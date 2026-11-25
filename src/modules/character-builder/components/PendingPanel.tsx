import { useState } from 'react';
import { Box, Button, ButtonBase, Drawer, IconButton } from '@mui/material';
import {
  ChevronRight as GoIcon, Close as CloseIcon, ExpandLess as OpenIcon, InfoOutlined as InfoIcon, WarningAmberRounded as WarnIcon,
  ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import { chrome, displayFont, gold, green, ink, parchment, rule } from '../../../theme';
import { tr } from '../../../i18n';
import type { Compiled, Pending, Warning } from '../engine/types';
import { TAB_LABEL, tabOf, type BuilderTab } from '../tabs';
import { BandHead, Label, Notice, PendCount, SlotCard } from './ui';
import { warmShadow } from './uiTokens';

const TONE = { info: 'info', warn: 'warn', error: 'error' } as const;
const ICON = { info: <InfoIcon />, warn: <WarnIcon />, error: <ErrorIcon /> };

export interface PendingPanelProps {
  compiled: Compiled;
  onGo: (tab: BuilderTab, key?: string) => void;
  onDiscard: (choiceKey: string) => void;
  canEdit: boolean;
  /** GM: libera a entrada só para este personagem (exceção nas regras da mesa). */
  onAllow?: (entryId: string) => void;
  /** Nome do personagem, para o "Liberar para Loki". */
  name: string;
}

type Filter = 'all' | 'pending' | 'warnings';

function Lists({ compiled, onGo, onDiscard, canEdit, onAllow, name, filter }: PendingPanelProps & { filter: Filter }) {
  const { pending, warnings } = compiled;
  const label = (p: Pending) => (p.missing > 1 ? `${p.label} (${p.missing})` : p.label);
  const allowLabel = name.trim() ? tr(`Liberar para ${name.trim()}`, `Allow for ${name.trim()}`) : tr('Liberar para este personagem', 'Allow for this character');
  const action = (w: Warning) => w.code === 'ORPHAN_CHOICE' && w.ref && canEdit
    ? <Button size="small" variant="outlined" onClick={() => onDiscard(w.ref as string)}>{tr('Descartar', 'Discard')}</Button>
    : w.entryId && onAllow
      ? <Button size="small" variant="contained" data-view="" onClick={() => onAllow(w.entryId as string)}>{allowLabel}</Button>
      : undefined;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {filter !== 'warnings' && (
        <>
          <Label>{tr(`Pendências · ${pending.length}`, `To do · ${pending.length}`)}</Label>
          {pending.length === 0 && <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Nada pendente.', 'Nothing to do.')}</Box>}
          {pending.map((p) => (
            <SlotCard key={p.key} look="todo" kicker={`${tr(`Nível ${p.level}`, `Level ${p.level}`)} · ${TAB_LABEL[tabOf(p.key)]}`} name={label(p)}
              onClick={() => onGo(tabOf(p.key), p.key)}
              trailing={<Box component="span" sx={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: gold.deep }}>{tr('Ir', 'Go')}<GoIcon fontSize="small" /></Box>} />
          ))}
        </>
      )}
      {filter !== 'pending' && warnings.length > 0 && (
        <>
          <Label sx={{ mt: filter === 'all' ? 0.75 : 0 }}>{tr(`Avisos · ${warnings.length}`, `Warnings · ${warnings.length}`)}</Label>
          {warnings.map((w, i) => (
            <Notice key={`${w.code}-${w.ref ?? ''}-${i}`} tone={TONE[w.level]} icon={ICON[w.level]} action={action(w)}>
              <Box component={w.ref ? ButtonBase : 'span'} onClick={w.ref ? () => onGo(tabOf(w.ref), w.ref) : undefined}
                sx={{ textAlign: 'left', font: 'inherit', color: 'inherit', fontWeight: 600, justifyContent: 'flex-start' }}>{w.message}</Box>
            </Notice>
          ))}
        </>
      )}
      <Box sx={{ fontSize: 12, color: ink.secondary }}>{tr('Nada aqui impede aplicar na mesa.', 'Nothing here blocks applying to the table.')}</Box>
    </Box>
  );
}

