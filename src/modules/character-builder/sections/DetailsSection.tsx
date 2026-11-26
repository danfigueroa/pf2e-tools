import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, MenuItem, TextField } from '@mui/material';
import { DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { ink } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { VIEW_OK } from '../../character-viewer/sheetAccess';
import type { MemberRow } from '../../../services/members';
import { BackgroundNotes } from '../components/BackgroundNotes';
import { SectionHead } from '../components/ui';
import { cardSx } from '../components/uiTokens';
import type { BuildRecord, BuildState } from '../types';
import { DETAIL_FIELDS } from './detailFields';

type DetailKey = keyof BuildState['details'];

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

export interface DetailsProps {
  state: BuildState;
  build: BuildRecord;
  update: (change: (state: BuildState) => BuildState) => void;
  canEdit: boolean;
  /** GM: membros da mesa para escolher o dono. */
  members: MemberRow[] | null;
  owner: string | null;
  onOwner?: (user: string | null) => void;
  actions: { key: string; label: string; onClick: () => void; danger?: boolean; icon?: React.ReactNode }[];
  notice?: React.ReactNode;
}

/** Detalhes: nome e nível, quem é o personagem (retrato, idade, pronomes…), dono, retreinos, background e as ações. */
export function DetailsSection({ state, build, update, canEdit, members, owner, onOwner, actions, notice }: DetailsProps) {
  const nameMissing = !state.name.trim();
  const setDetail = (key: DetailKey, value: string) =>
    update((s) => {
      const details = { ...s.details };
      if (value) details[key] = value;
      else delete details[key];
      return { ...s, details };
    });
  const card = [cardSx, { p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5 }] as const;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={card}>
        <SectionHead>{tr('Quem é', 'Who they are')}</SectionHead>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 96px', sm: '1fr 120px' }, gap: 1.5 }}>
          <TextField label={tr('Nome', 'Name')} value={state.name} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} size="small"
            error={nameMissing} helperText={nameMissing ? tr('O nome não pode ficar vazio.', 'The name can\'t be empty.') : undefined}
            slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} />
          <TextField select size="small" label={tr('Nível', 'Level')} value={state.level} onChange={(e) => update((s) => ({ ...s, level: Number(e.target.value) }))}
            disabled={!canEdit}>
            {LEVELS.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
          {DETAIL_FIELDS.map(({ key, label }) => (
            <TextField key={key} size="small" label={label} value={state.details[key] ?? ''} onChange={(e) => setDetail(key, e.target.value)}
              slotProps={{ htmlInput: { maxLength: 80, readOnly: !canEdit } }} />
          ))}
        </Box>
        <TextField size="small" label={tr('Retrato (endereço da imagem)', 'Portrait (image address)')} value={state.details.portrait ?? ''}
          onChange={(e) => setDetail('portrait', e.target.value.trim())} slotProps={{ htmlInput: { maxLength: 500, readOnly: !canEdit, inputMode: 'url' } }}
          helperText={tr('É o token do personagem na Ficha e no mapa. Para enviar uma imagem, toque no medalhão do resumo.', 'It is the character token on the Sheet and the map. To upload an image, tap the summary medallion.')} />
        {members && onOwner && (
          <TextField select size="small" label={tr('Dono', 'Owner')} sx={{ maxWidth: 280 }} value={owner ?? ''}
            onChange={(e) => onOwner(e.target.value || null)}>
            <MenuItem value="">{tr('Sem dono', 'No owner')}</MenuItem>
            {members.map((m) => <MenuItem key={m.userId} value={m.userId}>{m.displayName ?? m.username ?? m.userId.slice(0, 8)}</MenuItem>)}
          </TextField>
        )}
      </Box>

      {build.publishedRev !== null && (
        <Box sx={card}>
          <SectionHead>{tr('Background narrativo', 'Backstory')}</SectionHead>
          <BackgroundNotes slug={build.slug} canEdit={canEdit} />
        </Box>
      )}

      {state.history.some((h) => h.kind === 'retrain') && (
        <Box sx={card}>
          <SectionHead note={tr('últimos 10', 'last 10')}>{tr('Retreinos', 'Retraining')}</SectionHead>
          {state.history.filter((h) => h.kind === 'retrain').slice(-10).reverse().map((h, i) => (
            <Box key={i} sx={{ fontSize: 14, color: ink.secondary }}>
              {new Date(h.at).toLocaleDateString(locale)} · {h.by} · {h.note}
            </Box>
          ))}
        </Box>
      )}

      <Box sx={card}>
        <SectionHead>{tr('Ações', 'Actions')}</SectionHead>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <Button key={a.key} variant="outlined" color={a.danger ? 'error' : 'primary'} startIcon={a.danger ? <DeleteIcon /> : a.icon} onClick={a.onClick} {...VIEW_OK}>
              {a.label}</Button>
          ))}
        </Box>
        {notice}
        <Box component="p" sx={{ m: 0, fontSize: 12, color: ink.secondary }}>
          {tr('Regras e textos de jogo: ', 'Game rules and text: ')}
          <RouterLink to="/creditos">{tr('créditos e licenças', 'credits and licenses')}</RouterLink>
        </Box>
      </Box>
    </Box>
  );
}

export const DetailsError = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <Alert severity="error" onClose={onClose}>{message}</Alert>
);
