/* i18n-ignore-file */
// Tradução pt-BR do vocabulário mecânico do bloco de criatura.
// Os arquivos de dados mantêm os valores canônicos (tamanho, tipos de dano,
// traits, sentidos, deslocamentos) em inglês; a tradução acontece no render.
// Em INGLÊS (`isEn`) as funções devolvem o termo canônico como veio, e os rótulos
// fixos são os do livro — os dicionários abaixo são só do português.

import { isEn, tr } from '../../i18n';

// Rótulos fixos do bloco de criatura
export const LABELS = {
  perception: tr('Percepção', 'Perception'),
  languages: tr('Idiomas', 'Languages'),
  skills: tr('Perícias', 'Skills'),
  ac: tr('CA', 'AC'),
  fort: 'Fort',
  ref: 'Ref',
  will: tr('Von', 'Will'),
  hp: tr('PV', 'HP'),
  tempHp: tr('PV temporários', 'temporary HP'),
  immunities: tr('Imunidades', 'Immunities'),
  resistances: tr('Resistências', 'Resistances'),
  weaknesses: tr('Fraquezas', 'Weaknesses'),
  speed: tr('Deslocamento', 'Speed'),
  melee: tr('Corpo a corpo', 'Melee'),
  ranged: tr('À distância', 'Ranged'),
  damage: tr('Dano', 'Damage'),
  athletics: tr('Atletismo', 'Athletics'),
  duration: tr('Duração', 'Duration'),
  traditions: tr('Tradições', 'Traditions'),
  level: tr('Nível', 'Level'),
  creature: tr('Criatura', 'Creature'),
  // Usados pelo bloco de criatura da AON (módulo de escalar monstro).
  items: tr('Itens', 'Items'),
  senses: tr('Sentidos', 'Senses'),
  recallKnowledge: tr('Rememorar Conhecimento', 'Recall Knowledge'),
  source: tr('Fonte', 'Source'),
} as const;

/**
 * Símbolo de ação do stat block. O AON escreve por extenso
 * ("Single Action", "Two Actions"); a ficha impressa usa o glifo.
 */
export const ACTION_GLYPHS: Record<string, string> = {
  'free action': '◇',
  'reaction': '⤾',
  'single action': '◆',
  'two actions': '◆◆',
  'three actions': '◆◆◆',
};

export function actionGlyph(actions: string | null | undefined): string {
  if (!actions) return '';
  return ACTION_GLYPHS[actions.toLowerCase().trim()] ?? '';
}

// Abreviações de atributo
export const ABILITY_ABBR: Record<string, string> = {
  strength: tr('For', 'Str'),
  dexterity: tr('Des', 'Dex'),
  constitution: 'Con',
  intelligence: 'Int',
  wisdom: tr('Sab', 'Wis'),
  charisma: tr('Car', 'Cha'),
};

// Tamanhos
const SIZES: Record<string, string> = {
  Tiny: 'Minúsculo',
  Small: 'Pequeno',
  Medium: 'Médio',
  Large: 'Grande',
  Huge: 'Enorme',
  Gargantuan: 'Imenso',
};

// Raridades
const RARITIES: Record<string, string> = {
  Common: 'Comum',
  Uncommon: 'Incomum',
  Rare: 'Raro',
  Unique: 'Único',
};

// Tipos de dano e energia (forma adjetiva usada em "Dano 2d6 contundente")
const DAMAGE_TYPES: Record<string, string> = {
  bludgeoning: 'contundente',
  piercing: 'perfurante',
  slashing: 'cortante',
  acid: 'ácido',
  cold: 'frio',
  electricity: 'eletricidade',
  fire: 'fogo',
  sonic: 'sônico',
  force: 'força',
  mental: 'mental',
  poison: 'veneno',
  vitality: 'vitalidade',
  void: 'trevas',
  spirit: 'espírito',
  bleed: 'sangramento',
  holy: 'sagrado',
  unholy: 'profano',
  precision: 'precisão',
  physical: 'físico',
};

// Sentidos
export const SENSES: Record<string, string> = {
  lowLightVision: tr('visão na penumbra', 'low-light vision'),
  darkvision: tr('visão no escuro', 'darkvision'),
  scent: tr('olfato', 'scent'),
  tremorsense: tr('sentido sísmico', 'tremorsense'),
  truesight: tr('visão verdadeira', 'truesight'),
  blindsight: tr('percepção às cegas', 'blindsight'),
};

