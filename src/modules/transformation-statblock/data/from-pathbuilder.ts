import type { PlayerCharacter } from '../../../types';
import type { BuildInfo, Proficiencies } from '../../character-sheet/types';
import { parseCharacterJson } from '../../character-sheet/types';
import { abilityMod, totalHp } from '../../character-viewer/helpers';

// Pathbuilder stores each proficiency as its bonus (2 × rank): 0 untrained,
// 2 trained, 4 expert, 6 master, 8 legendary. A proficient modifier adds the
// character level; an untrained one is just the ability modifier (no level).
function profMod(profBonus: number, ability: number, level: number): number {
  return profBonus > 0 ? level + profBonus + ability : ability;
}

// Best "your own" attack modifier — used for the battle-form rule
// "unless your own attack modifier is higher". Prefer the highest final weapon
// attack bonus (already includes level, proficiency and runes); fall back to
// unarmed proficiency when the character has no weapons.
function bestAttackBonus(build: BuildInfo): number {
  const level = build.level;
  const { str, dex } = build.abilities;
  const p = build.proficiencies;
  const unarmed = profMod(p.unarmed, abilityMod(str), level);
  const weaponBest = (build.weapons ?? []).reduce(
    (max, w) => (typeof w.attack === 'number' && w.attack > max ? w.attack : max),
    Number.NEGATIVE_INFINITY
  );
  const dexFinesse = profMod(p.unarmed, abilityMod(dex), level);
  return Math.max(unarmed, dexFinesse, weaponBest === Number.NEGATIVE_INFINITY ? unarmed : weaponBest);
}

function saveMod(
  p: Proficiencies,
  key: 'fortitude' | 'reflex' | 'will',
  ability: number,
  level: number
): number {
  return profMod(p[key], abilityMod(ability), level);
}

// Convert a Pathbuilder `build` object into the extended PlayerCharacter used
// by the transformation stat block, populating real final modifiers.
export function playerCharacterFromBuild(build: BuildInfo): PlayerCharacter {
  const { str, dex, con, int, wis, cha } = build.abilities;
  const level = build.level;
  const p = build.proficiencies;
  const attr = build.attributes;

  const maxHP = totalHp({
    ancestryHp: attr.ancestryhp,
    classHp: attr.classhp,
    bonusHp: attr.bonushp,
    bonusHpPerLevel: attr.bonushpPerLevel,
    level,
    conScore: con,
  });

  return {
    name: build.name,
    level,
    class: build.class,
    ancestry: build.ancestry,
    background: build.background,
    abilityScores: {
      strength: str,
      dexterity: dex,
      constitution: con,
      intelligence: int,
      wisdom: wis,
      charisma: cha,
    },
    skills: {},
    proficiencyBonus: 0,
    classFeatures: build.specials ?? [],
    equipment: (build.equipment ?? []).map((e) => e[0]),
    maxHP,
    perception: profMod(p.perception, abilityMod(wis), level),
    athletics: profMod(p.athletics, abilityMod(str), level),
    attackBonus: bestAttackBonus(build),
    saves: {
      fortitude: saveMod(p, 'fortitude', con, level),
      reflex: saveMod(p, 'reflex', dex, level),
      will: saveMod(p, 'will', wis, level),
    },
  };
}

// Convenience: parse a raw Pathbuilder JSON export into a PlayerCharacter.
export function playerCharacterFromJson(json: unknown): PlayerCharacter {
  return playerCharacterFromBuild(parseCharacterJson(json));
}
