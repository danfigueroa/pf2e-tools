import { createTheme } from '@mui/material/styles';

// Cores inspiradas no Pathfinder 2e Remaster
// Verde-teal característico + fundo escuro elegante
export const pathfinderTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#14B8A6', // Verde-teal vibrante
      light: '#2DD4BF',
      dark: '#0D9488',
      contrastText: '#0A0A0A',
    },
    secondary: {
      main: '#D4A853', // Dourado suave
      light: '#E5C078',
      dark: '#B8923E',
      contrastText: '#0A0A0A',
    },
    background: {
      default: '#0A0F0D', // Verde muito escuro (quase preto)
      paper: '#131A17', // Verde escuro para cards
    },
    surface: {
      main: '#1A2420', // Superfícies elevadas
    },
    text: {
      primary: '#F0FDF4', // Branco com tom verde
      secondary: '#94A3B8', // Cinza claro
    },
    error: {
      main: '#F87171',
    },
    warning: {
      main: '#FBBF24',
    },
    success: {
      main: '#34D399',
    },
    divider: '#1E2D28', // Divisor sutil
  },
  typography: {
    fontFamily: '"Source Sans 3", "Inter", "Roboto", sans-serif',
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.375rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#1E2D28 #0A0F0D',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: '#0A0F0D',
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#1E2D28',
            minHeight: 24,
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#2A3F38',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#131A17',
          border: '1px solid #1E2D28',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: '#14B8A6',
            boxShadow: '0 8px 30px rgba(20, 184, 166, 0.15)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        contained: {
          boxShadow: '0 2px 8px rgba(20, 184, 166, 0.3)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(20, 184, 166, 0.4)',
          },
        },
        outlined: {
          borderColor: '#1E2D28',
          '&:hover': {
            borderColor: '#14B8A6',
            backgroundColor: 'rgba(20, 184, 166, 0.08)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0D1512',
          borderBottom: '1px solid #1E2D28',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0D1512',
          borderRight: '1px solid #1E2D28',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
        outlined: {
          borderColor: '#1E2D28',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: 'rgba(20, 184, 166, 0.12)',
            '&:hover': {
              backgroundColor: 'rgba(20, 184, 166, 0.18)',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          },
        },
      },
    },
  },
});

// Exportar com nome antigo para compatibilidade
export const darkTheme = pathfinderTheme;

// Extend the theme interface to include custom colors
declare module '@mui/material/styles' {
  interface Palette {
    surface: Palette['primary'];
  }

  interface PaletteOptions {
    surface?: PaletteOptions['primary'];
  }
}
