import type { TransformationSpell, TransformationForm } from '../../../types';

// Monstrosity Form - monstrous battle forms
export const monstrosityForms: TransformationForm[] = [
  {
    id: 'phoenix',
    name: 'Phoenix',
    size: 'Gargantuan',
    speed: {
      land: 30,
      fly: 90
    },
    attacks: [
      {
        name: 'Beak',
        type: 'melee',
        bonus: 28,
        damage: '2d12 piercing plus 2d8 fire',
        traits: ['reach'],
        range: 20
      },
      {
        name: 'Talon',
        type: 'melee',
        bonus: 28,
        damage: '2d8 slashing plus 2d8 fire',
        traits: ['agile', 'reach'],
        range: 20
      }
    ],
    abilities: [
      {
        name: 'Self-Immolation',
        description: 'All your melee attacks deal an extra 2d8 fire damage. You gain immunity to fire and weakness 10 to cold.',
        traits: ['fire']
      },
      {
        name: 'Shroud of Flame',
        description: 'Any creature that touches you or hits you with an unarmed attack or non-reach melee weapon takes 2d6 fire damage.',
        traits: ['fire', 'aura']
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['fire'],
    weaknesses: {
      cold: 10
    },
    description: 'Size Gargantuan; Speed 30 feet, fly 90 feet; immunity to fire; weakness 10 cold; Melee beak (reach 20 feet), Damage 2d12 piercing plus 2d8 fire; Melee talon (agile, reach 20 feet), Damage 2d8 slashing plus 2d8 fire; shroud of flame deals 2d6 fire to creatures touching you.'
  },
  {
    id: 'purple-worm',
    name: 'Purple Worm',
    size: 'Gargantuan',
    speed: {
      land: 40,
      burrow: 30,
      swim: 20
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 28,
        damage: '2d12 piercing plus 2d6 poison',
        traits: ['reach'],
        range: 20
      },
      {
        name: 'Stinger',
        type: 'melee',
        bonus: 28,
        damage: '2d8 piercing plus 2d6 poison and 1d6 persistent poison',
        traits: ['agile', 'reach'],
        range: 20
      },
      {
        name: 'Body',
        type: 'melee',
        bonus: 26,
        damage: '2d8 bludgeoning',
        traits: ['reach'],
        range: 15
      }
    ],
    abilities: [
      {
        name: 'Inexorable',
        description: 'You can burrow through solid rock and cannot be grabbed, immobilized, or restrained by nonmagical means.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60,
      tremorsense: 60
    },
    description: 'Size Gargantuan; Speed 40 feet, burrow 30 feet, swim 20 feet; tremorsense (imprecise) 60 feet; Melee jaws (reach 20 feet), Damage 2d12 piercing plus 2d6 poison; Melee stinger (agile, reach 20 feet), Damage 2d8 piercing plus 2d6 poison and 1d6 persistent poison; Melee body (reach 15 feet), Damage 2d8 bludgeoning; Inexorable (burrow through rock, cannot be grabbed).'
  },
  {
    id: 'sea-serpent',
    name: 'Sea Serpent',
    size: 'Gargantuan',
    speed: {
      land: 20,
      swim: 90
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 28,
        damage: '2d12 piercing plus Grab',
        traits: ['reach'],
        range: 20
      },
      {
        name: 'Tail',
        type: 'melee',
        bonus: 28,
        damage: '2d8 bludgeoning',
        traits: ['agile', 'reach'],
        range: 25
      }
    ],
    abilities: [
      {
        name: 'Spine Rake',
        description: 'Once per round as part of a Swim action, you deal 3d6 slashing damage to any creature you swim through or past.',
        traits: []
      },
      {
        name: 'Aquatic',
        description: 'Can breathe underwater.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    description: 'Size Gargantuan; Speed 20 feet, swim 90 feet; Melee jaws (reach 20 feet), Damage 2d12 piercing plus Grab; Melee tail (agile, reach 25 feet), Damage 2d8 bludgeoning; spine rake deals 3d6 slashing while swimming.'
  },
  {
    id: 'kraken',
    name: 'Kraken',
    size: 'Gargantuan',
    speed: {
      land: 10,
      swim: 70
    },
    attacks: [
      {
        name: 'Beak',
        type: 'melee',
        bonus: 28,
        damage: '2d12 piercing',
        traits: []
      },
      {
        name: 'Tentacle',
        type: 'melee',
        bonus: 28,
        damage: '2d8 bludgeoning plus Grab',
        traits: ['agile', 'reach'],
        range: 30
      }
    ],
    abilities: [
      {
        name: 'Ink Cloud',
        description: 'Once per minute, you can emit a 30-foot-radius cloud of ink, creating concealment for 1 minute in water.',
        traits: []
      },
      {
        name: 'Aquatic',
        description: 'Can breathe underwater.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    description: 'Size Gargantuan; Speed 10 feet, swim 70 feet; Melee beak, Damage 2d12 piercing; Melee tentacle (agile, reach 30 feet), Damage 2d8 bludgeoning plus Grab; ink cloud creates concealment.'
  },
  {
    id: 'behemoth',
    name: 'Behemoth',
    size: 'Gargantuan',
    speed: {
      land: 50
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 28,
        damage: '2d12 piercing plus Knockdown',
        traits: ['reach'],
        range: 20
      },
      {
        name: 'Foot',
        type: 'melee',
        bonus: 28,
        damage: '2d8 bludgeoning',
        traits: ['agile', 'reach'],
        range: 15
      }
    ],
    abilities: [
      {
        name: 'Trample',
        description: 'You Stride up to double your Speed and can move through spaces of Large or smaller creatures. Each creature you move through takes 2d8 bludgeoning damage (basic Reflex save).',
        traits: []
      }
    ],
    senses: {
      darkvision: 60,
      scent: 60
    },
    description: 'Size Gargantuan; Speed 50 feet; Melee jaws (reach 20 feet), Damage 2d12 piercing plus Knockdown; Melee foot (agile, reach 15 feet), Damage 2d8 bludgeoning; Trample 2d8 bludgeoning.'
  }
];

export const monstrosityFormSpell: TransformationSpell = {
  id: 'monstrosity-form',
  name: 'Monstrosity Form',
  level: 8,
  school: 'transmutation',
  traditions: ['arcane', 'primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into the shape of a Gargantuan legendary monster, with one of the following battle forms. You gain the following statistics and abilities regardless of which battle form you choose: AC = 20 + your level; 20 temporary HP; darkvision; one or more unarmed melee attacks (specific to the form), which are the only attacks you can use. You have hands in this battle form and can use manipulate actions. You can Dismiss the spell.',
  heightened: {
    9: 'You instead gain AC = 22 + your level, 25 temporary HP, attack modifier +30, damage bonus +17, and Athletics +32.'
  },
  forms: monstrosityForms
};

