import { useCallback, useRef, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  Button,
  TableFooter,
  FormControlLabel,
  Switch,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { useTheme } from '@mui/material/styles';
import { useAsyncTask, useScrollToLoad, pageSize } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import CollectionFab from './components/CollectionFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import SearchHeader from './components/SearchHeader';
import { formatAddress, formatStatus, formatTime } from '../common/util/formatter';
import { useDeviceReadonly, useManager } from '../common/util/permissions';
import { usePreference } from '../common/util/preferences';
import useSettingsStyles from './common/useSettingsStyles';
import DeviceUsersValue from './components/DeviceUsersValue';
import usePersistedState from '../common/util/usePersistedState';
import fetchOrThrow from '../common/util/fetchOrThrow';
import AddressValue from '../common/components/AddressValue';
import exportExcel from '../common/util/exportExcel';

const DevicesPage = () => {
  const { classes } = useSettingsStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();

  const groups = useSelector((state) => state.groups.items);

  const manager = useManager();
  const deviceReadonly = useDeviceReadonly();
  const coordinateFormat = usePreference('coordinateFormat');

  const positions = useSelector((state) => state.session.positions);

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showAll, setShowAll] = usePersistedState('showAllDevices', false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const importInputRef = useRef(null);

  const loadItems = useCallback(
    async (offset, signal) => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ all: showAll, limit: pageSize, offset });
        if (searchKeyword) {
          query.append('keyword', searchKeyword);
        }
        const response = await fetchOrThrow(`/api/devices?${query.toString()}`, { signal });
        const data = await response.json();
        setItems((previous) => (offset ? [...previous, ...data] : data));
        setHasMore(data.length >= pageSize);
      } finally {
        setLoading(false);
      }
    },
    [searchKeyword, showAll],
  );

  const sentinelRef = useScrollToLoad(() => loadItems(items.length));

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      setItems([]);
      await loadItems(0, signal);
    },
    [reloadKey, loadItems],
  );

  const handleExport = async () => {
    const data = items.map((item) => ({
      [t('sharedName')]: item.name,
      [t('deviceIdentifier')]: item.uniqueId,
      [t('groupParent')]: item.groupId ? groups[item.groupId]?.name : null,
      [t('sharedPhone')]: item.phone,
      [t('deviceModel')]: item.model,
      [t('deviceContact')]: item.contact,
      [t('userExpirationTime')]: formatTime(item.expirationTime, 'date'),
      [t('deviceStatus')]: formatStatus(item.status, t),
      [t('deviceLastUpdate')]: formatTime(item.lastUpdate, 'minutes'),
      [t('positionAddress')]: positions[item.id]
        ? formatAddress(positions[item.id], coordinateFormat)
        : '',
    }));
    const sheets = new Map();
    sheets.set(t('deviceTitle'), data);
    await exportExcel(t('deviceTitle'), 'devices.xlsx', sheets, theme);
  };
  const handleImport = async (event) => {
    const file = event.target.files[0];
    event.target.value = null;

    if (!file) {
      return;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      alert('CSV file is empty');
      return;
    }

    const headers = lines[0].split(',').map((header) => header.trim());
    const required = ['name', 'uniqueId'];

    if (!required.every((field) => headers.includes(field))) {
      alert('CSV must contain name and uniqueId columns');
      return;
    }

    const existingResponse = await fetchOrThrow('/api/devices?all=true');
    const existingDevices = await existingResponse.json();
    const existingUniqueIds = new Set(existingDevices.map((device) => device.uniqueId));
    const groupByName = new Map(Object.values(groups).map((group) => [group.name, group.id]));
    const csvUniqueIds = new Set();
    const getGroupId = async (groupName) => {
      if (!groupName) {
        return 0;
      }

      if (groupByName.has(groupName)) {
        return groupByName.get(groupName);
      }

      const response = await fetchOrThrow('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName }),
      });

      const group = await response.json();
      groupByName.set(group.name, group.id);
      return group.id;
    };

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const line of lines.slice(1)) {
      const values = line.split(',').map((value) => value.trim());
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));

      if (!row.name || !row.uniqueId) {
        failed += 1;
        errors.push(`${row.name || 'Unknown'}: missing name or uniqueId`);
        continue;
      }

      if (csvUniqueIds.has(row.uniqueId)) {
        skipped += 1;
        errors.push(`${row.name}: duplicate uniqueId in CSV (${row.uniqueId})`);
        continue;
      }

      csvUniqueIds.add(row.uniqueId);

      if (existingUniqueIds.has(row.uniqueId)) {
        skipped += 1;
        errors.push(`${row.name}: uniqueId already exists (${row.uniqueId})`);
        continue;
      }

      try {
        await fetchOrThrow('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            uniqueId: row.uniqueId,
            phone: row.phone || null,
            model: row.model || null,
            contact: row.contact || null,
            category: row.category || null,
            groupId: await getGroupId(row.group),
          }),
        });
        created += 1;
      } catch (error) {
        failed += 1;
        errors.push(`${row.name}: ${error.message}`);
      }
    }

    reload();
    alert(
      `Import completed. Created: ${created}. Skipped: ${skipped}. Failed: ${failed}${
        errors.length ? `\n\n${errors.join('\n')}` : ''
      }`,
    );
  };

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkIcon fontSize="small" />,
    handler: (deviceId) => navigate(`/settings/device/${deviceId}/connections`),
  };

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'deviceTitle']}>
      <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell>{t('deviceIdentifier')}</TableCell>
            <TableCell>{t('groupParent')}</TableCell>
            <TableCell>{t('sharedPhone')}</TableCell>
            <TableCell>{t('deviceModel')}</TableCell>
            <TableCell>{t('deviceContact')}</TableCell>
            <TableCell>{t('userExpirationTime')}</TableCell>
            <TableCell>{t('positionAddress')}</TableCell>
            {manager && <TableCell>{t('settingsUsers')}</TableCell>}
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.uniqueId}</TableCell>
              <TableCell>{item.groupId ? groups[item.groupId]?.name : null}</TableCell>
              <TableCell>{item.phone}</TableCell>
              <TableCell>{item.model}</TableCell>
              <TableCell>{item.contact}</TableCell>
              <TableCell>{formatTime(item.expirationTime, 'date')}</TableCell>
              <TableCell>
                {positions[item.id] && (
                  <AddressValue
                    latitude={positions[item.id].latitude}
                    longitude={positions[item.id].longitude}
                    originalAddress={positions[item.id]?.address}
                  />
                )}
              </TableCell>
              {manager && (
                <TableCell>
                  <DeviceUsersValue deviceId={item.id} />
                </TableCell>
              )}
              <TableCell className={classes.columnAction} padding="none">
                <CollectionActions
                  itemId={item.id}
                  editPath="/settings/device"
                  endpoint="devices"
                  onReload={reload}
                  customActions={[actionConnections]}
                  readonly={deviceReadonly}
                />
              </TableCell>
            </TableRow>
          ))}
          {loading && <TableShimmer columns={manager ? 9 : 8} endAction />}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={handleImport}
              />
              <Button
                onClick={() => importInputRef.current.click()}
                variant="text"
                disabled={deviceReadonly}
              >
                Import CSV
              </Button>
              <Button onClick={handleExport} variant="text">
                {t('reportExport')}
              </Button>
            </TableCell>
            <TableCell colSpan={manager ? 9 : 8} align="right">
              <FormControlLabel
                control={
                  <Switch
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                    size="small"
                  />
                }
                label={t('notificationAlways')}
                labelPlacement="start"
                disabled={!manager}
              />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      {hasMore && !loading && <div ref={sentinelRef} />}
      <CollectionFab editPath="/settings/device" />
    </PageLayout>
  );
};

export default DevicesPage;
