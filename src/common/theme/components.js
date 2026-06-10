export default {
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      html: {
        height: '100%',
        backgroundColor: theme.enterprise.colors.background,
      },
      body: {
        height: '100%',
        backgroundColor: theme.enterprise.colors.background,
        color: theme.enterprise.colors.text,
        scrollbarWidth: 'thin',
        scrollbarColor: `${theme.enterprise.colors.textSubtle} ${theme.enterprise.colors.backgroundElevated}`,
      },
      '#root': {
        height: '100%',
      },
      '*::-webkit-scrollbar': {
        width: 10,
        height: 10,
      },
      '*::-webkit-scrollbar-track': {
        backgroundColor: theme.enterprise.colors.backgroundElevated,
      },
      '*::-webkit-scrollbar-thumb': {
        borderRadius: theme.enterprise.radius.sm,
        backgroundColor: theme.enterprise.colors.textSubtle,
      },
      '.maplibregl-ctrl-group': {
        border: `1px solid ${theme.enterprise.colors.border}`,
        borderRadius: theme.enterprise.radius.sm,
        overflow: 'hidden',
        backgroundColor: theme.enterprise.colors.surface,
        boxShadow: theme.enterprise.shadows.overlay,
        backdropFilter: 'blur(10px)',
      },
      '.maplibregl-ctrl-group button': {
        width: 34,
        height: 34,
        backgroundColor: 'transparent',
      },
      '.maplibregl-ctrl-group button:hover': {
        backgroundColor: theme.enterprise.colors.rowHover,
      },
      '.maplibregl-ctrl-scale': {
        borderColor: `${theme.enterprise.colors.textMuted} !important`,
        color: `${theme.enterprise.colors.text} !important`,
        backgroundColor: `${theme.enterprise.colors.surface} !important`,
        backdropFilter: 'blur(10px)',
      },
      '.maplibregl-ctrl-attrib': {
        borderRadius: theme.enterprise.radius.xs,
        backgroundColor: `${theme.enterprise.colors.surface} !important`,
        color: `${theme.enterprise.colors.textMuted} !important`,
      },
      '.maplibregl-style-list button': {
        color: theme.enterprise.colors.text,
      },
      '.maplibregl-style-list button.active': {
        color: theme.enterprise.colors.accent,
      },
      '.maplibregl-style-list button:hover': {
        backgroundColor: `${theme.enterprise.colors.rowHover} !important`,
      },
      '.maplibregl-style-list button + button': {
        borderTopColor: `${theme.enterprise.colors.borderSubtle} !important`,
      },
      '.maplibregl-ctrl-geocoder, .maplibregl-ctrl-geocoder .suggestions': {
        border: `1px solid ${theme.enterprise.colors.border}`,
        borderRadius: theme.enterprise.radius.sm,
        backgroundColor: `${theme.enterprise.colors.surface} !important`,
        boxShadow: `${theme.enterprise.shadows.overlay} !important`,
        backdropFilter: 'blur(10px)',
      },
      '.maplibregl-ctrl-geocoder--input': {
        color: `${theme.enterprise.colors.text} !important`,
      },
      '.maplibregl-ctrl-geocoder .suggestions > li > a': {
        color: `${theme.enterprise.colors.text} !important`,
      },
      '.maplibregl-ctrl-geocoder .suggestions > .active > a, .maplibregl-ctrl-geocoder .suggestions > li > a:hover':
        {
          color: `${theme.enterprise.colors.text} !important`,
          backgroundColor: `${theme.enterprise.colors.rowHover} !important`,
        },
      '.maplibregl-ctrl-geocoder--button': {
        backgroundColor: `${theme.enterprise.colors.surface} !important`,
      },
    }),
  },
  MuiUseMediaQuery: {
    defaultProps: {
      noSsr: true,
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: theme.enterprise.density.controlHeight,
        borderRadius: theme.enterprise.radius.xs,
        color: theme.enterprise.colors.text,
        backgroundColor: theme.enterprise.colors.surfaceMuted,
        transition: theme.transitions.create(['border-color', 'box-shadow', 'background-color']),
        '&:hover': {
          backgroundColor: theme.enterprise.colors.surface,
        },
        '&.Mui-focused': {
          boxShadow: theme.enterprise.shadows.focus,
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.enterprise.colors.border,
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: 'rgba(148, 163, 184, 0.36)',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: theme.enterprise.colors.accent,
        },
      }),
      input: ({ theme }) => ({
        fontSize: theme.enterprise.typography.bodySize,
        paddingTop: 8,
        paddingBottom: 8,
      }),
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: theme.enterprise.colors.textMuted,
        fontSize: theme.enterprise.typography.bodySize,
      }),
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: theme.enterprise.density.controlHeight,
        borderRadius: theme.enterprise.radius.xs,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: theme.enterprise.typography.bodySize,
      }),
      containedPrimary: ({ theme }) => ({
        color: '#ffffff',
        backgroundColor: theme.enterprise.colors.accent,
        '&:hover': {
          backgroundColor: '#1f6feb',
        },
      }),
      outlined: ({ theme }) => ({
        borderColor: theme.enterprise.colors.border,
        color: theme.enterprise.colors.text,
        backgroundColor: theme.enterprise.colors.surfaceMuted,
        '&:hover': {
          borderColor: 'rgba(148, 163, 184, 0.36)',
          backgroundColor: theme.enterprise.colors.rowHover,
        },
      }),
      text: ({ theme }) => ({
        color: theme.enterprise.colors.text,
        '&:hover': {
          backgroundColor: theme.enterprise.colors.rowHover,
        },
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.enterprise.radius.xs,
        color: theme.enterprise.colors.textMuted,
        transition: theme.transitions.create(['background-color', 'color', 'box-shadow']),
        '&:hover': {
          color: theme.enterprise.colors.text,
          backgroundColor: theme.enterprise.colors.rowHover,
        },
        '&.Mui-focusVisible': {
          boxShadow: theme.enterprise.shadows.focus,
        },
      }),
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center',
      },
    },
  },
  MuiTooltip: {
    defaultProps: {
      enterDelay: 500,
      enterNextDelay: 500,
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: theme.enterprise.colors.text,
        backgroundImage: 'none',
        backgroundColor: theme.enterprise.colors.surface,
      }),
    },
  },
  MuiCard: {
    styleOverrides: {
      root: ({ theme }) => ({
        border: `1px solid ${theme.enterprise.colors.border}`,
        borderRadius: theme.enterprise.radius.sm,
        color: theme.enterprise.colors.text,
        backgroundImage: 'none',
        backgroundColor: theme.enterprise.colors.surface,
        boxShadow: theme.enterprise.shadows.overlay,
      }),
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        border: `1px solid ${theme.enterprise.colors.border}`,
        borderRadius: theme.enterprise.radius.sm,
        backgroundImage: 'none',
        backgroundColor: theme.enterprise.colors.surfaceAlt,
        boxShadow: theme.enterprise.shadows.panel,
      }),
    },
  },
  MuiDialogContent: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(2),
      }),
    },
  },
  MuiDialogActions: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: theme.spacing(1, 2, 2),
        borderTop: `1px solid ${theme.enterprise.colors.borderSubtle}`,
      }),
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderColor: theme.enterprise.colors.border,
        backgroundImage: 'none',
        backgroundColor: theme.enterprise.colors.surfaceAlt,
      }),
    },
  },
  MuiTabs: {
    styleOverrides: {
      root: {
        minHeight: 34,
      },
      indicator: ({ theme }) => ({
        height: 2,
        backgroundColor: theme.enterprise.colors.accent,
      }),
    },
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        minHeight: 34,
        padding: theme.spacing(0.25, 1.25),
        color: theme.enterprise.colors.textMuted,
        fontSize: theme.enterprise.typography.denseSize,
        textTransform: 'none',
        '&.Mui-selected': {
          color: theme.enterprise.colors.text,
        },
      }),
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        margin: theme.spacing(0.25, 0.75),
        borderRadius: theme.enterprise.radius.sm,
        color: theme.enterprise.colors.textMuted,
        '&:hover': {
          color: theme.enterprise.colors.text,
          backgroundColor: theme.enterprise.colors.rowHover,
        },
        '&.Mui-selected': {
          color: theme.enterprise.colors.text,
          backgroundColor: theme.enterprise.colors.rowSelected,
          boxShadow: `inset 3px 0 0 ${theme.enterprise.colors.success}`,
        },
        '&.Mui-selected:hover': {
          backgroundColor: 'rgba(34, 197, 94, 0.22)',
        },
      }),
    },
  },
  MuiListItemIcon: {
    styleOverrides: {
      root: {
        minWidth: 38,
        color: 'inherit',
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderBottomColor: theme.enterprise.colors.borderSubtle,
        color: theme.enterprise.colors.text,
        fontSize: theme.enterprise.typography.bodySize,
        '@media print': {
          color: theme.palette.alwaysDark.main,
        },
      }),
      head: ({ theme }) => ({
        position: 'sticky',
        top: 0,
        zIndex: 1,
        borderBottomColor: theme.enterprise.colors.border,
        color: '#93c5fd',
        backgroundColor: theme.enterprise.colors.tableHeader,
        fontSize: theme.enterprise.typography.labelSize,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0,
      }),
      sizeSmall: ({ theme }) => ({
        padding: theme.spacing(0.55, 1),
      }),
    },
  },
  MuiTable: {
    defaultProps: {
      size: 'small',
    },
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.enterprise.colors.backgroundElevated,
      }),
    },
  },
  MuiTableRow: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&:nth-of-type(even) .MuiTableCell-body': {
          backgroundColor: theme.enterprise.colors.rowAlt,
        },
        '&:hover .MuiTableCell-body': {
          backgroundColor: theme.enterprise.colors.rowHover,
        },
      }),
    },
  },
  MuiTableContainer: {
    styleOverrides: {
      root: ({ theme }) => ({
        border: `1px solid ${theme.enterprise.colors.border}`,
        borderRadius: theme.enterprise.radius.sm,
        backgroundColor: theme.enterprise.colors.backgroundElevated,
      }),
    },
  },
  MuiBottomNavigation: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: 56,
        borderTop: 0,
        backgroundColor: theme.enterprise.colors.surface,
      }),
    },
  },
  MuiBottomNavigationAction: {
    styleOverrides: {
      root: ({ theme }) => ({
        minWidth: 64,
        padding: theme.spacing(0.55, 0.5, 0.45),
        color: theme.enterprise.colors.textMuted,
        transition: theme.transitions.create(['background-color', 'color']),
        '&:hover': {
          color: theme.enterprise.colors.text,
          backgroundColor: theme.enterprise.colors.rowHover,
        },
        '&.Mui-selected': {
          color: theme.enterprise.colors.accent,
          backgroundColor: theme.enterprise.colors.accentSoft,
        },
        '& .MuiBottomNavigationAction-label': {
          fontSize: theme.enterprise.typography.labelSize,
          lineHeight: 1.15,
        },
      }),
    },
  },
};
