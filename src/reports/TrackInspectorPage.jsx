import { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PageLayout from '../common/components/PageLayout';
import PositionValue from '../common/components/PositionValue';
import { useTranslation } from '../common/components/LocalizationProvider';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import fetchOrThrow from '../common/util/fetchOrThrow';
import ReportFilter from './components/ReportFilter';
import ReportsMenu from './components/ReportsMenu';
import useReportStyles from './common/useReportStyles';

const normalizeTrackPacket = (position, index) => ({
  id: position.id,
  index,
  deviceId: position.deviceId,
  fixTime: position.fixTime,
  serverTime: position.serverTime,
  latitude: position.latitude,
  longitude: position.longitude,
  speed: position.speed,
  course: position.course,
  altitude: position.altitude,
  valid: position.valid,
  protocol: position.protocol,
  address: position.address,
  attributes: position.attributes || {},
  rawPosition: position,
});

const findAttribute = (packet, keys) => keys.find((key) => packet.attributes[key] != null);

const hasProperty = (position, key) => Object.prototype.hasOwnProperty.call(position, key);

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
    gridTemplateRows: 'minmax(260px, 38vh) minmax(280px, 1fr)',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 2, 2),
    minHeight: 0,
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
      gridTemplateRows: '260px minmax(280px, 1fr) minmax(220px, auto)',
    },
  },
  panel: {
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: theme.shape.borderRadius,
  },
  mapPanel: {
    gridColumn: '1 / 2',
  },
  tablePanel: {
    gridColumn: '1 / 2',
  },
  detailsPanel: {
    gridColumn: '2 / 3',
    gridRow: '1 / 3',
    [theme.breakpoints.down('lg')]: {
      gridColumn: '1 / 2',
      gridRow: 'auto',
    },
  },
  placeholder: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.hover,
  },
  tableContainer: {
    height: '100%',
  },
  details: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  detailsHeader: {
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  json: {
    margin: 0,
    padding: theme.spacing(2),
    overflow: 'auto',
    flexGrow: 1,
    fontSize: theme.typography.caption.fontSize,
    fontFamily: theme.typography.fontFamilyMonospaced,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  state: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

const TrackInspectorPage = () => {
  const reportClasses = useReportStyles().classes;
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const positionAttributes = usePositionAttributes(t);

  const [packets, setPackets] = useState([]);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const onShow = useCallback(async ({ deviceIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));

    setLoading(true);
    setError(null);
    setLoaded(false);
    try {
      const response = await fetchOrThrow(`/api/positions?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      const normalizedPackets = data.map(normalizeTrackPacket);
      setPackets(normalizedPackets);
      setSelectedPacket(normalizedPackets[0] || null);
      setLoaded(true);
    } catch (errorValue) {
      setPackets([]);
      setSelectedPacket(null);
      setError(errorValue.message || String(errorValue));
    } finally {
      setLoading(false);
    }
  }, []);

  const renderTableState = () => {
    if (loading) {
      return (
        <div className={classes.state}>
          <CircularProgress size={20} />
          <Typography variant="body2">{t('sharedLoading')}</Typography>
        </div>
      );
    }
    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }
    if (loaded && !packets.length) {
      return <Typography variant="body2">{t('sharedNoData')}</Typography>;
    }
    if (packets.length) {
      return (
        <Typography variant="body2">
          {t('trackInspectorPacketsLoaded').replace('{count}', packets.length)}
        </Typography>
      );
    }
    return <Typography variant="body2">{t('trackInspectorTablePlaceholder')}</Typography>;
  };

  const renderPositionValue = (packet, key) => (
    <PositionValue
      position={packet.rawPosition}
      property={hasProperty(packet.rawPosition, key) ? key : null}
      attribute={hasProperty(packet.rawPosition, key) ? null : key}
    />
  );

  const renderAttributeValue = (packet, keys) => {
    const key = findAttribute(packet, keys);
    return key ? <PositionValue position={packet.rawPosition} attribute={key} /> : '';
  };

  const renderPowerBattery = (packet) => {
    const keys = ['power', 'battery', 'batteryLevel'];
    return keys
      .filter((key) => packet.attributes[key] != null)
      .map((key) => (
        <div key={key}>
          {positionAttributes[key]?.name || key}: <PositionValue position={packet.rawPosition} attribute={key} />
        </div>
      ));
  };

  const renderPacketTable = () => {
    if (loading || error || !packets.length) {
      return <div className={classes.placeholder}>{renderTableState()}</div>;
    }

    return (
      <TableContainer className={classes.tableContainer}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>{positionAttributes.fixTime.name}</TableCell>
              <TableCell>{positionAttributes.serverTime.name}</TableCell>
              <TableCell>{positionAttributes.valid.name}</TableCell>
              <TableCell>{positionAttributes.speed.name}</TableCell>
              <TableCell>{positionAttributes.course.name}</TableCell>
              <TableCell>{t('trackInspectorCoordinates')}</TableCell>
              <TableCell>{positionAttributes.address.name}</TableCell>
              <TableCell>{positionAttributes.ignition.name}</TableCell>
              <TableCell>{positionAttributes.fuel.name}</TableCell>
              <TableCell>{t('trackInspectorPowerBattery')}</TableCell>
              <TableCell>{positionAttributes.odometer.name}</TableCell>
              <TableCell>{positionAttributes.protocol.name}</TableCell>
              <TableCell>{t('sharedAttributes')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {packets.map((packet) => (
              <TableRow
                key={packet.id}
                hover
                selected={selectedPacket?.id === packet.id}
                onClick={() => setSelectedPacket(packet)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>{packet.index + 1}</TableCell>
                <TableCell>{renderPositionValue(packet, 'fixTime')}</TableCell>
                <TableCell>{renderPositionValue(packet, 'serverTime')}</TableCell>
                <TableCell>{renderPositionValue(packet, 'valid')}</TableCell>
                <TableCell>{renderPositionValue(packet, 'speed')}</TableCell>
                <TableCell>{renderPositionValue(packet, 'course')}</TableCell>
                <TableCell>
                  {renderPositionValue(packet, 'latitude')}
                  <br />
                  {renderPositionValue(packet, 'longitude')}
                </TableCell>
                <TableCell>{renderPositionValue(packet, 'address')}</TableCell>
                <TableCell>{renderAttributeValue(packet, ['ignition'])}</TableCell>
                <TableCell>{renderAttributeValue(packet, ['fuel', 'fuel1', 'fuel2'])}</TableCell>
                <TableCell>{renderPowerBattery(packet)}</TableCell>
                <TableCell>{renderAttributeValue(packet, ['odometer', 'totalDistance'])}</TableCell>
                <TableCell>{renderPositionValue(packet, 'protocol')}</TableCell>
                <TableCell>{Object.keys(packet.attributes).length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderPacketDetails = () => {
    if (!selectedPacket) {
      return (
        <div className={classes.placeholder}>
          <Typography variant="body2">{t('trackInspectorDetailsPlaceholder')}</Typography>
        </div>
      );
    }

    return (
      <div className={classes.details}>
        <div className={classes.detailsHeader}>
          <Typography variant="subtitle2">
            #{selectedPacket.index + 1} / {selectedPacket.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedPacket.fixTime}
          </Typography>
        </div>
        <pre className={classes.json}>
          {JSON.stringify(
            {
              attributes: selectedPacket.attributes,
              rawPosition: selectedPacket.rawPosition,
            },
            null,
            2,
          )}
        </pre>
      </div>
    );
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTrackInspector']}>
      <div className={reportClasses.container}>
        <div className={reportClasses.header}>
          <ReportFilter deviceType="single" loading={loading} onShow={onShow} />
        </div>
        <Box className={classes.content}>
          <Paper className={cx(classes.panel, classes.mapPanel)} variant="outlined">
            <div className={classes.placeholder}>
              <Typography variant="body2">
                {packets.length ? t('trackInspectorMapLoaded') : t('trackInspectorMapPlaceholder')}
              </Typography>
            </div>
          </Paper>
          <Paper className={cx(classes.panel, classes.tablePanel)} variant="outlined">
            {renderPacketTable()}
          </Paper>
          <Paper className={cx(classes.panel, classes.detailsPanel)} variant="outlined">
            {renderPacketDetails()}
          </Paper>
        </Box>
      </div>
    </PageLayout>
  );
};

export default TrackInspectorPage;
