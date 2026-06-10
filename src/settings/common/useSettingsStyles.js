import { makeStyles } from 'tss-react/mui';

export default makeStyles()((theme) => ({
  table: {
    marginBottom: theme.spacing(10),
    border: `1px solid ${theme.enterprise.colors.border}`,
    borderRadius: theme.enterprise.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.enterprise.colors.backgroundElevated,
  },
  columnAction: {
    width: '1%',
    paddingRight: theme.spacing(1),
  },
  container: {
    marginTop: theme.spacing(1.5),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(3),
    color: theme.enterprise.colors.text,
    '& .MuiAccordion-root': {
      border: `1px solid ${theme.enterprise.colors.border}`,
      borderRadius: theme.enterprise.radius.sm,
      overflow: 'hidden',
      backgroundColor: theme.enterprise.colors.surface,
      boxShadow: 'none',
      '&:before': {
        display: 'none',
      },
    },
    '& .MuiAccordionSummary-root': {
      minHeight: 42,
      borderBottom: `1px solid ${theme.enterprise.colors.borderSubtle}`,
      backgroundColor: theme.enterprise.colors.surfaceAlt,
    },
    '& .MuiAccordionSummary-content': {
      margin: theme.spacing(0.75, 0),
    },
    '& .MuiAccordionDetails-root': {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.25),
      padding: theme.spacing(1.5),
    },
    '& .MuiTextField-root, & .MuiFormControl-root': {
      marginTop: 0,
      marginBottom: 0,
    },
  },
  buttons: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    '& > *': {
      flexBasis: 'auto',
      minWidth: 118,
    },
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    paddingBottom: theme.spacing(2),
  },
  verticalActions: {
    display: 'flex',
    flexDirection: 'column',
  },
}));