// Tipos de deslocamento
export const SPEED_TYPES: Record<string, string> = {
  land: '',
  climb: tr('escalar', 'climb'),
  swim: tr('nadar', 'swim'),
  fly: tr('voar', 'fly'),
  burrow: tr('escavar', 'burrow'),
};

// Traits comuns (palavra inicial; números e letras de tipo são preservados)
const TRAITS: Record<string, string> = {
  agile: 'ágil',
  finesse: 'acuidade',
  reach: 'alcance',
  range: 'distância',
  trip: 'derrubar',
  deadly: 'letal',
  versatile: 'versátil',
  forceful: 'impetuoso',
  sweep: 'amplo',
  shove: 'empurrar',
  push: 'empurrão',
  grab: 'agarrar',
  backswing: 'contragolpe',
  thrown: 'arremesso',
  unarmed: 'desarmado',
  // traits de criatura
  ooze: 'limo',
  elemental: 'elemental',
  air: 'ar',
  earth: 'terra',
  water: 'água',
  metal: 'metal',
  wood: 'madeira',
  divine: 'divino',
  fire: 'fogo',
  // letras de tipo em versatile X (S/P/B)
  S: 'C', // slashing → cortante
  P: 'P', // piercing → perfurante
  B: 'B', // bludgeoning → contundente
  // traits de habilidade
  emotion: 'emoção',
  visual: 'visual',
  illusion: 'ilusão',
  incapacitation: 'incapacitação',
};

// Nomes de ataque comuns
const ATTACK_NAMES: Record<string, string> = {
  jaws: 'mandíbulas',
  claw: 'garra',
  claws: 'garras',
  fist: 'punho',
  horn: 'chifre',
  horns: 'chifres',
  tail: 'cauda',
  foot: 'pata',
  talon: 'garra',
  fangs: 'presas',
  tongue: 'língua',
  branch: 'galho',
  dagger: 'adaga',
  sword: 'espada',
  boot: 'bota',
  scythe: 'foice',
  antler: 'galhada',
  'big claw': 'garra grande',
  'little claw': 'garra pequena',
  pseudopod: 'pseudópode',
  'cube face': 'face do cubo',
  gust: 'rajada',
  'lightning lance': 'lança relâmpago',
  tendril: 'tentáculo',
  wave: 'onda',
  blade: 'lâmina',
  vine: 'cipó',
  greatsword: 'espadão',
  scimitar: 'cimitarra',
  sunbeam: 'raio solar',
  'deific weapon': 'arma divina',
  'aqueous fist': 'punho aquoso',
  wing: 'asa',
  beak: 'bico',
  stinger: 'ferrão',
  pincer: 'pinça',
  hoof: 'casco',
  stomp: 'pisão',
  aquatic: 'aquático',
  bite: 'mordida',
  glaive: 'glaive',
  headbutt: 'cabeçada',
  longsword: 'espada longa',
  mandibles: 'mandíbulas',
  tentacle: 'tentáculo',
  thorns: 'espinhos',
  web: 'teia',
  foreleg: 'pata dianteira',
  'composite longbow': 'arco longo composto',
  'flaming greatsword': 'espadão flamejante',
  'flaming sword': 'espada flamejante',
  'holy greatsword': 'espadão sagrado',
  'holy mace': 'maça sagrada',
  'holy warhammer': 'martelo de guerra sagrado',
  'spine rake': 'espinho dorsal',
  beard: 'barba',
  leaf: 'folha',
  vines: 'cipós',
};

