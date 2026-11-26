import { useState } from 'react';
import { Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon, Close as CloseIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { chrome, ink } from '../../../theme';
import { BandHead, Folio, Pill, SectionHead } from '../components/ui';
import { cardSx } from '../components/uiTokens';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import type { RuleEntry } from '../rules/types';
import type { CompanionChoice } from '../types';
import type { SectionProps } from './types';

let seq = 0;
const newKey = () => `pet-${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Companheiros (F6.7): companheiro animal (tipo e especialização/avanço do catálogo) e familiar (habilidades). Os números
 * do companheiro a Ficha já calcula (`companionStats.ts`); aqui ficam as escolhas. Quantas habilidades o familiar tem
 * depende dos talentos e da classe: o Criador ainda não confere e mostra só a contagem.
 */
export function CompanionsSection({ state, update, canEdit, mesaRules, entries }: SectionProps & { entries: RuleEntry[] }) {
  const [picking, setPicking] = useState<{ key: string; field: 'type' | 'ability' | 'advance' } | null>(null);
  const byType = (t: string) => entries.filter((e) => e.type === t);
  const name = (id?: string) => entries.find((e) => e.id === id)?.name ?? id;

  const setCompanions = (fn: (list: CompanionChoice[]) => CompanionChoice[]) => update((s) => ({ ...s, companions: fn(s.companions) }));
  const patch = (key: string, p: Partial<CompanionChoice>) => setCompanions((list) => list.map((c) => (c.key === key ? { ...c, ...p } : c)));
  const addChoice = (c: CompanionChoice, prefix: string, id: string) => {
    const n = Object.keys(c.choices).filter((k) => k.startsWith(prefix)).length + 1;
    patch(c.key, { choices: { ...c.choices, [`${prefix}-${n}`]: { id } } });
  };

  const current = picking ? state.companions.find((c) => c.key === picking.key) : undefined;
  const pickerEntries = !picking || !current ? [] : picking.field === 'type'
    ? (current.kind === 'animal' ? [...byType('animal-companion'), ...byType('animal-companion-unique')] : byType('familiar-specific'))
    : picking.field === 'ability' ? byType('familiar-ability')
      : [...byType('animal-companion-advanced'), ...byType('animal-companion-specialization')];

  return (
    <Stack spacing={1.5}>
      {state.companions.length === 0 && (
        <Box sx={[cardSx, { p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }]}>
          <SectionHead>{tr('Companheiros', 'Companions')}</SectionHead>
          <Box sx={{ fontSize: 14, color: ink.secondary }}>{tr('Companheiro animal ou familiar, quando a classe ou um talento dá.', 'An animal companion or familiar, when your class or a feat grants one.')}</Box>
        </Box>
      )}
        {state.companions.map((c) => {
          const chosen = Object.entries(c.choices).filter(([, v]) => 'id' in v) as [string, { id: string }][];
          return (
            <Box key={c.key} sx={[cardSx, { overflow: 'hidden' }]}>
              <BandHead right={canEdit ? (
                <IconButton size="small" aria-label={tr('Remover', 'Remove')} title={tr('Remover', 'Remove')} sx={{ color: chrome.text }}
                  onClick={() => setCompanions((l) => l.filter((x) => x.key !== c.key))}><DeleteIcon fontSize="small" /></IconButton>
              ) : undefined}>{c.name || (c.kind === 'animal' ? tr('Companheiro animal', 'Animal companion') : tr('Familiar', 'Familiar'))}</BandHead>
              <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label={tr('Nome', 'Name')} defaultValue={c.name} disabled={!canEdit}
                  onBlur={(e) => e.target.value.trim() && patch(c.key, { name: e.target.value.trim().slice(0, 80) })} />
                <TextField size="small" select label={tr('Tipo', 'Kind')} value={c.kind} disabled={!canEdit}
                  onChange={(e) => patch(c.key, { kind: e.target.value as CompanionChoice['kind'], type: undefined, choices: {} })}>
                  <MenuItem value="animal">{tr('Companheiro animal', 'Animal companion')}</MenuItem>
                  <MenuItem value="familiar">{tr('Familiar', 'Familiar')}</MenuItem>
                </TextField>
              </Box>
              <Folio label={c.kind === 'animal' ? tr('Animal', 'Animal') : tr('Familiar específico · opcional', 'Specific familiar · optional')}
                name={c.type ? name(c.type) : c.kind === 'animal' ? tr('Escolher animal', 'Choose animal') : tr('Nenhum', 'None')}
                todo={!c.type && c.kind === 'animal'} disabled={!canEdit} onClick={() => setPicking({ key: c.key, field: 'type' })} />
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
                {chosen.map(([k, v]) => (
                  <Pill key={k} title={canEdit ? tr('Tocar para tirar', 'Tap to remove') : undefined} onClick={canEdit ? () => {
                    const { [k]: _drop, ...rest } = c.choices;
                    void _drop;
                    patch(c.key, { choices: rest });
                  } : undefined}>{name(v.id)}{canEdit && <CloseIcon sx={{ fontSize: 14, color: ink.secondary }} />}</Pill>
                ))}
                {canEdit && (
                  <Pill look="add" onClick={() => setPicking({ key: c.key, field: c.kind === 'familiar' ? 'ability' : 'advance' })}>
                    {c.kind === 'familiar' ? tr('+ Habilidade', '+ Ability') : tr('+ Avanço/especialização', '+ Advancement/specialization')}</Pill>
                )}
                {c.kind === 'familiar' && (
                  <Typography variant="caption" color="text.secondary">
                    {tr(`${chosen.length} habilidade(s); o número permitido depende dos talentos e da classe.`, `${chosen.length} ability(ies); the allowed number depends on feats and class.`)}
                  </Typography>
                )}
              </Stack>
              </Box>
            </Box>
          );
        })}
        {canEdit && state.companions.length < 10 && (
          <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} startIcon={<AddIcon />} onClick={() => setCompanions((l) => [...l, { key: newKey(), kind: 'animal', name: tr('Companheiro', 'Companion'), choices: {} }])}>
            {tr('Adicionar companheiro', 'Add companion')}</Button>
        )}
      <ContentPicker open={!!picking} title={picking?.field === 'ability' ? tr('Habilidade de familiar', 'Familiar ability') : picking?.field === 'advance' ? tr('Avanço do companheiro', 'Companion advancement') : tr('Tipo', 'Type')}
        entries={pickerEntries} mesaRules={mesaRules} onClose={() => setPicking(null)}
        onPick={(id) => {
          if (!current || !picking) return;
          if (picking.field === 'type') patch(current.key, { type: id });
          else addChoice(current, picking.field, id);
        }} />
    </Stack>
  );
}
