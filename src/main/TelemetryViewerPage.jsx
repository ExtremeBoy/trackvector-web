import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Chip, IconButton, Paper, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import { makeStyles } from 'tss-react/mui';
import PageLayout from '../common/components/PageLayout';
import TelemetryPanel from '../common/components/TelemetryPanel';
import { useTranslation } from '../common/components/LocalizationProvider';
import { formatStatus, formatTime, getStatusColor } from '../common/util/formatter';
import { devicesActions } from '../store';
import ReportsMenu from '../reports/components/ReportsMenu';

const useStyles = makeStyles()((theme) => ({
  shell: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    color: theme.enterprise.colors.text,
    background: 'linear-gradient(180deg, #0f1720 0%, #111827 44%, #151b22 100%)',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 1.5),
    borderBottom: `1px solid ${theme.enterprise.colors.border}`,
    backgroundColor: theme.enterprise.colors.surfaceAlt,
    boxShadow: theme.enterprise.shadows.overlay,
    [theme.breakpoints.down('sm')]: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  },
  titleBlock: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
  },
  titleText: {
    minWidth: 0,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    paddingTop: theme.spacing(0.5),
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(1.25),
  },
  panel: {
    minHeight: 'calc(100vh - 150px)',
    overflow: 'hidden',
    padding: theme.spacing(1.25),
    borderRadius: theme.enterprise.radius.sm,
    borderColor: theme.enterprise.colors.border,
    backgroundColor: 'rgba(15, 23, 32, 0.92)',
    color: theme.enterprise.colors.text,
  },
}));

const statusPalette = {
  success: 'success',
  error: 'error',
  neutral: 'default',
};

const TelemetryViewerPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();
  const { deviceId } = useParams();
  const numericDeviceId = Number(deviceId);

  const device = useSelector((state) => state.devices.items[numericDeviceId]);
  const position = useSelector((state) => state.session.positions[numericDeviceId]);
  const statusColor = getStatusColor(device?.status);

  useEffect(() => {
    if (Number.isFinite(numericDeviceId)) {
      dispatch(devicesActions.selectId(numericDeviceId));
    }
  }, [dispatch, numericDeviceId]);

  const close = () => navigate('/');

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['sharedDevice', 'telemetryTitle']}>
      <Box className={classes.shell}>
        <Box className={classes.header}>
          <Box className={classes.titleBlock}>
            <IconButton size="small" onClick={close}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Box className={classes.titleText}>
              <Typography variant="h6" noWrap>
                {device?.name || t('telemetryTitle')}
              </Typography>
              <Box className={classes.meta}>
                <Chip
                  size="small"
                  color={statusPalette[statusColor]}
                  label={device?.status ? formatStatus(device.status, t) : t('deviceStatusUnknown')}
                />
                <Typography variant="caption" color="textSecondary">
                  {position?.fixTime
                    ? `${t('positionFixTime')}: ${formatTime(position.fixTime, 'minutes')}`
                    : t('telemetryNoData')}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box className={classes.actions}>
            <Button size="small" variant="outlined" startIcon={<ArrowBackIcon />} onClick={close}>
              {t('sharedBack')}
            </Button>
            <IconButton size="small" onClick={close} title={t('sharedClose')}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Box className={classes.content}>
          <Paper variant="outlined" className={classes.panel}>
            <TelemetryPanel deviceId={numericDeviceId} position={position} />
          </Paper>
        </Box>
      </Box>
    </PageLayout>
  );
};

export default TelemetryViewerPage;
