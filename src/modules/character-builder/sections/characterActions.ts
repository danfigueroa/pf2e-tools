import { locale } from '../../../i18n';
import { BOUNTY_HUNTER_DEDICATION, MONSTER_HUNTER } from '../engine/feats';
import { buildRulesIndex, grantedActionName } from '../engine/rulesIndex';
import type { RuleEntry } from '../rules/types';
import type { SectionProps } from './types';

export interface CharacterAction {
  entry: RuleEntry;
  sources: { name: string; level: number }[];
  bountyHunter?: boolean;
  monsterHunter?: boolean;
}

const HUNT_PREY = 'action:action-2257'; // Player Core p. 154.
const activityTraits = /^(exploration|downtime)$/i;

export function characterActions({ state, compiled, index }: Pick<SectionProps, 'state' | 'compiled' | 'index'>, catalog: RuleEntry[]): CharacterAction[] {
  const actions = buildRulesIndex([catalog.filter((entry) => entry.type === 'action' && !entry.superseded)], []);
  const result = new Map<string, CharacterAction>();
  const add = (entry: RuleEntry | undefined, name: string, level: number) => {
    if (!entry) return;
    const key = entry.homebrew ? entry.id : entry.name.toLowerCase();
    const row = result.get(key) ?? { entry, sources: [] };
    if (!row.sources.some((s) => s.name === name && s.level === level)) row.sources.push({ name, level });
    result.set(key, row);
  };
  const origins = [state.origin.ancestry, state.origin.heritage, state.origin.background]
    .map(index.get).filter((entry): entry is RuleEntry => !!entry);
  const sources = [
    ...origins.map((entry) => ({ entry, name: entry.name, level: 1 })),
    ...compiled.classFeatures.filter((f) => f.level <= compiled.level)
      .map((f) => ({ entry: index.get(f.id), name: f.name, level: f.level, classFeature: true })),
    ...compiled.classChoices.filter((c) => c.level <= compiled.level && c.chosen)
      .map((c) => {
        const entry = index.get(c.chosen) ?? c.options.find((e) => e.id === c.chosen);
        return { entry, name: entry?.name ?? c.label, level: c.level };
      }),
    ...compiled.taken.filter((t) => !t.limited).map((t) => ({ entry: t.entry, name: t.entry.name, level: t.level })),
  ];
  const cls = index.get(state.class.id);
  for (const source of sources) {
    const { entry, name, level } = source;
    const sourceName = 'classFeature' in source ? cls?.name ?? name : name;
    if ('classFeature' in source) {
      const action = actions.byName(name, 'action');
      // Homônimos de um livro diferente só valem quando a ação identifica a classe no próprio traço.
      if (action && (action.source.id === entry?.source.id || action.traits?.includes(cls?.name ?? ''))) add(action, sourceName, level);
    }
    if (entry && (entry.actions || entry.type === 'action' || entry.traits?.some((t) => activityTraits.test(t)))) add(entry, sourceName, level);
    for (const rule of entry?.rules ?? []) {
      const granted = grantedActionName(rule);
      if (granted) add(actions.byName(granted, 'action'), sourceName, level);
    }
  }

  const huntPrey = [...result.values()].find((action) => action.entry.id === HUNT_PREY);
  if (huntPrey) {
    huntPrey.bountyHunter = compiled.taken.some((t) => t.entry.id === BOUNTY_HUNTER_DEDICATION);
    huntPrey.monsterHunter = compiled.taken.some((t) => t.entry.id === MONSTER_HUNTER);
  }
  return [...result.values()].sort((a, b) => a.entry.name.localeCompare(b.entry.name, locale));
}
