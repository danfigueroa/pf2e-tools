import type { TransformationSpell, TransformationForm } from '../../../types';

// Aerial Form - forms that can fly
export const aerialForms: TransformationForm[] = [
  {
    id: 'bat',
    name: 'Bat',
    size: 'Medium',
    speed: {
      land: 20,
      fly: 30
    },
    attacks: [
      {
        name: 'Fangs',
        type: 'melee',
        bonus: 16,
        damage: '2d8 piercing',
        traits: []
      },
      {
        name: 'Wing',
        type: 'melee',
        bonus: 16,
        damage: '2d6 bludgeoning',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Echolocation',
        description: 'Precise echolocation 40 feet',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    description: 'Speed 20 feet, fly 30 feet; echolocation 40 feet; Melee fangs, Damage 2d8 piercing; Melee wing (agile), Damage 2d6 bludgeoning.'
  },
  {
    id: 'bird',
    name: 'Bird',
    size: 'Medium',
    speed: {
      land: 10,
      fly: 50
    },
    attacks: [
      {
        name: 'Beak',
        type: 'melee',
        bonus: 16,
        damage: '2d8 piercing',
        traits: []
      },
      {
        name: 'Talon',
        type: 'melee',
        bonus: 16,
        damage: '1d10 slashing',
        traits: ['agile']
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true
    },
    description: 'Speed 10 feet, fly 50 feet; Melee beak, Damage 2d8 piercing; Melee talon (agile), Damage 1d10 slashing.'
  },
  {
    id: 'pterosaur',
    name: 'Pterosaur',
    size: 'Medium',
    speed: {
      land: 10,
      fly: 40
    },
    attacks: [
      {
        name: 'Beak',
        type: 'melee',
        bonus: 16,
        damage: '3d6 piercing',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 10 feet, fly 40 feet; scent (imprecise) 30 feet; Melee beak, Damage 3d6 piercing.'
  },
  {
    id: 'wasp',
    name: 'Wasp',
    size: 'Medium',
    speed: {
      land: 20,
      fly: 40
    },
    attacks: [
      {
        name: 'Stinger',
        type: 'melee',
        bonus: 16,
        damage: '1d8 piercing plus 1d6 poison',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true
    },
    description: 'Speed 20 feet, fly 40 feet; Melee stinger, Damage 1d8 piercing plus 1d6 poison.'
  }
];

export const aerialFormSpell: TransformationSpell = {
  id: 'aerial-form',
  name: 'Aerial Form',
  level: 4,
  school: 'transmutation',
  traditions: ['arcane', 'primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into the shape of a Large flying creature. You gain the following statistics and abilities regardless of which battle form you choose: AC = 18 + your level; 5 temporary HP; low-light vision; one or more unarmed melee attacks (specific to the form chosen), which are the only attacks you can use. You can use Athletics to Fly, Speed 20 feet.',
  heightened: {
    5: 'Your battle form is Huge, gaining a 10-foot reach. You instead gain AC = 18 + your level, 10 temporary HP, attack modifier +18, damage bonus +8, and Athletics +20.',
    6: 'Your battle form is Huge, gaining a 10-foot reach. You instead gain AC = 21 + your level, 15 temporary HP, attack modifier +21, damage bonus +10, and Athletics +23.'
  },
  forms: aerialForms
};