// Nomes de magias e formas (criaturas). Nomes próprios sem equivalente
// consagrado permanecem no original.
const NAMES: Record<string, string> = {
  // Magias
  'Animal Form': 'Forma Animal',
  'Insect Form': 'Forma de Inseto',
  'Aerial Form': 'Forma Aérea',
  'Dinosaur Form': 'Forma de Dinossauro',
  'Fey Form': 'Forma Feérica',
  'Elemental Form': 'Forma Elemental',
  'Plant Form': 'Forma Vegetal',
  'Dragon Form': 'Forma de Dragão',
  'Fiend Form': 'Forma de Corruptor',
  'Angel Form': 'Forma de Anjo',
  'Monstrosity Form': 'Forma de Monstruosidade',
  'Nature Incarnate': 'Natureza Encarnada',
  'Ooze Form': 'Forma de Limo',
  'Element Embodied': 'Elemento Personificado',
  Avatar: 'Avatar',
  'Generic Avatar': 'Avatar Genérico',
  'Avatar of Iomedae': 'Avatar de Iomedae',
  'Avatar of Gorum': 'Avatar de Gorum',
  'Avatar of Sarenrae': 'Avatar de Sarenrae',
  'Avatar of Rovagug': 'Avatar de Rovagug',
  'Avatar of Pharasma': 'Avatar de Pharasma',
  // Animais
  Ape: 'Macaco',
  Bear: 'Urso',
  Bull: 'Touro',
  Canine: 'Canídeo',
  Cat: 'Felino',
  Deer: 'Cervo',
  Frog: 'Sapo',
  Shark: 'Tubarão',
  Snake: 'Serpente',
  Crab: 'Caranguejo',
  Crocodile: 'Crocodilo',
  Orca: 'Orca',
  Seal: 'Foca',
  // Dinossauros
  Ankylosaurus: 'Anquilossauro',
  Brontosaurus: 'Brontossauro',
  Deinonychus: 'Deinônico',
  Stegosaurus: 'Estegossauro',
  Triceratops: 'Tríceratops',
  Tyrannosaurus: 'Tiranossauro',
  // Insetos / aracnídeos
  Ant: 'Formiga',
  Beetle: 'Besouro',
  Centipede: 'Centopeia',
  Mantis: 'Louva-a-deus',
  Scorpion: 'Escorpião',
  Spider: 'Aranha',
  Wasp: 'Vespa',
  // Voadores
  Bird: 'Ave',
  Bat: 'Morcego',
  Pterosaur: 'Pterossauro',
  // Feéricos
  Dryad: 'Dríade',
  Elananx: 'Elananx',
  Nymph: 'Ninfa',
  Pixie: 'Pixie',
  Satyr: 'Sátiro',
  Redcap: 'Barrete Vermelho',
  // Elementais
  'Air Elemental': 'Elemental do Ar',
  'Earth Elemental': 'Elemental da Terra',
  'Fire Elemental': 'Elemental do Fogo',
  'Water Elemental': 'Elemental da Água',
  'Metal Elemental': 'Elemental do Metal',
  'Wood Elemental': 'Elemental da Madeira',
  'Primordial Elemental': 'Elemental Primordial',
  // Vegetais
  Flytrap: 'Papa-moscas',
  Fungus: 'Fungo',
  Arboreal: 'Arbóreo',
  Shambler: 'Tropeçante',
  'Green Man': 'Homem Verde',
  // Dragões
  'Black Dragon': 'Dragão Negro',
  'Blue Dragon': 'Dragão Azul',
  'Green Dragon': 'Dragão Verde',
  'Red Dragon': 'Dragão Vermelho',
  'White Dragon': 'Dragão Branco',
  'Brass Dragon': 'Dragão de Latão',
  'Bronze Dragon': 'Dragão de Bronze',
  'Copper Dragon': 'Dragão de Cobre',
  'Gold Dragon': 'Dragão de Ouro',
  'Silver Dragon': 'Dragão de Prata',
  // Limos
  'Black Pudding': 'Pudim Negro',
  'Gelatinous Cube': 'Cubo Gelatinoso',
  'Gray Ooze': 'Limo Cinzento',
  'Ochre Jelly': 'Geleia Ocre',
  // Anjos
  'Astral Deva': 'Deva Astral',
  'Monadic Deva': 'Deva Monádico',
  'Movanic Deva': 'Deva Movânico',
  'Cassisian (Archive Angel)': 'Cassisian (Anjo Arquivo)',
  'Choral Angel': 'Anjo Coral',
  Planetar: 'Planetar',
  // Corruptores
  'Barbazu (Bearded Devil)': 'Barbazu (Diabo Barbado)',
  'Brimorak (Fire Demon)': 'Brimorak (Demônio do Fogo)',
  'Dretch (Sloth Demon)': 'Dretch (Demônio da Preguiça)',
  'Erinys (Fury Devil)': 'Erínia (Diabo da Fúria)',
  'Piscodaemon (Wrath Daemon)': 'Piscodaemon (Daemon da Ira)',
  'Ceustodaemon (Guardian Daemon)': 'Ceustodaemon (Daemon Guardião)',
  // Monstruosidades / Natureza
  Behemoth: 'Beemote',
  Kaiju: 'Kaiju',
  Kraken: 'Kraken',
  Phoenix: 'Fênix',
  'Purple Worm': 'Verme Púrpura',
  'Sea Serpent': 'Serpente Marinha',
  'World Serpent': 'Serpente do Mundo',
};

