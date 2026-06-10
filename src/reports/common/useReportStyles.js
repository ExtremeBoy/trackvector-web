import { makeStyles } from 'tss-react/mui';

export default makeStyles()((theme) => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    color: theme.enterprise.colors.text,
    backgroundColor: theme.enterprise.colors.background,
  },
  containerMap: {
    flexBasis: '40%',
    flexShrink: 0,
  },
  containerMain: {
    overflow: 'auto',
    padding: theme.spacing(1.25),
    backgroundColor: theme.enterprise.colors.background,
    '& > .MuiTable-root, & .MuiTable-root': {
      minWidth: 720,
    },
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 3,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    borderBottom: `1px solid ${theme.enterprise.colors.border}`,
    backgroundColor: theme.enterprise.colors.surfaceAlt,
    boxShadow: theme.enterprise.shadows.overlay,
  },
  columnAction: {
    width: '1%',
    paddingLeft: theme.spacing(1),
    '@media print': {
      display: 'none',
    },
  },
  columnActionContainer: {
    display: 'flex',
  },
  filter: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.enterprise.colors.borderSubtle}`,
    backgroundColor: theme.enterprise.colors.surfaceAlt,
    '& .MuiInputBase-root, & .MuiButton-root': {
      minHeight: theme.enterprise.density.controlHeight,
    },
    '@media print': {
      display: 'none !important',
    },
  },
  filterItem: {
    minWidth: 0,
    flex: `1 1 ${theme.dimensions.filterFormWidth}`,
  },
  filterButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    flex: `1 1 ${theme.dimensions.filterFormWidth}`,
    alignItems: 'center',
  },
  filterButton: {
    flexGrow: 1,
  },
  chart: {
    flexGrow: 1,
    overflow: 'hidden',
  },
  actionCellPadding: {
    '&.MuiTableCell-body': {
      paddingTop: 0,
      paddingBottom: 0,
    },
    '@media print': {
      display: 'none',
    },
  },
}));
