import { Fragment, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip as MuiTooltip,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import { makeStyles } from 'tss-react/mui';
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
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ReportFilter from './components/ReportFilter';
import chartTheme from './common/chartTheme';
import useReportStyles from './common/useReportStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import {
  formatTelemetryNumber,
  formatTelemetryValue,
  getTelemetryStatus,
  getTelemetryStatusColor,
  getTelemetryStatusDescription,
  getTelemetryValueType,
} from '../common/components/TelemetryPanel';

const historyLimit = 2000;

const calibrationPresets = [
  {
    label: '0-10V to 0-100%',
    rawMin: 0,
    rawMax: 10,
    displayMin: 0,
    displayMax: 100,
    rawUnit: 'V',
    displayUnit: '%',
  },
  {
    label: '0.5-4.5V to 0-100%',
    rawMin: 0.5,
    rawMax: 4.5,
    displayMin: 0,
    displayMax: 100,
    rawUnit: 'V',
    displayUnit: '%',
  },
  {
    label: '4-20mA to 0-100%',
    rawMin: 4,
    rawMax: 20,
    displayMin: 0,
    displayMax: 100,
    rawUnit: 'mA',
    displayUnit: '%',
  },
];

const useStyles = makeStyles()((theme) => ({
  shell: {
    minHeight: 'auto',
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.25),
    paddingBottom: theme.spacing(3),
    overflow: 'visible',
    background: 'linear-gradient(180deg, #0f1720 0%, #111827 44%, #151b22 100%)',
  },
  page: {
    height: 'auto !important',
    minHeight: '100%',
    flex: '0 0 auto',
    overflow: 'visible !important',
  },
  panel: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: theme.enterprise.radius.sm,
    borderColor: theme.enterprise.colors.border,
    backgroundColor: 'rgba(15, 23, 32, 0.92)',
    color: theme.enterprise.colors.text,
  },
  latestHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  latestActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  chartPanel: {
    minHeight: 0,
    overflow: 'visible',
  },
  historyPanel: {
    maxHeight: 540,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    padding: theme.spacing(1, 1.25),
    borderBottom: `1px solid ${theme.enterprise.colors.borderSubtle}`,
  },
  panelBody: {
    minHeight: 0,
    /*padding: theme.spacing(1.25),*/
    overflow: 'visible',
  },
  tableBody: {
    overflow: 'hidden',
  },
  chartBody: {
    overflow: 'visible',
  },
  tableWrap: {
    overflow: 'auto',
    border: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    borderRadius: theme.enterprise.radius.xs,
    backgroundColor: theme.enterprise.colors.backgroundElevated,
  },
  latestTableWrap: {
    maxHeight: 380,
  },
  historyTableWrap: {
    maxHeight: 460,
  },
  table: {
    minWidth: 760,
    '& .MuiTableCell-sizeSmall': {
      whiteSpace: 'nowrap',
      paddingLeft: theme.spacing(0.75),
      paddingRight: theme.spacing(0.75),
    },
    '& .MuiTableCell-head': {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      color: theme.enterprise.colors.accent,
      backgroundColor: theme.enterprise.colors.surfaceAlt,
      borderBottom: `1px solid ${theme.enterprise.colors.border}`,
    },
  },
  configTable: {
    minWidth: 1120,
    '& .MuiTableCell-sizeSmall': {
      whiteSpace: 'nowrap',
      paddingLeft: theme.spacing(0.5),
      paddingRight: theme.spacing(0.5),
    },
  },
  configInput: {
    '& .MuiInputBase-input': {
      paddingTop: theme.spacing(0.75),
      paddingBottom: theme.spacing(0.75),
    },
  },
  calibrationRow: {
    '& .MuiTableCell-sizeSmall': {
      borderBottomColor: theme.enterprise.colors.borderSubtle,
    },
  },
  calibrationPanel: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
  },
  calibrationFields: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  calibrationInput: {
    width: 86,
    '& .MuiInputBase-input': {
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
    },
  },
  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  reorder: {
    display: 'flex',
  },
  selectedRow: {
    backgroundColor: `${theme.enterprise.colors.rowSelected} !important`,
    boxShadow: `inset 3px 0 0 ${theme.enterprise.colors.success}`,
  },
  clickableRow: {
    cursor: 'pointer',
  },
  chart: {
    height: 380,
    padding: theme.spacing(1),
    overflow: 'visible',
    border: chartTheme.panelBorder,
    borderRadius: 4,
    backgroundColor: chartTheme.panelBackground,
    '& .recharts-cartesian-axis-tick-value': {
      fill: `${chartTheme.axisText} !important`,
      stroke: 'none !important',
      fontSize: '11px !important',
      fontWeight: '400 !important',
      textShadow: 'none !important',
    },
    '& .recharts-cartesian-axis-tick-line': {
      display: 'none',
    },
    '& .recharts-cartesian-axis-line': {
      stroke: `${chartTheme.axisLine} !important`,
    },
    '& .recharts-cartesian-axis-tick': {
      pointerEvents: 'none',
    },
  },
  chartLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    paddingBottom: theme.spacing(1),
  },
  chartLegendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.enterprise.colors.textMuted,
  },
  chartLegendSwatch: {
    width: 10,
    height: 3,
    borderRadius: 2,
  },
  chartTooltip: {
    minWidth: 220,
    padding: theme.spacing(1),
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: 4,
    backgroundColor: chartTheme.tooltipBackground,
    color: chartTheme.tooltipText,
    boxShadow: theme.enterprise.shadows.overlay,
  },
  chartTooltipRow: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(90px, 1fr) auto',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    paddingTop: theme.spacing(0.5),
  },
  chartTooltipSwatch: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  chartTooltipValue: {
    color: chartTheme.tooltipText,
    fontVariantNumeric: 'tabular-nums',
  },
  chartActiveValues: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    paddingBottom: theme.spacing(1),
  },
  chartActiveChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 0.75),
    border: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    borderRadius: theme.enterprise.radius.xs,
    backgroundColor: theme.enterprise.colors.surfaceMuted,
  },
  chartActiveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
  },
  chartEmptyValue: {
    color: theme.enterprise.colors.textMuted,
  },
  chartsStack: {
    overflow: 'visible',
  },
  chartHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    paddingBottom: theme.spacing(0.5),
  },
  chartValue: {
    color: theme.enterprise.colors.accent,
  },
  sensorTable: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 260,
    maxHeight: 420,
    overflow: 'hidden',
    border: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    borderRadius: theme.enterprise.radius.xs,
    backgroundColor: theme.enterprise.colors.backgroundElevated,
  },
  sensorTableHeader: {
    flex: '0 0 auto',
    display: 'grid',
    gridTemplateColumns:
      '40px minmax(180px, 1.4fr) minmax(120px, 1fr) minmax(120px, 1fr) 80px 120px 160px',
    alignItems: 'center',
    minWidth: 860,
    color: theme.enterprise.colors.accent,
    backgroundColor: theme.enterprise.colors.surfaceAlt,
    borderBottom: `1px solid ${theme.enterprise.colors.border}`,
  },
  sensorTableBody: {
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'auto',
  },
  sensorRow: {
    display: 'grid',
    gridTemplateColumns:
      '40px minmax(180px, 1.4fr) minmax(120px, 1fr) minmax(120px, 1fr) 80px 120px 160px',
    alignItems: 'center',
    minWidth: 860,
    borderBottom: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.enterprise.colors.rowHover,
    },
  },
  sensorCell: {
    minWidth: 0,
    padding: theme.spacing(0.7, 0.75),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sensorCheckboxCell: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(0.25),
  },
  chips: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
  statusValue: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    flexShrink: 0,
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

