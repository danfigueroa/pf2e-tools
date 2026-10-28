import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import type { LayoutContext } from './menuContext';
import { gold, green } from '../theme';
import { RollFeedLayer, RollHistoryDrawer } from '../components/RollFeed';
import { SharedRuleLayer } from '../components/SharedRuleLayer';
import { setPresencePage, startPresence } from '../services/presence';
import { startNotifications } from '../services/notifications';
import { Sidebar } from './sidebar/Sidebar';
import { MobileHeader, MobileTabBar } from './MobileChrome';
import { MOBILE_HEADER_HEIGHT, SIDEBAR_RAIL, SIDEBAR_WIDTH, TAB_BAR_HEIGHT } from './navigation';

// Só baixado quando alguém abre "Trocar senha".
const ChangePasswordDialog = lazy(() =>
  import('../modules/account/ChangePasswordDialog').then((m) => ({ default: m.ChangePasswordDialog })));
// Só baixada no primeiro ⌘K (ou toque na busca).
const CommandPalette = lazy(() => import('../components/CommandPalette'));

/** Recolher a sidebar é preferência do aparelho (vale em todas as mesas). */
const COLLAPSED_KEY = 'pf2e:sidebar-collapsed';
const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
};

export const MainLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  // O mapa é a página: sem moldura, sem cabeçalho, sem barra de abas e sem sidebar fixa. O
  // botão "Menu" da barra do mapa abre a mesma gaveta temporária do celular.
  const isMap = location.pathname === '/mapa' || location.pathname.startsWith('/mapa/');
  const temporary = isMobile || isMap;
  const sidebarWidth = isMap ? 0 : collapsed ? SIDEBAR_RAIL : SIDEBAR_WIDTH;

  // Quem está na mesa (sidebar): este aparelho anuncia a página em que está.
  useEffect(() => { startPresence(); startNotifications(); }, []);
  useEffect(() => { setPresencePage(location.pathname); }, [location.pathname]);

  // ⌘K / Ctrl+K em qualquer página; o campo do topo da Início e a lupa do celular mandam o evento.
  useEffect(() => {
    const open = () => setSearchOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('pf2e:open-search', open);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pf2e:open-search', open);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((v) => {
      try { localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1'); } catch { /* sem storage: vale nesta carga */ }
      return !v;
    });
  }, []);

  /** Escolher um destino fecha a gaveta temporária (celular e mapa); a fixa do desktop fica. */
  const closeTemporary = () => { if (temporary) setDrawerOpen(false); };

  const layoutContext: LayoutContext = { openMenu: () => setDrawerOpen(true) };

  const sidebarProps = {
    onNavigate: closeTemporary,
    onOpenHistory: () => { setHistoryOpen(true); closeTemporary(); },
    onOpenPassword: () => { setPasswordOpen(true); closeTemporary(); },
  };

  const paperSx = {
    boxSizing: 'border-box' as const,
    backgroundColor: green.deepest,
    backgroundImage: 'none',
    borderRight: `2px solid ${gold.main}`,
    overflow: 'hidden',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        // Para o que fica `fixed` por cima de tudo se alinhar à moldura: o cartão de rolagem
        // centra no conteúdo (fora da sidebar), e o cartão de regra fica acima da barra de abas.
        '--sidebar-w': { xs: '0px', md: `${sidebarWidth}px` },
        '--tabbar-h': isMap ? '0px' : { xs: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`, md: '0px' },
      }}
    >
      {!isMap && isMobile && (
        <>
          <MobileHeader onOpenPassword={() => setPasswordOpen(true)} />
          <MobileTabBar onMore={() => setDrawerOpen(true)} />
        </>
      )}

      {/* Gaveta temporária: o "Mais" do celular e o "Menu" do mapa, em qualquer largura. */}
      <Drawer
        variant="temporary"
        open={drawerOpen && temporary}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': { ...paperSx, width: SIDEBAR_WIDTH, maxWidth: '88vw' } }}
      >
        <Sidebar collapsed={false} {...sidebarProps} />
      </Drawer>

      {/* Sidebar fixa do desktop. */}
      {!temporary && (
        <Box component="aside" sx={{ width: sidebarWidth, flexShrink: 0, transition: 'width 160ms ease' }}>
          <Drawer
            variant="permanent"
            open
            sx={{ '& .MuiDrawer-paper': { ...paperSx, width: sidebarWidth, transition: 'width 160ms ease' } }}
          >
            <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} {...sidebarProps} />
          </Drawer>
        </Box>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // Item flex tem `min-width: auto`: sem isto, um filho largo (linha de stat block,
          // nome comprido) empurra o main além da viewport.
          minWidth: 0,
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        {isMap ? (
          <Outlet context={layoutContext} />
        ) : (
          // No celular a moldura do conteúdo encolhe: cada 8px aqui é 8px a mais para os
          // números da ficha, que é o que se lê na mesa. Embaixo, o espaço da barra de abas.
          <Box
            sx={{
              px: { xs: 1.5, sm: 3 },
              pt: { xs: `${MOBILE_HEADER_HEIGHT + 16}px`, sm: `${MOBILE_HEADER_HEIGHT + 24}px`, md: 3 },
              pb: { xs: 'calc(var(--tabbar-h) + 16px)', md: 3 },
            }}
          >
            <Outlet context={layoutContext} />
          </Box>
        )}
      </Box>

      {/* Rolagens de qualquer aparelho, em qualquer página. */}
      <RollFeedLayer />
      {/* Regra (talento, magia…) que alguém compartilhou pela ficha. */}
      <SharedRuleLayer />
      <RollHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
      {passwordOpen && (
        <Suspense fallback={null}>
          <ChangePasswordDialog open onClose={() => setPasswordOpen(false)} />
        </Suspense>
      )}
      {searchOpen && (
        <Suspense fallback={null}>
          <CommandPalette onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </Box>
  );
};
