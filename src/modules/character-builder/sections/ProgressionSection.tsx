import { useContext, useMemo, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { ExpandMore as ExpandIcon } from '@mui/icons-material';
import { tr } from '../../../i18n';
import { ContentPicker } from '../components/ContentPicker';
import { PickerField } from '../components/PickerField';
import { evaluatePrereqs } from '../engine/prereqs';
import { featKindLabel, fitsSlot, type FeatSlot } from '../engine/slots';
import type { ChildSlot } from '../engine/feats';
import type { RuleEntry } from '../rules/types';
import { ruleListSlug } from '../rules';
import { pickerEditions } from '../remaster';
import { BuildExceptions } from '../hooks/buildExceptions';
import { setChoice, type SectionProps } from './types';

const SAVES = [
  { value: 'fortitude', label: tr('Fortitude', 'Fortitude') },
  { value: 'reflex', label: tr('Reflexos', 'Reflex') },
  { value: 'will', label: tr('Vontade', 'Will') },
];

/** Rótulo de opção de ChoiceSet: o Foundry manda chave de tradução ("PF2E.SavesWill"); o valor é mais legível. */
function optionLabel(o: { value: string; label: string }): string {
  if (o.label === 'PF2E.TraitArcane') return tr('Arcana', 'Arcane');
  if (o.label === 'PF2E.TraitDivine') return tr('Divina', 'Divine');
  if (!o.label.startsWith('PF2E.')) return o.label;
  const fromPath = /\.(fortitude|reflex|will|perception|[a-z]+)\.rank$/.exec(o.value)?.[1];
  const raw = fromPath ?? o.value.split('.').pop() ?? o.value;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type Picking =
  | { kind: 'feat'; slot: FeatSlot }
  | { kind: 'child'; child: ChildSlot }
  | { kind: 'classChoice'; key: string }
  | null;

export interface ProgressionProps extends SectionProps {
  feats: RuleEntry[];
  archetypes: RuleEntry[];
  /** Arquétipo que o seletor está navegando (carrega a lista dele). */
  browseArchetype: string | null;
  setBrowseArchetype: (name: string | null) => void;
  /** Slot a abrir direto (vindo de "Trocar talento" na Ficha). */
  initialSlot?: string | null;
}

/**
 * Aba Progressão (UX §1.2): o plano do 1º ao 20º, um acordeão por nível. Cada nível mostra as características de classe
 * (texto), os slots de talento e as escolhas filhas. Níveis acima do atual aparecem esmaecidos ("planejado").
 */
export function ProgressionSection(props: ProgressionProps) {
  const { state, update, compiled, mesaRules, canEdit, index, feats, archetypes, browseArchetype, setBrowseArchetype, initialSlot } = props;
  const initial = initialSlot ? compiled.featSlots.find((s) => s.key === initialSlot) : undefined;
  const [open, setOpen] = useState<number | false>(initial?.level ?? compiled.level);
  const [picking, setPicking] = useState<Picking>(initial && canEdit ? { kind: 'feat', slot: initial } : null);

  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  const takenBySlot = useMemo(() => new Map(compiled.taken.map((t) => [t.slot, t])), [compiled.taken]);
  const pendingKeys = useMemo(() => new Set(compiled.pending.map((p) => p.key)), [compiled.pending]);
  const exceptions = useContext(BuildExceptions);
  const className = index.get(state.class.id)?.name;

  /** Candidatos de um slot: pelo tipo, até o teto de nível; o arquétipo navegado entra nos slots de classe e arquétipo. */
  const candidates = (kind: FeatSlot['kind'], cap: number, filter?: ChildSlot['filter']) => feats.filter((f) => {
    if ((f.level ?? 0) > cap) return false;
    if (filter) {
      const traits = (f.traits ?? []).map((t) => t.toLowerCase());
      if (filter.category === 'ancestry' && !fitsSlot(f, 'ancestry', { ancestryTraits: compiled.ancestryTraits })) return false;
      if (filter.category === 'class' && !fitsSlot(f, 'class', { className, ancestryTraits: [] })) return false;
      if (filter.category === 'general' && !traits.includes('general')) return false;
      if (filter.category === 'skill' && !traits.includes('skill')) return false;
      return filter.traits.every((t) => t.includes('{') || traits.includes(t));
    }
    return fitsSlot(f, kind, { className, ancestryTraits: compiled.ancestryTraits });
  });

  const reason = (e: RuleEntry) => {
    const r = evaluatePrereqs(e.prerequisites?.text, compiled.prereq);
    if (r.result === 'fail') return tr(`não cumpre: ${r.parts.filter((p) => p.result === 'fail').map((p) => p.reason ?? p.text).join('; ')}`, `not met: ${r.parts.filter((p) => p.result === 'fail').map((p) => p.reason ?? p.text).join('; ')}`);
    if (r.result === 'unknown') return tr('confira o pré-requisito', 'check the prerequisite');
    return undefined;
  };
  const featFacts = (e: RuleEntry) => (
    <Stack spacing={0.25}>
      <Typography variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>{tr('Nível', 'Level')}: </Box>{e.level ?? '—'}</Typography>
      {e.prerequisites?.text && (
        <Typography variant="body2"><Box component="span" sx={{ color: 'text.secondary' }}>{tr('Pré-requisitos', 'Prerequisites')}: </Box>{e.prerequisites.text}</Typography>
      )}
      {reason(e) && <Typography variant="body2" color="warning.main">{reason(e)}</Typography>}
    </Stack>
  );

  const pickFeat = (slotKey: string, id: string) => {
    const entry = feats.find((f) => f.id === id);
    const archetype = entry?.feat?.archetype?.[0];
    // O arquétipo vai no qualificador: é ele que diz qual lista baixar ao reabrir o personagem.
    setChoice(update, slotKey, { id, ...(archetype ? { qualifier: `archetype:${ruleListSlug(archetype)}` } : {}) });
  };

  const picker = (() => {
    if (!picking) return null;
    if (picking.kind === 'feat') {
      const { slot } = picking;
      const entries = candidates(slot.kind, slot.maxLevel ?? slot.level);
      const raw = state.choices[slot.key];
      return (
        <ContentPicker open title={`${slot.label} (${tr('nível', 'level')} ${slot.level})`} entries={entries}
          value={raw && 'id' in raw ? raw.id : undefined} onPick={(id) => pickFeat(slot.key, id)} onClose={() => setPicking(null)}
          mesaRules={mesaRules} facts={featFacts} secondary={(e) => [`${tr('nível', 'level')} ${e.level ?? 0}`, reason(e)].filter(Boolean).join(' · ')} />
      );
    }
    if (picking.kind === 'child') {
      const { child } = picking;
      const entries = candidates('general', child.filter?.maxLevel ?? child.level, child.filter);
      return (
        <ContentPicker open title={child.label} entries={entries} value={child.chosen}
          onPick={(id) => setChoice(update, child.key, { id })} onClose={() => setPicking(null)} mesaRules={mesaRules} facts={featFacts}
          secondary={(e) => [`${tr('nível', 'level')} ${e.level ?? 0}`, reason(e)].filter(Boolean).join(' · ')} />
      );
    }
    const slot = compiled.classChoices.find((c) => c.key === picking.key);
    if (!slot) return null;
    return (
      <ContentPicker open title={slot.label} entries={slot.options} value={slot.chosen}
        onPick={(id) => setChoice(update, slot.key, { id })} onClose={() => setPicking(null)} mesaRules={mesaRules} />
    );
  })();

  const childRow = (child: ChildSlot) => {
    if (child.kind === 'feat') {
      const chosen = child.chosen ? index.get(child.chosen)?.name ?? child.chosen : undefined;
      return <PickerField key={child.key} label={child.label} value={chosen} onOpen={() => setPicking({ kind: 'child', child })} disabled={!canEdit} />;
    }
    return (
      <TextField key={child.key} select size="small" label={child.label} value={child.chosen ?? ''} disabled={!canEdit}
        error={!child.chosen} onChange={(e) => setChoice(update, child.key, e.target.value ? { value: e.target.value } : null)}>
        <MenuItem value="">{tr('Escolher…', 'Choose…')}</MenuItem>
        {(child.options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{optionLabel(o)}</MenuItem>)}
      </TextField>
    );
  };

  return (
    <Stack spacing={1}>
      {compiled.featSlots.some((s) => s.kind === 'archetype' || s.kind === 'class') && (
        <TextField select size="small" label={tr('Arquétipo para navegar (dedicações e talentos)', 'Archetype to browse (dedications and feats)')}
          value={browseArchetype ?? ''} onChange={(e) => setBrowseArchetype(e.target.value || null)} sx={{ maxWidth: 420 }}>
          <MenuItem value="">{tr('Nenhum', 'None')}</MenuItem>
          {pickerEditions(archetypes, mesaRules, exceptions).map((a) => <MenuItem key={a.id} value={a.name}>{a.name}</MenuItem>)}
        </TextField>
      )}

      {levels.map((level) => {
        const planned = level > compiled.level;
        const features = compiled.classFeatures.filter((f) => f.level === level);
        const slots = compiled.featSlots.filter((s) => s.level === level);
        const classChoices = compiled.classChoices.filter((c) => c.level === level);
        const saveChoices = compiled.saveChoices.filter((c) => c.level === level);
        const groupChoices = compiled.groupChoices.filter((c) => c.level === level);
        const children = compiled.featChildren.filter((c) => c.level === level);
        const missing = [...slots.map((s) => s.key), ...classChoices.map((c) => c.key), ...saveChoices.map((c) => c.key), ...groupChoices.map((c) => c.key), ...children.map((c) => c.key)]
          .filter((k) => pendingKeys.has(k)).length;
        if (!features.length && !slots.length && !classChoices.length && !saveChoices.length && !groupChoices.length) return null;
        return (
          <Accordion key={level} expanded={open === level} onChange={(_, on) => setOpen(on ? level : false)} disableGutters
            slotProps={{ transition: { unmountOnExit: true } }} sx={{ opacity: planned ? 0.6 : 1 }}>
            <AccordionSummary expandIcon={<ExpandIcon />} data-view="">
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{tr(`Nível ${level}`, `Level ${level}`)}</Typography>
                {planned && <Chip size="small" variant="outlined" label={tr('planejado', 'planned')} />}
                {!planned && missing > 0 && <Chip size="small" color="warning" label={tr(`${missing} pendente${missing > 1 ? 's' : ''}`, `${missing} to do`)} />}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.25}>
                {features.length > 0 && (
                  <Typography variant="body2" color="text.secondary">{features.map((f) => f.name).join(' · ')}</Typography>
                )}
                {classChoices.map((c) => (
                  <PickerField key={c.key} label={c.label} value={c.chosen ? c.options.find((o) => o.id === c.chosen)?.name ?? index.get(c.chosen)?.name : undefined}
                    hint={c.fixed ? tr('Concedida pelo arquétipo de classe', 'Granted by the class archetype') : undefined}
                    onOpen={() => setPicking({ kind: 'classChoice', key: c.key })} disabled={!canEdit || c.fixed} />
                ))}
                {saveChoices.map((c) => (
                  <TextField key={c.key} select size="small" label={c.label} value={c.chosen ?? ''} disabled={!canEdit} error={!c.chosen && !planned}
                    onChange={(e) => setChoice(update, c.key, e.target.value ? { value: e.target.value } : null)}>
                    <MenuItem value="">{tr('Escolher…', 'Choose…')}</MenuItem>
                    {SAVES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                  </TextField>
                ))}
                {groupChoices.map((c) => (
                  <TextField key={c.key} size="small" label={`${c.label}: ${tr('grupo de arma', 'weapon group')}`} defaultValue={c.chosen ?? ''}
                    disabled={!canEdit} error={!c.chosen && !planned} helperText={tr('Em inglês, como na AON (ex.: hammer, sword, bow).', 'As on AON (e.g. hammer, sword, bow).')}
                    onBlur={(e) => setChoice(update, c.key, e.target.value.trim() ? { value: e.target.value.trim().toLowerCase() } : null)} />
                ))}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1 }}>
                  {slots.map((slot) => {
                    const taken = takenBySlot.get(slot.key);
                    const raw = state.choices[slot.key];
                    const name = taken?.entry.name ?? (raw && 'id' in raw ? index.get(raw.id)?.name ?? raw.id : undefined);
                    const required = index.get(slot.requiredFeat);
                    return (
                      <Box key={slot.key}>
                        <PickerField label={slot.maxLevel ? `${slot.label} (≤ ${slot.maxLevel})` : featKindLabel(slot.kind)} value={name}
                          hint={taken && taken.prereq.result !== 'ok' ? (taken.prereq.result === 'fail' ? tr('pré-requisito não cumprido', 'prerequisite not met') : tr('confira o pré-requisito', 'check the prerequisite')) : undefined}
                          onOpen={() => setPicking({ kind: 'feat', slot })} disabled={!canEdit} />
                        {required && canEdit && !(raw && 'id' in raw && raw.id === required.id) && (
                          <Button size="small" onClick={() => pickFeat(slot.key, required.id)}>
                            {tr(`Escolher ${required.name}`, `Choose ${required.name}`)}
                          </Button>
                        )}
                      </Box>
                    );
                  })}
                </Box>
                {children.map(childRow)}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
      {picker}
    </Stack>
  );
}