const seriesColors = chartTheme.linePalette;

const sortByKey = (items) => Array.from(items).sort((a, b) => a.key.localeCompare(b.key));

const sortSensorConfigs = (items) =>
  Array.from(items).sort((first, second) => {
    const firstOrder = first.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
    return first.key.localeCompare(second.key);
  });

const inferSensorType = (point) => {
  const key = point.key.toLowerCase();
  if (key.includes('fuel')) {
    return 'FUEL';
  }
  if (key.includes('temp')) {
    return 'TEMPERATURE';
  }
  if (key.includes('battery') || key.includes('power') || key.includes('voltage')) {
    return 'VOLTAGE';
  }
  if (key.includes('ignition') || getTelemetryValueType(point) === 'BOOLEAN') {
    return 'SWITCH';
  }
  if (getTelemetryValueType(point) === 'NUMBER') {
    return 'ANALOG';
  }
  return 'TEXT';
};

const createSensorConfigsFromItems = (items) =>
  sortSensorConfigs(
    sortByKey(items).map((item, index) => ({
      key: item.key,
      label: item.key,
      sensorType: inferSensorType(item),
      enabled: true,
      sortOrder: index,
    })),
  );

const normalizePoint = (item) => ({ ...item, valueType: getTelemetryValueType(item) });

const getPointTimestamp = (item) => Date.parse(item.fixTime || item.deviceTime || item.createdAt);

const getPointPositionId = (item) => item.positionId ?? item.position?.id;

const formatRawValue = (item) =>
  getTelemetryValueType(item) === 'NUMBER' && item.rawValueNumber != null
    ? formatTelemetryNumber(item.rawValueNumber)
    : '';

const getUnit = (config) => config?.displayUnit || config?.unit || config?.rawUnit || '';

