import { grey, green, indigo } from '@mui/material/colors';
import enterprise from './designTokens';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

export default (server, darkMode) => ({
  mode: darkMode ? 'dark' : 'light',
  background: {
    default: darkMode ? enterprise.colors.background : grey[50],
    paper: darkMode ? enterprise.colors.surface : '#ffffff',
  },
  text: darkMode
    ? {
        primary: enterprise.colors.text,
        secondary: enterprise.colors.textMuted,
      }
    : undefined,
  divider: darkMode ? enterprise.colors.borderSubtle : undefined,
  primary: {
    main:
      validatedColor(server?.attributes?.colorPrimary) ||
      (darkMode ? enterprise.colors.accent : indigo[900]),
  },
  secondary: {
    main:
      validatedColor(server?.attributes?.colorSecondary) ||
      (darkMode ? enterprise.colors.success : green[800]),
  },
  neutral: {
    main: grey[500],
  },
  geometry: {
    main: '#3bb2d0',
  },
  alwaysDark: {
    main: grey[900],
  },
});
