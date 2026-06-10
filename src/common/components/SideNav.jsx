import { Fragment } from 'react';
import { makeStyles } from 'tss-react/mui';
import {
  List,
  ListItemText,
  ListItemIcon,
  Divider,
  ListSubheader,
  ListItemButton,
} from '@mui/material';
import { Link, useLocation } from 'react-router-dom';

const SideNav = ({ routes }) => {
  const { classes } = useStyles();
  const location = useLocation();

  return (
    <List disablePadding className={classes.root}>
      {routes.map((route) =>
        route.subheader ? (
          <Fragment key={route.subheader}>
            <Divider />
            <ListSubheader>{route.subheader}</ListSubheader>
          </Fragment>
        ) : (
          <ListItemButton
            disableRipple
            component={Link}
            key={route.href}
            to={route.href}
            selected={location.pathname.match(route.match || route.href) !== null}
          >
            <ListItemIcon>{route.icon}</ListItemIcon>
            <ListItemText primary={route.name} />
          </ListItemButton>
        ),
      )}
    </List>
  );
};

const useStyles = makeStyles()((theme) => ({
  root: {
    paddingTop: theme.spacing(1),
    '& .MuiListSubheader-root': {
      color: theme.enterprise.colors.textSubtle,
      backgroundColor: 'transparent',
      fontSize: theme.enterprise.typography.labelSize,
      lineHeight: '32px',
      textTransform: 'uppercase',
    },
    '& .MuiListItemText-primary': {
      fontSize: theme.enterprise.typography.bodySize,
      fontWeight: 500,
    },
  },
}));

export default SideNav;
