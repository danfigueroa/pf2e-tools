import { useState } from 'react';
import { Box, ButtonBase, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  FormatListNumbered as InitiativeIcon,
  Home as HomeIcon,
  Key as KeyIcon,
  Logout as LogoutIcon,
  Map as MapIcon,
  MoreHoriz as MoreIcon,
  PhoneIphone as ViewerIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { chrome, gold, green, ink, parchment, rule } from '../theme';
import { signOut, useMesaInfo, useRole } from '../services/auth';
import { MesaMenu } from '../components/MesaSwitcher';
import { NotificationsButton } from '../components/NotificationsButton';
import { LanguageToggle } from '../components/LanguageToggle';
import { tr } from '../i18n';
import { initialsOf, isCurrent, MOBILE_HEADER_HEIGHT, openSearch, TAB_BAR_HEIGHT } from './navigation';
import logoSymbol from '../assets/covil-simbolo.svg';

const squareButton = {
  width: 44, height: 44, borderRadius: 1.5, flexShrink: 0,
  border: `1px solid ${rule}`, bgcolor: parchment.paper, color: ink.primary,
};

/**
 * Cabeçalho do celular (todo o app, menos o mapa): símbolo, a mesa (abre o seletor), o sino, a
 * busca e a conta. Fica sobre o pergaminho, como no design — a moldura verde é a barra de abas.
 */
export const MobileHeader = ({ onOpenPassword }: { onOpenPassword: () => void }) => {
  const mesa = useMesaInfo();
  const role = useRole();
  const [mesaMenu, setMesaMenu] = useState<HTMLElement | null>(null);
  const [account, setAccount] = useState<HTMLElement | null>(null);
  const name = role.displayName ?? role.username ?? tr('Sua conta', 'Your account');

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.appBar,
        height: MOBILE_HEADER_HEIGHT, px: 2, display: 'flex', alignItems: 'center', gap: 0.75,
        bgcolor: 'background.default', borderBottom: `1px solid ${rule}`,
      }}
    >
      <Box component={Link} to="/" aria-label={tr("Início", 'Home')} sx={{ display: 'flex', flexShrink: 0, mr: 0.25 }}>
        <Box component="img" src={logoSymbol} alt="" sx={{ width: 32, height: 32 }} />
      </Box>
      <ButtonBase
        onClick={(e) => setMesaMenu(e.currentTarget)}
        aria-haspopup="menu"
        aria-label={tr(`Mesa: ${mesa.name}. Trocar de mesa`, `Table: ${mesa.name}. Switch table`)}
        sx={{ ...squareButton, width: 'auto', flex: 1, minWidth: 0, px: 1.5, justifyContent: 'space-between', gap: 0.5 }}
      >
        <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{mesa.name}</Typography>
        <ExpandIcon fontSize="small" sx={{ color: ink.secondary }} />
      </ButtonBase>
      <NotificationsButton />
      <IconButton aria-label={tr("Buscar uma página", 'Search for a page')} onClick={openSearch} sx={squareButton}>
        <SearchIcon fontSize="small" />
      </IconButton>
      {role.userId && (
        <ButtonBase
          aria-label={tr(`Conta de ${name}`, `${name}'s account`)}
          aria-haspopup="menu"
          onClick={(e) => setAccount(e.currentTarget)}
          sx={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, bgcolor: green.deepest, color: chrome.text, fontWeight: 700, fontSize: '0.875rem' }}
        >
          {initialsOf(name)}
        </ButtonBase>
      )}
      <MesaMenu anchor={mesaMenu} onClose={() => setMesaMenu(null)} />
      <Menu anchorEl={account} open={!!account} onClose={() => setAccount(null)}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
          <Typography variant="caption" color="text.secondary">{role.isGm ? tr('Mestre da mesa', 'Game master') : tr('Jogador', 'Player')}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAccount(null); onOpenPassword(); }}>
          <ListItemIcon><KeyIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={tr("Trocar senha", 'Change password')} />
        </MenuItem>
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="body2">{tr('Idioma', 'Language')}</Typography>
          <LanguageToggle tone="paper" />
        </Box>
        <MenuItem onClick={() => void signOut()}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={tr("Sair da conta", 'Sign out')} />
        </MenuItem>
      </Menu>
    </Box>
  );
};

const TABS = [
  { text: tr('Início', 'Home'), icon: <HomeIcon />, path: '/' },
  { text: tr('Ficha', 'Sheet'), icon: <ViewerIcon />, path: '/ficha-virtual' },
  { text: tr('Iniciativa', 'Initiative'), icon: <InitiativeIcon />, path: '/iniciativa' },
  { text: tr('Mapa', 'Map'), icon: <MapIcon />, path: '/mapa' },
];

/** A barra de abas do celular; "Mais" abre a gaveta com a sidebar inteira. */
export const MobileTabBar = ({ onMore }: { onMore: () => void }) => {
  const { pathname } = useLocation();
  const tab = (active: boolean) => ({
    flex: 1, minWidth: 0, height: TAB_BAR_HEIGHT - 8, display: 'flex', flexDirection: 'column' as const, gap: 0.5,
    alignItems: 'center', justifyContent: 'center', borderRadius: 1.5, textDecoration: 'none',
    color: active ? chrome.text : chrome.textMuted, fontSize: '0.6875rem', fontWeight: active ? 600 : 400,
    '& svg': { fontSize: 22, color: active ? gold.bright : 'inherit' },
  });
  return (
    <Box
      component="nav"
      aria-label={tr("Navegação principal", 'Main navigation')}
      sx={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: (t) => t.zIndex.appBar,
        px: 1, pt: 0.5, pb: 'calc(4px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', bgcolor: green.deepest, borderRadius: '20px 20px 0 0',
      }}
    >
      {TABS.map((t) => {
        const active = isCurrent(pathname, t.path);
        return (
          <ButtonBase key={t.path} component={Link} to={t.path} aria-current={active ? 'page' : undefined} sx={tab(active)}>
            {t.icon}
            {t.text}
          </ButtonBase>
        );
      })}
      <ButtonBase onClick={onMore} aria-label={tr("Mais: abrir o menu", 'More: open the menu')} sx={tab(false)}>
        <MoreIcon />
        {tr('Mais', 'More')}</ButtonBase>
    </Box>
  );
};
