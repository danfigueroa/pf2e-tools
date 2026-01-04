import type { TransformationSpell, TransformationForm } from '../../../types';

// Insect Form - insect forms
export const insectForms: TransformationForm[] = [
  {
    id: 'ant',
    name: 'Ant',
    size: 'Medium',
    speed: {
      land: 30,
      climb: 30
    },
    attacks: [
      {
        name: 'Mandibles',
        type: 'melee',
        bonus: 13,
        damage: '2d6 bludgeoning',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 30 feet, climb 30 feet; Melee mandibles, Damage 2d6 bludgeoning.'
  },
  {
    id: 'beetle',
    name: 'Beetle',
    size: 'Medium',
    speed: {
      land: 25
    },
    attacks: [
      {
        name: 'Mandibles',
        type: 'melee',
        bonus: 13,
        damage: '2d10 bludgeoning',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true
    },
    description: 'Speed 25 feet; Melee mandibles, Damage 2d10 bludgeoning.'
  },
  {
    id: 'centipede',
    name: 'Centipede',
    size: 'Medium',
    speed: {
      land: 25,
      climb: 25
    },
    attacks: [
      {
        name: 'Mandibles',
        type: 'melee',
        bonus: 13,
        damage: '1d8 piercing plus 1d4 poison',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true
    },
    description: 'Speed 25 feet, climb 25 feet; Melee mandibles, Damage 1d8 piercing plus 1d4 poison.'
  },
  {
    id: 'mantis',
    name: 'Mantis',
    size: 'Medium',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Foreleg',
        type: 'melee',
        bonus: 13,
        damage: '2d8 bludgeoning',
        traits: ['grapple']
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true
    },
    description: 'Speed 40 feet; Melee foreleg, Damage 2d8 bludgeoning; the mantis gains the Grab action.'
  },
  {
    id: 'scorpion',
    name: 'Scorpion',
    size: 'Medium',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Stinger',
        type: 'melee',
        bonus: 13,
        damage: '1d8 piercing plus 1d6 poison',
        traits: []
      },
      {
        name: 'Pincer',
        type: 'melee',
        bonus: 13,
        damage: '1d6 bludgeoning',
        traits: ['agile', 'grapple']
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      tremorsense: 60
    },
    description: 'Speed 40 feet; tremorsense (imprecise) 60 feet; Melee stinger, Damage 1d8 piercing plus 1d6 poison; Melee pincer (agile), Damage 1d6 bludgeoning; the scorpion gains the Grab action.'
  },
  {
    id: 'spider',
    name: 'Spider',
    size: 'Medium',
    speed: {
      land: 25,
      climb: 25
    },
    attacks: [
      {
        name: 'Fangs',
        type: 'melee',
        bonus: 13,
        damage: '1d6 piercing plus 1d6 poison',
        traits: []
      },
      {
        name: 'Web',
        type: 'ranged',
        bonus: 13,
        damage: '',
        range: 20,
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Web',
        description: 'You can shoot a web as a ranged attack to entangle a target.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    description: 'Speed 25 feet, climb 25 feet; Melee fangs, Damage 1d6 piercing plus 1d6 poison; Ranged web (range 20 feet), entangles the target.'
  }
];

export const insectFormSpell: TransformationSpell = {
  id: 'insect-form',
  name: 'Insect Form',
  level: 3,
  school: 'transmutation',
  traditions: ['primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into the shape of a Medium insect battle form. You gain the following statistics and abilities regardless of which battle form you choose: AC = 18 + your level; 10 temporary HP; low-light vision; one or more melee unarmed attacks (specific to the form); Athletics modifier +13.',
  heightened: {
    4: 'Your battle form is Large, gaining 10-foot reach. You instead gain AC = 18 + your level, 15 temporary HP, attack modifier +16, damage bonus +6, and Athletics +16.',
    5: 'Your battle form is Huge, gaining 15-foot reach. You instead gain AC = 18 + your level, 20 temporary HP, attack modifier +18, damage bonus +6 and double damage dice, and Athletics +20.'
  },
  forms: insectForms
};

