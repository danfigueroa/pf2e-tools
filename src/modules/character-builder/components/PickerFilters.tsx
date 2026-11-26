import { useState, type ReactNode } from 'react';
import { Box, Button, InputBase, MenuItem, TextField } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { ink, rule } from '../../../theme';
import { locale, tr } from '../../../i18n';
import { Label, Pill } from './ui';
import {
  ACTION_LABEL, EDITION_LABEL, EMPTY_FILTERS, SORT_LABEL, type ActionKey, type Edition, type Eligible, type Facets, type PickerFilterState,
  type SortKey,
} from './filterModel';

const RARITY: Record<string, string> = { common: tr('Comum', 'Common'), uncommon: tr('Incomum', 'Uncommon'), rare: tr('Raro', 'Rare'), unique: tr('Único', 'Unique') };
const TRADITION: Record<string, string> = { arcane: tr('Arcana', 'Arcane'), divine: tr('Divina', 'Divine'), occult: tr('Oculta', 'Occult'), primal: tr('Primal', 'Primal') };
const ELIGIBLE: Record<Eligible, string> = { all: tr('Todos', 'All'), ok: tr('Só elegíveis', 'Eligible only'), maybe: tr('Elegíveis ou o GM confere', 'Eligible or GM checks') };
const CANTRIP = { all: tr('Todas', 'All'), only: tr('Só truques', 'Cantrips only'), none: tr('Sem truques', 'No cantrips') } as const;
const TRAITS_SHOWN = 24;

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const Group = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box role="group" aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
    <Label>{label}</Label>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>{children}</Box>
  </Box>
);

/**
 * O painel de filtros avançados do seletor: nível (faixa), ordenação, raridade, ações, elegibilidade, edição, tradição e
 * truque (magias), categoria e preço (itens) e traços (todos os marcados, com busca). Só aparece o que separa a lista.
 */
