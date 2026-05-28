import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Slider,
  Snackbar,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSelector } from 'react-redux';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import FilterListIcon from '@mui/icons-material/FilterList';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import { List } from 'react-window';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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

const replaySpeeds = [1, 5, 10, 25, 50];
const mobileTabs = ['map', 'packets', 'details', 'charts'];
const chartTabs = ['speed', 'fuel', 'power', 'ignition', 'all'];

const copyToClipboard = async (value) => {
  let clipboardError;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (!document.execCommand('copy')) {
      throw new Error('document.execCommand("copy") returned false');
    }
  } catch (fallbackError) {
    console.warn('Track Inspector summary copy failed', {
      clipboardError,
      fallbackError,
    });
    throw fallbackError;
  } finally {
    document.body.removeChild(textArea);
  }
};

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
  { id: 'address', width: 320 },
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
  shell: {
    background: 'linear-gradient(180deg, #0f1720 0%, #111827 42%, #151b22 100%)',
    color: '#d9e2ec',
  },
  toolbarHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 4,
    backgroundColor: '#111820',
    borderBottom: '1px solid rgba(148, 163, 184, 0.22)',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.24)',
    '& > div': {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    },
    '& > div > div': {
      flex: '0 1 210px',
    },
    '& .MuiInputBase-root, & .MuiButton-root, & .MuiIconButton-root': {
      height: 42,
    },
    '& .MuiInputBase-root': {
      color: '#e5eef8',
      backgroundColor: 'rgba(15, 23, 32, 0.88)',
    },
    '& .MuiInputLabel-root': {
      color: '#93a4b7',
      transform: 'translate(14px, 10px) scale(1)',
    },
    '& .MuiInputLabel-shrink': {
      transform: 'translate(14px, -8px) scale(0.75)',
    },
    '& .MuiSelect-select, & .MuiInputBase-input': {
      paddingTop: 9,
      paddingBottom: 9,
    },
    '& > div > div:last-child': {
      order: 4,
      flex: '0 0 auto',
    },
    '& > div > div:last-child .MuiButton-root': {
      minWidth: 118,
      color: '#04130b',
      border: 0,
      backgroundColor: '#22c55e',
      boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.26), 0 8px 18px rgba(34, 197, 94, 0.18)',
      '&:hover': {
        backgroundColor: '#16a34a',
      },
      '&.Mui-disabled': {
        color: 'rgba(226, 232, 240, 0.38)',
        backgroundColor: 'rgba(34, 197, 94, 0.18)',
      },
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(148, 163, 184, 0.24)',
    },
  },
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 7fr) minmax(320px, 3fr)',
    gridTemplateRows: 'minmax(380px, 44vh) minmax(280px, 30vh) minmax(320px, 38vh)',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.25),
    minHeight: 0,
    overflow: 'auto',
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
      gridTemplateRows: '320px minmax(280px, 1fr) minmax(280px, auto) minmax(260px, auto)',
    },
  },
  panel: {
    minHeight: 0,
    overflow: 'hidden',
    borderRadius: 6,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(15, 23, 32, 0.92)',
    color: '#d9e2ec',
  },
  mapPanel: {
    gridColumn: '1 / 2',
    position: 'relative',
    boxShadow: 'inset 0 0 0 1px rgba(34, 197, 94, 0.05)',
  },
  tablePanel: {
    gridColumn: '1 / 2',
    minHeight: 280,
  },
  detailsPanel: {
    gridColumn: '2 / 3',
    gridRow: '1 / 4',
    position: 'sticky',
    top: theme.spacing(1.25),
    alignSelf: 'start',
    height: 'calc(100vh - 118px)',
    [theme.breakpoints.down('lg')]: {
      gridColumn: '1 / 2',
      gridRow: 'auto',
      position: 'static',
      height: 'auto',
    },
  },
  chartsPanel: {
    gridColumn: '1 / 2',
  },
  mobileHidden: {
    [theme.breakpoints.down('lg')]: {
      display: 'none',
    },
  },
  placeholder: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
    color: '#91a3b7',
    backgroundColor: 'rgba(15, 23, 32, 0.82)',
  },
  tableContainer: {
    height: '100%',
    overflowX: 'scroll',
    overflowY: 'hidden',
    backgroundColor: '#101820',
    scrollbarWidth: 'thin',
    scrollbarColor: '#64748b #111820',
    '&::-webkit-scrollbar': {
      width: 10,
      height: 10,
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: '#111820',
    },
    '&::-webkit-scrollbar-thumb': {
      borderRadius: 6,
      backgroundColor: '#64748b',
    },
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
    backgroundColor: '#182331',
    borderBottom: '1px solid rgba(148, 163, 184, 0.24)',
    color: '#93c5fd',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  virtualList: {
    flexGrow: 1,
    minHeight: 0,
    scrollbarWidth: 'thin',
    scrollbarColor: '#64748b #101820',
    '&::-webkit-scrollbar': {
      width: 10,
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: '#101820',
    },
    '&::-webkit-scrollbar-thumb': {
      borderRadius: 6,
      backgroundColor: '#64748b',
    },
  },
  virtualRow: {
    display: 'grid',
    gridTemplateColumns,
    alignItems: 'center',
    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
    cursor: 'pointer',
    color: '#dce6ef',
    '&:nth-of-type(even)': {
      backgroundColor: 'rgba(30, 41, 54, 0.48)',
    },
    '&:hover': {
      backgroundColor: 'rgba(59, 130, 246, 0.14)',
    },
  },
  virtualRowSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.16) !important',
    boxShadow: 'inset 3px 0 0 #22c55e, inset 0 0 18px rgba(34, 197, 94, 0.08)',
    '&:hover': {
      backgroundColor: 'rgba(34, 197, 94, 0.2) !important',
    },
  },
  virtualCell: {
    minWidth: 0,
    padding: theme.spacing(0.4, 0.9),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: theme.typography.caption.fontSize,
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
    backgroundColor: 'rgba(15, 23, 32, 0.88)',
    color: '#e2e8f0',
    '&:hover': {
      backgroundColor: 'rgba(30, 41, 59, 0.96)',
    },
  },
  mapLegend: {
    position: 'absolute',
    right: theme.spacing(1),
    bottom: theme.spacing(1),
    zIndex: 1,
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 6,
    color: '#d9e2ec',
    backgroundColor: 'rgba(15, 23, 32, 0.86)',
    backdropFilter: 'blur(8px)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.caption.fontSize,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#22c55e',
  },
  toolbarActions: {
    order: 3,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flex: '0 0 auto !important',
    '& .MuiButton-root, & .MuiIconButton-root': {
      border: '1px solid rgba(148, 163, 184, 0.24)',
      color: '#d9e2ec',
      backgroundColor: 'rgba(15, 23, 32, 0.84)',
    },
    '& .MuiIconButton-root': {
      width: 42,
    },
  },
  filterPanel: {
    order: 8,
    flex: '1 0 100% !important',
    padding: theme.spacing(0, 1, 1),
  },
  filterPanelInner: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    padding: theme.spacing(1),
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 6,
    backgroundColor: 'rgba(2, 6, 23, 0.28)',
  },
  charts: {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto minmax(260px, 1fr)',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.75),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  },
  chartTabs: {
    minHeight: 34,
    '& .MuiTab-root': {
      minHeight: 34,
      color: '#94a3b8',
      padding: theme.spacing(0.25, 1.25),
    },
    '& .Mui-selected': {
      color: '#e2e8f0',
    },
  },
  chartGrid: {
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    gap: theme.spacing(0.75),
  },
  chartGridAll: {
    gridTemplateRows: 'repeat(4, minmax(150px, 1fr))',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#64748b #111820',
  },
  chart: {
    minHeight: 180,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.28)',
  },
  chartTitle: {
    padding: theme.spacing(0.5, 1),
    color: '#cbd5e1',
  },
  chartBody: {
    flexGrow: 1,
    minHeight: 150,
  },
  replayControls: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flex: '1 1 auto',
    minWidth: 0,
    flexWrap: 'wrap',
  },
  replaySlider: {
    minWidth: 140,
    flexGrow: 1,
  },
  speedGroup: {
    flexShrink: 0,
  },
  diagnosticFilter: {
    flex: '0 0 auto',
  },
  diagnosticFilterGroup: {
    flexWrap: 'wrap',
    '& .MuiToggleButton-root': {
      color: '#cbd5e1',
      borderColor: 'rgba(148, 163, 184, 0.22)',
      padding: theme.spacing(0.35, 1),
      '&.Mui-selected': {
        color: '#052e16',
        backgroundColor: '#22c55e',
      },
    },
  },
  mobileTabs: {
    display: 'none',
    [theme.breakpoints.down('lg')]: {
      display: 'block',
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
  chipGroup: {
    display: 'flex',
    gap: theme.spacing(0.5),
    flexWrap: 'wrap',
  },
  sidebar: {
    height: '100%',
    display: 'grid',
    gridTemplateRows: 'auto auto minmax(0, 1fr)',
    minHeight: 0,
  },
  sidebarSection: {
    padding: theme.spacing(1.25),
    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
    '& .MuiIconButton-root': {
      color: '#d9e2ec',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      backgroundColor: 'rgba(15, 23, 32, 0.62)',
    },
    '& .MuiToggleButton-root': {
      color: '#cbd5e1',
      borderColor: 'rgba(148, 163, 184, 0.22)',
      padding: theme.spacing(0.35, 0.8),
      '&.Mui-selected': {
        color: '#052e16',
        backgroundColor: '#22c55e',
      },
    },
  },
  sidebarTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(0.75),
  },
  metric: {
    padding: theme.spacing(0.75),
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.24)',
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: theme.typography.caption.fontSize,
  },
  metricValue: {
    color: '#f8fafc',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  detailsTabs: {
    minHeight: 36,
    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
    '& .MuiTab-root': {
      minHeight: 36,
      color: '#94a3b8',
      padding: theme.spacing(0.5, 1),
    },
    '& .Mui-selected': {
      color: '#e2e8f0',
    },
  },
  detailsHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  detailsActions: {
    display: 'flex',
    gap: theme.spacing(0.5),
  },
  details: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  detailsBody: {
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(1.25),
  },
  detailsHeader: {
    padding: theme.spacing(1.25),
    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
  },
  json: {
    margin: 0,
    padding: theme.spacing(1),
    overflow: 'auto',
    flexGrow: 1,
    fontSize: theme.typography.caption.fontSize,
    fontFamily: theme.typography.fontFamilyMonospaced,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.14)',
    borderRadius: 4,
    backgroundColor: '#020617',
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
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const t = useTranslation();
  const positionAttributes = usePositionAttributes(t);
  const listRef = useRef(null);
  const devices = useSelector((state) => state.devices.items);

  const [packets, setPackets] = useState([]);
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [cameraTarget, setCameraTarget] = useState({ type: 'track', version: 0 });
  const [diagnosticFilter, setDiagnosticFilter] = useState('all');
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [activeChartTab, setActiveChartTab] = useState('speed');
  const [activeMobileTab, setActiveMobileTab] = useState('map');
  const [detailsTab, setDetailsTab] = useState('details');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportRange, setReportRange] = useState(null);
  const [snackbar, setSnackbar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const filteredPackets = useMemo(
    () => packets.filter((packet) => matchesDiagnosticFilter(packet, diagnosticFilter)),
    [packets, diagnosticFilter],
  );

  const mapPositions = useMemo(() => packets.map((packet) => packet.rawPosition), [packets]);

  const eventPacketIds = useMemo(
    () =>
      new Set(
        packets
          .filter(
            (packet) =>
              hasAnomaly(packet) ||
              packet.diagnostics.ignitionChange ||
              packet.diagnostics.possibleDrain ||
              packet.diagnostics.possibleRefuel,
          )
          .map((packet) => packet.id),
      ),
    [packets],
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

  useEffect(() => {
    if (!replayPlaying || !packets.length) {
      return undefined;
    }
    const interval = setInterval(
      () => {
        setSelectedPacket((current) => {
          const currentIndex = current
            ? packets.findIndex((packet) => packet.id === current.id)
            : -1;
          const nextIndex = currentIndex + 1;
          if (nextIndex >= packets.length) {
            setReplayPlaying(false);
            return current;
          }
          const nextPacket = packets[nextIndex];
          setCameraTarget((previous) => ({
            type: 'packet',
            id: nextPacket.id,
            version: previous.version + 1,
          }));
          return nextPacket;
        });
      },
      Math.max(1000 / replaySpeed, 50),
    );
    return () => clearInterval(interval);
  }, [packets, replayPlaying, replaySpeed]);

  const onShow = useCallback(async ({ deviceIds, from, to }) => {
    const query = new URLSearchParams({ from, to });
    deviceIds.forEach((deviceId) => query.append('deviceId', deviceId));

    setLoading(true);
    setError(null);
    setLoaded(false);
    setReplayPlaying(false);
    setReportRange({ deviceIds, from, to });
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
      setReplayPlaying(false);
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

  const stepReplay = useCallback(
    (direction) => {
      if (!packets.length) {
        return;
      }
      const currentIndex = selectedPacket
        ? packets.findIndex((packet) => packet.id === selectedPacket.id)
        : 0;
      const nextIndex = Math.min(Math.max(currentIndex + direction, 0), packets.length - 1);
      selectPacket(packets[nextIndex]);
    },
    [packets, selectPacket, selectedPacket],
  );

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

  const copyText = useCallback((value) => copyToClipboard(value), []);

  const getDeviceName = useCallback(
    (packet) => devices[packet?.deviceId]?.name || packet?.deviceId || '',
    [devices],
  );

  const getPacketAddress = useCallback((packet) => packet.address || '—', []);

  const copySummary = useCallback(async () => {
    if (!packets.length) {
      setSnackbar({ severity: 'warning', message: t('trackInspectorCopyNoData') });
      return;
    }

    try {
      if (selectedPacket) {
        await copyText(
          [
            `Device: ${getDeviceName(selectedPacket)}`,
            `Packet: #${selectedPacket.index + 1}`,
            `Fix time: ${selectedPacket.fixTime}`,
            `Server time: ${selectedPacket.serverTime}`,
            `Coordinates: ${selectedPacket.latitude}, ${selectedPacket.longitude}`,
            `Address: ${getPacketAddress(selectedPacket)}`,
            `Speed: ${selectedPacket.speed ?? '—'}`,
            `Course: ${selectedPacket.course ?? '—'}`,
            `Fuel: ${selectedPacket.diagnostics.fuel ?? '—'}`,
            `Power: ${selectedPacket.diagnostics.power ?? '—'}`,
            `Battery: ${selectedPacket.diagnostics.battery ?? '—'}`,
            `Ignition: ${selectedPacket.diagnostics.ignition ?? '—'}`,
            `Valid: ${selectedPacket.valid ?? '—'}`,
          ].join('\n'),
        );
      } else {
        const firstPacket = packets[0];
        const lastPacket = packets[packets.length - 1];
        const distance = packets.reduce(
          (sum, packet) => sum + (Number(packet.diagnostics.deltaDistance) || 0),
          0,
        );
        await copyText(
          [
            `Device: ${getDeviceName(firstPacket)}`,
            `Period: ${reportRange?.from || '—'} - ${reportRange?.to || '—'}`,
            `Packets: ${packets.length}`,
            `Distance: ${Math.round(distance)} m`,
            `Start: ${firstPacket.fixTime}`,
            `End: ${lastPacket.fixTime}`,
            `Fuel start: ${firstPacket.diagnostics.fuel ?? '—'}`,
            `Fuel end: ${lastPacket.diagnostics.fuel ?? '—'}`,
            `Fuel delta: ${
              firstPacket.diagnostics.fuel != null && lastPacket.diagnostics.fuel != null
                ? lastPacket.diagnostics.fuel - firstPacket.diagnostics.fuel
                : '—'
            }`,
          ].join('\n'),
        );
      }
      setSnackbar({ severity: 'success', message: t('trackInspectorCopySuccess') });
    } catch (error) {
      console.warn('Track Inspector summary copy failed', error);
      setSnackbar({ severity: 'error', message: t('trackInspectorCopyError') });
    }
  }, [copyText, getDeviceName, getPacketAddress, packets, reportRange, selectedPacket, t]);

  const renderDiagnosticSummary = useCallback(
    (packet) => {
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
    },
    [t],
  );

  const exportCsv = useCallback(() => {
    const escapeValue = (value) => {
      const stringValue = value == null ? '' : String(value);
      return `"${stringValue.replaceAll('"', '""')}"`;
    };
    const rows = filteredPackets.map((packet) => [
      packet.index + 1,
      packet.fixTime,
      packet.serverTime,
      packet.valid,
      packet.speed,
      packet.course,
      `${packet.latitude}, ${packet.longitude}`,
      packet.address,
      packet.diagnostics.ignition,
      packet.diagnostics.fuel,
      packet.diagnostics.power,
      packet.diagnostics.battery,
      packet.diagnostics.odometer,
      packet.protocol,
      renderDiagnosticSummary(packet),
      JSON.stringify(packet.attributes),
    ]);
    const header = [
      '#',
      columnLabels.fixTime,
      columnLabels.serverTime,
      columnLabels.valid,
      columnLabels.speed,
      columnLabels.course,
      columnLabels.coordinates,
      columnLabels.address,
      columnLabels.ignition,
      columnLabels.fuel,
      positionAttributes.power.name,
      positionAttributes.battery.name,
      columnLabels.odometer,
      columnLabels.protocol,
      columnLabels.diagnostics,
      columnLabels.attributes,
    ];
    const csv = [header, ...rows].map((row) => row.map(escapeValue).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'track-inspector.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [columnLabels, filteredPackets, positionAttributes, renderDiagnosticSummary]);

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

  const renderBooleanChip = (value, trueLabel, falseLabel) => {
    if (value == null) {
      return '';
    }
    return (
      <Chip
        size="small"
        color={value ? 'success' : 'default'}
        label={value ? trueLabel : falseLabel}
        variant={value ? 'filled' : 'outlined'}
      />
    );
  };

  const renderPowerBattery = (packet) => {
    const keys = ['power', 'battery', 'batteryLevel'];
    return keys
      .filter((key) => packet.attributes[key] != null)
      .map((key) => (
        <div key={key}>
          {positionAttributes[key]?.name || key}:{' '}
          <PositionValue position={packet.rawPosition} attribute={key} />
        </div>
      ));
  };

  const renderPacketCell = (packet, columnId) => {
    switch (columnId) {
      case 'index':
        return packet.index + 1;
      case 'fixTime':
      case 'serverTime':
        return renderPositionValue(packet, columnId);
      case 'valid':
        return renderBooleanChip(packet.valid, t('positionValid'), t('trackInspectorInvalidGps'));
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
        return renderBooleanChip(
          packet.diagnostics.ignition,
          positionAttributes.ignition.name,
          t('sharedNo'),
        );
      case 'fuel':
        return renderAttributeValue(packet, ['fuel', 'fuel1', 'fuel2']);
      case 'powerBattery':
        return renderPowerBattery(packet);
      case 'odometer':
        return renderAttributeValue(packet, ['odometer', 'totalDistance']);
      case 'attributes':
        return Object.keys(packet.attributes).length;
      case 'diagnostics':
        return renderDiagnosticBadges(packet);
      default:
        return '';
    }
  };

  const renderDiagnosticBadges = (packet) => {
    const diagnostics = packet.diagnostics;
    const badges = [];
    if (!diagnostics.validGPS) {
      badges.push(
        <Chip key="invalid" size="small" color="error" label={t('trackInspectorInvalidGps')} />,
      );
    }
    if (diagnostics.possibleDrain) {
      badges.push(
        <Chip key="drain" size="small" color="error" label={t('trackInspectorPossibleDrain')} />,
      );
    }
    if (diagnostics.possibleRefuel) {
      badges.push(
        <Chip
          key="refuel"
          size="small"
          color="success"
          label={t('trackInspectorPossibleRefuel')}
        />,
      );
    }
    if (diagnostics.powerLoss) {
      badges.push(
        <Chip key="power" size="small" color="warning" label={t('trackInspectorPowerLoss')} />,
      );
    }
    if (diagnostics.ignitionChange) {
      badges.push(<Chip key="ignition" size="small" label={t('trackInspectorIgnitionChange')} />);
    }
    if (!badges.length) {
      return <Chip size="small" variant="outlined" label={t('trackInspectorNoIssues')} />;
    }
    return <div className={classes.chipGroup}>{badges}</div>;
  };

  const renderPacketRow = ({ index, style, packets, selectedId, selectPacket }) => {
    const packet = packets[index];
    return (
      <div
        className={cx(classes.virtualRow, selectedId === packet.id && classes.virtualRowSelected)}
        style={style}
        role="row"
        onClick={(event) => {
          if (!event.defaultPrevented) {
            selectPacket(packet);
          }
        }}
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
            rowComponent={renderPacketRow}
            rowCount={filteredPackets.length}
            rowHeight={42}
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

  const renderMetric = (label, value) => (
    <div className={classes.metric}>
      <div className={classes.metricLabel}>{label}</div>
      <div className={classes.metricValue}>{value || '-'}</div>
    </div>
  );

  const renderReplayPanel = () => (
    <div className={classes.sidebarSection}>
      <div className={classes.sidebarTitle}>
        <Typography variant="subtitle2">Replay</Typography>
        <Chip
          size="small"
          color={replayPlaying ? 'success' : 'default'}
          label={replayPlaying ? t('trackInspectorPlay') : t('trackInspectorPause')}
          variant="outlined"
        />
      </div>
      <div className={classes.replayControls}>
        <IconButton
          size="small"
          disabled={!packets.length}
          onClick={() => stepReplay(-1)}
          title={t('trackInspectorStepBack')}
        >
          <SkipPreviousIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={!packets.length}
          onClick={() => setReplayPlaying((value) => !value)}
          title={t(replayPlaying ? 'trackInspectorPause' : 'trackInspectorPlay')}
        >
          {replayPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>
        <IconButton
          size="small"
          disabled={!packets.length}
          onClick={() => stepReplay(1)}
          title={t('trackInspectorStepForward')}
        >
          <SkipNextIcon fontSize="small" />
        </IconButton>
        <ToggleButtonGroup
          className={classes.speedGroup}
          value={replaySpeed}
          exclusive
          size="small"
          onChange={(event, value) => value && setReplaySpeed(value)}
        >
          {replaySpeeds.map((speed) => (
            <ToggleButton key={speed} value={speed}>
              {speed}x
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Slider
          className={classes.replaySlider}
          size="small"
          disabled={!packets.length}
          min={0}
          max={Math.max(packets.length - 1, 0)}
          value={selectedPacket?.index || 0}
          onChange={(event, value) => selectPacket(packets[value])}
        />
      </div>
    </div>
  );

  const renderPacketDetails = () => {
    if (!selectedPacket) {
      return (
        <div className={classes.sidebar}>
          {renderReplayPanel()}
          <div className={classes.placeholder}>
            <Typography variant="body2">{t('trackInspectorDetailsPlaceholder')}</Typography>
          </div>
        </div>
      );
    }

    return (
      <div className={classes.sidebar}>
        {renderReplayPanel()}
        <div className={classes.sidebarSection}>
          <div className={classes.sidebarTitle}>
            <Typography variant="subtitle2">Diagnostics</Typography>
            {renderDiagnosticBadges(selectedPacket)}
          </div>
          <div className={classes.metricGrid}>
            {renderMetric(columnLabels.speed, renderPositionValue(selectedPacket, 'speed'))}
            {renderMetric(columnLabels.valid, renderPacketCell(selectedPacket, 'valid'))}
            {renderMetric(columnLabels.fuel, renderPacketCell(selectedPacket, 'fuel'))}
            {renderMetric(columnLabels.odometer, renderPacketCell(selectedPacket, 'odometer'))}
          </div>
        </div>
        <div className={classes.details}>
          <div className={classes.detailsHeader}>
            <div className={classes.detailsHeaderRow}>
              <div>
                <Typography variant="subtitle2">
                  #{selectedPacket.index + 1} / {selectedPacket.id}
                </Typography>
                <Typography variant="caption" color="#94a3b8">
                  {selectedPacket.fixTime}
                </Typography>
              </div>
              <div className={classes.detailsActions}>
                <IconButton
                  size="small"
                  title={t('trackInspectorCopyCoordinates')}
                  onClick={() =>
                    copyText(`${selectedPacket.latitude}, ${selectedPacket.longitude}`)
                  }
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  title={t('trackInspectorCopyJson')}
                  onClick={() =>
                    copyText(
                      JSON.stringify(
                        {
                          diagnostics: selectedPacket.diagnostics,
                          attributes: selectedPacket.attributes,
                          rawPosition: selectedPacket.rawPosition,
                        },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </div>
            </div>
          </div>
          <Tabs
            className={classes.detailsTabs}
            value={detailsTab}
            onChange={(event, value) => setDetailsTab(value)}
            variant="fullWidth"
          >
            <Tab value="details" label="Details" />
            <Tab value="attributes" label="Attributes" />
            <Tab value="diagnostics" label="Diagnostics" />
            <Tab value="raw" label="Raw" />
          </Tabs>
          <div className={classes.detailsBody}>
            {detailsTab === 'details' && (
              <div className={classes.metricGrid}>
                {renderMetric(columnLabels.fixTime, renderPositionValue(selectedPacket, 'fixTime'))}
                {renderMetric(
                  columnLabels.serverTime,
                  renderPositionValue(selectedPacket, 'serverTime'),
                )}
                {renderMetric(
                  columnLabels.coordinates,
                  `${selectedPacket.latitude}, ${selectedPacket.longitude}`,
                )}
                {renderMetric(columnLabels.address, renderPacketCell(selectedPacket, 'address'))}
                {renderMetric(columnLabels.course, renderPositionValue(selectedPacket, 'course'))}
                {renderMetric(
                  columnLabels.protocol,
                  renderPositionValue(selectedPacket, 'protocol'),
                )}
              </div>
            )}
            {detailsTab === 'attributes' && (
              <pre className={classes.json}>
                {JSON.stringify(selectedPacket.attributes, null, 2)}
              </pre>
            )}
            {detailsTab === 'diagnostics' && (
              <pre className={classes.json}>
                {JSON.stringify(selectedPacket.diagnostics, null, 2)}
              </pre>
            )}
            {detailsTab === 'raw' && (
              <pre className={classes.json}>
                {JSON.stringify(selectedPacket.rawPosition, null, 2)}
              </pre>
            )}
          </div>
        </div>
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
        <div className={classes.mapLegend}>
          <span className={classes.legendItem}>
            <span className={classes.legendDot} />
            Track
          </span>
          <span className={classes.legendItem}>
            <span className={classes.legendDot} style={{ backgroundColor: '#38bdf8' }} />
            Selected
          </span>
          <span className={classes.legendItem}>
            <span className={classes.legendDot} style={{ backgroundColor: '#f97316' }} />
            Events
          </span>
        </div>
        <MapView>
          {[...new Set(mapPositions.map((position) => position.deviceId))].map((deviceId) => {
            const devicePositions = mapPositions.filter(
              (position) => position.deviceId === deviceId,
            );
            return (
              <Fragment key={deviceId}>
                <MapRoutePath positions={devicePositions} color="#22c55e" />
                <MapRoutePoints
                  positions={devicePositions}
                  onClick={onMapPointClick}
                  color="#22c55e"
                  selectedId={selectedPacket?.id}
                  eventIds={eventPacketIds}
                  selectedColor="#38bdf8"
                  eventColor="#f97316"
                />
              </Fragment>
            );
          })}
          {cameraTarget.type === 'track' ? (
            <MapCamera key={`track-${cameraTarget.version}`} positions={mapPositions} />
          ) : (
            selectedPacket &&
            cameraTarget.id === selectedPacket.id && (
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
            <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="3 3" />
            <XAxis
              dataKey="index"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="rgba(148, 163, 184, 0.3)"
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="rgba(148, 163, 184, 0.3)"
              width={42}
              tickCount={4}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f1720',
                border: '1px solid rgba(148, 163, 184, 0.24)',
                color: '#e2e8f0',
              }}
              labelFormatter={(value) => chartData[value]?.fixTime || value}
            />
            {selectedPacket && (
              <ReferenceLine x={selectedPacket.index} stroke="#22c55e" strokeDasharray="3 3" />
            )}
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

    const charts = {
      speed: renderChart(
        t('trackInspectorSpeedChart'),
        <Line key="speed" type="monotone" dataKey="speed" dot={false} stroke="#38bdf8" />,
      ),
      fuel: renderChart(
        t('trackInspectorFuelChart'),
        <Line key="fuel" type="monotone" dataKey="fuel" dot={false} stroke="#22c55e" />,
      ),
      power: renderChart(
        t('trackInspectorPowerChart'),
        <>
          <Line type="monotone" dataKey="power" dot={false} stroke="#f97316" />
          <Line type="monotone" dataKey="battery" dot={false} stroke="#a78bfa" />
        </>,
      ),
      ignition: renderChart(
        t('trackInspectorIgnitionChart'),
        <Line key="ignition" type="stepAfter" dataKey="ignition" dot={false} stroke="#f43f5e" />,
      ),
    };

    return (
      <div className={classes.charts}>
        <Tabs
          className={classes.chartTabs}
          value={activeChartTab}
          onChange={(event, value) => setActiveChartTab(value)}
        >
          {chartTabs.map((tab) => (
            <Tab key={tab} value={tab} label={t(`trackInspectorChartTab${tab}`)} />
          ))}
        </Tabs>
        <div className={cx(classes.chartGrid, activeChartTab === 'all' && classes.chartGridAll)}>
          {activeChartTab === 'all' ? Object.values(charts) : charts[activeChartTab]}
        </div>
      </div>
    );
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTrackInspector']}>
      <div className={cx(reportClasses.container, classes.shell)}>
        <div className={cx(reportClasses.header, classes.toolbarHeader)}>
          <ReportFilter deviceType="single" loading={loading} onShow={onShow}>
            <div className={classes.toolbarActions}>
              <Button
                size="small"
                startIcon={<FilterListIcon />}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                Фильтры
              </Button>
              <IconButton
                size="small"
                disabled={!filteredPackets.length}
                onClick={exportCsv}
                title={t('trackInspectorExportCsv')}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={copySummary} title={t('trackInspectorCopySummary')}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </div>
            <div className={classes.filterPanel}>
              <Collapse in={filtersOpen} timeout="auto">
                <div className={classes.filterPanelInner}>
                  <Typography variant="subtitle2">Фильтры</Typography>
                  <ToggleButtonGroup
                    className={cx(classes.diagnosticFilterGroup, classes.diagnosticFilter)}
                    value={diagnosticFilter}
                    exclusive
                    size="small"
                    onChange={(event, value) => value && setDiagnosticFilter(value)}
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
              </Collapse>
            </div>
          </ReportFilter>
        </div>
        <Tabs
          className={classes.mobileTabs}
          value={activeMobileTab}
          onChange={(event, value) => setActiveMobileTab(value)}
          variant="fullWidth"
        >
          {mobileTabs.map((tab) => (
            <Tab
              key={tab}
              value={tab}
              label={t(`trackInspectorTab${tab[0].toUpperCase()}${tab.slice(1)}`)}
            />
          ))}
        </Tabs>
        <Box className={classes.content}>
          <Paper
            className={cx(
              classes.panel,
              classes.mapPanel,
              !desktop && activeMobileTab !== 'map' && classes.mobileHidden,
            )}
            variant="outlined"
          >
            {renderMap()}
          </Paper>
          <Paper
            className={cx(
              classes.panel,
              classes.tablePanel,
              !desktop && activeMobileTab !== 'packets' && classes.mobileHidden,
            )}
            variant="outlined"
          >
            {renderPacketTable()}
          </Paper>
          <Paper
            className={cx(
              classes.panel,
              classes.chartsPanel,
              !desktop && activeMobileTab !== 'charts' && classes.mobileHidden,
            )}
            variant="outlined"
          >
            {renderCharts()}
          </Paper>
          <Paper
            className={cx(
              classes.panel,
              classes.detailsPanel,
              !desktop && activeMobileTab !== 'details' && classes.mobileHidden,
            )}
            variant="outlined"
          >
            {renderPacketDetails()}
          </Paper>
        </Box>
        <Snackbar
          open={Boolean(snackbar)}
          autoHideDuration={3000}
          onClose={() => setSnackbar(null)}
        >
          <Alert severity={snackbar?.severity || 'info'} onClose={() => setSnackbar(null)}>
            {snackbar?.message}
          </Alert>
        </Snackbar>
      </div>
    </PageLayout>
  );
};

export default TrackInspectorPage;
