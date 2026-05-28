import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { List } from 'react-window';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { makeStyles } from 'tss-react/mui';
import PageLayout from '../common/components/PageLayout';
import PositionValue from '../common/components/PositionValue';
import { useTranslation } from '../common/components/LocalizationProvider';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import fetchOrThrow from '../common/util/fetchOrThrow';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositions from '../map/MapPositions';
import MapCamera from '../map/MapCamera';
import MapScale from '../map/MapScale';
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

const diagnosticFilters = [
  'all',
  'anomalies',
  'fuelEvents',
  'invalidGps',
  'ignitionChanges',
  'powerIssues',
];

const firstNumber = (attributes, keys) => {
  const key = keys.find((item) => Number.isFinite(Number(attributes[item])));
  return key ? Number(attributes[key]) : null;
};

const firstBoolean = (attributes, keys) => {
  const key = keys.find((item) => attributes[item] != null);
  if (!key) {
    return null;
  }
  const value = attributes[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }
  return ['true', '1', 'on', 'yes'].includes(String(value).toLowerCase());
};

const distanceMeters = (start, end) => {
  if (
    !Number.isFinite(start.latitude) ||
    !Number.isFinite(start.longitude) ||
    !Number.isFinite(end.latitude) ||
    !Number.isFinite(end.longitude)
  ) {
    return 0;
  }
  const toRadians = (value) => (value * Math.PI) / 180;
  const radius = 6371000;
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);
  const deltaLat = toRadians(end.latitude - start.latitude);
  const deltaLon = toRadians(end.longitude - start.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const enrichDiagnostics = (packets) => {
  const result = [];
  packets.forEach((packet, index) => {
    const previous = index > 0 ? result[index - 1] : null;
    const ignition = firstBoolean(packet.attributes, ['ignition']);
    const fuel = firstNumber(packet.attributes, ['fuel', 'fuel1', 'fuel2']);
    const power = firstNumber(packet.attributes, ['power']);
    const battery = firstNumber(packet.attributes, ['battery', 'batteryLevel']);
    const odometer = firstNumber(packet.attributes, ['odometer', 'totalDistance']);
    const validGPS =
      packet.valid === true &&
      Number.isFinite(packet.latitude) &&
      Number.isFinite(packet.longitude) &&
      Math.abs(packet.latitude) <= 90 &&
      Math.abs(packet.longitude) <= 180;

    const previousFuel = previous?.diagnostics.fuel;
    const previousPower = previous?.diagnostics.power;
    const previousIgnition = previous?.diagnostics.ignition;
    const previousOdometer = previous?.diagnostics.odometer;
    const deltaFuel = fuel != null && previousFuel != null ? fuel - previousFuel : null;
    const deltaTime =
      previous && packet.fixTime && previous.fixTime
        ? (new Date(packet.fixTime).getTime() - new Date(previous.fixTime).getTime()) / 1000
        : null;
    const gpsDistance = previous ? distanceMeters(previous, packet) : null;
    const deltaDistance =
      odometer != null && previousOdometer != null ? odometer - previousOdometer : gpsDistance;
    const fuelChangeRate =
      deltaFuel != null && deltaTime > 0 ? (deltaFuel / deltaTime) * 3600 : null;
    const jumpSpeed = gpsDistance != null && deltaTime > 0 ? (gpsDistance / deltaTime) * 3.6 : 0;
    const possibleDrain = deltaFuel != null && deltaFuel < -5;
    const possibleRefuel = deltaFuel != null && deltaFuel > 5;
    const gpsJump = validGPS && previous?.diagnostics.validGPS && jumpSpeed > 200;
    const powerLoss = previousPower != null && previousPower > 5 && power != null && power <= 1;
    const ignitionChange =
      previousIgnition != null && ignition != null && previousIgnition !== ignition;

    result.push({
      ...packet,
      diagnostics: {
        ignition,
        fuel,
        power,
        battery,
        odometer,
        validGPS,
        deltaFuel,
        deltaDistance,
        deltaTime,
        fuelChangeRate,
        possibleDrain,
        possibleRefuel,
        gpsJump,
        powerLoss,
        ignitionChange,
      },
    });
  });
  return result;
};

const hasAnomaly = (packet) =>
  packet.diagnostics.possibleDrain ||
  packet.diagnostics.possibleRefuel ||
  packet.diagnostics.gpsJump ||
  packet.diagnostics.powerLoss ||
  !packet.diagnostics.validGPS;

const matchesDiagnosticFilter = (packet, filter) => {
  switch (filter) {
    case 'anomalies':
      return hasAnomaly(packet);
    case 'fuelEvents':
      return packet.diagnostics.possibleDrain || packet.diagnostics.possibleRefuel;
    case 'invalidGps':
      return !packet.diagnostics.validGPS;
    case 'ignitionChanges':
      return packet.diagnostics.ignitionChange;
    case 'powerIssues':
      return packet.diagnostics.powerLoss;
    default:
      return true;
  }
};

const tableColumns = [
  { id: 'index', width: 64 },
  { id: 'fixTime', width: 170 },
  { id: 'serverTime', width: 170 },
  { id: 'valid', width: 90 },
  { id: 'speed', width: 110 },
  { id: 'course', width: 90 },
  { id: 'coordinates', width: 150 },
  { id: 'address', width: 260 },
  { id: 'ignition', width: 110 },
  { id: 'fuel', width: 110 },
  { id: 'powerBattery', width: 170 },
  { id: 'odometer', width: 130 },
  { id: 'protocol', width: 120 },
  { id: 'attributes', width: 100 },
  { id: 'diagnostics', width: 220 },
];

const gridTemplateColumns = tableColumns.map((column) => `${column.width}px`).join(' ');

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
    gridTemplateRows: 'minmax(260px, 34vh) minmax(260px, 1fr) minmax(280px, 34vh)',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 2, 2),
    minHeight: 0,
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
      gridTemplateRows: '260px minmax(280px, 1fr) minmax(280px, auto) minmax(220px, auto)',
    },
  },
  panel: {
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: theme.shape.borderRadius,
  },
  mapPanel: {
    gridColumn: '1 / 2',
    position: 'relative',
  },
  tablePanel: {
    gridColumn: '1 / 2',
  },
  detailsPanel: {
    gridColumn: '2 / 3',
    gridRow: '1 / 4',
    [theme.breakpoints.down('lg')]: {
      gridColumn: '1 / 2',
      gridRow: 'auto',
    },
  },
  chartsPanel: {
    gridColumn: '1 / 2',
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
    overflowX: 'auto',
  },
  virtualTable: {
    minWidth: tableColumns.reduce((sum, column) => sum + column.width, 0),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  virtualHeader: {
    display: 'grid',
    gridTemplateColumns,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  virtualList: {
    flexGrow: 1,
    minHeight: 0,
  },
  virtualRow: {
    display: 'grid',
    gridTemplateColumns,
    alignItems: 'center',
    borderBottom: `1px solid ${theme.palette.divider}`,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  virtualRowSelected: {
    backgroundColor: theme.palette.action.selected,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  virtualCell: {
    minWidth: 0,
    padding: theme.spacing(0.5, 1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: theme.typography.body2.fontSize,
  },
  virtualCellMultiline: {
    whiteSpace: 'normal',
    lineHeight: 1.25,
  },
  mapAction: {
    position: 'absolute',
    zIndex: 1,
    top: theme.spacing(1),
    left: theme.spacing(1),
  },
  charts: {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  chart: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  chartTitle: {
    padding: theme.spacing(0, 1),
  },
  chartBody: {
    flexGrow: 1,
    minHeight: 0,
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
  const listRef = useRef(null);

  const [packets, setPackets] = useState([]);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [cameraTarget, setCameraTarget] = useState({ type: 'track', version: 0 });
  const [diagnosticFilter, setDiagnosticFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const filteredPackets = useMemo(
    () => packets.filter((packet) => matchesDiagnosticFilter(packet, diagnosticFilter)),
    [packets, diagnosticFilter],
  );

  const chartData = useMemo(
    () =>
      packets.map((packet) => ({
        packetId: packet.id,
        index: packet.index,
        fixTime: packet.fixTime,
        speed: packet.speed,
        fuel: packet.diagnostics.fuel,
        power: packet.diagnostics.power,
        battery: packet.diagnostics.battery,
        ignition: packet.diagnostics.ignition == null ? null : Number(packet.diagnostics.ignition),
      })),
    [packets],
  );

  const columnLabels = useMemo(
    () => ({
      index: '#',
      fixTime: positionAttributes.fixTime.name,
      serverTime: positionAttributes.serverTime.name,
      valid: positionAttributes.valid.name,
      speed: positionAttributes.speed.name,
      course: positionAttributes.course.name,
      coordinates: t('trackInspectorCoordinates'),
      address: positionAttributes.address.name,
      ignition: positionAttributes.ignition.name,
      fuel: positionAttributes.fuel.name,
      powerBattery: t('trackInspectorPowerBattery'),
      odometer: positionAttributes.odometer.name,
      protocol: positionAttributes.protocol.name,
      attributes: t('sharedAttributes'),
      diagnostics: t('trackInspectorDiagnostics'),
    }),
    [positionAttributes, t],
  );

  useEffect(() => {
    if (selectedPacket) {
      const visibleIndex = filteredPackets.findIndex((packet) => packet.id === selectedPacket.id);
      if (visibleIndex < 0) {
        return;
      }
      listRef.current?.scrollToRow({
        index: visibleIndex,
        align: 'smart',
        behavior: 'auto',
      });
    }
  }, [filteredPackets, selectedPacket]);

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
      const normalizedPackets = enrichDiagnostics(data.map(normalizeTrackPacket));
      setPackets(normalizedPackets);
      setSelectedPacket(normalizedPackets[0] || null);
      setCameraTarget((previous) => ({ type: 'track', version: previous.version + 1 }));
      setLoaded(true);
    } catch (errorValue) {
      setPackets([]);
      setSelectedPacket(null);
      setError(errorValue.message || String(errorValue));
    } finally {
      setLoading(false);
    }
  }, []);

  const selectPacket = useCallback((packet, focusMap = true) => {
    setSelectedPacket(packet);
    if (packet && focusMap) {
      setCameraTarget((previous) => ({
        type: 'packet',
        id: packet.id,
        version: previous.version + 1,
      }));
    }
  }, []);

  const onMapPointClick = useCallback(
    (positionId) => {
      const packet = packets.find((item) => item.id === positionId);
      if (packet) {
        selectPacket(packet, false);
      }
    },
    [packets, selectPacket],
  );

  const fitToTrack = useCallback(() => {
    setCameraTarget((previous) => ({ type: 'track', version: previous.version + 1 }));
  }, []);

  const selectChartPacket = useCallback(
    (event) => {
      const packetId = event?.activePayload?.[0]?.payload?.packetId;
      const packet = packets.find((item) => item.id === packetId);
      if (packet) {
        selectPacket(packet);
      }
    },
    [packets, selectPacket],
  );

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
    if (loaded && packets.length && !filteredPackets.length) {
      return <Typography variant="body2">{t('trackInspectorNoFilteredPackets')}</Typography>;
    }
    if (packets.length) {
      return (
        <Typography variant="body2">
          {t('trackInspectorPacketsLoaded')
            .replace('{count}', filteredPackets.length)
            .replace('{total}', packets.length)}
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

  const renderDiagnosticSummary = (packet) => {
    const diagnostics = packet.diagnostics;
    const items = [];
    if (!diagnostics.validGPS) {
      items.push(t('trackInspectorInvalidGps'));
    }
    if (diagnostics.gpsJump) {
      items.push(t('trackInspectorGpsJump'));
    }
    if (diagnostics.possibleDrain) {
      items.push(t('trackInspectorPossibleDrain'));
    }
    if (diagnostics.possibleRefuel) {
      items.push(t('trackInspectorPossibleRefuel'));
    }
    if (diagnostics.powerLoss) {
      items.push(t('trackInspectorPowerLoss'));
    }
    if (diagnostics.ignitionChange) {
      items.push(t('trackInspectorIgnitionChange'));
    }
    if (items.length) {
      return items.join(', ');
    }
    return t('trackInspectorNoIssues');
  };

  const renderPacketCell = (packet, columnId) => {
    switch (columnId) {
      case 'index':
        return packet.index + 1;
      case 'fixTime':
      case 'serverTime':
      case 'valid':
      case 'speed':
      case 'course':
      case 'address':
      case 'protocol':
        return renderPositionValue(packet, columnId);
      case 'coordinates':
        return (
          <>
            {renderPositionValue(packet, 'latitude')}
            <br />
            {renderPositionValue(packet, 'longitude')}
          </>
        );
      case 'ignition':
        return renderAttributeValue(packet, ['ignition']);
      case 'fuel':
        return renderAttributeValue(packet, ['fuel', 'fuel1', 'fuel2']);
      case 'powerBattery':
        return renderPowerBattery(packet);
      case 'odometer':
        return renderAttributeValue(packet, ['odometer', 'totalDistance']);
      case 'attributes':
        return Object.keys(packet.attributes).length;
      case 'diagnostics':
        return renderDiagnosticSummary(packet);
      default:
        return '';
    }
  };

  const PacketRow = ({ index, style, packets, selectedId, selectPacket }) => {
    const packet = packets[index];
    return (
      <div
        className={cx(classes.virtualRow, selectedId === packet.id && classes.virtualRowSelected)}
        style={style}
        role="row"
        onClick={() => selectPacket(packet)}
      >
        {tableColumns.map((column) => (
          <div
            key={column.id}
            className={cx(
              classes.virtualCell,
              (column.id === 'coordinates' ||
                column.id === 'powerBattery' ||
                column.id === 'diagnostics') &&
                classes.virtualCellMultiline,
            )}
            role="cell"
            title={
              column.id === 'address'
                ? packet.address || ''
                : column.id === 'diagnostics'
                  ? renderDiagnosticSummary(packet)
                  : undefined
            }
          >
            {renderPacketCell(packet, column.id)}
          </div>
        ))}
      </div>
    );
  };

  const renderPacketTable = () => {
    if (loading || error || !packets.length || !filteredPackets.length) {
      return <div className={classes.placeholder}>{renderTableState()}</div>;
    }

    return (
      <div className={classes.tableContainer}>
        <div className={classes.virtualTable} role="grid">
          <div className={classes.virtualHeader} role="row">
            {tableColumns.map((column) => (
              <div className={classes.virtualCell} key={column.id} role="columnheader">
                <strong>{columnLabels[column.id]}</strong>
              </div>
            ))}
          </div>
          <List
            className={classes.virtualList}
            listRef={listRef}
            rowComponent={PacketRow}
            rowCount={filteredPackets.length}
            rowHeight={52}
            rowProps={{
              packets: filteredPackets,
              selectedId: selectedPacket?.id,
              selectPacket,
            }}
            overscanCount={10}
          />
        </div>
      </div>
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
              diagnostics: selectedPacket.diagnostics,
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

  const renderMap = () => {
    if (!packets.length) {
      return (
        <div className={classes.placeholder}>
          <Typography variant="body2">{t('trackInspectorMapPlaceholder')}</Typography>
        </div>
      );
    }

    const positions = packets.map((packet) => packet.rawPosition);

    return (
      <>
        <Button
          className={classes.mapAction}
          size="small"
          variant="contained"
          startIcon={<MyLocationIcon />}
          onClick={fitToTrack}
        >
          {t('trackInspectorFitTrack')}
        </Button>
        <MapView>
          {[...new Set(positions.map((position) => position.deviceId))].map((deviceId) => {
            const devicePositions = positions.filter((position) => position.deviceId === deviceId);
            return (
              <Fragment key={deviceId}>
                <MapRoutePath positions={devicePositions} />
                <MapRoutePoints positions={devicePositions} onClick={onMapPointClick} />
              </Fragment>
            );
          })}
          {selectedPacket && (
            <MapPositions positions={[selectedPacket.rawPosition]} titleField="fixTime" />
          )}
          {cameraTarget.type === 'track' ? (
            <MapCamera key={`track-${cameraTarget.version}`} positions={positions} />
          ) : (
            selectedPacket && (
              <MapCamera
                key={`packet-${cameraTarget.id}-${cameraTarget.version}`}
                latitude={selectedPacket.latitude}
                longitude={selectedPacket.longitude}
              />
            )
          )}
          <MapScale />
        </MapView>
      </>
    );
  };

  const renderChart = (title, children) => (
    <div className={classes.chart}>
      <Typography className={classes.chartTitle} variant="subtitle2">
        {title}
      </Typography>
      <div className={classes.chartBody}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} onClick={selectChartPacket}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="index" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={42} />
            <Tooltip labelFormatter={(value) => chartData[value]?.fixTime || value} />
            {children}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderCharts = () => {
    if (!packets.length) {
      return (
        <div className={classes.placeholder}>
          <Typography variant="body2">{t('trackInspectorChartsPlaceholder')}</Typography>
        </div>
      );
    }

    return (
      <div className={classes.charts}>
        {renderChart(
          t('trackInspectorSpeedChart'),
          <Line key="speed" type="monotone" dataKey="speed" dot={false} stroke="#1976d2" />,
        )}
        {renderChart(
          t('trackInspectorFuelChart'),
          <Line key="fuel" type="monotone" dataKey="fuel" dot={false} stroke="#2e7d32" />,
        )}
        {renderChart(
          t('trackInspectorPowerChart'),
          <>
            <Line type="monotone" dataKey="power" dot={false} stroke="#ed6c02" />
            <Line type="monotone" dataKey="battery" dot={false} stroke="#9c27b0" />
          </>,
        )}
        {renderChart(
          t('trackInspectorIgnitionChart'),
          <Line key="ignition" type="stepAfter" dataKey="ignition" dot={false} stroke="#d32f2f" />,
        )}
      </div>
    );
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTrackInspector']}>
      <div className={reportClasses.container}>
        <div className={reportClasses.header}>
          <ReportFilter deviceType="single" loading={loading} onShow={onShow}>
            <div className={reportClasses.filterItem}>
              <ToggleButtonGroup
                value={diagnosticFilter}
                exclusive
                size="small"
                onChange={(event, value) => value && setDiagnosticFilter(value)}
                fullWidth
              >
                {diagnosticFilters.map((filter) => (
                  <ToggleButton key={filter} value={filter}>
                    <Typography variant="button" noWrap>
                      {t(`trackInspectorFilter${filter[0].toUpperCase()}${filter.slice(1)}`)}
                    </Typography>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </div>
          </ReportFilter>
        </div>
        <Box className={classes.content}>
          <Paper className={cx(classes.panel, classes.mapPanel)} variant="outlined">
            {renderMap()}
          </Paper>
          <Paper className={cx(classes.panel, classes.tablePanel)} variant="outlined">
            {renderPacketTable()}
          </Paper>
          <Paper className={cx(classes.panel, classes.chartsPanel)} variant="outlined">
            {renderCharts()}
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
