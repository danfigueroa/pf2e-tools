import { Box, Button, Dialog, IconButton, useMediaQuery, useTheme } from '@mui/material';
import { Close as CloseIcon, ChevronRight as OpenIcon, InfoOutlined as InfoIcon } from '@mui/icons-material';
import { chrome, displayFont, gold, ink, parchment, rule } from '../../../theme';
import { tr } from '../../../i18n';
import type { Compiled } from '../engine/types';
import { levelAsks, slotGains, statDiff } from './levelDiff';
import { ContentBadge, DiffRows, Medallion, Notice, SectionHead, SlotCard } from './ui';
import { cardSx } from './uiTokens';

/**
 * Subir de nível (redesign): "7 → 8", o que o nível novo pede (os slots, em tracejado ouro) e o que muda sozinho pela
 * regra (PV, CA, salvamentos, CD, golpe, espaços de magia, características). Nada vai para a mesa: só muda o nível do
 * rascunho, e a pessoa escolhe, revisa e aplica quando quiser.
 */
export function LevelUpDialog({ open, onClose, onConfirm, current, next, name, className, portrait }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  current: Compiled;
  next: Compiled | null;
  name: string;
  className?: string;
  portrait?: string | null;
}) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('sm'));
  const to = current.level + 1;
  const asks = next ? levelAsks(next, to) : [];
  const diff = next ? statDiff(current, next).filter((d) => d.label !== tr('Nível', 'Level')) : [];
  const gains = next ? slotGains(current, next) : [];
  const features = next?.classFeatures.filter((f) => f.level === to) ?? [];
  return (
    <Dialog open={open} onClose={onClose} fullScreen={!wide} fullWidth maxWidth="sm"
      slotProps={{ paper: { sx: { bgcolor: parchment.page, borderRadius: { sm: '10px' }, overflow: 'hidden', display: 'flex', flexDirection: 'column' } } }}>
      <Box sx={{ bgcolor: chrome.hero, color: chrome.text, borderBottom: `2px solid ${gold.main}`, display: 'flex', alignItems: 'center', gap: 1.75, px: 2, py: 2.25, flex: 'none' }}>
        <Medallion name={name} src={portrait} size={56} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ fontSize: 13, color: chrome.textSoft }}>{[name, className].filter(Boolean).join(' · ')}</Box>
          <Box component="h2" sx={{ m: 0, font: `700 30px/1.1 ${displayFont}`, color: chrome.text }}>
            {current.level} <Box component="span" sx={{ color: gold.bright }}>→</Box> {to}
          </Box>
        </Box>
        <IconButton aria-label={tr('Cancelar', 'Cancel')} onClick={onClose} sx={{ color: chrome.text }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SectionHead note={tr(`${asks.length} escolha${asks.length === 1 ? '' : 's'}`, `${asks.length} choice${asks.length === 1 ? '' : 's'}`)}>
            {tr(`O nível ${to} pede`, `Level ${to} asks for`)}
          </SectionHead>
          {asks.length === 0 && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Nenhuma escolha nova.', 'No new choice.')}</Box>}
          {asks.map((a) => (
            <SlotCard key={a.key} look="todo" kicker={tr(`${a.label} · nível ${to}`, `${a.label} · level ${to}`)} name={tr('Escolher', 'Choose')}
              trailing={<OpenIcon fontSize="small" sx={{ color: gold.deep }} />} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <SectionHead note={tr('pela regra', 'by the rules')}>{tr('Muda sozinho', 'Changes on its own')}</SectionHead>
          <Box sx={[cardSx, { px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }]}>
            {diff.length ? <DiffRows rows={diff} /> : <Box sx={{ fontSize: 14, color: ink.secondary }}>{next ? tr('Nenhum número muda.', 'No number changes.') : tr('Calculando…', 'Calculating…')}</Box>}
            {(gains.length > 0 || features.length > 0) && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', pt: 1.25, borderTop: `1px solid ${rule}` }}>
                {gains.map((g) => <ContentBadge key={g} kind="trait">{g}</ContentBadge>)}
                {features.map((f) => <ContentBadge key={f.name} kind="trait">{f.name}</ContentBadge>)}
              </Box>
            )}
          </Box>
          <Notice tone="info" icon={<InfoIcon />}>{tr('Nada vai para a mesa agora. Você escolhe, revisa e aplica quando quiser.', 'Nothing goes to the table now. You choose, review and apply whenever you like.')}</Notice>
        </Box>
      </Box>
      <Box sx={{ flex: 'none', px: 2, py: 1.25, pb: { xs: 'calc(10px + env(safe-area-inset-bottom))', sm: 1.25 }, bgcolor: parchment.paper, borderTop: `1px solid ${rule}`, display: 'flex', gap: 1.25 }}>
        <Button variant="outlined" sx={{ flex: 1 }} onClick={onClose}>{tr('Cancelar', 'Cancel')}</Button>
        <Button variant="contained" sx={{ flex: 1.6 }} onClick={onConfirm}>{tr(`Subir para o nível ${to}`, `Level up to ${to}`)}</Button>
      </Box>
    </Dialog>
  );
}
