import { lazy, Suspense, useState } from 'react';
import { Box, ButtonBase, IconButton, Popover, Typography } from '@mui/material';
import {
  Casino as DiceIcon,
  Key as KeyIcon,
  Lock as LockIcon,
  Logout as LogoutIcon,
  UnfoldMore as UnfoldIcon,
  ViewSidebar as CollapseIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { chrome, displayFont, gold, green } from '../../theme';
import { signOut, useMesaInfo, useRole } from '../../services/auth';
import { usePresence } from '../../services/presence';
import { useTableRolls } from '../../services/rolls';
import { useCombatStatus } from '../../services/combatStatus';
import { MesaMenu } from '../../components/MesaSwitcher';
import { initialsOf, isCurrent, SECTION_LABEL, visibleNav, type NavItem, type NavSection } from '../navigation';
import { rollHeadline, sessionDate, sessionSince, timeAgo } from '../format';
import logoHorizontal from '../../assets/covil-logo-horizontal-fundo-escuro.svg';
import logoSymbol from '../../assets/covil-simbolo.svg';

// A lista detalhada de quem está na mesa (com o nome do aparelho editável): só baixa ao abrir.
const PresenceList = lazy(() => import('../../components/PresenceList').then((m) => ({ default: m.PresenceList })));

const sectionLabelSx = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: chrome.label,
};

/** Círculo com as iniciais, para quem não tem token. */
export const Initials = ({ name, size = 28, bg = chrome.line, color = chrome.text, ring }: {
  name: string; size?: number; bg?: string; color?: string; ring?: boolean;
}) => (
  <Box
    aria-hidden
    sx={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, bgcolor: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, lineHeight: 1,
      boxShadow: ring ? `0 0 0 2px ${green.deepest}, 0 0 0 4px ${gold.bright}` : undefined,
    }}
  >
    {initialsOf(name)}
  </Box>
);

interface SidebarProps {
  collapsed: boolean;
  /** Ausente: sem botão de recolher (gaveta do celular e do mapa). */
  onToggleCollapse?: () => void;
  /** Escolher um destino (fecha a gaveta temporária). */
  onNavigate: () => void;
  onOpenHistory: () => void;
  onOpenPassword: () => void;
}

/**
 * A moldura verde: marca, cartão da mesa (sessão e quem está nela), navegação em seções, as
 * últimas rolagens e a conta. Recolhida, vira um trilho só de ícones com dica.
 */
export const Sidebar = ({ collapsed, onToggleCollapse, onNavigate, onOpenHistory, onOpenPassword }: SidebarProps) => {
  const role = useRole();
  const items = visibleNav(role.isGm);
  const sections = (['jogo', 'gm', 'mesa'] as NavSection[])
    .map((s) => ({ section: s, items: items.filter((i) => i.section === s) }))
    .filter((s) => s.items.length > 0);

  return (
    <Box
      sx={{
        height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5,
        px: collapsed ? 1.25 : 2, pt: 2.75, pb: 2.5, overflowY: 'auto', overflowX: 'hidden',
        bgcolor: green.deepest, color: chrome.text,
      }}
    >
      <Brand collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      <MesaCard collapsed={collapsed} />

      <Box component="nav" aria-label="Navegação principal" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {sections.map(({ section, items: list }, i) => (
          <Box key={section} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {collapsed ? (
              i > 0 && <Box sx={{ height: '1px', bgcolor: chrome.line, mx: 1.5, my: 1.25 }} />
            ) : (
              <Typography sx={{ ...sectionLabelSx, px: 1.5, pt: i > 0 ? 2.25 : 0.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                {SECTION_LABEL[section]}
                {section === 'gm' && <LockIcon sx={{ fontSize: 12 }} />}
              </Typography>
            )}
            {list.map((item) => <NavLink key={item.path} item={item} collapsed={collapsed} onNavigate={onNavigate} />)}
          </Box>
        ))}
      </Box>

      {collapsed ? (
        <IconButton aria-label="Últimas rolagens" title="Últimas rolagens" onClick={onOpenHistory} sx={{ alignSelf: 'center', color: chrome.textMuted }}>
          <DiceIcon />
        </IconButton>
      ) : (
        <RecentRolls onOpenHistory={onOpenHistory} />
      )}

      <Profile collapsed={collapsed} onOpenPassword={onOpenPassword} />
    </Box>
  );
};

const Brand = ({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse?: () => void }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 1.5, pl: collapsed ? 0 : 1, pr: collapsed ? 0 : 0.5, flexDirection: collapsed ? 'column' : 'row' }}>
    {collapsed ? (
      <Box component="img" src={logoSymbol} alt="Covil de Dados" sx={{ width: 40, height: 40 }} />
    ) : (
      <Box component="img" src={logoHorizontal} alt="Covil de Dados" sx={{ display: 'block', height: 42, width: 'auto', maxWidth: 180 }} />
    )}
    {onToggleCollapse && (
      <IconButton
        aria-label={collapsed ? 'Abrir menu' : 'Recolher menu'}
        title={collapsed ? 'Abrir menu' : 'Recolher menu'}
        onClick={onToggleCollapse}
        sx={{
          width: 44, height: 44, borderRadius: 1.5, border: `1px solid ${chrome.line}`, color: chrome.textMuted,
          transform: collapsed ? 'scaleX(-1)' : undefined,
        }}
      >
        <CollapseIcon fontSize="small" />
      </IconButton>
    )}
  </Box>
);

