import { lazy, Suspense, useEffect, useState } from 'react';
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
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  // Description as SheetIcon, // desativado junto com a Ficha em PDF
  PhoneIphone as ViewerIcon,
  FormatListNumbered as InitiativeIcon,
  Transform as TransformIcon,
  Whatshot as ScalerIcon,
  Map as MapIcon,
  Casino as DiceIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { green, gold, parchment } from '../theme';
import logoHorizontal from '../assets/covil-logo-horizontal-fundo-escuro.svg';
import logoSymbol from '../assets/covil-simbolo.svg';
import { RollFeedLayer, RollHistoryDrawer } from '../components/RollFeed';
import { SharedRuleLayer } from '../components/SharedRuleLayer';
import { MesaSwitcher } from '../components/MesaSwitcher';
import { setPresencePage, startPresence, usePresence } from '../services/presence';

// A lista mostra o token de cada ficha aberta, e o `TokenBadge` traz o estado da mesa junto: fora do chunk
// principal, baixada só quando há alguém para mostrar.
const PresenceList = lazy(() => import('../components/PresenceList').then((m) => ({ default: m.PresenceList })));

const PresenceSlot = () => {
  const someone = usePresence().length > 0;
  return someone ? <Suspense fallback={null}><PresenceList /></Suspense> : null;
};

const drawerWidth = 260;

/** `/mapa/abc123` ainda é o item "Mapa de Combate". */
const isCurrent = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);

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
    text: 'Iniciativa',
    icon: <InitiativeIcon />,
    path: '/iniciativa',
  },
  {
    text: 'Mapa de Combate',
    icon: <MapIcon />,
    path: '/mapa',
  },
  {
    text: 'Histórico de Rolagens',
    icon: <HistoryIcon />,
    path: '/historico',
  },
  // Desativado — Ficha em PDF (ver App.tsx).
  // {
  //   text: 'Ficha em PDF',
  //   icon: <SheetIcon />,
  //   path: '/character-sheet',
  // },
  {
    text: 'Stat Block de Transformação',
    icon: <TransformIcon />,
    path: '/transformation',
  },
  {
    text: 'Escalar Monstro',
    icon: <ScalerIcon />,
    path: '/escalar-monstro',
  },
];

export const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  // O mapa é a página: sem moldura, sem AppBar e sem sidebar fixa. O menu vira
  // uma aba discreta na borda que abre a mesma gaveta temporária do celular.
  const isMap = location.pathname === '/mapa' || location.pathname.startsWith('/mapa/');

  // Quem está na mesa (sidebar): este aparelho anuncia a página em que está.
  useEffect(() => { startPresence(); }, []);
  useEffect(() => { setPresencePage(location.pathname); }, [location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile || isMap) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Marca */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
        <Box
          component="img"
          src={logoHorizontal}
          alt="Covil de Dados"
          sx={{ display: 'block', height: 44, width: 'auto', maxWidth: '100%' }}
        />
        <Box
          sx={{
            mt: 1,
            height: 2,
            backgroundColor: gold.main,
            opacity: 0.7,
          }}
        />
        <MesaSwitcher />
      </Box>

      <PresenceSlot />

      {/* Navegação */}
      <Box sx={{ overflow: 'auto', flex: 1, py: 1 }}>
        <List disablePadding>
          {navigationItems.map((item) => {
            const isActive = isCurrent(location.pathname, item.path);
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

      {/* Últimas rolagens: o cartão some em segundos, as 30 últimas ficam aqui. */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <ListItemButton
          onClick={() => { setHistoryOpen(true); if (isMobile || isMap) setMobileOpen(false); }}
          sx={{ borderRadius: 1, '&:hover': { backgroundColor: 'rgba(200, 169, 81, 0.08)' } }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: CHROME_TEXT }}>
            <DiceIcon />
          </ListItemIcon>
          <ListItemText
            primary="Últimas rolagens"
            primaryTypographyProps={{ fontSize: '0.9rem', color: CHROME_TEXT }}
          />
        </ListItemButton>
      </Box>

      {/* Rodapé */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'rgba(200, 169, 81, 0.25)',
        }}
      >
        <Typography variant="caption" sx={{ color: CHROME_TEXT, display: 'block' }}>
          Pathfinder 2e Remaster
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: CHROME_TEXT, display: 'block', mt: 0.5, opacity: 0.75, lineHeight: 1.35 }}
        >
          Ferramenta de fã, gratuita e não oficial. Pathfinder é marca registrada da Paizo Inc.
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
          display: isMap ? 'none' : { md: 'none' },
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

          <Box
            component="img"
            src={logoSymbol}
            alt="Covil de Dados"
            sx={{ height: 32, width: 32, mr: 1.25, flexShrink: 0 }}
          />
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
            {navigationItems.find(item => isCurrent(location.pathname, item.path))?.text || 'Covil de Dados'}
          </Typography>
          <IconButton
            color="inherit"
            aria-label="Últimas rolagens"
            onClick={() => setHistoryOpen(true)}
            sx={{ ml: 'auto' }}
          >
            <DiceIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box
        component="nav"
        sx={{ width: isMap ? 0 : { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile Drawer (e o menu do mapa, em qualquer largura) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: isMap ? 'block' : { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': drawerPaperSx,
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop Drawer */}
        {!isMap && (
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
        )}
      </Box>

      {isMap && (
        <Tooltip title="Menu" placement="right">
          <IconButton
            aria-label="abrir menu"
            onClick={handleDrawerToggle}
            size="small"
            sx={{
              position: 'fixed',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 5,
              borderRadius: '0 8px 8px 0',
              width: 20,
              height: 56,
              color: gold.bright,
              backgroundColor: 'rgba(14, 36, 25, 0.55)',
              opacity: 0.55,
              transition: 'opacity 150ms, width 150ms',
              '&:hover, &:focus-visible': {
                opacity: 1,
                width: 32,
                backgroundColor: green.deepest,
              },
            }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isMap ? '100%' : { md: `calc(100% - ${drawerWidth}px)` },
          // Item flex tem `min-width: auto`: sem isto, um filho largo (linha de
          // stat block, nome comprido) empurra o main além da viewport.
          minWidth: 0,
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        {/* Spacer for mobile AppBar */}
        {!isMap && <Toolbar sx={{ display: { md: 'none' } }} />}

        {/* No celular a moldura do conteúdo encolhe: cada 8px aqui é 8px a
            mais para os números da ficha, que é o que se lê na mesa. */}
        {isMap ? (
          <Outlet />
        ) : (
          <Box sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 3 } }}>
            <Outlet />
          </Box>
        )}
      </Box>

      {/* Rolagens de qualquer aparelho, em qualquer página. */}
      <RollFeedLayer />
      {/* Regra (talento, magia…) que alguém compartilhou pela ficha. */}
      <SharedRuleLayer />
      <RollHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Box>
  );
};
