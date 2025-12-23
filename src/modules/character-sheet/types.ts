export interface AbilityBreakdown {
  ancestryFree?: string[];
  ancestryBoosts?: string[];
  ancestryFlaws?: string[];
  backgroundBoosts?: string[];
  classBoosts?: string[];
  mapLevelledBoosts?: Record<string, string[]>;
}

export interface Abilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  breakdown?: AbilityBreakdown;
}

export interface Attributes {
  ancestryhp: number;
  classhp: number;
  bonushp: number;
  bonushpPerLevel: number;
  speed: number;
  speedBonus: number;
}

export interface Proficiencies {
  classDC: number;
  perception: number;
  fortitude: number;
  reflex: number;
  will: number;
  heavy: number;
  medium: number;
  light: number;
  unarmored: number;
  advanced: number;
  martial: number;
  simple: number;
  unarmed: number;
  castingArcane: number;
  castingDivine: number;
  castingOccult: number;
  castingPrimal: number;
  acrobatics: number;
  arcana: number;
  athletics: number;
  crafting: number;
  deception: number;
  diplomacy: number;
  intimidation: number;
  medicine: number;
  nature: number;
  occultism: number;
  performance: number;
  religion: number;
  society: number;
  stealth: number;
  survival: number;
  thievery: number;
}

export interface Weapon {
  name: string;
  qty: number;
  prof: string;
  die: string;
  pot: number;
  str: string | null;
  mat: string | null;
  display: string;
  runes: string[];
  damageType: string;
  attack: number;
  damageBonus: number;
  extraDamage?: string[];
  increasedDice?: boolean;
  isInventor?: boolean;
}

export interface Armor {
  name: string;
  qty: number;
  prof: string;
  pot: number;
  res: string | null;
  mat: string | null;
  display: string;
  worn: boolean;
  runes: string[];
}

export interface SpellListByLevel {
  spellLevel: number;
  list: string[];
}

export interface SpellDescription {
  name: string;
  actions?: string;        // "1", "2", "3", "reaction", "free", "1 to 3"
  traits?: string[];       // ["divine", "healing", "vitality"]
  range?: string;          // "30 feet", "touch", "120 feet"
  area?: string;           // "15-foot emanation", "30-foot cone"
  targets?: string;        // "1 creature", "you"
  duration?: string;       // "1 minute", "sustained up to 1 minute"
  defense?: string;        // "basic Fortitude", "Will"
  description: string;     // Descrição completa
  damage?: string;         // "1d8" (dado base)
  damageType?: string;     // "vitality", "fire", "cold"
  heightened?: Record<string, string>;  // { "+1": "damage increases by 1d8" }
}

export interface SpellCaster {
  name: string;
  magicTradition: 'arcane' | 'divine' | 'occult' | 'primal' | string;
  spellcastingType: 'prepared' | 'spontaneous' | string;
  ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | string;
  proficiency: number;
  focusPoints: number;
  innate: boolean;
  perDay: number[];
  spells: SpellListByLevel[];
  prepared: string[];
  blendedSpells: string[];
}

export interface Pet {
  type: 'Animal Companion' | 'Familiar' | string;
  name: string;
  animal?: string;          // Tipo do animal (Bear, Wolf, etc.)
  mature?: boolean;         // Companheiro maduro
  incredible?: boolean;     // Companheiro incrível
  incredibleType?: string;  // Tipo do incrível (Savage, Nimble, etc.)
  specializations?: string[];
  armor?: string;           // Armadura do companheiro
  equipment?: string[];
}

export interface Familiar {
  name: string;
  type: string;
  abilities?: string[];
}

export interface BuildInfo {
  name: string;
  class: string;
  dualClass: string | null;
  level: number;
  xp: number;
  ancestry: string;
  heritage: string;
  background: string;
  alignment: string;
  deity: string;
  sizeName: string;
  keyability: string;
  languages: string[];
  abilities: Abilities;
  attributes: Attributes;
  proficiencies: Proficiencies;
  feats: any[];
  featDescriptions?: Record<string, string>;
  specials: string[];
  specialDescriptions?: Record<string, string>;
  spellDescriptions?: Record<string, SpellDescription>;
  lores: [string, number][];
  equipment: [string, number, string?][];
  specificProficiencies: {
    trained: string[];
    expert: string[];
    master: string[];
    legendary: string[];
  };
  weapons: Weapon[];
  armor: Armor[];
  money: { cp: number; sp: number; gp: number; pp: number };
  spellCasters: SpellCaster[];
  focusPoints?: number;
  focus?: Record<string, Record<string, {
    abilityBonus?: number;
    proficiency?: number;
    itemBonus?: number;
    focusCantrips?: string[];
    focusSpells?: string[];
  }>>;
  mods?: Record<string, Record<string, number>>;
  acTotal?: {
    acProfBonus: number;
    acAbilityBonus: number;
    acItemBonus: number;
    acTotal: number;
    shieldBonus: number | null;
  };
  pets?: Pet[];
  familiars?: Familiar[];
  rituals?: string[];
  resistances?: string[];
}

export interface CharacterFile {
  success: boolean;
  build: BuildInfo;
}

export function parseCharacterJson(json: unknown): BuildInfo {
  const obj = json as CharacterFile;
  if (!obj || !obj.success || !obj.build) {
    throw new Error('JSON de personagem inválido: campo "build" ausente.');
  }
  return obj.build;
}

export function formatAbilityScore(name: string, value: number) {
  const mod = Math.floor((value - 10) / 2);
  return `${name.toUpperCase()}: ${value} (mod ${mod >= 0 ? '+' + mod : mod})`;
}

export function getAonSearchUrl(name: string) {
  const q = encodeURIComponent(name);
  return `https://2e.aonprd.com/Search.aspx?q=${q}`;
}
