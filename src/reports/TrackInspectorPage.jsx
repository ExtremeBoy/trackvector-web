import { useCallback, useState } from 'react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PageLayout from '../common/components/PageLayout';
import { useTranslation } from '../common/components/LocalizationProvider';
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

  const [packets, setPackets] = useState([]);
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
      setPackets(data.map(normalizeTrackPacket));
      setLoaded(true);
    } catch (errorValue) {
      setPackets([]);
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
            <div className={classes.placeholder}>{renderTableState()}</div>
          </Paper>
          <Paper className={cx(classes.panel, classes.detailsPanel)} variant="outlined">
            <div className={classes.placeholder}>
              <Typography variant="body2">{t('trackInspectorDetailsPlaceholder')}</Typography>
            </div>
          </Paper>
        </Box>
      </div>
    </PageLayout>
  );
};

export default TrackInspectorPage;
