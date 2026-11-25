import { useState } from 'react';
import { Box, Button, Chip, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon, DeleteOutline as DeleteIcon } from '@mui/icons-material';
import { displayFont } from '../../../theme';
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
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Typography component="h3" sx={{ fontFamily: displayFont, fontWeight: 700, mb: 1 }}>{tr('Companheiros', 'Companions')}</Typography>
      <Stack spacing={1.5}>
        {state.companions.map((c) => {
          const chosen = Object.entries(c.choices).filter(([, v]) => 'id' in v) as [string, { id: string }][];
          return (
            <Box key={c.key} sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, alignItems: 'center' }}>
                <TextField size="small" label={tr('Nome', 'Name')} defaultValue={c.name} disabled={!canEdit}
                  onBlur={(e) => e.target.value.trim() && patch(c.key, { name: e.target.value.trim().slice(0, 80) })} />
                <TextField size="small" select label={tr('Tipo', 'Kind')} value={c.kind} disabled={!canEdit}
                  onChange={(e) => patch(c.key, { kind: e.target.value as CompanionChoice['kind'], type: undefined, choices: {} })}>
                  <MenuItem value="animal">{tr('Companheiro animal', 'Animal companion')}</MenuItem>
                  <MenuItem value="familiar">{tr('Familiar', 'Familiar')}</MenuItem>
                </TextField>
                <Button variant="outlined" onClick={() => setPicking({ key: c.key, field: 'type' })} disabled={!canEdit}>
                  {c.type ? name(c.type) : c.kind === 'animal' ? tr('Escolher animal', 'Choose animal') : tr('Familiar específico (opcional)', 'Specific familiar (optional)')}</Button>
              </Box>
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
                {chosen.map(([k, v]) => (
                  <Chip key={k} size="small" label={name(v.id)} onDelete={canEdit ? () => {
                    const { [k]: _drop, ...rest } = c.choices;
                    void _drop;
                    patch(c.key, { choices: rest });
                  } : undefined} />
                ))}
                {canEdit && (
                  <Chip size="small" icon={<AddIcon />} variant="outlined"
                    label={c.kind === 'familiar' ? tr('Habilidade', 'Ability') : tr('Avanço/especialização', 'Advancement/specialization')}
                    onClick={() => setPicking({ key: c.key, field: c.kind === 'familiar' ? 'ability' : 'advance' })} />
                )}
                {c.kind === 'familiar' && (
                  <Typography variant="caption" color="text.secondary">
                    {tr(`${chosen.length} habilidade(s); o número permitido depende dos talentos e da classe.`, `${chosen.length} ability(ies); the allowed number depends on feats and class.`)}
                  </Typography>
                )}
                {canEdit && <IconButton aria-label={tr('Remover', 'Remove')} title={tr('Remover', 'Remove')} onClick={() => setCompanions((l) => l.filter((x) => x.key !== c.key))}><DeleteIcon /></IconButton>}
              </Stack>
            </Box>
          );
        })}
        {canEdit && state.companions.length < 10 && (
          <Button startIcon={<AddIcon />} onClick={() => setCompanions((l) => [...l, { key: newKey(), kind: 'animal', name: tr('Companheiro', 'Companion'), choices: {} }])}>
            {tr('Adicionar companheiro', 'Add companion')}</Button>
        )}
      </Stack>
      <ContentPicker open={!!picking} title={picking?.field === 'ability' ? tr('Habilidade de familiar', 'Familiar ability') : picking?.field === 'advance' ? tr('Avanço do companheiro', 'Companion advancement') : tr('Tipo', 'Type')}
        entries={pickerEntries} mesaRules={mesaRules} onClose={() => setPicking(null)}
        onPick={(id) => {
          if (!current || !picking) return;
          if (picking.field === 'type') patch(current.key, { type: id });
          else addChoice(current, picking.field, id);
        }} />
    </Paper>
  );
}