/** Painel lateral do desktop: cabeçalho verde com os dois contadores. */
export function PendingAside(props: PendingPanelProps) {
  const { pending, warnings } = props.compiled;
  return (
    <Box component="aside" aria-label={tr('Pendências e avisos', 'To do and warnings')} sx={{ bgcolor: parchment.paper, border: `1px solid ${rule}`, borderRadius: '6px', boxShadow: warmShadow, overflow: 'hidden' }}>
      <BandHead right={<><PendCount n={pending.length} /><PendCount n={warnings.length} sx={{ bgcolor: chrome.line, color: chrome.text }} /></>}>
        {tr('Pendências e avisos', 'To do and warnings')}
      </BandHead>
      <Box sx={{ p: 1.5 }}><Lists {...props} filter="all" /></Box>
    </Box>
  );
}

/**
 * Celular: a pílula verde flutuante acima da barra de abas ("3 pendências · 4 avisos") e a gaveta com o filtro
 * Tudo / Pendências / Avisos.
 */
export function PendingSheet(props: PendingPanelProps & { open: boolean; onOpen: () => void; onClose: () => void }) {
  const { open, onOpen, onClose, ...panel } = props;
  const { pending, warnings } = panel.compiled;
  const [filter, setFilter] = useState<Filter>('all');
  if (!pending.length && !warnings.length) return null;
  const summary = [
    pending.length ? tr(`pendência${pending.length > 1 ? 's' : ''}`, 'to do') : tr('nada pendente', 'nothing to do'),
    warnings.length ? tr(`${warnings.length} aviso${warnings.length > 1 ? 's' : ''}`, `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`) : null,
  ].filter(Boolean).join(' · ');
  const seg = (key: Filter, label: React.ReactNode) => (
    <ButtonBase key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} sx={{
      height: 38, borderRadius: '6px', fontSize: 14, fontWeight: 600, gap: 0.75, color: filter === key ? ink.primary : ink.secondary,
      bgcolor: filter === key ? parchment.paper : 'transparent', boxShadow: filter === key ? warmShadow : 'none',
    }}>{label}</ButtonBase>
  );
  return (
    <>
      <ButtonBase onClick={onOpen} data-view="" aria-label={tr('Abrir pendências e avisos', 'Open to do and warnings')} sx={{
        display: { xs: 'flex', md: 'none' }, position: 'fixed', left: 12, right: 12, bottom: 'calc(var(--tabbar-h) + 12px)', zIndex: 1050,
        minHeight: 48, borderRadius: 24, bgcolor: green.main, border: `1px solid ${gold.main}`, color: chrome.text, alignItems: 'center',
        gap: 1.25, pl: 2, pr: 0.75, boxShadow: '0 8px 20px #00000040', fontSize: 14, fontWeight: 600, justifyContent: 'flex-start',
      }}>
        {pending.length > 0 && <PendCount n={pending.length} />}
        <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>{summary}</Box>
        <Box component="span" sx={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><OpenIcon /></Box>
      </ButtonBase>
      <Drawer anchor="bottom" open={open} onClose={onClose}
        slotProps={{ paper: { sx: { maxHeight: '85vh', bgcolor: parchment.paper, borderRadius: '16px 16px 0 0', borderTop: `2px solid ${gold.main}`, pb: 'calc(12px + env(safe-area-inset-bottom))' } } }}>
        <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: rule, mx: 'auto', mt: 1, mb: 0.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 2.25, pr: 1 }}>
          <Box component="h2" sx={{ m: 0, flex: 1, font: `700 20px ${displayFont}` }}>{tr('Pendências e avisos', 'To do and warnings')}</Box>
          <IconButton aria-label={tr('Fechar', 'Close')} onClick={onClose}><CloseIcon /></IconButton>
        </Box>
        <Box sx={{ px: 2, pb: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', bgcolor: parchment.sunken, borderRadius: '8px', p: '3px', gap: '3px' }}>
            {seg('all', tr('Tudo', 'All'))}
            {seg('pending', <>{tr('Pendências', 'To do')} <PendCount n={pending.length} sx={{ minWidth: 20, height: 20 }} /></>)}
            {seg('warnings', tr(`Avisos ${warnings.length}`, `Warnings ${warnings.length}`))}
          </Box>
          <Box sx={{ fontSize: 13, color: ink.secondary }}>{tr('Nada disso impede aplicar na mesa. Resolva quando quiser.', 'None of this blocks applying to the table. Sort it out whenever you like.')}</Box>
        </Box>
        <Box sx={{ px: 2, overflowY: 'auto' }}><Lists {...panel} filter={filter} /></Box>
      </Drawer>
    </>
  );
}
