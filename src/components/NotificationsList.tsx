import type { ReactElement } from 'react';
import { Box, ButtonBase, Popover, Typography } from '@mui/material';
import {
  AssignmentInd as AssignedIcon,
  CardGiftcard as GiftIcon,
  Description as SheetIcon,
  Map as MapIcon,
  MenuBook as RuleIcon,
  Campaign as HandoutIcon,
  SportsKabaddi as CombatIcon,
  Visibility as RevealIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useNotifications, type NotificationKind, type TableNotification } from '../services/notifications';
import { timeAgo } from '../layouts/format';
import { getAuthState } from '../services/auth';

const myId = () => { const a = getAuthState(); return a.status === 'in' ? a.user.id : null; };
import { gold, rule } from '../theme';
import { tr } from '../i18n';

const ICONS: Record<NotificationKind, ReactElement> = {
  'sheet-published': <SheetIcon fontSize="small" />,
  'sheet-assigned': <AssignedIcon fontSize="small" />,
  'map-active': <MapIcon fontSize="small" />,
  'map-revealed': <RevealIcon fontSize="small" />,
  'combat-started': <CombatIcon fontSize="small" />,
  'rule-shared': <RuleIcon fontSize="small" />,
  'handout-shared': <HandoutIcon fontSize="small" />,
  'trophy-unlocked': <TrophyIcon fontSize="small" />,
  gift: <GiftIcon fontSize="small" />,
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** "ghan-buri" → "Ghan Buri": o remetente de um item vem como slug. */
const fromSlug = (slug: string) => slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function textOf(n: TableNotification): string {
  const d = n.data;
  switch (n.kind) {
    case 'sheet-published':
      return tr(`Nova versão de ${str(d.name) || 'uma ficha'}${typeof d.level === 'number' ? ` (nível ${d.level})` : ''}`, `New version of ${str(d.name) || 'a sheet'}${typeof d.level === 'number' ? ` (level ${d.level})` : ''}`);
    case 'sheet-assigned':
      return tr(`${str(d.name) || 'Uma ficha'} agora é sua`, `${str(d.name) || 'A sheet'} is now yours`);
    case 'map-active':
      return tr(`A mesa foi para o mapa ${str(d.name) || 'novo'}`, `The table moved to the map ${str(d.name) || 'new'}`);
    case 'map-revealed':
      return tr(`Mapa revelado: ${str(d.name) || 'sem nome'}`, `Map revealed: ${str(d.name) || 'unnamed'}`);
    case 'combat-started':
      return tr('O combate começou', 'Combat started');
    case 'rule-shared':
      return `${str(d.by) || tr('Alguém', 'Someone')} compartilhou ${str(d.name) || tr('uma regra', 'a rule')}`;
    case 'handout-shared':
      return tr(`${str(d.by) || 'O GM'} mostrou à mesa: ${str(d.name) || 'sem título'}`, `${str(d.by) || 'The GM'} showed the table: ${str(d.name) || 'untitled'}`);
    case 'trophy-unlocked':
      return d.user === myId()
        ? tr(`Troféu desbloqueado: ${str(d.title)}`, `Trophy unlocked: ${str(d.titleEn) || str(d.title)}`)
        : tr(`${str(d.name) || 'Alguém'} ganhou ${str(d.title)}`, `${str(d.name) || 'Someone'} earned ${str(d.titleEn) || str(d.title)}`);
    case 'gift':
      return tr(
        `${fromSlug(str(d.from)) || 'Alguém'} te enviou ${typeof d.n === 'number' ? d.n : 1}× ${str(d.name)}`,
        `${fromSlug(str(d.from)) || 'Someone'} sent you ${typeof d.n === 'number' ? d.n : 1}× ${str(d.name)}`,
      );
  }
}

/** A lista do sino (chunk à parte: só baixa no primeiro toque). `fresh`: o que era novo ao abrir. */
export default function NotificationsList({ anchor, fresh, onClose }: { anchor: HTMLElement | null; fresh: Set<string>; onClose: () => void }) {
  const { items } = useNotifications();
  const navigate = useNavigate();

  const go = (n: TableNotification) => {
    onClose();
    const d = n.data;
    if (n.kind === 'rule-shared' || n.kind === 'handout-shared') {
      window.dispatchEvent(new CustomEvent('pf2e:show-share', { detail: d }));
    } else if (n.kind === 'map-active' || n.kind === 'map-revealed') {
      navigate(str(d.map) ? `/mapa/${str(d.map)}` : '/mapa');
    } else if (n.kind === 'combat-started') {
      navigate('/iniciativa');
    } else if (n.kind === 'trophy-unlocked') {
      navigate(d.user === myId() ? '/trofeus' : `/trofeus/${str(d.user)}`);
    } else if (str(d.slug)) {
      navigate(`/ficha-virtual?ficha=${encodeURIComponent(str(d.slug))}`);
    }
  };

  return (
    <Popover
      open={!!anchor}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 'min(360px, calc(100vw - 16px))', maxHeight: 'min(520px, 70vh)', display: 'flex', flexDirection: 'column' } } }}
    >
      <Typography component="h2" sx={{ px: 2, pt: 1.75, pb: 1, fontWeight: 700, borderBottom: `1px solid ${rule}` }}>
        {tr('Notificações', 'Notifications')}</Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          {tr('Nada novo por aqui. Fichas publicadas, mapas, combates, regras compartilhadas, o que o GM mostra e itens recebidos aparecem aqui.', 'Nothing new here. Published sheets, maps, combats, shared rules, what the GM shows and received items show up here.')}</Typography>
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
                  {isNew && <Box aria-label={tr("nova", 'new')} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: gold.deep, mt: 0.75, flexShrink: 0 }} />}
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      )}
    </Popover>
  );
}
