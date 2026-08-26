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

// Talento / habilidade (feature de classe, heritage, ação) vindo da AON já
// estruturado e traduzido pelo backend (api/_lib/feat-core.js).
/**
 * Magias de um bastão, já filtradas pelo degrau que o personagem possui.
 *
 * O AON guarda a família inteira num documento só ("Staff of Healing" traz
 * base, Greater, Major e True), então o backend isola o degrau e acumula as
 * magias **só para baixo**, como manda a regra do bastão (GM Core p. 278).
 * Nomes de magia ficam em inglês: é por eles que a UI busca a descrição.
 */
export interface StaffInfo {
  /** Degrau que a ficha possui, ex. "Staff of Healing (Greater)". */
  tierName: string;
  tierLevel: number;
  price: string | null;
  /** Efeito próprio do degrau, ex. "O bônus de item das magias heal é +2." */
  effect: string;
  ranks: {
    /** 0 = truque (não gasta carga). */
    rank: number;
    /** `tierLevel` diz de qual degrau a magia veio (base ou o próprio). */
    spells: { name: string; tierLevel: number }[];
  }[];
  /** Degraus somados na lista (o próprio e os inferiores). */
  tiers: { name: string; level: number }[];
}

export interface FeatDescription {
  name: string;
  level?: number | null;
  actions?: string;        // "Single Action", "Two Actions", "Reaction", "Free Action"
  traits?: string[];
  category?: string;       // 'feat' | 'class-feature' | 'heritage' | 'action' | ...
  className?: string;      // 'Fighter'
  archetype?: string[];
  sourceBook?: string;     // "Player Core, p. 141"
  prerequisites?: string;
  trigger?: string;
  requirements?: string;
  frequency?: string;
  access?: string;
  cost?: string;
  description: string | null;
  /** Só itens da categoria Staves (ver StaffInfo). */
  staff?: StaffInfo;
  translationPending?: boolean;  // ficou em EN por falha de tradução — não cachear
}

export interface SpellDescription {
  name: string;
  level?: number | null;   // rank base da magia no AON (null quando não achada)
  heighten?: string[];     // padrão de heighten do AON, ex. ["+1"]
  sourceBook?: string;     // "Player Core, p. 341"
  heightenedEntries?: { level: string; text: string }[];  // estruturado do backend
  translationPending?: boolean;  // ficou em EN por falha de tradução — não cachear
  actions?: string;        // "1", "2", "3", "reaction", "free", "1 to 3"
  traits?: string[];       // ["healing", "vitality"] — sem tradições
  traditions?: string[]    // ["divine", "primal"] — separado de traits
  castComponents?: string  // "somatic, verbal"
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

// Ataque na forma CANÔNICA do AON (companheiro jovem: 1 dado, sem modificadores).
// Os números finais saem de computeCompanion(), em character-viewer/companionStats.ts.
export interface CompanionAttack {
  category: string;      // 'melee' | 'ranged'
  actions: string;       // "Single Action"
  name: string;          // "jaws" — canônico EN, traduzido no render
  traits: string[];      // ["Agile"]
  damageDice: string;    // "1d8" — dado base do companheiro jovem
  damageType: string;    // "piercing" — canônico EN
}

/**
 * Base canônica do companheiro JOVEM, vinda dos campos estruturados do AON.
 * Vocabulário mecânico (tamanho, tipos de dano, perícias, sentidos) fica em
 * inglês e é traduzido no render; só a prosa (summary, supportBenefit) chega
 * traduzida do backend. A progressão (mature/nimble/savage) e o nível são
 * aplicados no frontend, porque dependem da ficha.
 */
export interface CompanionStats {
  name: string;
  summary: string;
  sourceBook?: string;
  size: string;          // "Small"
  speed: number;         // velocidade terrestre em pés
  speeds: Record<string, number>;   // { land: 35, swim: 25 }
  ancestryHp: number;    // PV de ancestralidade do tipo
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  skills: string[];      // perícia extra treinada que vem do tipo
  senses: string;
  attacks: CompanionAttack[];
  supportBenefit: string;
  advancedManeuver: string | null;
  mount?: boolean;
  translationPending?: boolean;
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

// Formato de talento vindo do JSON do Pathbuilder/exportador
// Array: [nome, qualificador|null, tipo, nível, ...campos extras]
export type FeatArray = [string, string | null, string?, number?, ...unknown[]]
// Objeto (formato alternativo menos comum)
export interface FeatObject { name: string; type?: string; level?: number }
export type FeatEntry = FeatArray | FeatObject

/** Extrai nome, tipo e nível de qualquer formato de entrada de talento */
export function parseFeatEntry(f: FeatEntry): { name: string; type: string; level: number } {
  if (Array.isArray(f)) {
    return {
      name: String(f[0] ?? ''),
      type: String(f[2] ?? 'Outro'),
      level: Number(f[3] ?? 1),
    }
  }
  return {
    name: String(f.name ?? ''),
    type: String(f.type ?? 'Outro'),
    level: Number(f.level ?? 1),
  }
}

export interface FocusAbility {
  abilityBonus?: number;
  proficiency?: number;
  itemBonus?: number;
  focusCantrips?: string[];
  focusSpells?: string[];
}

export type FocusTradition = Record<string, FocusAbility>

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
  feats: FeatEntry[];
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
  focus?: Record<string, FocusTradition>;
  mods?: Record<string, Record<string, number>>;
  acTotal?: {
    acProfBonus: number;
    acAbilityBonus: number;
    acItemBonus: number;
    acTotal: number;
    shieldBonus: number | null;
  };
  pets?: Pet[];
  petDescriptions?: Record<string, CompanionStats>;
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
