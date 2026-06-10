import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BarChartIcon from '@mui/icons-material/BarChart';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from './LocalizationProvider';
import TelemetryPanel from './TelemetryPanel';
import { formatStatus, formatTime, getStatusColor } from '../util/formatter';

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: 5,
    left: '50%',
    transform: 'translateX(-50%)',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + ${desktopPadding} / 2)`,
      bottom: theme.spacing(3),
    },
    [theme.breakpoints.down('md')]: {
      width: `calc(100% - ${theme.spacing(2)})`,
      bottom: `calc(${theme.spacing(1.5)} + ${theme.dimensions.bottomBarHeight}px)`,
    },
  },
  card: {
    pointerEvents: 'auto',
    width: 680,
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    border: `1px solid ${theme.enterprise.colors.border}`,
    borderRadius: theme.enterprise.radius.sm,
    backgroundColor: theme.enterprise.colors.surface,
    boxShadow: theme.enterprise.shadows.overlay,
    backdropFilter: 'blur(10px)',
    [theme.breakpoints.down('md')]: {
      width: '100%',
      maxWidth: 'none',
      maxHeight: '82vh',
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1, 0.85, 1),
    borderBottom: `1px solid ${theme.enterprise.colors.borderSubtle}`,
  },
  titleBlock: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  titleText: {
    minWidth: 0,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    paddingTop: theme.spacing(0.35),
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    flexShrink: 0,
  },
  content: {
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(1),
    '&:last-child': {
      paddingBottom: theme.spacing(1),
    },
  },
  footer: {
    justifyContent: 'flex-start',
    padding: theme.spacing(0.75, 1),
    borderTop: `1px solid ${theme.enterprise.colors.borderSubtle}`,
  },
}));

const statusPalette = {
  success: 'success',
  error: 'error',
  neutral: 'default',
};

const DeviceTelemetryPopup = ({ deviceId, position, onBack, onClose, desktopPadding = 0 }) => {
  const { classes } = useStyles({ desktopPadding });
  const navigate = useNavigate();
  const t = useTranslation();
  const device = useSelector((state) => state.devices.items[deviceId]);
  const statusColor = getStatusColor(device?.status);

  const openReport = () => {
    const query = new URLSearchParams({
      deviceId: String(deviceId),
      from: dayjs().startOf('day').toISOString(),
      to: dayjs().endOf('day').toISOString(),
    });
    navigate(`/reports/telemetry?${query.toString()}`);
  };

  if (!device) {
    return null;
  }

  return (
    <div className={classes.root}>
      <Rnd
        default={{ x: 0, y: 0, width: 'auto', height: 'auto' }}
        enableResizing={false}
        dragHandleClassName="draggable-header"
        style={{ position: 'relative' }}
      >
        <Card elevation={3} className={classes.card}>
          <Box className={`${classes.header} draggable-header`}>
            <Box className={classes.titleBlock}>
              <Tooltip title={t('sharedBack')}>
                <IconButton size="small" onClick={onBack} onTouchStart={onBack}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Box className={classes.titleText}>
                <Typography variant="body2" noWrap>
                  {device.name}
                </Typography>
                <Box className={classes.meta}>
                  <Chip
                    size="small"
                    color={statusPalette[statusColor]}
                    label={
                      device.status ? formatStatus(device.status, t) : t('deviceStatusUnknown')
                    }
                  />
                  <Typography variant="caption" color="textSecondary">
                    {position?.fixTime
                      ? formatTime(position.fixTime, 'minutes')
                      : t('telemetryNoData')}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box className={classes.actions}>
              <Tooltip title={t('sharedClose')}>
                <IconButton size="small" onClick={onClose} onTouchStart={onClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <CardContent className={classes.content}>
            <TelemetryPanel deviceId={deviceId} position={position} compact />
          </CardContent>
          <CardActions className={classes.footer}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<BarChartIcon />}
              onClick={openReport}
            >
              {t('telemetryOpenReport')}
            </Button>
          </CardActions>
        </Card>
      </Rnd>
    </div>
  );
};

export default DeviceTelemetryPopup;
