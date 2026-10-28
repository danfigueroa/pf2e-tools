import { useState, type ReactElement } from 'react';
import { Badge, Box, ButtonBase, IconButton, Popover, Tooltip, Typography } from '@mui/material';
import {
  AssignmentInd as AssignedIcon,
  CardGiftcard as GiftIcon,
  Description as SheetIcon,
  Map as MapIcon,
  MenuBook as RuleIcon,
  NotificationsNone as BellIcon,
  SportsKabaddi as CombatIcon,
  Visibility as RevealIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { markAllRead, useNotifications, type NotificationKind, type TableNotification } from '../services/notifications';
import { timeAgo } from '../layouts/format';
import { gold, ink, parchment, rule } from '../theme';

const ICONS: Record<NotificationKind, ReactElement> = {
  'sheet-published': <SheetIcon fontSize="small" />,
  'sheet-assigned': <AssignedIcon fontSize="small" />,
  'map-active': <MapIcon fontSize="small" />,
  'map-revealed': <RevealIcon fontSize="small" />,
  'combat-started': <CombatIcon fontSize="small" />,
  'rule-shared': <RuleIcon fontSize="small" />,
  gift: <GiftIcon fontSize="small" />,
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** "ghan-buri" → "Ghan Buri": o remetente de um item vem como slug. */
const fromSlug = (slug: string) => slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function textOf(n: TableNotification): string {
  const d = n.data;
  switch (n.kind) {
    case 'sheet-published':
      return `Nova versão de ${str(d.name) || 'uma ficha'}${typeof d.level === 'number' ? ` (nível ${d.level})` : ''}`;
    case 'sheet-assigned':
      return `${str(d.name) || 'Uma ficha'} agora é sua`;
    case 'map-active':
      return `A mesa foi para o mapa ${str(d.name) || 'novo'}`;
    case 'map-revealed':
      return `Mapa revelado: ${str(d.name) || 'sem nome'}`;
    case 'combat-started':
      return 'O combate começou';
    case 'rule-shared':
      return `${str(d.by) || 'Alguém'} compartilhou ${str(d.name) || 'uma regra'}`;
    case 'gift':
      return `${fromSlug(str(d.from)) || 'Alguém'} te enviou ${typeof d.n === 'number' ? d.n : 1}× ${str(d.name)}`;
  }
}

/**
 * O sino: as notificações da mesa (`services/notifications.ts`). Abrir marca tudo como lido —
 * na conta, então vale para os outros aparelhos —, mas a lista aberta ainda destaca o que era
 * novo. Tocar leva ao lugar: a ficha, o mapa, a Iniciativa ou reabre o cartão da regra.
 */
export const NotificationsButton = ({ tone = 'light' }: { tone?: 'light' | 'dark' }) => {
  const { items, unread } = useNotifications();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // O que estava sem ler quando a lista abriu (o `read` já virou verdadeiro).
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const open = (el: HTMLElement) => {
    setFresh(new Set(items.filter((n) => !n.read).map((n) => n.key)));
    setAnchor(el);
    if (unread > 0) void markAllRead();
  };

  const go = (n: TableNotification) => {
    setAnchor(null);
    const d = n.data;
    if (n.kind === 'rule-shared') {
      window.dispatchEvent(new CustomEvent('pf2e:show-share', { detail: d }));
    } else if (n.kind === 'map-active' || n.kind === 'map-revealed') {
      navigate(str(d.map) ? `/mapa/${str(d.map)}` : '/mapa');
    } else if (n.kind === 'combat-started') {
      navigate('/iniciativa');
    } else if (str(d.slug)) {
      navigate(`/ficha-virtual?ficha=${encodeURIComponent(str(d.slug))}`);
    }
  };

  const label = unread > 0 ? `Notificações: ${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Notificações';
  return (
    <>
      <Tooltip title="Notificações">
        <IconButton
          aria-label={label}
          aria-haspopup="dialog"
          onClick={(e) => open(e.currentTarget)}
          sx={{
            width: 44, height: 44, borderRadius: 1.75, flexShrink: 0,
            border: `1px solid ${tone === 'light' ? rule : 'transparent'}`,
            bgcolor: tone === 'light' ? parchment.paper : 'transparent',
            color: tone === 'light' ? ink.primary : 'inherit',
          }}
        >
          <Badge badgeContent={unread} max={9} color="error" overlap="circular">
            <BellIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 'min(360px, calc(100vw - 16px))', maxHeight: 'min(520px, 70vh)', display: 'flex', flexDirection: 'column' } } }}
      >
        <Typography component="h2" sx={{ px: 2, pt: 1.75, pb: 1, fontWeight: 700, borderBottom: `1px solid ${rule}` }}>
          Notificações
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Nada novo por aqui. Fichas publicadas, mapas, combates, regras compartilhadas e itens recebidos aparecem aqui.
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto' }}>
            {items.map((n) => {
              const isNew = fresh.has(n.key);
              return (
                <Box component="li" key={n.key}>
                  <ButtonBase
                    onClick={() => go(n)}
                    sx={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2, py: 1.25, textAlign: 'left',
                      bgcolor: isNew ? `${gold.bright}1F` : 'transparent',
                      '&:hover': { bgcolor: `${gold.bright}33` },
                    }}
                  >
                    <Box sx={{ color: gold.deep, mt: 0.25 }}>{ICONS[n.kind]}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: isNew ? 700 : 400 }}>{textOf(n)}</Typography>
                      <Typography variant="caption" color="text.secondary">{timeAgo(n.at)}</Typography>
                    </Box>
                    {isNew && <Box aria-label="nova" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: gold.deep, mt: 0.75, flexShrink: 0 }} />}
                  </ButtonBase>
                </Box>
              );
            })}
          </Box>
        )}
      </Popover>
    </>
  );
};
