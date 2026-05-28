import { Box, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PageLayout from '../common/components/PageLayout';
import { useTranslation } from '../common/components/LocalizationProvider';
import ReportFilter from './components/ReportFilter';
import ReportsMenu from './components/ReportsMenu';
import useReportStyles from './common/useReportStyles';

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
}));

const TrackInspectorPage = () => {
  const reportClasses = useReportStyles().classes;
  const { classes, cx } = useStyles();
  const t = useTranslation();

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTrackInspector']}>
      <div className={reportClasses.container}>
        <div className={reportClasses.header}>
          <ReportFilter deviceType="single" loading={false} onShow={() => {}} />
        </div>
        <Box className={classes.content}>
          <Paper className={cx(classes.panel, classes.mapPanel)} variant="outlined">
            <div className={classes.placeholder}>
              <Typography variant="body2">{t('trackInspectorMapPlaceholder')}</Typography>
            </div>
          </Paper>
          <Paper className={cx(classes.panel, classes.tablePanel)} variant="outlined">
            <div className={classes.placeholder}>
              <Typography variant="body2">{t('trackInspectorTablePlaceholder')}</Typography>
            </div>
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
