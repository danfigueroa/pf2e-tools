import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogContent, DialogTitle, Drawer, FormControlLabel, IconButton, List, ListItemButton,
  ListItemText, MenuItem, Stack, Switch, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { ArrowBack as BackIcon, Close as CloseIcon } from '@mui/icons-material';
import { locale, tr } from '../../../i18n';
import type { RuleEntry } from '../rules/types';
import type { MesaRules } from '../types';
import { allowedAtTable } from '../mesaRules';

const PAGE = 150;

const DescriptionContent = lazy(() =>
  import('../../character-viewer/components/DescriptionContent').then((m) => ({ default: m.DescriptionContent })));

type RarityFilter = 'all' | 'common' | 'uncommon' | 'rare';

const RARITY_LABEL: Record<string, string> = {
  common: tr('Comum', 'Common'), uncommon: tr('Incomum', 'Uncommon'), rare: tr('Raro', 'Rare'), unique: tr('Único', 'Unique'),
};

export interface ContentPickerProps {
  open: boolean;
  title: string;
  entries: RuleEntry[];
  value?: string;
  onPick: (id: string) => void;
  onClose: () => void;
  mesaRules: MesaRules | null;
  /** Fatos mecânicos no detalhe (PV, boosts, proficiências…). */
  facts?: (entry: RuleEntry) => React.ReactNode;
  /** Linha secundária da lista. */
  secondary?: (entry: RuleEntry) => string | undefined;
}

/**
 * Seletor do Criador (UX §1.3): busca, filtros, lista e detalhe. Celular: tela cheia, tocar na linha abre o detalhe.
 * Desktop: as duas colunas lado a lado. ↑/↓ andam na lista, Enter escolhe, Esc fecha. A descrição completa (pt/en) vem
 * do pipeline de descrições, sob demanda.
 */
