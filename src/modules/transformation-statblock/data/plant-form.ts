import type { TransformationSpell, TransformationForm } from '../../../types';

// Plant Form - plant battle forms
export const plantForms: TransformationForm[] = [
  {
    id: 'arboreal',
    name: 'Arboreal',
    size: 'Large',
    speed: {
      land: 30
    },
    attacks: [
      {
        name: 'Branch',
        type: 'melee',
        bonus: 17,
        damage: '2d10 bludgeoning',
        traits: ['reach'],
        range: 15
      },
      {
        name: 'Foot',
        type: 'melee',
        bonus: 17,
        damage: '2d8 bludgeoning',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true
    },
    resistances: {
      bludgeoning: 5,
      piercing: 5
    },
    weaknesses: {
      fire: 10
    },
    description: 'Size Large; Speed 30 feet; Melee branch (reach 15 feet), Damage 2d10 bludgeoning; Melee foot, Damage 2d8 bludgeoning; resistance 5 bludgeoning and piercing; weakness 10 fire.'
  },
  {
    id: 'flytrap',
    name: 'Flytrap',
    size: 'Large',
    speed: {
      land: 15
    },
    attacks: [
      {
        name: 'Leaf',
        type: 'melee',
        bonus: 17,
        damage: '2d8 piercing plus 1d6 acid',
        traits: ['reach'],
        range: 10
      }
    ],
    abilities: [
      {
        name: 'Sticky Grab',
        description: 'A creature hit by your leaf Strike is grabbed until the end of your next turn unless it Escapes first.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    resistances: {
      acid: 10
    },
    weaknesses: {
      fire: 10
    },
    description: 'Size Large; Speed 15 feet; Melee leaf (reach 10 feet), Damage 2d8 piercing plus 1d6 acid; creatures hit are grabbed; resistance 10 acid; weakness 10 fire.'
  },
  {
    id: 'shambler',
    name: 'Shambler',
    size: 'Large',
    speed: {
      land: 20,
      swim: 20
    },
    attacks: [
      {
        name: 'Vine',
        type: 'melee',
        bonus: 17,
        damage: '2d8 bludgeoning',
        traits: ['reach'],
        range: 15
      }
    ],
    abilities: [
      {
        name: 'Shamble',
        description: 'You gain a +2 circumstance bonus to AC and saves while in swampy or vegetated terrain.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    resistances: {
      electricity: 10
    },
    weaknesses: {
      fire: 10
    },
    description: 'Size Large; Speed 20 feet, swim 20 feet; Melee vine (reach 15 feet), Damage 2d8 bludgeoning; +2 circumstance bonus to AC and saves in swampy terrain; resistance 10 electricity; weakness 10 fire.'
  },
  {
    id: 'fungus',
    name: 'Fungus',
    size: 'Large',
    speed: {
      land: 25
    },
    attacks: [
      {
        name: 'Tendril',
        type: 'melee',
        bonus: 17,
        damage: '2d6 bludgeoning plus 1d4 poison',
        traits: ['reach'],
        range: 10
      }
    ],
    abilities: [
      {
        name: 'Spore Cloud',
        description: 'Once per round, you can release a cloud of spores in a 15-foot emanation. Creatures in the area must succeed at a Fortitude save or become sickened 1.',
        traits: ['poison']
      }
    ],
    senses: {
      lowLightVision: true
    },
    resistances: {
      poison: 10
    },
    weaknesses: {
      fire: 10
    },
    description: 'Size Large; Speed 25 feet; Melee tendril (reach 10 feet), Damage 2d6 bludgeoning plus 1d4 poison; spore cloud (15-foot emanation, sickens targets); resistance 10 poison; weakness 10 fire.'
  }
];

export const plantFormSpell: TransformationSpell = {
  id: 'plant-form',
  name: 'Plant Form',
  level: 5,
  school: 'transmutation',
  traditions: ['primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'Taking inspiration from verdant creatures, you transform into a Large plant battle form. You must choose arboreal, flytrap, shambler, or fungus when you Cast the Spell. You can substitute a similar plant of your choice, but the statistics remain the same. You gain the following statistics and abilities regardless of which battle form you choose: AC = 19 + your level; 12 temporary HP; low-light vision; weakness 10 fire; one or more unarmed melee attacks (specific to the form); Athletics modifier +17.',
  heightened: {
    6: 'Your battle form is Huge, and your attacks have 15-foot reach. You instead gain AC = 22 + your level, 24 temporary HP, attack modifier +21, damage bonus +8, and Athletics +22.'
  },
  forms: plantForms
};