const parseOptionalNumber = (value) => {
  if (value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
};

const parseFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const calculateCalibration = ({ rawMin, rawMax, displayMin, displayMax }) => {
  const parsedRawMin = parseFiniteNumber(rawMin);
  const parsedRawMax = parseFiniteNumber(rawMax);
  const parsedDisplayMin = parseFiniteNumber(displayMin);
  const parsedDisplayMax = parseFiniteNumber(displayMax);
  if (
    parsedRawMin == null ||
    parsedRawMax == null ||
    parsedDisplayMin == null ||
    parsedDisplayMax == null ||
    parsedRawMin === parsedRawMax
  ) {
    return null;
  }
  const multiplier = (parsedDisplayMax - parsedDisplayMin) / (parsedRawMax - parsedRawMin);
  const offset = parsedDisplayMin - parsedRawMin * multiplier;
  return {
    multiplier,
    offset,
    minValue: Math.min(parsedDisplayMin, parsedDisplayMax),
    maxValue: Math.max(parsedDisplayMin, parsedDisplayMax),
  };
};

const toSensorPayload = (configs) =>
  configs.map((config, index) => ({
    key: config.key,
    label: config.label,
    unit: config.unit,
    rawUnit: config.rawUnit,
    displayUnit: config.displayUnit || config.unit,
    multiplier: typeof config.multiplier === 'number' ? config.multiplier : null,
    offset: typeof config.offset === 'number' ? config.offset : null,
    formula: config.formula,
    minValue: typeof config.minValue === 'number' ? config.minValue : null,
    maxValue: typeof config.maxValue === 'number' ? config.maxValue : null,
    warningMin: typeof config.warningMin === 'number' ? config.warningMin : null,
    warningMax: typeof config.warningMax === 'number' ? config.warningMax : null,
    criticalMin: typeof config.criticalMin === 'number' ? config.criticalMin : null,
    criticalMax: typeof config.criticalMax === 'number' ? config.criticalMax : null,
    enabled: config.enabled !== false,
    sortOrder: config.sortOrder ?? index,
  }));

const getInitialSensorKeys = (searchParams) => {
  const repeated = searchParams.getAll('sensor').filter(Boolean);
  const csv = (searchParams.get('sensors') || '').split(',').filter(Boolean);
  return [...new Set([...repeated, ...csv])];
};

const getSensorLabel = (config, key) => {
  const unit = getUnit(config);
  return `${config?.label || key}${unit ? ` (${unit})` : ''}`;
};

const formatChartTime = (value, domain) => {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  const [from, to] = Array.isArray(domain) ? domain : [];
  const longRange =
    Number.isFinite(Number(from)) &&
    Number.isFinite(Number(to)) &&
    Number(to) - Number(from) > 24 * 60 * 60 * 1000;
  if (!longRange) {
    return formatTime(timestamp, 'seconds');
  }
  return new Date(timestamp).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const createChartTimeTicks = (domain) => {
  const [from, to] = Array.isArray(domain) ? domain.map(Number) : [];
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return undefined;
  }
  const count = to - from > 24 * 60 * 60 * 1000 ? 6 : 7;
  return Array.from({ length: count }, (_, index) =>
    Math.round(from + ((to - from) * index) / (count - 1)),
  );
};

const getNearestTimestampIndex = (timestamp, data) => {
  if (!Array.isArray(data) || !data.length) {
    return 0;
  }
  const target = Number(timestamp);
  if (!Number.isFinite(target)) {
    return 0;
  }
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  data.forEach((item, index) => {
    const distance = Math.abs(Number(item.timestamp) - target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
};

const findPacketRow = (packet, data) => {
  if (!packet || !Array.isArray(data) || !data.length) {
    return null;
  }
  if (packet.positionId != null) {
    return (
      data.find((item) => String(item.positionId) === String(packet.positionId)) ||
      (packet.timestamp != null
        ? data.find((item) => item.timestamp === packet.timestamp) || null
        : null)
    );
  }
  if (packet.timestamp != null) {
    const timestampMatch = data.find((item) => item.timestamp === packet.timestamp);
    if (timestampMatch) {
      return timestampMatch;
    }
    return data[getNearestTimestampIndex(packet.timestamp, data)] || null;
  }
  return null;
};

const normalizeSelection = (keys, configs, latest) => {
  const available = new Set(configs.map((config) => config.key));
  const validKeys = keys.filter((key) => available.has(key));
  if (validKeys.length) {
    return validKeys;
  }
  const numericConfig = configs.find((config) => {
    const latestItem = latest.find((item) => item.key === config.key);
    return latestItem && getTelemetryValueType(latestItem) === 'NUMBER';
  });
  return [(numericConfig || configs[0])?.key].filter(Boolean);
};

const TelemetryStatus = ({ item, config }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const status = getTelemetryStatus(item, config);
  return (
    <MuiTooltip title={getTelemetryStatusDescription(status, config || {})}>
      <Box className={classes.statusValue}>
        <Box
          className={classes.statusDot}
          sx={{ backgroundColor: getTelemetryStatusColor(theme, status.level) }}
        />
        <Typography variant="caption">{status.label}</Typography>
      </Box>
    </MuiTooltip>
  );
};

const isTimestampLike = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 946684800000 && number <= 4102444800000;
};

const TelemetryChartTooltip = ({ active, payload, seriesList, t, classes }) => {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <Box className={classes.chartTooltip}>
      <Typography variant="caption" sx={{ color: chartTheme.tooltipMuted }}>
        {formatTime(row.timestamp, 'seconds')}
      </Typography>
      {seriesList.map((series) => {
        const point = row.points[series.key];
        if (!point) {
          return null;
        }
        const unit = getUnit(series.config);
        const value = formatTelemetryNumber(point.value);
        const rawValue = point.rawValue;
        const formattedRaw = rawValue != null ? formatTelemetryNumber(rawValue) : '';
        const showRaw =
          rawValue != null &&
          formattedRaw !== value &&
          String(rawValue) !== String(point.positionId) &&
          !isTimestampLike(rawValue);
        const status = getTelemetryStatus(point.item, series.config);
        return (
          <Box key={series.key} className={classes.chartTooltipRow}>
            <Box className={classes.chartTooltipSwatch} sx={{ backgroundColor: series.color }} />
            <Typography variant="caption" sx={{ color: chartTheme.tooltipMuted }}>
              {series.config?.label || series.key}
            </Typography>
            <Typography variant="caption" className={classes.chartTooltipValue}>
              {value}
              {unit ? ` ${unit}` : ''} · {status.label}
              {showRaw ? ` · ${t('telemetryColumnRaw')}: ${formattedRaw}` : ''}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

const TelemetryActiveDot = ({ cx, cy, payload, dataKey, activeRow, color }) => {
  if (!activeRow || payload?.packetKey !== activeRow.packetKey || payload?.[dataKey] == null) {
    return null;
  }
  return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke={chartTheme.tooltipBackground} />;
};

const TelemetryReportPage = () => {
  const reportClasses = useReportStyles().classes;
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const [searchParams] = useSearchParams();

  const [latestItems, setLatestItems] = useState([]);
  const [sensorConfigs, setSensorConfigs] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [selectedSensorKeys, setSelectedSensorKeys] = useState(() =>
    getInitialSensorKeys(searchParams),
  );
  const [currentRequest, setCurrentRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [hoveredPacket, setHoveredPacket] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [savedSensorConfigs, setSavedSensorConfigs] = useState([]);
  const [savingSensors, setSavingSensors] = useState(false);
  const [sensorError, setSensorError] = useState(false);
  const [calibrationDrafts, setCalibrationDrafts] = useState({});
  const [calibrationErrors, setCalibrationErrors] = useState({});

  const configByKey = useMemo(
    () => new Map(sensorConfigs.map((config) => [config.key, config])),
    [sensorConfigs],
  );
  const itemByKey = useMemo(
    () => new Map(latestItems.map((item) => [item.key, item])),
    [latestItems],
  );
  const visibleConfigs = useMemo(
    () => sensorConfigs.filter((config) => config.enabled !== false),
    [sensorConfigs],
  );
  const selectedConfigs = useMemo(
    () => selectedSensorKeys.map((key) => configByKey.get(key)).filter(Boolean),
    [configByKey, selectedSensorKeys],
  );
  const numericSelectedKeys = useMemo(
    () =>
      selectedSensorKeys.filter((key) => {
        const latestItem = itemByKey.get(key);
        if (latestItem && getTelemetryValueType(latestItem) === 'NUMBER') {
          return true;
        }
        return historyItems.some(
          (item) =>
            item.key === key &&
            getTelemetryValueType(item) === 'NUMBER' &&
            item.valueNumber != null,
        );
      }),
    [historyItems, itemByKey, selectedSensorKeys],
  );
  const selectedHasNonNumeric = selectedSensorKeys.some(
    (key) => !numericSelectedKeys.includes(key),
  );

  const chartSeries = useMemo(
    () =>
      numericSelectedKeys.map((key, index) => {
        const config = configByKey.get(key);
        const data = historyItems
          .filter(
            (item) =>
              item.key === key &&
              getTelemetryValueType(item) === 'NUMBER' &&
              item.valueNumber != null,
          )
          .map((item) => ({
            timestamp: getPointTimestamp(item),
            positionId: getPointPositionId(item),
            value: Number(item.valueNumber),
            rawValue: item.rawValueNumber,
            item,
          }))
          .filter((item) => !Number.isNaN(item.timestamp))
          .sort((a, b) => a.timestamp - b.timestamp);
        return {
          key,
          config,
          valueKey: `value${index}`,
          yAxisId: `axis${index}`,
          color: seriesColors[index % seriesColors.length],
          data,
        };
      }),
    [configByKey, historyItems, numericSelectedKeys],
  );
  const chartData = useMemo(() => {
    const packets = new Map();
    chartSeries.forEach((series) => {
      series.data.forEach((point) => {
        const packetKey =
          point.positionId != null ? `position-${point.positionId}` : `time-${point.timestamp}`;
        const packet = packets.get(packetKey) || {
          packetKey,
          timestamp: point.timestamp,
          positionId: point.positionId,
          points: {},
        };
        packet.timestamp = Math.min(packet.timestamp, point.timestamp);
        packet.points[series.key] = point;
        packet[series.valueKey] = point.value;
        packets.set(packetKey, packet);
      });
    });
    return Array.from(packets.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [chartSeries]);
  const activeChartRow = useMemo(
    () => findPacketRow(hoveredPacket, chartData),
    [chartData, hoveredPacket],
  );

  const sortedHistoryItems = useMemo(
    () =>
      Array.from(historyItems).sort(
        (a, b) => Date.parse(b.fixTime || b.createdAt) - Date.parse(a.fixTime || a.createdAt),
      ),
    [historyItems],
  );
  const chartTimeDomain = useMemo(() => {
    if (!currentRequest?.from || !currentRequest?.to) {
      return ['dataMin', 'dataMax'];
    }
    const from = Date.parse(currentRequest.from);
    const to = Date.parse(currentRequest.to);
    return Number.isNaN(from) || Number.isNaN(to) ? ['dataMin', 'dataMax'] : [from, to];
  }, [currentRequest]);
  const chartTimeTicks = useMemo(() => createChartTimeTicks(chartTimeDomain), [chartTimeDomain]);

  const loadSensors = useCallback(async (deviceId, latest) => {
    try {
      const query = new URLSearchParams({ deviceId });
      const response = await fetchOrThrow(`/api/telemetry/sensors?${query.toString()}`);
      const data = await response.json();
      const configs = Array.isArray(data) ? sortSensorConfigs(data) : [];
      const nextConfigs = configs.length ? configs : createSensorConfigsFromItems(latest);
      setSensorConfigs(nextConfigs);
      setSavedSensorConfigs(nextConfigs);
      return nextConfigs;
    } catch {
      const fallbackConfigs = createSensorConfigsFromItems(latest);
      setSensorConfigs(fallbackConfigs);
      setSavedSensorConfigs(fallbackConfigs);
      return fallbackConfigs;
    }
  }, []);

  const loadHistory = useCallback(
    async ({ deviceId, from, to }, keys) => {
      const uniqueKeys = [...new Set(keys.filter(Boolean))];
      if (!deviceId || !from || !to || !uniqueKeys.length) {
        setHistoryItems([]);
        return;
      }
      setHistoryLoading(true);
      try {
        const responses = await Promise.all(
          uniqueKeys.map(async (key) => {
            const query = new URLSearchParams({
              deviceId: String(deviceId),
              key,
              from,
              to,
              limit: String(historyLimit),
            });
            const response = await fetchOrThrow(`/api/telemetry/history?${query.toString()}`);
            const data = await response.json();
            return Array.isArray(data)
              ? data.map((item) => normalizePoint({ ...item, key: item.key || key }))
              : [];
          }),
        );
        setHistoryItems(responses.flat());
      } catch {
        setError(t('telemetryError'));
        setHistoryItems([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [t],
  );

  const onShow = useCallback(
    async ({ deviceIds, from, to }) => {
      const [deviceId] = deviceIds;
      if (!deviceId) {
        setLoaded(false);
        return;
      }
      const request = { deviceId, from, to };
      setCurrentRequest(request);
      setLoading(true);
      setError(null);
      setLoaded(false);
      try {
        const latestQuery = new URLSearchParams({ deviceId });
        const latestResponse = await fetchOrThrow(
          `/api/telemetry/latest?${latestQuery.toString()}`,
        );
        const latestData = await latestResponse.json();
        const normalizedLatest = sortByKey(
          (Array.isArray(latestData) ? latestData : []).map(normalizePoint),
        );
        setLatestItems(normalizedLatest);
        const configs = await loadSensors(String(deviceId), normalizedLatest);
        const deviceChanged = currentRequest?.deviceId !== deviceId;
        const queryKeys = getInitialSensorKeys(searchParams);
        const initialKeys = deviceChanged ? queryKeys : selectedSensorKeys;
        const nextKeys = normalizeSelection(initialKeys, configs, normalizedLatest);
        setSelectedSensorKeys(nextKeys);
        await loadHistory(request, nextKeys);
        setLoaded(true);
      } catch {
        setError(t('telemetryError'));
        setLatestItems([]);
        setSensorConfigs([]);
        setSavedSensorConfigs([]);
        setHistoryItems([]);
        setSelectedSensorKeys([]);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    },
    [currentRequest, loadHistory, loadSensors, searchParams, selectedSensorKeys, t],
  );

  const applySelection = useCallback(
    (keys) => {
      const nextKeys = [...new Set(keys.filter(Boolean))];
      setSelectedSensorKeys(nextKeys);
      if (currentRequest) {
        loadHistory(currentRequest, nextKeys);
      }
    },
    [currentRequest, loadHistory],
  );

  const handleRowClick = (key, event) => {
    if (event.ctrlKey || event.metaKey) {
      applySelection(
        selectedSensorKeys.includes(key)
          ? selectedSensorKeys.filter((selectedKey) => selectedKey !== key)
          : [...selectedSensorKeys, key],
      );
      return;
    }
    applySelection([key]);
  };

  const handleCheckboxChange = (key, checked) => {
    applySelection(
      checked
        ? [...selectedSensorKeys, key]
        : selectedSensorKeys.filter((selectedKey) => selectedKey !== key),
    );
  };

  const handleConfigChange = useCallback((key, changes) => {
    setSensorConfigs((previous) =>
      previous.map((config) => (config.key === key ? { ...config, ...changes } : config)),
    );
  }, []);

  const handleConfigNumberChange = useCallback(
    (key, name, value) => {
      handleConfigChange(key, { [name]: parseOptionalNumber(value) });
    },
    [handleConfigChange],
  );

  const handleMoveConfig = useCallback((key, direction) => {
    setSensorConfigs((previous) => {
      const sorted = sortSensorConfigs(previous);
      const index = sorted.findIndex((config) => config.key === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) {
        return previous;
      }
      const next = Array.from(sorted);
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((config, order) => ({ ...config, sortOrder: order }));
    });
  }, []);

  const handleCalibrationDraftChange = useCallback((key, name, value) => {
    setCalibrationDrafts((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        [name]: value,
      },
    }));
    setCalibrationErrors((previous) => ({ ...previous, [key]: false }));
  }, []);

  const handleApplyCalibration = useCallback(
    (key, draft, units = {}) => {
      const calibration = calculateCalibration(draft);
      if (!calibration) {
        setCalibrationErrors((previous) => ({ ...previous, [key]: true }));
        return;
      }
      handleConfigChange(key, {
        ...calibration,
        ...(units.rawUnit ? { rawUnit: units.rawUnit } : {}),
        ...(units.displayUnit ? { displayUnit: units.displayUnit, unit: units.displayUnit } : {}),
      });
      setCalibrationDrafts((previous) => ({ ...previous, [key]: draft }));
      setCalibrationErrors((previous) => ({ ...previous, [key]: false }));
    },
    [handleConfigChange],
  );

  const handleApplyCalibrationPreset = useCallback(
    (key, preset) => {
      const draft = {
        rawMin: String(preset.rawMin),
        rawMax: String(preset.rawMax),
        displayMin: String(preset.displayMin),
        displayMax: String(preset.displayMax),
      };
      handleApplyCalibration(key, draft, {
        rawUnit: preset.rawUnit,
        displayUnit: preset.displayUnit,
      });
    },
    [handleApplyCalibration],
  );

  const handleCancelEdit = useCallback(() => {
    setSensorConfigs(savedSensorConfigs);
    setSensorError(false);
    setEditMode(false);
  }, [savedSensorConfigs]);

  const handleSaveSensors = useCallback(async () => {
    if (!currentRequest?.deviceId) {
      return;
    }
    setSavingSensors(true);
    setSensorError(false);
    try {
      const query = new URLSearchParams({ deviceId: String(currentRequest.deviceId) });
      const response = await fetchOrThrow(`/api/telemetry/sensors?${query.toString()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSensorPayload(sortSensorConfigs(sensorConfigs))),
      });
      const data = await response.json();
      const configs = Array.isArray(data)
        ? sortSensorConfigs(data)
        : sortSensorConfigs(sensorConfigs);
      setSensorConfigs(configs);
      setSavedSensorConfigs(configs);
      setSelectedSensorKeys((previous) =>
        previous.filter((key) => configs.some((config) => config.key === key)),
      );
      setEditMode(false);
    } catch {
      setSensorError(true);
    } finally {
      setSavingSensors(false);
    }
  }, [currentRequest, sensorConfigs]);

  const handleChartMouseMove = (state) => {
    const row = state?.activePayload?.[0]?.payload;
    if (!row?.timestamp) {
      setHoveredPacket(null);
      return;
    }
    setHoveredPacket({
      timestamp: row.timestamp,
      positionId: row.positionId,
    });
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTelemetry']}>
      <div className={cx(reportClasses.container, classes.page)}>
        <div className={reportClasses.header}>
          <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
        </div>
        <Box className={classes.shell}>
          {error && <Alert severity="error">{error}</Alert>}
          {!searchParams.get('deviceId') && (
            <Alert severity="info">{t('telemetrySelectDevice')}</Alert>
          )}
          {loaded && !sensorConfigs.length && !error && (
            <Alert severity="info">{t('telemetryNoSensors')}</Alert>
          )}
          {sensorError && <Alert severity="error">{t('telemetrySensorSaveError')}</Alert>}

          <>
            <Box className={classes.latestHeader}>
              <Typography variant="subtitle2">{t('telemetryLatest')}</Typography>
              <Box className={classes.latestActions}>
                {loading && <CircularProgress size={18} />}
                {editMode ? (
                  <>
                    <MuiTooltip title={t('sharedSave')}>
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={handleSaveSensors}
                          disabled={savingSensors}
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </MuiTooltip>
                    <MuiTooltip title={t('sharedClose')}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={handleCancelEdit}
                          disabled={savingSensors}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </MuiTooltip>
                  </>
                ) : (
                  <MuiTooltip title={t('telemetryEditSensors')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => setEditMode(true)}
                        disabled={!sensorConfigs.length || !currentRequest?.deviceId}
                      >
                        <SettingsIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </MuiTooltip>
                )}
              </Box>
            </Box>
            {editMode && (
              <Box className={cx(classes.tableWrap, classes.tableBody)}>
                <Table size="small" className={classes.configTable}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('telemetryColumnVisible')}</TableCell>
                      <TableCell>{t('telemetryColumnSensor')}</TableCell>
                      <TableCell>{t('telemetryColumnLabel')}</TableCell>
                      <TableCell>{t('telemetryColumnRawUnit')}</TableCell>
                      <TableCell>{t('telemetryColumnDisplayUnit')}</TableCell>
                      <TableCell>{t('telemetryColumnMultiplier')}</TableCell>
                      <TableCell>{t('telemetryColumnOffset')}</TableCell>
                      <TableCell>{t('telemetryColumnMin')}</TableCell>
                      <TableCell>{t('telemetryColumnMax')}</TableCell>
                      <TableCell>{t('telemetryColumnWarnMin')}</TableCell>
                      <TableCell>{t('telemetryColumnWarnMax')}</TableCell>
                      <TableCell>{t('telemetryColumnCritMin')}</TableCell>
                      <TableCell>{t('telemetryColumnCritMax')}</TableCell>
                      <TableCell>{t('telemetryColumnOrder')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortSensorConfigs(sensorConfigs).map((config, index, configs) => {
                      const item = itemByKey.get(config.key);
                      const numeric = item ? getTelemetryValueType(item) === 'NUMBER' : true;
                      const draft = calibrationDrafts[config.key] || {};
                      return (
                        <Fragment key={config.key}>
                          <TableRow>
                            <TableCell>
                              <Checkbox
                                size="small"
                                checked={config.enabled !== false}
                                onChange={(event) =>
                                  handleConfigChange(config.key, {
                                    enabled: event.target.checked,
                                  })
                                }
                                disabled={savingSensors}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{config.sensorType}</Typography>
                              <Typography variant="caption" color="textSecondary">
                                {config.key}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                value={config.label || ''}
                                className={classes.configInput}
                                onChange={(event) =>
                                  handleConfigChange(config.key, { label: event.target.value })
                                }
                                disabled={savingSensors}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                value={config.rawUnit || ''}
                                className={classes.configInput}
                                onChange={(event) =>
                                  handleConfigChange(config.key, { rawUnit: event.target.value })
                                }
                                disabled={savingSensors}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                variant="standard"
                                value={config.displayUnit || config.unit || ''}
                                className={classes.configInput}
                                onChange={(event) =>
                                  handleConfigChange(config.key, {
                                    displayUnit: event.target.value,
                                    unit: event.target.value,
                                  })
                                }
                                disabled={savingSensors}
                              />
                            </TableCell>
                            {[
                              'multiplier',
                              'offset',
                              'minValue',
                              'maxValue',
                              'warningMin',
                              'warningMax',
                              'criticalMin',
                              'criticalMax',
                            ].map((name) => (
                              <TableCell key={name}>
                                <TextField
                                  size="small"
                                  variant="standard"
                                  type="number"
                                  value={config[name] ?? ''}
                                  className={classes.configInput}
                                  onChange={(event) =>
                                    handleConfigNumberChange(config.key, name, event.target.value)
                                  }
                                  disabled={savingSensors}
                                />
                              </TableCell>
                            ))}
                            <TableCell>
                              <Box className={classes.reorder}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveConfig(config.key, -1)}
                                  disabled={savingSensors || index === 0}
                                >
                                  <ArrowUpwardIcon fontSize="inherit" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleMoveConfig(config.key, 1)}
                                  disabled={savingSensors || index === configs.length - 1}
                                >
                                  <ArrowDownwardIcon fontSize="inherit" />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                          {numeric && (
                            <TableRow className={classes.calibrationRow}>
                              <TableCell />
                              <TableCell colSpan={13}>
                                <Box className={classes.calibrationPanel}>
                                  <Typography variant="caption" color="textSecondary">
                                    {t('telemetryCalibration')}
                                  </Typography>
                                  <Box className={classes.calibrationFields}>
                                    {['rawMin', 'rawMax', 'displayMin', 'displayMax'].map(
                                      (name) => (
                                        <TextField
                                          key={name}
                                          size="small"
                                          variant="standard"
                                          type="number"
                                          label={t(`telemetry${name}`)}
                                          value={draft[name] ?? ''}
                                          className={classes.calibrationInput}
                                          onChange={(event) =>
                                            handleCalibrationDraftChange(
                                              config.key,
                                              name,
                                              event.target.value,
                                            )
                                          }
                                          error={calibrationErrors[config.key]}
                                          disabled={savingSensors}
                                        />
                                      ),
                                    )}
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleApplyCalibration(config.key, draft)}
                                    disabled={savingSensors}
                                  >
                                    {t('sharedApply')}
                                  </Button>
                                  <Box className={classes.presets}>
                                    {calibrationPresets.map((preset) => (
                                      <Button
                                        key={preset.label}
                                        size="small"
                                        variant="text"
                                        onClick={() =>
                                          handleApplyCalibrationPreset(config.key, preset)
                                        }
                                        disabled={savingSensors}
                                      >
                                        {preset.label}
                                      </Button>
                                    ))}
                                  </Box>
                                  {calibrationErrors[config.key] && (
                                    <Typography variant="caption" color="error">
                                      {t('telemetryInvalidCalibration')}
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
            {visibleConfigs.length ? (
              <Box className={classes.sensorTable}>
                <Box className={classes.sensorTableHeader}>
                  <Box className={classes.sensorCheckboxCell} />
                  <Box className={classes.sensorCell}>{t('telemetryColumnLabel')}</Box>
                  <Box className={classes.sensorCell}>{t('telemetryColumnValue')}</Box>
                  <Box className={classes.sensorCell}>{t('telemetryColumnRaw')}</Box>
                  <Box className={classes.sensorCell}>{t('telemetryColumnUnit')}</Box>
                  <Box className={classes.sensorCell}>{t('telemetryColumnStatus')}</Box>
                  <Box className={classes.sensorCell}>{t('telemetryColumnUpdated')}</Box>
                </Box>
                <Box className={classes.sensorTableBody}>
                  {visibleConfigs.map((config) => {
                    const item = itemByKey.get(config.key);
                    const selected = selectedSensorKeys.includes(config.key);
                    return (
                      <Box
                        key={config.key}
                        className={cx(classes.sensorRow, selected && classes.selectedRow)}
                        onClick={(event) => handleRowClick(config.key, event)}
                      >
                        <Box className={classes.sensorCheckboxCell}>
                          <Checkbox
                            size="small"
                            checked={selected}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              handleCheckboxChange(config.key, event.target.checked)
                            }
                          />
                        </Box>
                        <Box className={classes.sensorCell}>{config.label || config.key}</Box>
                        <Box className={classes.sensorCell}>
                          {item ? formatTelemetryValue(item) : ''}
                        </Box>
                        <Box className={classes.sensorCell}>{item ? formatRawValue(item) : ''}</Box>
                        <Box className={classes.sensorCell}>{getUnit(config)}</Box>
                        <Box className={classes.sensorCell}>
                          {item && <TelemetryStatus item={item} config={config} />}
                        </Box>
                        <Box className={classes.sensorCell}>
                          {item ? formatTime(item.fixTime || item.createdAt, 'minutes') : ''}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary" className={classes.empty}>
                {loaded ? t('telemetryNoData') : t('telemetrySelectDevice')}
              </Typography>
            )}
          </>

          <Paper variant="outlined" className={cx(classes.panel, classes.chartPanel)}>
            <Box className={classes.panelHeader}>
              <Typography variant="subtitle2">{t('telemetryHistoryChart')}</Typography>
              <Box className={classes.chips}>
                {selectedConfigs.map((config) => (
                  <Chip
                    key={config.key}
                    size="small"
                    label={getSensorLabel(config, config.key)}
                    onDelete={() =>
                      applySelection(
                        selectedSensorKeys.filter((selectedKey) => selectedKey !== config.key),
                      )
                    }
                  />
                ))}
              </Box>
            </Box>
            <Box className={cx(classes.panelBody, classes.chartBody)}>
              {selectedHasNonNumeric && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  {t('telemetryNonNumericSensors')}
                </Alert>
              )}
              {!numericSelectedKeys.length && loaded && selectedSensorKeys.length > 0 && (
                <Alert severity="info">{t('telemetryNoNumericChartData')}</Alert>
              )}
              {numericSelectedKeys.length > 0 &&
                !chartSeries.some((series) => series.data.length) &&
                loaded && <Alert severity="info">{t('telemetryNoPeriodData')}</Alert>}
              {chartData.length > 0 && (
                <Box className={classes.chart}>
                  <Box className={classes.chartLegend}>
                    {chartSeries.map((series) => (
                      <Box key={series.key} className={classes.chartLegendItem}>
                        <Box
                          className={classes.chartLegendSwatch}
                          sx={{ backgroundColor: series.color }}
                        />
                        <Typography variant="caption">
                          {getSensorLabel(series.config, series.key)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {activeChartRow && (
                    <Box className={classes.chartActiveValues}>
                      {chartSeries.map((series) => {
                        const point = activeChartRow.points[series.key];
                        return (
                          <Box key={series.key} className={classes.chartActiveChip}>
                            <Box
                              className={classes.chartActiveDot}
                              sx={{ backgroundColor: series.color }}
                            />
                            <Typography variant="caption" color="textSecondary">
                              {series.config?.label || series.key}
                            </Typography>
                            <Typography
                              variant="caption"
                              className={point ? classes.chartValue : classes.chartEmptyValue}
                            >
                              {point
                                ? `${formatTelemetryNumber(point.value)}${
                                    getUnit(series.config) ? ` ${getUnit(series.config)}` : ''
                                  }`
                                : '—'}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 28, left: 0, bottom: 32 }}
                      onMouseMove={handleChartMouseMove}
                      onMouseLeave={() => setHoveredPacket(null)}
                    >
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        tickFormatter={(value) => formatChartTime(value, chartTimeDomain)}
                        domain={chartTimeDomain}
                        ticks={chartTimeTicks}
                        interval={0}
                        scale="time"
                        minTickGap={72}
                        tickMargin={12}
                        tick={{ fontSize: 11, fill: chartTheme.axisText }}
                        axisLine={{ stroke: chartTheme.axisLine }}
                        tickLine={false}
                      />
                      {chartSeries.map((series, index) => (
                        <YAxis
                          key={series.yAxisId}
                          yAxisId={series.yAxisId}
                          orientation={index === 1 ? 'right' : 'left'}
                          type="number"
                          tickFormatter={(value) => formatTelemetryNumber(value)}
                          domain={['auto', 'auto']}
                          tick={{ fontSize: 11, fill: chartTheme.axisText }}
                          axisLine={{ stroke: index < 2 ? series.color : chartTheme.axisLine }}
                          tickLine={{ stroke: chartTheme.tickLine }}
                          hide={index > 1}
                        />
                      ))}
                      <CartesianGrid
                        stroke={chartTheme.gridStroke}
                        strokeDasharray={chartTheme.gridDash}
                      />
                      <Tooltip
                        allowEscapeViewBox={{ x: true, y: true }}
                        cursor={{
                          stroke: 'rgba(226, 232, 240, 0.55)',
                          strokeWidth: 1,
                        }}
                        content={(props) => (
                          <TelemetryChartTooltip
                            {...props}
                            seriesList={chartSeries}
                            t={t}
                            classes={classes}
                          />
                        )}
                      />
                      {activeChartRow && (
                        <ReferenceLine
                          yAxisId={chartSeries[0]?.yAxisId}
                          x={activeChartRow.timestamp}
                          stroke={chartTheme.cursorStroke}
                          strokeDasharray={chartTheme.cursorDash}
                          strokeWidth={1}
                          ifOverflow="extendDomain"
                          isFront
                        />
                      )}
                      {chartSeries.map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          yAxisId={series.yAxisId}
                          dataKey={series.valueKey}
                          name={getSensorLabel(series.config, series.key)}
                          stroke={series.color}
                          strokeWidth={1.8}
                          dot={(props) => (
                            <TelemetryActiveDot
                              {...props}
                              dataKey={series.valueKey}
                              activeRow={activeChartRow}
                              color={series.color}
                            />
                          )}
                          activeDot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" className={cx(classes.panel, classes.historyPanel)}>
            <Box className={classes.panelHeader}>
              <Typography variant="subtitle2">{t('telemetryHistoryTable')}</Typography>
              {historyLoading && <CircularProgress size={18} />}
            </Box>
            <Box className={cx(classes.panelBody, classes.tableBody)}>
              {sortedHistoryItems.length ? (
                <Box className={cx(classes.tableWrap, classes.historyTableWrap)}>
                  <Table size="small" className={classes.table}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('telemetryColumnTime')}</TableCell>
                        {selectedSensorKeys.length > 1 && (
                          <TableCell>{t('telemetryColumnSensor')}</TableCell>
                        )}
                        <TableCell>{t('telemetryColumnValue')}</TableCell>
                        <TableCell>{t('telemetryColumnRaw')}</TableCell>
                        <TableCell>{t('telemetryColumnUnit')}</TableCell>
                        <TableCell>{t('telemetryColumnStatus')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedHistoryItems.map((item, index) => {
                        const config = configByKey.get(item.key);
                        return (
                          <TableRow
                            key={`${item.key}-${item.fixTime || item.createdAt}-${index}`}
                            hover
                          >
                            <TableCell>
                              {formatTime(item.fixTime || item.createdAt, 'seconds')}
                            </TableCell>
                            {selectedSensorKeys.length > 1 && (
                              <TableCell>{config?.label || item.key}</TableCell>
                            )}
                            <TableCell>{formatTelemetryValue(item)}</TableCell>
                            <TableCell>{formatRawValue(item)}</TableCell>
                            <TableCell>{getUnit(config)}</TableCell>
                            <TableCell>
                              <TelemetryStatus item={item} config={config} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary" className={classes.empty}>
                  {loaded ? t('telemetryNoPeriodData') : t('telemetrySelectDevice')}
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>
      </div>
    </PageLayout>
  );
};

export default TelemetryReportPage;