/** O cartão da mesa: troca de mesa, sessão (ou a próxima) e quem está nela agora. */
const MesaCard = ({ collapsed }: { collapsed: boolean }) => {
  const mesa = useMesaInfo();
  const role = useRole();
  const peers = usePresence();
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [people, setPeople] = useState<HTMLElement | null>(null);

  const who = role.isGm ? 'você é o GM' : 'você joga';
  const subtitle = mesa.members ? `${mesa.members} ${mesa.members === 1 ? 'membro' : 'membros'} · ${who}` : who;
  const session = mesa.sessionStartedAt
    ? { live: true, title: 'Sessão em andamento', detail: sessionSince(mesa.sessionStartedAt) }
    : mesa.nextSessionAt && Date.parse(mesa.nextSessionAt) > Date.now()
      ? { live: false, title: 'Próxima sessão', detail: sessionDate(mesa.nextSessionAt) }
      : null;
  const here = peers.length;

  const badge = (
    <Box sx={{
      width: 40, height: 40, borderRadius: 1.5, bgcolor: gold.bright, color: green.deepest, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: displayFont, fontWeight: 700, fontSize: '0.95rem',
    }}>
      {initialsOf(mesa.name)}
    </Box>
  );

  if (collapsed) {
    return (
      <>
        <ButtonBase
          aria-label={`Mesa: ${mesa.name}. Trocar de mesa`}
          title={`${mesa.name} · trocar de mesa`}
          aria-haspopup="menu"
          onClick={(e) => setMenu(e.currentTarget)}
          sx={{ alignSelf: 'center', borderRadius: 1.5, position: 'relative' }}
        >
          {badge}
          {session?.live && (
            <Box sx={{ position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: '50%', bgcolor: chrome.online, border: `2px solid ${green.deepest}` }} />
          )}
        </ButtonBase>
        <MesaMenu anchor={menu} onClose={() => setMenu(null)} />
      </>
    );
  }

  return (
    <Box sx={{ borderRadius: 2.25, bgcolor: chrome.raised, border: `1px solid ${chrome.line}`, overflow: 'hidden' }}>
      <ButtonBase
        onClick={(e) => setMenu(e.currentTarget)}
        aria-haspopup="menu"
        aria-label={`Mesa: ${mesa.name}. Trocar de mesa`}
        sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75, minHeight: 64, textAlign: 'left', justifyContent: 'flex-start' }}
      >
        {badge}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 600, color: chrome.text }}>{mesa.name}</Typography>
          <Typography noWrap sx={{ fontSize: '0.75rem', color: chrome.textMuted }}>{subtitle}</Typography>
        </Box>
        <UnfoldIcon sx={{ color: chrome.textMuted, fontSize: 20 }} />
      </ButtonBase>
      {(session || here > 0) && (
        <ButtonBase
          onClick={(e) => { if (here > 0) setPeople(e.currentTarget); }}
          disabled={here === 0}
          aria-label={here > 0 ? `Quem está na mesa agora: ${here}` : undefined}
          sx={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25,
            px: 1.75, py: 1.5, borderTop: `1px solid ${chrome.line}`, bgcolor: chrome.raisedDeep, textAlign: 'left',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {session && (
              <Typography noWrap sx={{ display: 'flex', alignItems: 'center', gap: 0.875, fontSize: '0.8125rem', fontWeight: 600, color: chrome.textSoft }}>
                {session.live && <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: chrome.online, boxShadow: `0 0 0 3px ${chrome.online}33`, flexShrink: 0 }} />}
                {session.title}
              </Typography>
            )}
            <Typography noWrap sx={{ fontSize: '0.75rem', color: chrome.textMuted }}>
              {[session?.detail, here > 0 ? `${here} na mesa agora` : null].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          {here > 0 && (
            <Box sx={{ display: 'flex', flexShrink: 0 }} aria-hidden>
              {peers.slice(0, 4).map((p, i) => (
                <Box key={p.id} sx={{ ml: i ? -1 : 0, borderRadius: '50%', border: `2px solid ${chrome.raisedDeep}` }}>
                  <Initials name={p.who || p.name || p.character || '?'} size={26} bg={p.self ? gold.bright : chrome.line} color={p.self ? green.deepest : chrome.text} />
                </Box>
              ))}
            </Box>
          )}
        </ButtonBase>
      )}
      <MesaMenu anchor={menu} onClose={() => setMenu(null)} />
      <Popover
        open={!!people}
        anchorEl={people}
        onClose={() => setPeople(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { bgcolor: green.deepest, border: `1px solid ${chrome.line}`, pt: 1.5, width: 260 } } }}
      >
        <Suspense fallback={null}><PresenceList /></Suspense>
      </Popover>
    </Box>
  );
};

