import { tr } from '../../../i18n';
import { ruleListSlug } from '../engine/catalog';
import { CLASS_ARCHETYPES } from '../engine/classArchetypes';
import { evaluatePrereqs } from '../engine/prereqs';
import { featKindLabel, fitsSlot, type FeatSlot } from '../engine/slots';
import type { SectionProps } from '../sections/types';
import { setFeatChoice } from '../sections/types';
import type { RuleEntry } from '../rules/types';
import { ContentPicker } from './ContentPicker';

export function ArchetypeDedicationPicker({ slot, archetype, onBrowse, onClose, featLists, feats, core, compiled, state, update, mesaRules }: SectionProps & {
  slot: FeatSlot;
  archetype: string | null;
  onBrowse: (name: string | null) => void;
  onClose: () => void;
  featLists: Readonly<Record<string, RuleEntry[]>>;
  feats: RuleEntry[];
}) {
  const cap = slot.maxLevel ?? slot.level;
  const subtitle = tr(`${featKindLabel(slot.kind)} · nível ${slot.level}`, `${featKindLabel(slot.kind)} · level ${slot.level}`);
  const prereq = (e: RuleEntry) => evaluatePrereqs(e.prerequisites?.text, compiled.prereq);
  const raw = state.choices[slot.key];
  const value = raw && 'id' in raw ? raw.id : undefined;
  const isDedication = (entry: RuleEntry) => entry.type === 'feat' &&
    (entry.traits ?? []).some((t) => /^dedication$/i.test(t)) && (entry.level ?? 0) <= cap &&
    fitsSlot(entry, slot.kind, { ancestryTraits: compiled.ancestryTraits });

  if (!archetype) {
    const entries = core.archetypes.filter((a) => !CLASS_ARCHETYPES[a.id] && (a.level ?? 0) <= cap);
    return <ContentPicker key="archetypes" open title={tr('Escolher arquétipo', 'Choose an archetype')} subtitle={subtitle}
      entries={entries} onPick={(id) => onBrowse(entries.find((e) => e.id === id)?.name ?? null)}
      onClose={onClose} pickLabel={() => tr('Ver dedicação', 'View dedication')} mesaRules={mesaRules} prereq={prereq} keepOpen />;
  }

  const slug = ruleListSlug(archetype);
  const list = featLists[`feats/archetype/${slug}`];
  const entries = [...new Map([...(list ?? []), ...feats.filter((f) => f.feat?.archetype?.some((name) => ruleListSlug(name) === slug))]
    .filter(isDedication).map((f) => [f.id, f])).values()];
  return <ContentPicker key={slug} open title={tr(`Dedicação de ${archetype}`, `${archetype} dedication`)} subtitle={subtitle}
    entries={entries} value={value} onPick={(id) => setFeatChoice(update, slot.key, id, entries.find((f) => f.id === id))}
    onClose={onClose} mesaRules={mesaRules} prereq={prereq}
    browseAction={{ label: tr('Trocar arquétipo', 'Change archetype'), onClick: () => onBrowse(null) }}
    emptyText={list ? tr('O catálogo não tem uma dedicação deste arquétipo para esta vaga.', 'The catalog has no dedication for this archetype in this slot.')
      : tr('Carregando a dedicação…', 'Loading the dedication…')} />;
}
