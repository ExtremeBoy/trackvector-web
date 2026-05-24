import { useCallback, useEffect, useRef, useReducer, useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  Stack,
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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importSummary, setImportSummary] = useState({
    willCreate: 0,
    willSkip: 0,
    failedInvalid: 0,
    groupsToCreate: 0,
  });
  const [importing, setImporting] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteProcessing, setDeleteProcessing] = useState(false);
  const [bulkGroupDialogOpen, setBulkGroupDialogOpen] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState(0);
  const [bulkUpdating, setBulkUpdating] = useState(false);

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
  useEffect(() => {
    setSelectedDeviceIds((previous) =>
      previous.filter((id) => items.some((item) => item.id === id)),
    );
  }, [items]);

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
  const parseCsvText = (text) => text.split(/\r?\n/).filter((line) => line.trim());

  const parseCsvHeaders = (headerLine) => headerLine.split(',').map((header) => header.trim());

  const parseCsvRow = (headers, line) => {
    const values = line.split(',').map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    event.target.value = null;

    if (!file) {
      return;
    }

    const text = await file.text();
    const lines = parseCsvText(text);

    if (lines.length < 2) {
      alert('CSV file is empty');
      return;
    }

    const headers = parseCsvHeaders(lines[0]);
    const required = ['name', 'uniqueId'];

    if (!required.every((field) => headers.includes(field))) {
      alert('CSV must contain name and uniqueId columns');
      return;
    }

    const existingResponse = await fetchOrThrow('/api/devices?all=true');
    const existingDevices = await existingResponse.json();
    const existingUniqueIds = new Set(existingDevices.map((device) => device.uniqueId));
    const existingGroupNames = new Set(Object.values(groups).map((group) => group.name));
    const csvUniqueIds = new Set();
    const groupsToCreate = new Set();

    const rows = lines
      .slice(1)
      .map((line) => parseCsvRow(headers, line))
      .map((row) => {
        if (!row.name || !row.uniqueId) {
          return { ...row, status: 'invalid', reason: 'missing name or uniqueId' };
        }
        if (csvUniqueIds.has(row.uniqueId)) {
          return { ...row, status: 'skip', reason: `duplicate uniqueId in CSV (${row.uniqueId})` };
        }
        csvUniqueIds.add(row.uniqueId);
        if (existingUniqueIds.has(row.uniqueId)) {
          return { ...row, status: 'skip', reason: `uniqueId already exists (${row.uniqueId})` };
        }
        if (row.group && !existingGroupNames.has(row.group)) {
          groupsToCreate.add(row.group);
        }
        return { ...row, status: 'create', reason: 'will be created' };
      });

    setImportRows(rows);
    setImportSummary({
      willCreate: rows.filter((row) => row.status === 'create').length,
      willSkip: rows.filter((row) => row.status === 'skip').length,
      failedInvalid: rows.filter((row) => row.status === 'invalid').length,
      groupsToCreate: groupsToCreate.size,
    });
    setImportDialogOpen(true);
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    const groupByName = new Map(Object.values(groups).map((group) => [group.name, group.id]));
    const getGroupId = async (groupName) => {
      if (!groupName) return 0;
      if (groupByName.has(groupName)) return groupByName.get(groupName);
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

    for (const row of importRows) {
      if (row.status !== 'create') {
        if (row.status === 'invalid') {
          failed += 1;
        } else {
          skipped += 1;
        }
        errors.push(`${row.name || 'Unknown'}: ${row.reason}`);
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
    setImporting(false);
    setImportDialogOpen(false);
    setImportRows([]);
    reload();
    alert(
      `Import completed. Created: ${created}. Skipped: ${skipped}. Failed: ${failed}${errors.length ? `\n\n${errors.join('\n')}` : ''}`,
    );
  };

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkIcon fontSize="small" />,
    handler: (deviceId) => navigate(`/settings/device/${deviceId}/connections`),
  };

  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedDeviceIds.includes(item.id));
  const partiallySelected = selectedDeviceIds.length > 0 && !allVisibleSelected;
  const selectedCount = selectedDeviceIds.length;

  const handleToggleSelectAllVisible = (event) => {
    if (event.target.checked) {
      setSelectedDeviceIds(items.map((item) => item.id));
    } else {
      setSelectedDeviceIds([]);
    }
  };

  const handleToggleSelectOne = (deviceId) => {
    setSelectedDeviceIds((previous) =>
      previous.includes(deviceId)
        ? previous.filter((id) => id !== deviceId)
        : [...previous, deviceId],
    );
  };

  const handleBulkDelete = async () => {
    setDeleteProcessing(true);
    const results = await Promise.allSettled(
      selectedDeviceIds.map((deviceId) =>
        fetchOrThrow(`/api/devices/${deviceId}`, { method: 'DELETE' }),
      ),
    );
    const deleted = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - deleted;
    setDeleteProcessing(false);
    setDeleteDialogOpen(false);
    setSelectedDeviceIds([]);
    reload();
    alert(`Bulk delete completed. Deleted: ${deleted}. Failed: ${failed}`);
  };

  const handleBulkChangeGroup = async () => {
    setBulkUpdating(true);
    const selectedDevices = items.filter((item) => selectedDeviceIds.includes(item.id));
    const results = await Promise.allSettled(
      selectedDevices.map((device) =>
        fetchOrThrow(`/api/devices/${device.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...device, groupId: bulkGroupId }),
        }),
      ),
    );
    const updated = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - updated;
    setBulkUpdating(false);
    setBulkGroupDialogOpen(false);
    setSelectedDeviceIds([]);
    reload();
    alert(`Bulk group update completed. Updated: ${updated}. Failed: ${failed}`);
  };

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'deviceTitle']}>
      <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />
      <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
        <Table
          className={classes.table}
          sx={{ width: '100%', minWidth: 840, tableLayout: 'fixed' }}
        >
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: 150 }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: 120 }} />
            <col style={{ width: '19%' }} />
            {manager && <col style={{ width: '8%' }} />}
            <col style={{ width: 112 }} />
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 52, minWidth: 52, maxWidth: 52 }} padding="checkbox">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={partiallySelected}
                  onChange={handleToggleSelectAllVisible}
                />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('sharedName')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('deviceIdentifier')}</TableCell>
              <TableCell>{t('groupParent')}</TableCell>
              <TableCell>{t('sharedPhone')}</TableCell>
              <TableCell>{t('deviceModel')}</TableCell>
              <TableCell>{t('deviceContact')}</TableCell>
              <TableCell>{t('userExpirationTime')}</TableCell>
              <TableCell>{t('positionAddress')}</TableCell>
              {manager && <TableCell>{t('settingsUsers')}</TableCell>}
              <TableCell
                className={classes.columnAction}
                sx={{ width: 112, minWidth: 112, maxWidth: 112 }}
              />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell sx={{ width: 52, minWidth: 52, maxWidth: 52 }} padding="checkbox">
                  <Checkbox
                    checked={selectedDeviceIds.includes(item.id)}
                    onChange={() => handleToggleSelectOne(item.id)}
                  />
                </TableCell>
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
                <TableCell
                  className={classes.columnAction}
                  padding="none"
                  sx={{ width: 112, minWidth: 112, maxWidth: 112, whiteSpace: 'nowrap' }}
                >
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
                <Stack spacing={1} sx={{ py: 0.5 }}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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
                      size="small"
                      sx={{ whiteSpace: 'nowrap', minWidth: 125 }}
                    >
                      Import CSV
                    </Button>
                    <Button
                      onClick={handleExport}
                      variant="text"
                      size="small"
                      sx={{ whiteSpace: 'nowrap', minWidth: 125 }}
                    >
                      {t('reportExport')}
                    </Button>
                  </Stack>
                  {selectedCount > 0 && (
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                    >
                      <Box sx={{ fontSize: 14, color: 'text.secondary', mr: { sm: 1 } }}>
                        Selected: {selectedCount}
                      </Box>
                      {!deviceReadonly && (
                        <>
                          <Button
                            onClick={() => setDeleteDialogOpen(true)}
                            variant="outlined"
                            color="error"
                            size="small"
                            sx={{ whiteSpace: 'nowrap', minWidth: 110 }}
                          >
                            Delete selected
                          </Button>
                          <Button
                            onClick={() => setBulkGroupDialogOpen(true)}
                            variant="outlined"
                            size="small"
                            sx={{ whiteSpace: 'nowrap', minWidth: 110 }}
                          >
                            Change group
                          </Button>
                        </>
                      )}
                      <Button
                        onClick={() => setSelectedDeviceIds([])}
                        variant="text"
                        size="small"
                        sx={{ whiteSpace: 'nowrap', minWidth: 110 }}
                      >
                        Clear selection
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </TableCell>
              <TableCell colSpan={manager ? 10 : 9} align="right">
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
      </Box>
      {hasMore && !loading && <div ref={sentinelRef} />}
      <CollectionFab editPath="/settings/device" />
      <Dialog
        open={importDialogOpen}
        onClose={() => !importing && setImportDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>CSV Import Preview</DialogTitle>
        <DialogContent>
          <div>Will create: {importSummary.willCreate}</div>
          <div>Will skip: {importSummary.willSkip}</div>
          <div>Failed/invalid: {importSummary.failedInvalid}</div>
          <div>Groups to create: {importSummary.groupsToCreate}</div>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>name</TableCell>
                <TableCell>uniqueId</TableCell>
                <TableCell>model</TableCell>
                <TableCell>category</TableCell>
                <TableCell>phone</TableCell>
                <TableCell>contact</TableCell>
                <TableCell>group</TableCell>
                <TableCell>status/reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {importRows.map((row, index) => (
                <TableRow key={`${row.uniqueId || 'missing'}-${index}`}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.uniqueId}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.contact}</TableCell>
                  <TableCell>{row.group}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={`${row.status}: ${row.reason}`}
                      color={
                        row.status === 'create'
                          ? 'success'
                          : row.status === 'skip'
                            ? 'warning'
                            : 'error'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmImport}
            disabled={importing || importSummary.willCreate === 0}
            variant="contained"
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteProcessing && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete selected devices</DialogTitle>
        <DialogContent>Delete {selectedCount} selected devices?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkDelete}
            color="error"
            variant="contained"
            disabled={deleteProcessing}
          >
            {deleteProcessing ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={bulkGroupDialogOpen}
        onClose={() => !bulkUpdating && setBulkGroupDialogOpen(false)}
      >
        <DialogTitle>Change group for selected devices</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, minWidth: 260 }}>
            <InputLabel id="bulk-group-select-label">Group</InputLabel>
            <Select
              labelId="bulk-group-select-label"
              value={bulkGroupId}
              label="Group"
              onChange={(event) => setBulkGroupId(Number(event.target.value))}
            >
              <MenuItem value={0}>No group</MenuItem>
              {Object.values(groups).map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* TODO: Add optional bulk updates for category/model/contact with explicit per-field opt-in checkboxes. */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkGroupDialogOpen(false)} disabled={bulkUpdating}>
            Cancel
          </Button>
          <Button onClick={handleBulkChangeGroup} variant="contained" disabled={bulkUpdating}>
            {bulkUpdating ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

export default DevicesPage;
