import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CircularProgress,
  IconButton,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import fetchOrThrow from '../util/fetchOrThrow';
import { formatTime } from '../util/formatter';

const useStyles = makeStyles()((theme) => ({
  root: {
    minHeight: theme.spacing(10),
    color: theme.enterprise.colors.text,
  },
  tableWrap: {
    overflowX: 'auto',
    border: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    borderRadius: theme.enterprise.radius.xs,
    backgroundColor: theme.enterprise.colors.backgroundElevated,
  },
  table: {
    minWidth: 520,
    '& .MuiTableCell-sizeSmall': {
      whiteSpace: 'nowrap',
      paddingLeft: theme.spacing(0.75),
      paddingRight: theme.spacing(0.75),
    },
    '& .MuiTableCell-sizeSmall:first-of-type': {
      /*paddingLeft: 0,*/
    },
  },
  empty: {
    padding: theme.spacing(1, 0),
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },
  status: {
    paddingBottom: theme.spacing(1),
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingBottom: theme.spacing(0.5),
    '& .MuiButton-root, & .MuiIconButton-root': {
      minHeight: 32,
      height: 32,
    },
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  sensorCell: {
    minWidth: 120,
  },
  sensorKey: {
    display: 'block',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  config: {
    paddingBottom: theme.spacing(1),
    color: theme.enterprise.colors.text,
  },
  configTable: {
    minWidth: 880,
    '& .MuiTableCell-sizeSmall': {
      whiteSpace: 'nowrap',
      paddingLeft: theme.spacing(0.5),
      paddingRight: theme.spacing(0.5),
    },
    '& .MuiTableCell-sizeSmall:first-of-type': {
      paddingLeft: 0,
    },
  },
  configInput: {
    '& .MuiInputBase-input': {
      paddingTop: theme.spacing(0.75),
      paddingBottom: theme.spacing(0.75),
    },
  },
  reorder: {
    display: 'flex',
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
    width: 76,
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
  statusText: {
    display: 'block',
  },
  selectedRow: {
    backgroundColor: `${theme.enterprise.colors.rowSelected} !important`,
    boxShadow: `inset 3px 0 0 ${theme.enterprise.colors.success}`,
    cursor: 'pointer',
  },
  history: {
    paddingTop: theme.spacing(2),
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  chart: {
    height: 220,
    padding: theme.spacing(1),
    border: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    borderRadius: theme.enterprise.radius.xs,
    backgroundColor: theme.enterprise.colors.surfaceMuted,
  },
  chartMessage: {
    paddingTop: theme.spacing(1),
  },
  subtitle: {
    display: 'block',
    paddingBottom: theme.spacing(1),
  },
}));

const closeCode = 4000;
const reconnectDelay = 30000;
const historyLimit = 300;
const timeRanges = [
  { value: 1, label: '1H', title: 'Last 1 hour' },
  { value: 6, label: '6H', title: 'Last 6 hours' },
  { value: 12, label: '12H', title: 'Last 12 hours' },
  { value: 24, label: '24H', title: 'Last 24 hours' },
];

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

const labels = {
  key: 'Key',
  sensor: 'Sensor',
  sensorType: 'Sensor type',
  value: 'Current value',
  rawValue: 'Raw value',
  unit: 'Unit',
  status: 'Status',
  valueType: 'Value type',
  time: 'Updated',
  visible: 'Visible',
  label: 'Label',
  rawUnit: 'Raw unit',
  displayUnit: 'Display unit',
  multiplier: 'Multiplier',
  offset: 'Offset',
  minValue: 'Min',
  maxValue: 'Max',
  warningMin: 'Warn min',
  warningMax: 'Warn max',
  criticalMin: 'Crit min',
  criticalMax: 'Crit max',
  order: 'Order',
  calibration: 'Calibration',
  rawMin: 'Raw min',
  rawMax: 'Raw max',
  displayMin: 'Display min',
  displayMax: 'Display max',
  applyCalibration: 'Apply',
  invalidCalibration: 'Enter finite values and make raw max different from raw min',
  editSensors: 'Edit sensors',
  saveSensors: 'Save sensor settings',
  closeSensors: 'Close sensor settings',
  loading: 'Loading telemetry',
  loadingSensors: 'Loading sensor settings',
  loadingHistory: 'Loading history',
  liveDisconnected: 'Live updates disconnected',
  empty: 'No telemetry available',
  hiddenEmpty: 'No enabled telemetry sensors',
  error: 'Unable to load telemetry',
  sensorError: 'Unable to load sensor settings',
  historyError: 'Unable to load telemetry history',
  historyEmpty: 'No telemetry history for selected range',
  selectSensor: 'Select a sensor to view history',
  nonNumeric: 'History chart is available for number telemetry only',
  normalStatus: 'Normal',
  warningStatus: 'Warning',
  criticalStatus: 'Critical',
};

const getRangeStart = (rangeHours, to = Date.now()) => to - rangeHours * 60 * 60 * 1000;

export const getTelemetryValueType = (point) => {
  if (point.valueType) {
    return point.valueType;
  }
  if (point.valueNumber != null) {
    return 'NUMBER';
  }
  if (point.valueBoolean != null) {
    return 'BOOLEAN';
  }
  return 'STRING';
};

const sortItems = (items) =>
  Array.from(items).sort((first, second) => first.key.localeCompare(second.key));

const sortSensorConfigs = (items) =>
  Array.from(items).sort((first, second) => {
    const firstOrder = first.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
    return first.key.localeCompare(second.key);
  });

const sortHistoryItems = (items) =>
  Array.from(items).sort((first, second) => first.time - second.time);

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
    sortItems(items).map((item, index) => ({
      key: item.key,
      label: item.key,
      sensorType: inferSensorType(item),
      enabled: true,
      sortOrder: index,
    })),
  );

export const formatTelemetryNumber = (value) =>
  Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });

export const formatTelemetryValue = (point) => {
  switch (getTelemetryValueType(point)) {
    case 'NUMBER':
      return point.valueNumber != null ? formatTelemetryNumber(point.valueNumber) : '';
    case 'BOOLEAN':
      return point.valueBoolean ? 'On' : 'Off';
    case 'STRING':
      return point.valueString ?? '';
    default:
      if (point.valueNumber != null) {
        return formatTelemetryNumber(point.valueNumber);
      }
      if (point.valueBoolean != null) {
        return point.valueBoolean ? 'On' : 'Off';
      }
      return point.valueString ?? '';
  }
};

export const getTelemetryStatus = (point, config) => {
  if (getTelemetryValueType(point) !== 'NUMBER' || point.valueNumber == null || !config) {
    return { level: 'normal', label: labels.normalStatus };
  }
  const value = Number(point.valueNumber);
  if (!Number.isFinite(value)) {
    return { level: 'normal', label: labels.normalStatus };
  }
  if (
    (typeof config.criticalMin === 'number' && value < config.criticalMin) ||
    (typeof config.criticalMax === 'number' && value > config.criticalMax)
  ) {
    return { level: 'critical', label: labels.criticalStatus };
  }
  if (
    (typeof config.warningMin === 'number' && value < config.warningMin) ||
    (typeof config.warningMax === 'number' && value > config.warningMax) ||
    (typeof config.minValue === 'number' && value < config.minValue) ||
    (typeof config.maxValue === 'number' && value > config.maxValue)
  ) {
    return { level: 'warning', label: labels.warningStatus };
  }
  return { level: 'normal', label: labels.normalStatus };
};

export const getTelemetryStatusColor = (theme, level) => {
  if (level === 'critical') {
    return theme.palette.error.main;
  }
  if (level === 'warning') {
    return theme.palette.warning.main;
  }
  return theme.palette.text.disabled;
};

export const getTelemetryStatusDescription = (status, config) => {
  if (status.level === 'critical') {
    return `Critical threshold: ${config.criticalMin ?? '-'} to ${config.criticalMax ?? '-'}`;
  }
  if (status.level === 'warning') {
    return `Warning threshold: ${config.warningMin ?? config.minValue ?? '-'} to ${
      config.warningMax ?? config.maxValue ?? '-'
    }`;
  }
  return 'Within configured range';
};

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

const isLikelyNumericSensor = (sensorType) =>
  ['ANALOG', 'VOLTAGE', 'FUEL', 'TEMPERATURE', 'CAN'].includes(sensorType);

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

const TelemetryPanel = ({ deviceId, position, compact = false }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [liveError, setLiveError] = useState(false);
  const [sensorConfigs, setSensorConfigs] = useState([]);
  const [savedSensorConfigs, setSavedSensorConfigs] = useState([]);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savingSensors, setSavingSensors] = useState(false);
  const [calibrationDrafts, setCalibrationDrafts] = useState({});
  const [calibrationErrors, setCalibrationErrors] = useState({});
  const [selectedKey, setSelectedKey] = useState();
  const [rangeHours, setRangeHours] = useState(1);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [chartWindow, setChartWindow] = useState(() => {
    const to = Date.now();
    return { from: getRangeStart(1, to), to };
  });

  const socketRef = useRef();
  const reconnectTimeoutRef = useRef();
  const selectedKeyRef = useRef();
  const rangeHoursRef = useRef(rangeHours);

  const positionTelemetry = useMemo(() => {
    if (!position?.attributes) {
      return [];
    }
    return sortItems(
      Object.entries(position.attributes).map(([key, value]) => {
        const point = {
          key,
          deviceId: position.deviceId,
          positionId: position.id,
          fixTime: position.fixTime,
        };
        if (typeof value === 'number') {
          return { ...point, valueNumber: value, valueType: 'NUMBER' };
        }
        if (typeof value === 'boolean') {
          return { ...point, valueBoolean: value, valueType: 'BOOLEAN' };
        }
        return { ...point, valueString: value == null ? '' : String(value), valueType: 'STRING' };
      }),
    );
  }, [position]);

  const configByKey = useMemo(
    () => new Map(sensorConfigs.map((config) => [config.key, config])),
    [sensorConfigs],
  );

  const itemByKey = useMemo(() => new Map(items.map((item) => [item.key, item])), [items]);

  const visibleItems = useMemo(
    () =>
      Array.from(items)
        .filter((item) => configByKey.get(item.key)?.enabled !== false)
        .sort((first, second) => {
          const firstConfig = configByKey.get(first.key);
          const secondConfig = configByKey.get(second.key);
          const firstOrder = firstConfig?.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const secondOrder = secondConfig?.sortOrder ?? Number.MAX_SAFE_INTEGER;
          if (firstOrder !== secondOrder) {
            return firstOrder - secondOrder;
          }
          return first.key.localeCompare(second.key);
        }),
    [configByKey, items],
  );

  const selectedItem = visibleItems.find((item) => item.key === selectedKey);
  const selectedNumeric = selectedItem && getTelemetryValueType(selectedItem) === 'NUMBER';
  const selectedRange = timeRanges.find((range) => range.value === rangeHours);
  const selectedConfig = selectedItem ? configByKey.get(selectedItem.key) : null;
  const selectedLabel = selectedConfig?.label || selectedItem?.key || selectedKey;

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    rangeHoursRef.current = rangeHours;
  }, [rangeHours]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const loadSensorConfigs = useCallback(async () => {
    if (!deviceId) {
      setSensorConfigs([]);
      setSavedSensorConfigs([]);
      return;
    }
    setSensorLoading(true);
    setSensorError(false);
    try {
      const query = new URLSearchParams({ deviceId });
      const response = await fetchOrThrow(`/api/telemetry/sensors?${query.toString()}`);
      const data = await response.json();
      const configs = Array.isArray(data) ? sortSensorConfigs(data) : [];
      setSensorConfigs(configs);
      setSavedSensorConfigs(configs);
    } catch {
      const fallbackConfigs = createSensorConfigsFromItems(positionTelemetry);
      setSensorConfigs(fallbackConfigs);
      setSavedSensorConfigs(fallbackConfigs);
      setSensorError(!fallbackConfigs.length);
    } finally {
      setSensorLoading(false);
    }
  }, [deviceId, positionTelemetry]);

  useEffect(() => {
    setEditMode(false);
    loadSensorConfigs();
  }, [loadSensorConfigs]);

  useEffect(() => {
    if (selectedKey && !visibleItems.some((item) => item.key === selectedKey)) {
      setSelectedKey(undefined);
    }
  }, [selectedKey, visibleItems]);

  useEffect(() => {
    if (!sensorLoading && sensorError && !sensorConfigs.length && items.length) {
      const fallbackConfigs = createSensorConfigsFromItems(items);
      setSensorConfigs(fallbackConfigs);
      setSavedSensorConfigs(fallbackConfigs);
      setSensorError(false);
    }
  }, [items, sensorConfigs.length, sensorError, sensorLoading]);

  const mergePoints = useCallback(
    (points, message) => {
      setItems((previous) => {
        setError(false);
        const merged = new Map(previous.map((item) => [item.key, item]));
        points.forEach((point) => {
          const valueType = getTelemetryValueType(point);
          merged.set(point.key, {
            ...merged.get(point.key),
            ...point,
            valueType,
            deviceId: message.deviceId ?? deviceId,
            positionId: message.positionId,
            fixTime: point.fixTime || message.fixTime,
          });
          if (
            point.key === selectedKeyRef.current &&
            valueType === 'NUMBER' &&
            point.valueNumber != null
          ) {
            const time = Date.parse(point.fixTime || message.fixTime);
            const now = Date.now();
            if (
              !Number.isNaN(time) &&
              time >= getRangeStart(rangeHoursRef.current, now) &&
              time <= now
            ) {
              setChartWindow({ from: getRangeStart(rangeHoursRef.current, now), to: now });
              setHistoryItems((previous) =>
                sortHistoryItems([
                  ...previous.filter((item) => item.time !== time),
                  { time, value: Number(point.valueNumber) },
                ])
                  .filter((item) => item.time >= getRangeStart(rangeHoursRef.current, now))
                  .slice(-historyLimit),
              );
            }
          }
        });
        return sortItems(merged.values());
      });
    },
    [deviceId],
  );

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

  const handleCancelEdit = useCallback(() => {
    setSensorConfigs(savedSensorConfigs);
    setEditMode(false);
    setSensorError(false);
  }, [savedSensorConfigs]);

  const handleSaveSensors = useCallback(async () => {
    setSavingSensors(true);
    setSensorError(false);
    try {
      const query = new URLSearchParams({ deviceId });
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
      setEditMode(false);
    } catch {
      setSensorError(true);
    } finally {
      setSavingSensors(false);
    }
  }, [deviceId, sensorConfigs]);

  useEffect(() => {
    let active = true;

    const loadTelemetry = async () => {
      setLoading(true);
      setError(false);
      setItems([]);
      try {
        const query = new URLSearchParams({ deviceId });
        const response = await fetchOrThrow(`/api/telemetry/latest?${query.toString()}`);
        const data = await response.json();
        if (active) {
          setItems((previous) => {
            const merged = new Map();
            if (Array.isArray(data)) {
              data.forEach((item) => {
                merged.set(item.key, { ...item, valueType: getTelemetryValueType(item) });
              });
            }
            previous.forEach((item) => merged.set(item.key, item));
            return sortItems(merged.values());
          });
        }
      } catch {
        if (active) {
          setItems(positionTelemetry);
          setError(!positionTelemetry.length);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (deviceId) {
      loadTelemetry();
    } else {
      setItems([]);
    }

    return () => {
      active = false;
    };
  }, [deviceId, positionTelemetry]);

  useEffect(() => {
    if (!selectedKey || !selectedNumeric) {
      setHistoryItems([]);
      setHistoryError(false);
      setHistoryLoading(false);
      return undefined;
    }

    let active = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(false);
      try {
        const toTime = Date.now();
        const fromTime = getRangeStart(rangeHours, toTime);
        const to = new Date(toTime);
        const from = new Date(fromTime);
        setChartWindow({ from: fromTime, to: toTime });
        const query = new URLSearchParams({
          deviceId,
          key: selectedKey,
          from: from.toISOString(),
          to: to.toISOString(),
          limit: historyLimit,
        });
        const response = await fetchOrThrow(`/api/telemetry/history?${query.toString()}`);
        const data = await response.json();
        if (active) {
          const history = Array.isArray(data)
            ? data
                .filter(
                  (item) => getTelemetryValueType(item) === 'NUMBER' && item.valueNumber != null,
                )
                .map((item) => ({
                  time: Date.parse(item.fixTime || item.createdAt),
                  value: Number(item.valueNumber),
                }))
                .filter((item) => !Number.isNaN(item.time))
            : [];
          setHistoryItems(sortHistoryItems(history));
        }
      } catch {
        if (active) {
          setHistoryItems([]);
          setHistoryError(true);
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, [deviceId, rangeHours, selectedKey, selectedNumeric]);

  useEffect(() => {
    if (!deviceId) {
      return undefined;
    }

    let active = true;

    const connectSocket = () => {
      clearReconnectTimeout();
      if (!active) {
        return;
      }
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        socketRef.current.close(closeCode);
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const query = new URLSearchParams({ deviceId });
      const socket = new WebSocket(
        `${protocol}//${window.location.host}/api/socket/telemetry?${query.toString()}`,
      );
      socketRef.current = socket;

      socket.onopen = () => {
        if (active) {
          setLiveError(false);
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.deviceId === deviceId && Array.isArray(message.points)) {
            mergePoints(message.points, message);
          }
        } catch {
          if (active) {
            setLiveError(true);
          }
        }
      };

      socket.onerror = () => {
        if (active) {
          setLiveError(true);
        }
      };

      socket.onclose = (event) => {
        if (active && event.code !== closeCode) {
          setLiveError(true);
          clearReconnectTimeout();
          // eslint-disable-next-line @eslint-react/web-api-no-leaked-timeout
          reconnectTimeoutRef.current = setTimeout(connectSocket, reconnectDelay);
        }
      };
    };

    connectSocket();

    return () => {
      active = false;
      clearReconnectTimeout();
      socketRef.current?.close(closeCode);
      socketRef.current = null;
    };
  }, [clearReconnectTimeout, deviceId, mergePoints]);

  if (loading && !items.length) {
    return (
      <Box className={classes.loading}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="textSecondary">
          {labels.loading}
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{labels.error}</Alert>;
  }

  return (
    <Box className={classes.root}>
      <Box className={classes.toolbar}>
        <Typography variant="body2" color="textSecondary">
          Telemetry
        </Typography>
        <Box className={classes.actions}>
          {sensorLoading && <CircularProgress size={16} />}
          {editMode ? (
            <>
              <MuiTooltip title={labels.saveSensors}>
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
              <MuiTooltip title={labels.closeSensors}>
                <span>
                  <IconButton size="small" onClick={handleCancelEdit} disabled={savingSensors}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </span>
              </MuiTooltip>
            </>
          ) : (
            <MuiTooltip title={labels.editSensors}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => setEditMode(true)}
                  disabled={sensorLoading || (!sensorConfigs.length && !items.length)}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </span>
            </MuiTooltip>
          )}
        </Box>
      </Box>
      {sensorError && (
        <Alert severity="error" className={classes.status}>
          {labels.sensorError}
        </Alert>
      )}
      {liveError && (
        <Typography variant="caption" color="textSecondary" className={classes.status}>
          {labels.liveDisconnected}
        </Typography>
      )}
      {editMode && (
        <Box className={classes.config}>
          <Box className={classes.tableWrap}>
            <Table size="small" className={classes.configTable}>
              <TableHead>
                <TableRow>
                  <TableCell>{labels.visible}</TableCell>
                  <TableCell>{labels.sensor}</TableCell>
                  <TableCell>{labels.label}</TableCell>
                  <TableCell>{labels.rawUnit}</TableCell>
                  <TableCell>{labels.displayUnit}</TableCell>
                  <TableCell>{labels.multiplier}</TableCell>
                  <TableCell>{labels.offset}</TableCell>
                  <TableCell>{labels.minValue}</TableCell>
                  <TableCell>{labels.maxValue}</TableCell>
                  <TableCell>{labels.order}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortSensorConfigs(sensorConfigs).map((config, index, configs) => {
                  const item = itemByKey.get(config.key);
                  const numeric = item
                    ? getTelemetryValueType(item) === 'NUMBER'
                    : isLikelyNumericSensor(config.sensorType);
                  const draft = calibrationDrafts[config.key] || {};
                  return (
                    <Fragment key={config.key}>
                      <TableRow>
                        <TableCell>
                          <Checkbox
                            size="small"
                            checked={config.enabled !== false}
                            onChange={(event) =>
                              handleConfigChange(config.key, { enabled: event.target.checked })
                            }
                            disabled={savingSensors}
                          />
                        </TableCell>
                        <TableCell className={classes.sensorCell}>
                          <Typography variant="body2">{config.sensorType}</Typography>
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            className={classes.sensorKey}
                          >
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
                        <TableCell>
                          <TextField
                            size="small"
                            variant="standard"
                            type="number"
                            value={config.multiplier ?? ''}
                            className={classes.configInput}
                            onChange={(event) =>
                              handleConfigNumberChange(config.key, 'multiplier', event.target.value)
                            }
                            disabled={savingSensors}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            variant="standard"
                            type="number"
                            value={config.offset ?? ''}
                            className={classes.configInput}
                            onChange={(event) =>
                              handleConfigNumberChange(config.key, 'offset', event.target.value)
                            }
                            disabled={savingSensors}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            variant="standard"
                            type="number"
                            value={config.minValue ?? ''}
                            className={classes.configInput}
                            onChange={(event) =>
                              handleConfigNumberChange(config.key, 'minValue', event.target.value)
                            }
                            disabled={savingSensors}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            variant="standard"
                            type="number"
                            value={config.maxValue ?? ''}
                            className={classes.configInput}
                            onChange={(event) =>
                              handleConfigNumberChange(config.key, 'maxValue', event.target.value)
                            }
                            disabled={savingSensors}
                          />
                        </TableCell>
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
                        <TableRow
                          key={`${config.key}-calibration`}
                          className={classes.calibrationRow}
                        >
                          <TableCell />
                          <TableCell colSpan={9}>
                            <Box className={classes.calibrationPanel}>
                              <Typography variant="caption" color="textSecondary">
                                {labels.calibration}
                              </Typography>
                              <Box className={classes.calibrationFields}>
                                {['rawMin', 'rawMax', 'displayMin', 'displayMax'].map((name) => (
                                  <TextField
                                    key={name}
                                    size="small"
                                    variant="standard"
                                    type="number"
                                    label={labels[name]}
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
                                ))}
                              </Box>
                              <Box className={classes.calibrationFields}>
                                {['warningMin', 'warningMax', 'criticalMin', 'criticalMax'].map(
                                  (name) => (
                                    <TextField
                                      key={name}
                                      size="small"
                                      variant="standard"
                                      type="number"
                                      label={labels[name]}
                                      value={config[name] ?? ''}
                                      className={classes.calibrationInput}
                                      onChange={(event) =>
                                        handleConfigNumberChange(
                                          config.key,
                                          name,
                                          event.target.value,
                                        )
                                      }
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
                                {labels.applyCalibration}
                              </Button>
                              <Box className={classes.presets}>
                                {calibrationPresets.map((preset) => (
                                  <Button
                                    key={preset.label}
                                    size="small"
                                    variant="text"
                                    onClick={() => handleApplyCalibrationPreset(config.key, preset)}
                                    disabled={savingSensors}
                                  >
                                    {preset.label}
                                  </Button>
                                ))}
                              </Box>
                              {calibrationErrors[config.key] && (
                                <Typography variant="caption" color="error">
                                  {labels.invalidCalibration}
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
        </Box>
      )}
      {!items.length && !sensorLoading && (
        <Typography variant="body2" color="textSecondary" className={classes.empty}>
          {labels.empty}
        </Typography>
      )}
      {!!items.length && !visibleItems.length && (
        <Typography variant="body2" color="textSecondary" className={classes.empty}>
          {labels.hiddenEmpty}
        </Typography>
      )}
      {!!visibleItems.length && (
        <Box className={classes.tableWrap}>
          <Table size="small" className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>{labels.label}</TableCell>
                <TableCell>{labels.value}</TableCell>
                <TableCell>{labels.rawValue}</TableCell>
                <TableCell>{labels.unit}</TableCell>
                <TableCell>{labels.status}</TableCell>
                <TableCell>{labels.time}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleItems.map((item) => {
                const config = configByKey.get(item.key);
                const label = config?.label || item.key;
                const rawValue =
                  getTelemetryValueType(item) === 'NUMBER' && item.rawValueNumber != null
                    ? formatTelemetryNumber(item.rawValueNumber)
                    : '';
                const unit = config?.displayUnit || config?.unit || config?.rawUnit || '';
                const status = getTelemetryStatus(item, config);
                const statusColor = getTelemetryStatusColor(theme, status.level);
                return (
                  <TableRow
                    hover
                    key={item.key}
                    selected={item.key === selectedKey}
                    className={item.key === selectedKey ? classes.selectedRow : null}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <TableCell className={classes.sensorCell}>
                      <MuiTooltip title={item.key}>
                        <Box>
                          <Typography variant="body2">{label}</Typography>
                          <Typography
                            variant="caption"
                            color="textSecondary"
                            className={classes.sensorKey}
                          >
                            {item.key}
                          </Typography>
                        </Box>
                      </MuiTooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatTelemetryValue(item)}</Typography>
                    </TableCell>
                    <TableCell>{rawValue}</TableCell>
                    <TableCell>{unit}</TableCell>
                    <TableCell>
                      <MuiTooltip title={getTelemetryStatusDescription(status, config || {})}>
                        <Box className={classes.statusValue}>
                          <Box
                            className={classes.statusDot}
                            sx={{ backgroundColor: statusColor }}
                          />
                          <Typography
                            variant="caption"
                            color={status.level === 'normal' ? 'textSecondary' : 'textPrimary'}
                            className={classes.statusText}
                          >
                            {status.label}
                          </Typography>
                        </Box>
                      </MuiTooltip>
                    </TableCell>
                    <TableCell>{formatTime(item.fixTime || item.createdAt, 'minutes')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
      {!compact && (
        <Box className={classes.history}>
          <Box className={classes.historyHeader}>
            <Typography variant="body2" color="textSecondary">
              {selectedLabel || labels.selectSensor}
            </Typography>
            <ButtonGroup
              size="small"
              variant="outlined"
              disabled={!selectedKey || !selectedNumeric}
            >
              {timeRanges.map((range) => (
                <Button
                  key={range.value}
                  variant={rangeHours === range.value ? 'contained' : 'outlined'}
                  onClick={() => setRangeHours(range.value)}
                >
                  {range.label}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
          {!selectedKey && (
            <Typography variant="body2" color="textSecondary" className={classes.chartMessage}>
              {labels.selectSensor}
            </Typography>
          )}
          {selectedKey && !selectedNumeric && (
            <Typography variant="body2" color="textSecondary" className={classes.chartMessage}>
              {labels.nonNumeric}
            </Typography>
          )}
          {selectedKey && selectedNumeric && historyLoading && (
            <Box className={classes.loading}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="textSecondary">
                {labels.loadingHistory}
              </Typography>
            </Box>
          )}
          {selectedKey && selectedNumeric && historyError && (
            <Alert severity="error">{labels.historyError}</Alert>
          )}
          {selectedKey && selectedNumeric && !historyLoading && !historyError && (
            <Typography variant="caption" color="textSecondary" className={classes.subtitle}>
              {selectedRange.title}
            </Typography>
          )}
          {selectedKey &&
            selectedNumeric &&
            !historyLoading &&
            !historyError &&
            !historyItems.length && (
              <Typography variant="body2" color="textSecondary" className={classes.chartMessage}>
                {labels.historyEmpty}
              </Typography>
            )}
          {selectedKey &&
            selectedNumeric &&
            !historyLoading &&
            !historyError &&
            historyItems.length > 0 && (
              <Box className={classes.chart}>
                <ResponsiveContainer>
                  <LineChart
                    data={historyItems}
                    margin={{
                      top: 10,
                      right: 12,
                      left: -18,
                      bottom: 0,
                    }}
                  >
                    <XAxis
                      stroke={theme.palette.text.primary}
                      dataKey="time"
                      type="number"
                      tickFormatter={(value) => formatTime(value, 'time')}
                      domain={[chartWindow.from, chartWindow.to]}
                      scale="time"
                    />
                    <YAxis
                      stroke={theme.palette.text.primary}
                      type="number"
                      tickFormatter={(value) => parseFloat(value.toFixed(2))}
                      domain={['auto', 'auto']}
                    />
                    <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.default,
                        color: theme.palette.text.primary,
                      }}
                      formatter={(value) => [
                        selectedConfig?.displayUnit || selectedConfig?.unit
                          ? `${formatTelemetryNumber(value)} ${
                              selectedConfig.displayUnit || selectedConfig.unit
                            }`
                          : formatTelemetryNumber(value),
                        selectedLabel,
                      ]}
                      labelFormatter={(value) => formatTime(value, 'seconds')}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={theme.palette.primary.main}
                      dot={historyItems.length <= 20}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
        </Box>
      )}
    </Box>
  );
};

export default TelemetryPanel;
