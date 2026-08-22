import { useState } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Description as SheetIcon,
  PhoneIphone as ViewerIcon,
  Transform as TransformIcon,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { green, gold, parchment } from '../theme';

const drawerWidth = 260;

/** Tinta clara sobre a moldura verde (pergaminho esmaecido). */
const CHROME_TEXT = 'rgba(237, 227, 204, 0.78)';

interface NavigationItem {
  text: string;
  icon: React.ReactElement;
  path: string;
}

const navigationItems: NavigationItem[] = [
  {
    text: 'Início',
    icon: <HomeIcon />,
    path: '/',
  },
  {
    text: 'Ficha Virtual',
    icon: <ViewerIcon />,
    path: '/ficha-virtual',
  },
  {
    text: 'Ficha em PDF',
    icon: <SheetIcon />,
    path: '/character-sheet',
  },
  {
    text: 'Stat Block de Transformação',
    icon: <TransformIcon />,
    path: '/transformation',
  },
];

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Marca */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Typography
          variant="h3"
          component="div"
          sx={{
            fontSize: '1.25rem',
            color: gold.bright,
            letterSpacing: '0.08em',
            lineHeight: 1.2,
          }}
        >
          PF2e Tools
        </Typography>
        <Box
          sx={{
            mt: 1,
            height: 2,
            backgroundColor: gold.main,
            opacity: 0.7,
          }}
        />
      </Box>

      {/* Navegação */}
      <Box sx={{ overflow: 'auto', flex: 1, py: 1 }}>
        <List disablePadding>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding sx={{ px: 1.5, py: 0.25 }}>
                <ListItemButton
                  selected={isActive}
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 1,
                    borderLeft: '3px solid',
                    borderLeftColor: isActive ? gold.bright : 'transparent',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(200, 169, 81, 0.14)',
                      '&:hover': {
                        backgroundColor: 'rgba(200, 169, 81, 0.2)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(200, 169, 81, 0.08)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: isActive ? gold.bright : CHROME_TEXT,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontSize: '0.9rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? parchment.page : CHROME_TEXT,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Rodapé */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'rgba(200, 169, 81, 0.25)',
        }}
      >
        <Typography variant="caption" sx={{ color: CHROME_TEXT }}>
          Pathfinder 2e Remaster
        </Typography>
      </Box>
    </Box>
  );

  const drawerPaperSx = {
    boxSizing: 'border-box' as const,
    width: drawerWidth,
    backgroundColor: green.deepest,
    backgroundImage: 'none',
    borderRight: `2px solid ${gold.main}`,
    color: parchment.page,
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar (Mobile) */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          display: { md: 'none' },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="abrir menu"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h3"
            noWrap
            component="div"
            sx={{
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              letterSpacing: '0.05em',
              color: gold.bright,
            }}
          >
            {navigationItems.find(item => item.path === location.pathname)?.text || 'PF2e Tools'}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': drawerPaperSx,
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': drawerPaperSx,
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        {/* Spacer for mobile AppBar */}
        <Toolbar sx={{ display: { md: 'none' } }} />

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};
