import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import {
  IconButton,
  Tooltip,
  Avatar,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Typography,
} from '@mui/material';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import BatteryCharging60Icon from '@mui/icons-material/BatteryCharging60';
import Battery20Icon from '@mui/icons-material/Battery20';
import BatteryCharging20Icon from '@mui/icons-material/BatteryCharging20';
import ErrorIcon from '@mui/icons-material/Error';
import TimelineIcon from '@mui/icons-material/Timeline';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../store';
import {
  formatAlarm,
  formatBoolean,
  formatPercentage,
  formatStatus,
  getStatusColor,
} from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { mapIconKey, mapIcons } from '../map/core/preloadImages';
import { useAdministrator } from '../common/util/permissions';
import EngineIcon from '../resources/images/data/engine.svg?react';
import { useAttributePreference } from '../common/util/preferences';
import GeofencesValue from '../common/components/GeofencesValue';
import DriverValue from '../common/components/DriverValue';
import MotionBar from './components/MotionBar';

dayjs.extend(relativeTime);

const useStyles = makeStyles()((theme) => ({
  icon: {
    width: 22,
    height: 22,
    filter: 'brightness(0) invert(1)',
  },
  batteryText: {
    fontSize: '0.75rem',
    fontWeight: 'normal',
    lineHeight: '0.875rem',
  },
  success: {
    color: theme.palette.success.main,
  },
  warning: {
    color: theme.palette.warning.main,
  },
  error: {
    color: theme.palette.error.main,
  },
  neutral: {
    color: theme.palette.neutral.main,
  },
  selected: {
    backgroundColor: `${theme.enterprise.colors.rowSelected} !important`,
    boxShadow: `inset 3px 0 0 ${theme.enterprise.colors.success}, inset 0 0 18px rgba(34, 197, 94, 0.08)`,
  },
  item: {
    height: theme.enterprise.density.rowHeight - 4,
    margin: theme.spacing(0.25, 0.75),
    padding: theme.spacing(0.45, 0.75),
    border: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    borderRadius: theme.enterprise.radius.sm,
    color: theme.enterprise.colors.text,
    backgroundColor: 'rgba(15, 23, 32, 0.58)',
    transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow']),
    '&:hover': {
      borderColor: theme.enterprise.colors.border,
      backgroundColor: theme.enterprise.colors.rowHover,
    },
    '& .MuiListItemAvatar-root': {
      minWidth: 36,
    },
    '& .MuiAvatar-root': {
      width: 28,
      height: 28,
      borderRadius: theme.enterprise.radius.xs,
      backgroundColor: 'rgba(47, 129, 247, 0.16)',
      boxShadow: 'inset 0 0 0 1px rgba(47, 129, 247, 0.22)',
    },
    '& .MuiListItemText-root': {
      marginTop: 0,
      marginBottom: 0,
      minWidth: 0,
    },
    '& .MuiListItemText-primary': {
      color: theme.enterprise.colors.text,
      fontSize: theme.enterprise.typography.bodySize,
      fontWeight: 600,
      lineHeight: 1.25,
    },
    '& .MuiListItemText-secondary': {
      color: theme.enterprise.colors.textMuted,
      fontSize: theme.enterprise.typography.denseSize,
      lineHeight: 1.25,
    },
    '& .MuiIconButton-root': {
      width: 28,
      height: 28,
      padding: theme.spacing(0.25),
    },
  },
}));

const DeviceRow = ({ devices, index, style, onShowStatus, onShowTelemetry }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const item = devices[index];
  const position = useSelector((state) => state.session.positions[item.id]);

  const devicePrimary = useAttributePreference('devicePrimary', 'name');
  const deviceSecondary = useAttributePreference('deviceSecondary', '');

  const resolveFieldValue = (field) => {
    if (field === 'geofenceIds') {
      const geofenceIds = position?.geofenceIds;
      return geofenceIds?.length ? <GeofencesValue geofenceIds={geofenceIds} /> : null;
    }
    if (field === 'driverUniqueId') {
      const driverUniqueId = position?.attributes?.driverUniqueId;
      return driverUniqueId ? <DriverValue driverUniqueId={driverUniqueId} /> : null;
    }
    if (field === 'motion') {
      return <MotionBar deviceId={item.id} />;
    }
    return item[field];
  };

  const primaryValue = resolveFieldValue(devicePrimary);
  const secondaryValue = resolveFieldValue(deviceSecondary);

  const secondaryText = () => {
    let status;
    if (item.status === 'online' || !item.lastUpdate) {
      status = formatStatus(item.status, t);
    } else {
      status = dayjs(item.lastUpdate).fromNow();
    }
    return (
      <>
        {secondaryValue && (
          <>
            {secondaryValue}
            {' • '}
          </>
        )}
        <span className={classes[getStatusColor(item.status)]}>{status}</span>
      </>
    );
  };

  const openTelemetry = (event) => {
    event.stopPropagation();
    dispatch(devicesActions.selectId(item.id));
    onShowTelemetry?.();
  };

  return (
    <div style={style}>
      <ListItemButton
        key={item.id}
        onClick={() => {
          dispatch(devicesActions.selectId(item.id));
          onShowStatus?.();
        }}
        disabled={!admin && item.disabled}
        selected={selectedDeviceId === item.id}
        className={`${classes.item} ${selectedDeviceId === item.id ? classes.selected : ''}`}
      >
        <ListItemAvatar>
          <Avatar>
            <img className={classes.icon} src={mapIcons[mapIconKey(item.category)]} alt="" />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={primaryValue}
          secondary={secondaryText()}
          slots={{
            primary: Typography,
            secondary: Typography,
          }}
          slotProps={{
            primary: { noWrap: true },
            secondary: { noWrap: true },
          }}
        />
        {position && (
          <>
            {position.attributes.hasOwnProperty('alarm') && (
              <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
                <IconButton size="small">
                  <ErrorIcon fontSize="small" className={classes.error} />
                </IconButton>
              </Tooltip>
            )}
            {position.attributes.hasOwnProperty('ignition') && (
              <Tooltip
                title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}
              >
                <IconButton size="small">
                  {position.attributes.ignition ? (
                    <EngineIcon width={20} height={20} className={classes.success} />
                  ) : (
                    <EngineIcon width={20} height={20} className={classes.neutral} />
                  )}
                </IconButton>
              </Tooltip>
            )}
            {position.attributes.hasOwnProperty('batteryLevel') && (
              <Tooltip
                title={`${t('positionBatteryLevel')}: ${formatPercentage(position.attributes.batteryLevel)}`}
              >
                <IconButton size="small">
                  {(position.attributes.batteryLevel > 70 &&
                    (position.attributes.charge ? (
                      <BatteryChargingFullIcon fontSize="small" className={classes.success} />
                    ) : (
                      <BatteryFullIcon fontSize="small" className={classes.success} />
                    ))) ||
                    (position.attributes.batteryLevel > 30 &&
                      (position.attributes.charge ? (
                        <BatteryCharging60Icon fontSize="small" className={classes.warning} />
                      ) : (
                        <Battery60Icon fontSize="small" className={classes.warning} />
                      ))) ||
                    (position.attributes.charge ? (
                      <BatteryCharging20Icon fontSize="small" className={classes.error} />
                    ) : (
                      <Battery20Icon fontSize="small" className={classes.error} />
                    ))}
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
        <Tooltip title={t('telemetryTitle')}>
          <IconButton size="small" onClick={openTelemetry} disabled={!admin && item.disabled}>
            <TimelineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;
