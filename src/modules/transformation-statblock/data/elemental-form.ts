import type { TransformationSpell, TransformationForm } from '../../../types';

// Elemental Form - elemental battle forms
export const elementalForms: TransformationForm[] = [
  {
    id: 'air-elemental',
    name: 'Air Elemental',
    size: 'Medium',
    speed: {
      land: 20,
      fly: 80
    },
    attacks: [
      {
        name: 'Gust',
        type: 'melee',
        bonus: 18,
        damage: '1d4 bludgeoning',
        traits: ['agile', 'finesse']
      }
    ],
    abilities: [
      {
        name: 'High Winds',
        description: 'You gain a +2 circumstance bonus to AC and saves against ranged attacks.',
        traits: ['air']
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['bleed', 'paralyzed', 'poison', 'sleep'],
    description: 'Speed 20 feet, fly 80 feet; +2 circumstance bonus to AC vs. ranged attacks; Melee gust (agile, finesse), Damage 1d4 bludgeoning.'
  },
  {
    id: 'earth-elemental',
    name: 'Earth Elemental',
    size: 'Medium',
    speed: {
      land: 20,
      burrow: 20
    },
    attacks: [
      {
        name: 'Fist',
        type: 'melee',
        bonus: 18,
        damage: '2d10 bludgeoning',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      darkvision: 60,
      tremorsense: 60
    },
    immunities: ['bleed', 'paralyzed', 'poison', 'sleep'],
    resistances: {
      physical: 3
    },
    description: 'Speed 20 feet, burrow 20 feet; tremorsense (imprecise) 60 feet; resistance 3 to physical damage (except adamantine); Melee fist, Damage 2d10 bludgeoning.'
  },
  {
    id: 'fire-elemental',
    name: 'Fire Elemental',
    size: 'Medium',
    speed: {
      land: 50
    },
    attacks: [
      {
        name: 'Tendril',
        type: 'melee',
        bonus: 18,
        damage: '1d8 fire plus 1d4 persistent fire',
        traits: ['agile', 'finesse']
      }
    ],
    abilities: [],
    senses: {
      darkvision: 60
    },
    immunities: ['bleed', 'fire', 'paralyzed', 'poison', 'sleep'],
    weaknesses: {
      cold: 5,
      water: 5
    },
    description: 'Speed 50 feet; immunity to fire; weakness 5 cold and water; Melee tendril (agile, finesse), Damage 1d8 fire plus 1d4 persistent fire.'
  },
  {
    id: 'water-elemental',
    name: 'Water Elemental',
    size: 'Medium',
    speed: {
      land: 20,
      swim: 60
    },
    attacks: [
      {
        name: 'Wave',
        type: 'melee',
        bonus: 18,
        damage: '1d12 bludgeoning',
        traits: ['reach'],
        range: 10
      }
    ],
    abilities: [
      {
        name: 'Amphibious',
        description: 'Can breathe in water and air.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['bleed', 'paralyzed', 'poison', 'sleep'],
    resistances: {
      fire: 5
    },
    description: 'Speed 20 feet, swim 60 feet; resistance 5 fire; Melee wave (reach 10 feet), Damage 1d12 bludgeoning.'
  },
  {
    id: 'metal-elemental',
    name: 'Metal Elemental',
    size: 'Medium',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Blade',
        type: 'melee',
        bonus: 18,
        damage: '1d10 slashing plus 1d4 persistent bleed',
        traits: ['versatile P']
      }
    ],
    abilities: [],
    senses: {
      darkvision: 60
    },
    immunities: ['bleed', 'paralyzed', 'poison', 'sleep'],
    resistances: {
      electricity: 5
    },
    description: 'Speed 40 feet; resistance 5 electricity; Melee blade (versatile P), Damage 1d10 slashing plus 1d4 persistent bleed.'
  },
  {
    id: 'wood-elemental',
    name: 'Wood Elemental',
    size: 'Medium',
    speed: {
      land: 25,
      climb: 25
    },
    attacks: [
      {
        name: 'Branch',
        type: 'melee',
        bonus: 18,
        damage: '2d8 bludgeoning',
        traits: ['reach'],
        range: 10
      }
    ],
    abilities: [
      {
        name: 'Wooden Regeneration',
        description: 'You gain fast healing 2 while standing in an area of bright light.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['bleed', 'paralyzed', 'poison', 'sleep'],
    weaknesses: {
      fire: 5
    },
    description: 'Speed 25 feet, climb 25 feet; weakness 5 fire; fast healing 2 in bright light; Melee branch (reach 10 feet), Damage 2d8 bludgeoning.'
  }
];

export const elementalFormSpell: TransformationSpell = {
  id: 'elemental-form',
  name: 'Elemental Form',
  level: 5,
  school: 'transmutation',
  traditions: ['arcane', 'primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You call upon the power of the elements to transform into a Medium elemental battle form. When you cast this spell, choose air, earth, fire, metal, water, or wood. You have hands in this battle form and can use manipulate actions. You gain the following statistics and abilities regardless of which battle form you choose: AC = 19 + your level; 10 temporary HP; darkvision; immunity to bleed, paralyzed, poison, and sleep.',
  heightened: {
    6: 'Your battle form is Large and your attacks have 10-foot reach. You instead gain AC = 22 + your level, 15 temporary HP, attack modifier +20, damage bonus +9, and Athletics +22.',
    7: 'Your battle form is Huge and your attacks have 15-foot reach. You instead gain AC = 22 + your level, 20 temporary HP, attack modifier +23, damage bonus +13, and Athletics +25.'
  },
  forms: elementalForms
};

