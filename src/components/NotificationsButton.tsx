import { lazy, Suspense, useState } from 'react';
import { Badge, IconButton } from '@mui/material';
import { NotificationsNone as BellIcon } from '@mui/icons-material';
import { markAllRead, useNotifications } from '../services/notifications';
import { ink, parchment, rule } from '../theme';

// A lista (popover, ícones, textos) só baixa no primeiro toque: o sino em si fica no chunk principal.
const NotificationsList = lazy(() => import('./NotificationsList'));

/**
 * O sino: as notificações da mesa (`services/notifications.ts`). Abrir marca tudo como lido —
 * na conta, então vale para os outros aparelhos —, mas a lista aberta ainda destaca o que era
 * novo. Tocar leva ao lugar: a ficha, o mapa, a Iniciativa ou reabre o cartão da regra.
 */
export const NotificationsButton = ({ tone = 'light' }: { tone?: 'light' | 'dark' }) => {
  const { items, unread } = useNotifications();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // O que estava sem ler quando a lista abriu (o `read` já virou verdadeiro).
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const open = (el: HTMLElement) => {
    setFresh(new Set(items.filter((n) => !n.read).map((n) => n.key)));
    setAnchor(el);
    if (unread > 0) void markAllRead();
  };

  const label = unread > 0 ? `Notificações: ${unread} não ${unread === 1 ? 'lida' : 'lidas'}` : 'Notificações';
  return (
    <>
      <IconButton
        aria-label={label}
        title="Notificações"
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
      {anchor && (
        <Suspense fallback={null}>
          <NotificationsList anchor={anchor} fresh={fresh} onClose={() => setAnchor(null)} />
        </Suspense>
      )}
    </>
  );
};