const NavLink = ({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate: () => void }) => {
  const { pathname } = useLocation();
  const active = isCurrent(pathname, item.path);
  const combat = useCombatStatus();
  const round = item.path === '/iniciativa' && combat && combat.round > 0 ? combat.round : null;

  const link = (
    <ButtonBase
      component={Link}
      to={item.path}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.text : undefined}
      title={collapsed ? (round ? `${item.text} · rodada ${round}` : item.text) : undefined}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 1.5,
        minHeight: 48, pl: collapsed ? 0 : 0.75, pr: collapsed ? 0 : 1.5, borderRadius: 1.75,
        bgcolor: active ? chrome.active : 'transparent',
        color: active ? chrome.text : chrome.textSoft,
        fontSize: '0.95rem', fontWeight: active ? 600 : 400,
        '&:hover': { bgcolor: active ? chrome.active : `${chrome.active}99` },
        '&.Mui-focusVisible': { outline: `2px solid ${gold.bright}`, outlineOffset: -2 },
      }}
    >
      <Box sx={{
        width: 36, height: 36, borderRadius: 1.25, flexShrink: 0, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: active ? gold.bright : 'transparent', color: active ? green.deepest : 'inherit',
        '& svg': { fontSize: 20 },
      }}>
        {item.icon}
        {collapsed && round && (
          <Box sx={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', bgcolor: gold.bright, border: `2px solid ${green.deepest}` }} />
        )}
      </Box>
      {!collapsed && (
        <>
          <Box component="span" sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{item.text}</Box>
          {round && (
            <Box component="span" sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem', fontWeight: 700,
              px: 1.125, py: 0.375, borderRadius: 99, bgcolor: `${gold.bright}29`, color: chrome.text, whiteSpace: 'nowrap',
            }}>
              <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: gold.bright }} />
              Rodada {round}
            </Box>
          )}
        </>
      )}
    </ButtonBase>
  );

  return link;
};