export function PickerFilters({ facets, value, onChange, traitText, hasPrereq, shownCount, onDone }: {
  facets: Facets;
  value: PickerFilterState;
  onChange: (next: PickerFilterState) => void;
  traitText: (t: string) => string;
  hasPrereq: boolean;
  shownCount: number;
  /** Celular: fecha a gaveta ("Ver N resultados"). */
  onDone?: () => void;
}) {
  const [traitQ, setTraitQ] = useState('');
  const [allTraits, setAllTraits] = useState(false);
  const set = (patch: Partial<PickerFilterState>) => onChange({ ...value, ...patch });
  const levels = Array.from({ length: facets.maxLevel - facets.minLevel + 1 }, (_, i) => facets.minLevel + i);
  const term = traitQ.trim().toLowerCase();
  const traitList = facets.traits.filter((t) => !term || t.name.toLowerCase().includes(term) || traitText(t.name).toLowerCase().includes(term));
  const traits = [
    ...value.traits.map((name) => ({ name, count: facets.traits.find((t) => t.name === name)?.count ?? 0 })),
    ...traitList.filter((t) => !value.traits.includes(t.name)),
  ].slice(0, allTraits || term ? 200 : TRAITS_SHOWN + value.traits.length);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {facets.spells && facets.maxLevel > facets.minLevel && (
          <Group label={tr('Rank · os marcados', 'Rank · any selected')}>
            {levels.map((n) => (
              <Pill key={n} look={value.ranks.includes(n) ? 'sel' : 'default'} onClick={() => set({ ranks: toggle(value.ranks, n) })} sx={{ minWidth: 40 }}>
                {n === 0 ? tr('Truque', 'Cantrip') : n}
              </Pill>
            ))}
          </Group>
        )}
        {!facets.spells && facets.maxLevel > facets.minLevel && (
          <Box role="group" aria-label={tr('Nível', 'Level')} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Label>{tr('Nível', 'Level')}</Label>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <TextField select size="small" label={tr('De', 'From')} value={value.minLevel ?? ''} onChange={(e) => set({ minLevel: e.target.value === '' ? null : Number(e.target.value) })}>
                <MenuItem value="">{tr('Qualquer', 'Any')}</MenuItem>
                {levels.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
              <TextField select size="small" label={tr('Até', 'To')} value={value.maxLevel ?? ''} onChange={(e) => set({ maxLevel: e.target.value === '' ? null : Number(e.target.value) })}>
                <MenuItem value="">{tr('Qualquer', 'Any')}</MenuItem>
                {levels.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
            </Box>
          </Box>
        )}
        <Group label={tr('Ordenar por', 'Sort by')}>
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <Pill key={k} look={value.sort === k ? 'sel' : 'default'} onClick={() => set({ sort: k })}>{SORT_LABEL[k]}</Pill>)}
        </Group>
        {hasPrereq && (
          <Group label={tr('Pré-requisitos', 'Prerequisites')}>
            {(Object.keys(ELIGIBLE) as Eligible[]).map((k) => <Pill key={k} look={value.eligible === k ? 'sel' : 'default'} onClick={() => set({ eligible: k })}>{ELIGIBLE[k]}</Pill>)}
          </Group>
        )}
        {facets.rarities.length > 1 && (
          <Group label={tr('Raridade', 'Rarity')}>
            {facets.rarities.map((r) => <Pill key={r} look={value.rarities.includes(r) ? 'sel' : 'default'} onClick={() => set({ rarities: toggle(value.rarities, r) })}>{RARITY[r] ?? r}</Pill>)}
          </Group>
        )}
        {facets.actions.length > 1 && (
          <Group label={tr('Ações', 'Actions')}>
            {facets.actions.map((a) => (
              <Pill key={a} look={value.actions.includes(a) ? 'sel' : 'default'} onClick={() => set({ actions: toggle(value.actions, a as ActionKey) })}>{ACTION_LABEL[a]}</Pill>
            ))}
          </Group>
        )}
        {facets.editions.length > 1 && (
          <Group label={tr('Edição', 'Edition')}>
            {facets.editions.map((ed) => (
              <Pill key={ed} look={value.editions.includes(ed) ? 'sel' : 'default'} onClick={() => set({ editions: toggle(value.editions, ed as Edition) })}>{EDITION_LABEL[ed]}</Pill>
            ))}
          </Group>
        )}
        {facets.traditions.length > 1 && (
          <Group label={tr('Tradição', 'Tradition')}>
            {facets.traditions.map((t) => <Pill key={t} look={value.traditions.includes(t) ? 'sel' : 'default'} onClick={() => set({ traditions: toggle(value.traditions, t) })}>{TRADITION[t] ?? t}</Pill>)}
          </Group>
        )}
        {facets.spells && (
          <Group label={tr('Truques', 'Cantrips')}>
            {(Object.keys(CANTRIP) as (keyof typeof CANTRIP)[]).map((k) => <Pill key={k} look={value.cantrip === k ? 'sel' : 'default'} onClick={() => set({ cantrip: k })}>{CANTRIP[k]}</Pill>)}
          </Group>
        )}
        {facets.categories.length > 1 && (
          <Group label={tr('Categoria', 'Category')}>
            {facets.categories.map((c) => <Pill key={c} look={value.categories.includes(c) ? 'sel' : 'default'} onClick={() => set({ categories: toggle(value.categories, c) })}>{c}</Pill>)}
          </Group>
        )}
        {facets.prices && (
          <Box role="group" aria-label={tr('Preço máximo', 'Max price')} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Label>{tr('Preço máximo', 'Max price')}</Label>
            <TextField size="small" type="number" placeholder={tr('qualquer', 'any')} value={value.maxPrice ?? ''}
              onChange={(e) => set({ maxPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
              slotProps={{ input: { endAdornment: <Box component="span" sx={{ color: ink.secondary, fontSize: 13 }}>{tr('po', 'gp')}</Box> }, htmlInput: { min: 0 } }} />
          </Box>
        )}
      </Box>

      {facets.traits.length > 0 && (
        <Box role="group" aria-label={tr('Traços', 'Traits')} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Label>{tr('Traços · todos os marcados', 'Traits · all selected')}</Label>
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: 34, px: 1, border: `1px solid ${rule}`, borderRadius: '6px', ml: 'auto', minWidth: 180, color: ink.secondary }}>
              <SearchIcon sx={{ fontSize: 18 }} aria-hidden />
              <InputBase value={traitQ} onChange={(e) => setTraitQ(e.target.value)} placeholder={tr('Buscar traço', 'Search trait')}
                inputProps={{ 'aria-label': tr('Buscar traço', 'Search trait') }} sx={{ fontSize: 14, flex: 1 }} />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {traits.map((t) => (
              <Pill key={t.name} look={value.traits.includes(t.name) ? 'sel' : 'default'} onClick={() => set({ traits: toggle(value.traits, t.name) })} sx={{ minHeight: { xs: 36, sm: 30 } }}>
                {traitText(t.name)}<Box component="span" sx={{ fontSize: 11, opacity: 0.7 }}>{t.count.toLocaleString(locale)}</Box>
              </Pill>
            ))}
            {!term && !allTraits && facets.traits.length > TRAITS_SHOWN && (
              <Pill look="add" onClick={() => setAllTraits(true)}>{tr(`+ ${facets.traits.length - TRAITS_SHOWN} traços`, `+ ${facets.traits.length - TRAITS_SHOWN} traits`)}</Pill>
            )}
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button onClick={() => onChange({ ...EMPTY_FILTERS })}>{tr('Limpar filtros', 'Clear filters')}</Button>
        {onDone && <Button variant="contained" onClick={onDone}>{tr(`Ver ${shownCount.toLocaleString(locale)} resultado${shownCount === 1 ? '' : 's'}`, `Show ${shownCount.toLocaleString(locale)} result${shownCount === 1 ? '' : 's'}`)}</Button>}
      </Box>
    </Box>
  );
}