export function ContentPicker({ open, title, entries, value, onPick, onClose, mesaRules, facts, secondary }: ContentPickerProps) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const [q, setQ] = useState('');
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [onlyAllowed, setOnlyAllowed] = useState(true);
  const [focusId, setFocusId] = useState<string | undefined>(value);
  const [detailOpen, setDetailOpen] = useState(false);
  const [description, setDescription] = useState<RuleEntry | null>(null);
  // Listas longas (1.700 consumíveis) desenham em páginas: o celular não monta milhares de linhas de uma vez.
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setFocusId(value);
    setDetailOpen(false);
    setLimit(PAGE);
  }, [open, value]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return entries
      .filter((e) => !term || e.name.toLowerCase().includes(term) || (e.legacyNames ?? []).some((n) => n.toLowerCase().includes(term)))
      .filter((e) => rarity === 'all' || e.rarity === rarity || (rarity === 'rare' && e.rarity === 'unique'))
      .filter((e) => !onlyAllowed || allowedAtTable(e, mesaRules) !== false)
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [entries, q, rarity, onlyAllowed, mesaRules]);

  const focused = shown.find((e) => e.id === focusId) ?? (wide ? shown[0] : undefined);

  const move = (delta: number) => {
    const i = Math.max(0, shown.findIndex((e) => e.id === focused?.id));
    const next = shown[Math.min(shown.length - 1, Math.max(0, i + delta))];
    if (next) {
      setFocusId(next.id);
      listRef.current?.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  };
  const choose = (entry: RuleEntry) => {
    onPick(entry.id);
    onClose();
  };

  const detail = focused && (
    <Box sx={{ p: { xs: 0, md: 2 }, minWidth: 0 }}>
      <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>{focused.name}</Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, my: 1 }}>
        {focused.rarity && focused.rarity !== 'common' && <Chip size="small" color="warning" variant="outlined" label={RARITY_LABEL[focused.rarity] ?? focused.rarity} />}
        {!focused.remaster && <Chip size="small" variant="outlined" label={tr('Legado', 'Legacy')} />}
        {allowedAtTable(focused, mesaRules) === false && <Chip size="small" color="error" variant="outlined" label={tr('Fora das regras da mesa', 'Outside table rules')} />}
        {(focused.traits ?? []).filter((t) => t.toLowerCase() !== (focused.rarity ?? '')).slice(0, 6).map((t) => <Chip key={t} size="small" label={t} />)}
      </Stack>
      {facts?.(focused)}
      {focused.summary && <Typography variant="body2" sx={{ mt: 1.5 }} lang="en">{focused.summary}</Typography>}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {focused.source.page ? tr(`Página ${focused.source.page}`, `Page ${focused.source.page}`) : ''}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 2 }}>
        <Button variant="contained" onClick={() => choose(focused)}>{focused.id === value ? tr('Manter', 'Keep') : tr('Escolher', 'Choose')}</Button>
        <Button onClick={() => setDescription(focused)}>{tr('Descrição completa', 'Full description')}</Button>
      </Stack>
    </Box>
  );

  const list = (
    <List ref={listRef} dense role="listbox" aria-label={title} sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
      {shown.slice(0, limit).map((e) => {
        const blocked = allowedAtTable(e, mesaRules) === false;
        return (
          <ListItemButton key={e.id} data-id={e.id} role="option" aria-selected={e.id === value}
            selected={wide ? e.id === focused?.id : e.id === value}
            onClick={() => { setFocusId(e.id); if (!wide) setDetailOpen(true); }}
            onDoubleClick={() => choose(e)}>
            <ListItemText
              primary={<>{e.name}{e.id === value ? ' ✓' : ''}</>}
              secondary={[secondary?.(e), e.rarity && e.rarity !== 'common' ? RARITY_LABEL[e.rarity] : null, blocked ? tr('fora das regras', 'outside rules') : null].filter(Boolean).join(' · ') || undefined}
              slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } } }} />
          </ListItemButton>
        );
      })}
      {shown.length > limit && (
        <Box sx={{ p: 1.5, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {tr(`Mostrando ${limit} de ${shown.length}. Refine a busca ou`, `Showing ${limit} of ${shown.length}. Refine the search or`)}
          </Typography>
          <Button size="small" data-view="" onClick={() => setLimit((n) => n + PAGE)}>{tr('Mostrar mais', 'Show more')}</Button>
        </Box>
      )}
      {shown.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{tr('Nada encontrado.', 'Nothing found.')}</Typography>}
    </List>
  );

  return (
    <Dialog open={open} onClose={onClose} fullScreen={!wide} fullWidth maxWidth="lg"
      slotProps={{ paper: { sx: { height: { md: '85vh' } } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        {!wide && detailOpen && (
          <IconButton aria-label={tr('Voltar à lista', 'Back to list')} onClick={() => setDetailOpen(false)}><BackIcon /></IconButton>
        )}
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{title}</Box>
        <IconButton aria-label={tr('Fechar', 'Close')} onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 1.5, sm: 2 } }}>
        {(wide || !detailOpen) && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 1 }}>
            <TextField size="small" autoFocus label={tr('Buscar', 'Search')} value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
                if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
                if (e.key === 'Enter' && focused) { e.preventDefault(); choose(focused); }
              }} />
            <TextField select size="small" label={tr('Raridade', 'Rarity')} value={rarity} onChange={(e) => setRarity(e.target.value as RarityFilter)}>
              <MenuItem value="all">{tr('Todas', 'All')}</MenuItem>
              <MenuItem value="common">{RARITY_LABEL.common}</MenuItem>
              <MenuItem value="uncommon">{RARITY_LABEL.uncommon}</MenuItem>
              <MenuItem value="rare">{RARITY_LABEL.rare}</MenuItem>
            </TextField>
            {mesaRules && (
              <FormControlLabel sx={{ gridColumn: '1 / -1' }}
                control={<Switch size="small" checked={onlyAllowed} onChange={(e) => setOnlyAllowed(e.target.checked)} />}
                label={tr('Só o liberado na mesa', 'Only what the table allows')} />
            )}
          </Box>
        )}
        {wide ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) 2fr', gap: 2, flex: 1, minHeight: 0 }}>
            <Box sx={{ display: 'flex', minHeight: 0, borderRight: 1, borderColor: 'divider' }}>{list}</Box>
            <Box sx={{ overflowY: 'auto', minHeight: 0 }}>{detail}</Box>
          </Box>
        ) : detailOpen ? detail : list}
      </DialogContent>

      <Drawer anchor="right" open={!!description} onClose={() => setDescription(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 } } } }}>
        {description && (
          <Suspense fallback={null}>
            <DescriptionContent request={{ type: 'special', name: description.name }} onClose={() => setDescription(null)} />
          </Suspense>
        )}
      </Drawer>
    </Dialog>
  );
}