/** As três rolagens mais recentes da mesa; "Ver todas" abre as 30 do feed. */
const RecentRolls = ({ onOpenHistory }: { onOpenHistory: () => void }) => {
  const { rolls, ready } = useTableRolls();
  const recent = rolls.slice(0, 3);
  return (
    <Box sx={{ borderRadius: 2.25, bgcolor: chrome.raised, p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25, mt: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ ...sectionLabelSx, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DiceIcon sx={{ fontSize: 14, color: gold.bright }} /> Últimas rolagens
        </Typography>
        <ButtonBase onClick={onOpenHistory} sx={{ fontSize: '0.75rem', fontWeight: 600, color: gold.bright, px: 0.5, py: 0.5, borderRadius: 1 }}>
          Ver todas
        </ButtonBase>
      </Box>
      {recent.length === 0 ? (
        <Typography sx={{ fontSize: '0.8125rem', color: chrome.textMuted }}>
          {ready ? 'Ninguém rolou nada ainda.' : 'Carregando…'}
        </Typography>
      ) : recent.map((roll) => {
        const total = rollHeadline(roll);
        const nat20 = roll.check?.d20 === 20;
        return (
          <Box key={roll.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Initials name={roll.by || '?'} size={26} bg={roll.color} color={chrome.onAccent} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600, color: chrome.text }}>{roll.title}</Typography>
              <Typography noWrap sx={{ fontSize: '0.75rem', color: chrome.textMuted }}>{roll.by || 'Alguém'} · {timeAgo(roll.at)}</Typography>
            </Box>
            {nat20 && (
              <Box component="span" sx={{ fontSize: '0.625rem', fontWeight: 700, px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: gold.bright, color: green.deepest }}>
                20 NAT
              </Box>
            )}
            {total !== null && (
              <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.2rem', fontVariantNumeric: 'tabular-nums', color: nat20 ? gold.bright : chrome.text }}>
                {total}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};

const Profile = ({ collapsed, onOpenPassword }: { collapsed: boolean; onOpenPassword: () => void }) => {
  const role = useRole();
  const name = role.displayName ?? role.username ?? 'Sua conta';
  const roleText = role.isGm ? 'Mestre da mesa' : 'Jogador';
  if (!role.userId) {
    return collapsed ? null : <Disclaimer />;
  }
  if (collapsed) {
    return (
      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pt: 2, borderTop: `1px solid ${chrome.active}` }}>
        <Box title={`${name} · ${roleText}`}><Initials name={name} size={40} ring /></Box>
        <IconButton aria-label="Sair da conta" title="Sair da conta" onClick={() => void signOut()} sx={{ color: chrome.textMuted }}><LogoutIcon fontSize="small" /></IconButton>
      </Box>
    );
  }
  return (
    <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1.75, pt: 2, borderTop: `1px solid ${chrome.active}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
        <Initials name={name} size={40} ring />
        <Box sx={{ flex: 1, minWidth: 0, pl: 0.5 }}>
          <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 600, color: chrome.text }}>{name}</Typography>
          <Typography noWrap sx={{ fontSize: '0.75rem', color: chrome.textMuted }}>{roleText}</Typography>
        </Box>
        <IconButton aria-label="Trocar senha" title="Trocar senha" onClick={onOpenPassword} sx={{ color: chrome.textMuted }}><KeyIcon fontSize="small" /></IconButton>
        <IconButton aria-label="Sair da conta" title="Sair da conta" onClick={() => void signOut()} sx={{ color: chrome.textMuted }}><LogoutIcon fontSize="small" /></IconButton>
      </Box>
      <Disclaimer />
    </Box>
  );
};

const Disclaimer = () => (
  <Typography sx={{ px: 0.5, fontSize: '0.75rem', lineHeight: 1.5, color: chrome.label }}>
    Ferramenta de fã, gratuita e não oficial. Pathfinder é marca registrada da Paizo Inc.
  </Typography>
);
