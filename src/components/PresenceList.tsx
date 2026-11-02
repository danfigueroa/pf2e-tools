import { useState } from 'react';
import { Box, ButtonBase, IconButton, InputBase, Tooltip, Typography } from '@mui/material';
import { Check as CheckIcon, Edit as EditIcon } from '@mui/icons-material';
import { setDeviceName, useDeviceName, usePresence, type Peer } from '../services/presence';
import { TokenBadge } from '../modules/battle-map/components/TokenBadge';
import { gold, green, status as statusColor, onFrame } from '../theme/palette';
import { tr } from '../i18n';

/** Tinta clara sobre a moldura verde, a mesma do `MainLayout`. */
const CHROME_TEXT = 'rgba(237, 227, 204, 0.78)';

const PAGES: [string, string][] = [
  ['/ficha-virtual', tr('Ficha', 'Sheet')],
  ['/iniciativa', tr('Iniciativa', 'Initiative')],
  ['/mapa', tr('Mapa', 'Map')],
  ['/transformation', tr('Transformação', 'Transformation')],
  ['/escalar-monstro', tr('Escalar Monstro', 'Scale Monster')],
  ['/historico', tr('Estatísticas da Mesa', 'Table Stats')],
];

const pageLabel = (path: string) =>
  PAGES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] ?? tr('Início', 'Home');

const initials = (text: string) =>
  text.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/**
 * Quem está com o app aberto na mesa (`services/presence`): o nome do aparelho, a
 * ficha aberta e a página. Some sozinho quem fecha a aba. O próprio aparelho vem
 * primeiro, com o lápis para dar um nome a ele ("Dan (GM)").
 */
export const PresenceList = () => {
  const peers = usePresence();
  if (peers.length === 0) return null;
  return (
    <Box sx={{ px: 2.5, pb: 1.5 }}>
      <Typography variant="caption" sx={{ display: 'block', color: CHROME_TEXT, mb: 0.75 }}>
        {tr('Na mesa agora · ', 'At the table now · ')}{peers.length}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {peers.map((peer) => <PeerRow key={peer.id} peer={peer} />)}
      </Box>
    </Box>
  );
};

const PeerRow = ({ peer }: { peer: Peer }) => {
  const title = peer.name || peer.who || peer.character || (peer.self ? tr('Este aparelho', 'This device') : tr('Sem nome', 'Unnamed'));
  const where = [peer.name && peer.character ? peer.character : null, pageLabel(peer.page), peer.visible ? null : tr('em segundo plano', 'in the background')]
    .filter(Boolean)
    .join(' · ');
  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, opacity: peer.visible ? 1 : 0.6 }}>
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        {peer.slug && peer.character
          ? <TokenBadge slug={peer.slug} name={peer.character} size={28} />
          : (
            <Box sx={{
              width: 28, height: 28, borderRadius: '50%', border: `2px solid ${gold.main}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: onFrame.page, fontSize: '0.7rem', fontWeight: 700,
            }}>
              {initials(title)}
            </Box>
          )}
        <Box
          aria-hidden
          sx={{
            position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: '50%',
            backgroundColor: peer.visible ? statusColor.success : CHROME_TEXT, border: `1.5px solid ${green.deepest}`,
          }}
        />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {peer.self ? <SelfName title={title} /> : (
          <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 600, color: onFrame.page, lineHeight: 1.2 }}>
            {title}
          </Typography>
        )}
        <Typography noWrap variant="caption" component="div" sx={{ color: CHROME_TEXT, lineHeight: 1.2 }}>
          {where}
        </Typography>
      </Box>
    </Box>
  );
};

/** O nome deste aparelho, editável ali mesmo (fica no `localStorage`, não é login). */
const SelfName = ({ title }: { title: string }) => {
  const name = useDeviceName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const save = () => { setDeviceName(draft); setEditing(false); };

  if (editing) {
    return (
      <Box component="form" onSubmit={(e) => { e.preventDefault(); save(); }} sx={{ display: 'flex', alignItems: 'center' }}>
        <InputBase
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          placeholder={tr("Seu nome", 'Your name')}
          inputProps={{ maxLength: 40, 'aria-label': tr('Nome deste aparelho na mesa', 'This device\'s name at the table') }}
          sx={{ flex: 1, fontSize: '0.85rem', color: onFrame.page, borderBottom: `1px solid ${gold.main}`, py: 0 }}
        />
        <IconButton type="submit" size="small" aria-label={tr("Salvar nome", 'Save name')} sx={{ color: gold.bright, p: 0.25 }}>
          <CheckIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>
    );
  }
  return (
    <Tooltip title={tr("Dar um nome a este aparelho", 'Name this device')} enterDelay={400}>
      <ButtonBase
        onClick={() => { setDraft(name); setEditing(true); }}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: '100%', borderRadius: 0.5 }}
      >
        <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 600, color: onFrame.page, lineHeight: 1.2 }}>
          {title} <Box component="span" sx={{ color: CHROME_TEXT, fontWeight: 400 }}>{tr('(você)', '(you)')}</Box>
        </Typography>
        <EditIcon sx={{ fontSize: '0.85rem', color: CHROME_TEXT, flexShrink: 0 }} />
      </ButtonBase>
    </Tooltip>
  );
};
