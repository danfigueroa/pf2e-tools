import { lazy, Suspense } from 'react';
import { Box, Button, Dialog, Drawer, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Close as CloseIcon, DeleteOutline as RemoveIcon } from '@mui/icons-material';
import { chrome, displayFont, gold, green, ink, parchment, rule, status } from '../../../theme';
import { tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import { descriptionRequest, type SpellCast } from './descriptionRequest';
import { HeightenNote } from './HeightenNote';
import { ActionGlyph, ContentBadge, LevelBox } from './ui';
import { rarityBadge, warmShadow } from './uiTokens';
import { spellKind } from './spellText';

const DescriptionContent = lazy(() =>
  import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));

const TRADITION: Record<string, string> = { arcane: tr('Arcana', 'Arcane'), divine: tr('Divina', 'Divine'), occult: tr('Oculta', 'Occult'), primal: tr('Primal', 'Primal') };

/**
 * A magia já escolhida, para reler: nome, rank, tradições, traços e a descrição completa. Tirar fica num botão à parte,
 * porque tocar no nome para ler não pode apagar a escolha. Celular: folha que sobe; desktop: diálogo.
 */
export function SpellDetailDialog({ entry, cast, onClose, onRemove, removeLabel }: {
  entry: RuleEntry | null;
  /** Rank em que é lançada (espaço, ou metade do nível em truque e foco): a descrição vem elevada. */
  cast?: SpellCast;
  onClose: () => void;
  /** Sem ele (só leitura), não há botão de tirar. */
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  if (!entry) return null;

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, minWidth: 0 }}>
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
        <LevelBox level={entry.spell?.cantrip ? 0 : entry.spell?.rank ?? entry.level ?? '—'} rarity={entry.rarity} />
        <Box component="span" sx={{ fontWeight: 600, fontSize: 14 }}>{spellKind(entry)}</Box>
        {(entry.spell?.traditions ?? []).length > 0 && (
          <Box component="span" sx={{ fontSize: 14, color: ink.secondary }}>
            · {(entry.spell?.traditions ?? []).map((t) => TRADITION[t.toLowerCase()] ?? t).join(' / ')}
          </Box>
        )}
        {entry.actions && <ActionGlyph actions={entry.actions} size={14} />}
        {rarityBadge(entry.rarity) && <ContentBadge kind={rarityBadge(entry.rarity)!} />}
        {!entry.remaster && !entry.homebrew && <ContentBadge kind="legacy" />}
        {entry.homebrew && <ContentBadge kind="mesa" />}
      </Box>
      {cast && <HeightenNote entry={entry} cast={cast} />}
      {/* A descrição completa já traz traços, fonte e alcance; aqui só o que ela não diz (rank e tradições). */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {entry.homebrew ? (
          <Box component="p" sx={{ m: 0, fontSize: 15, whiteSpace: 'pre-line' }}>{entry.summary}</Box>
        ) : (
          <Suspense fallback={<Box sx={{ fontSize: 14, color: ink.secondary }}>{entry.summary ?? tr('Carregando…', 'Loading…')}</Box>}>
            <DescriptionContent key={`${entry.id}-${cast?.rank ?? ''}`} embedded request={descriptionRequest(entry, cast)} onClose={() => {}} />
          </Suspense>
        )}
      </Box>
    </Box>
  );

  const actions = (
    <>
      {onRemove && (
        <Button variant="outlined" startIcon={<RemoveIcon />} onClick={() => { onRemove(); onClose(); }}
          sx={{ color: status.error, borderColor: status.error, flex: { xs: 1, md: 'none' } }}>
          {removeLabel ?? tr('Tirar', 'Remove')}
        </Button>
      )}
      <Button variant="contained" onClick={onClose} sx={{ flex: { xs: 1.4, md: 'none' } }}>{tr('Fechar', 'Close')}</Button>
    </>
  );

  if (!wide) {
    return (
      <Drawer anchor="bottom" open onClose={onClose}
        slotProps={{ paper: { sx: { maxHeight: '86vh', bgcolor: parchment.paper, borderRadius: '16px 16px 0 0', borderTop: `2px solid ${gold.main}`, boxShadow: warmShadow } } }}>
        <Box role="dialog" aria-label={entry.name} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: rule, mx: 'auto', mt: 1, mb: 0.5, flex: 'none' }} />
          <Box sx={{ overflowY: 'auto', px: 2.25, pt: 0.75, pb: 1.5 }}>
            <Box component="h3" sx={{ m: 0, mb: 1.25, font: `700 24px/1.1 ${displayFont}`, overflowWrap: 'anywhere' }}>{entry.name}</Box>
            {body}
          </Box>
          <Box sx={{ px: 2.25, pt: 1.5, pb: 'calc(14px + env(safe-area-inset-bottom))', borderTop: `1px solid ${rule}`, display: 'flex', gap: 1, flex: 'none' }}>{actions}</Box>
        </Box>
      </Drawer>
    );
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md"
      slotProps={{ paper: { sx: { maxHeight: '86vh', bgcolor: parchment.paper, borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' } } }}>
      <Box sx={{ bgcolor: green.main, color: chrome.text, borderBottom: `2px solid ${gold.main}`, display: 'flex', alignItems: 'center', gap: 1, pl: 2.75, pr: 1, py: 1.5, flex: 'none' }}>
        <Box component="h2" sx={{ m: 0, flex: 1, font: `600 20px ${displayFont}`, overflowWrap: 'anywhere' }}>{entry.name}</Box>
        <IconButton aria-label={tr('Fechar', 'Close')} onClick={onClose} sx={{ color: chrome.text }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3.5, py: 2.5 }}>{body}</Box>
      <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end', borderTop: `1px solid ${rule}`, px: 3.5, py: 1.5 }}>{actions}</Box>
    </Dialog>
  );
}