export function translateName(name: string): string {
  if (isEn) return name;
  return NAMES[name] ?? name;
}

// Campos curtos da magia (conjuração, alcance, duração)
const SPELL_META: Record<string, string> = {
  '1 action': '1 ação',
  '2 actions': '2 ações',
  '3 actions': '3 ações',
  reaction: 'reação',
  'free action': 'ação livre',
  self: 'pessoal',
  touch: 'toque',
  you: 'você',
  '1 minute': '1 minuto',
  '10 minutes': '10 minutos',
  '1 hour': '1 hora',
  sustained: 'sustentada',
};

export function translateSpellMeta(value: string): string {
  if (isEn) return value;
  return SPELL_META[value.toLowerCase()] ?? value;
}

export function translateSize(size: string): string {
  if (isEn) return size;
  return SIZES[size] ?? size;
}

export function translateRarity(rarity: string): string {
  if (isEn) return rarity;
  // Os dados deste módulo trazem a raridade capitalizada, mas o índice da AON
  // devolve minúscula ("uncommon") — sem isso a busca de criaturas mostrava a
  // raridade em inglês.
  const key = rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
  return RARITIES[key] ?? rarity;
}

export function translateDamageType(type: string): string {
  if (isEn) return type;
  return DAMAGE_TYPES[type.toLowerCase()] ?? type;
}

// Traduz a string de dano completa, ex.: "2d6 bludgeoning plus 1d8 acid"
// → "2d6 contundente mais 1d8 ácido". Preserva dados e números.
export function translateDamageString(damage: string): string {
  if (isEn) return damage;
  let out = damage
    .replace(/\bplus\b/gi, 'mais')
    .replace(/\bpersistent\b/gi, 'persistente')
    .replace(/\band\b/gi, 'e')
    .replace(/favored weapon damage type/gi, 'tipo da arma favorecida');
  for (const [en, pt] of Object.entries(DAMAGE_TYPES)) {
    out = out.replace(new RegExp(`\\b${en}\\b`, 'gi'), pt);
  }
  return out;
}

// Traduz um trait, preservando números/letras (ex.: "reach 20" → "alcance 20",
// "versatile S" → "versátil C", "deadly d10" → "letal d10").
export function translateTrait(trait: string): string {
  if (isEn) return trait;
  const parts = trait.split(' ');
  const head = TRAITS[parts[0].toLowerCase()] ?? TRAITS[parts[0]] ?? parts[0];
  if (parts.length === 1) return head;
  const rest = parts.slice(1).map((p) => TRAITS[p] ?? p);
  return [head, ...rest].join(' ');
}

export function translateAttackName(name: string): string {
  if (isEn) return name;
  return ATTACK_NAMES[name.toLowerCase()] ?? name;
}

// Imunidades / condições comuns (cai para tipo de dano quando não mapeado)
const IMMUNITIES: Record<string, string> = {
  'critical hits': 'acertos críticos',
  'precision damage': 'dano de precisão',
  'visual effects': 'efeitos visuais',
  precision: 'precisão',
  bleed: 'sangramento',
  poison: 'veneno',
  disease: 'doença',
  paralyzed: 'paralisia',
  fear: 'medo',
};

export function translateImmunity(name: string): string {
  if (isEn) return name;
  return IMMUNITIES[name.toLowerCase()] ?? translateDamageType(name);
}

export function translateSense(key: string): string {
  return SENSES[key] ?? key;
}

export function translateSpeedType(key: string): string {
  return SPEED_TYPES[key] ?? key;
}
