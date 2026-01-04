import type { TransformationSpell, TransformationForm } from '../../../types';

// Angel Form - celestial battle forms
export const angelForms: TransformationForm[] = [
  {
    id: 'cassisian',
    name: 'Cassisian (Archive Angel)',
    size: 'Small',
    speed: {
      fly: 40
    },
    attacks: [
      {
        name: 'Headbutt',
        type: 'melee',
        bonus: 23,
        damage: '2d6 bludgeoning plus 1d6 spirit',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Perfect Recall',
        description: 'You can perfectly recall anything you\'ve seen or heard and have a +4 bonus to checks to remember things.',
        traits: []
      },
      {
        name: 'Repository of Lore',
        description: 'You can roll Recall Knowledge using Religion or Lore instead of the normal skill.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    resistances: {
      cold: 5,
      fire: 5
    },
    weaknesses: {
      evil: 5
    },
    description: 'Size Small; fly 40 feet; darkvision; resistance 5 cold and fire; weakness 5 evil; Melee headbutt (agile), Damage 2d6 bludgeoning plus 1d6 spirit; Perfect Recall; Repository of Lore.'
  },
  {
    id: 'choral-angel',
    name: 'Choral Angel',
    size: 'Small',
    speed: {
      fly: 40
    },
    attacks: [
      {
        name: 'Fist',
        type: 'melee',
        bonus: 23,
        damage: '1d8 bludgeoning plus 1d6 sonic plus 1d6 spirit',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Harmonize',
        description: 'You can use Performance to cast a single-action heal spell once per round, healing 2d8 HP to a creature within 30 feet.',
        traits: ['healing', 'sonic']
      },
      {
        name: 'Deafening Chorus',
        description: 'Once per round, you can create a burst of sound. Creatures within 15 feet take 2d6 sonic damage (basic Fortitude save).',
        traits: ['sonic']
      }
    ],
    senses: {
      darkvision: 60
    },
    resistances: {
      cold: 5,
      fire: 5,
      sonic: 10
    },
    weaknesses: {
      evil: 5
    },
    description: 'Size Small; fly 40 feet; darkvision; resistance 5 cold and fire, 10 sonic; weakness 5 evil; Melee fist (agile), Damage 1d8 bludgeoning plus 1d6 sonic plus 1d6 spirit; Harmonize (heal 2d8); Deafening Chorus (15-foot burst, 2d6 sonic).'
  },
  {
    id: 'movanic-deva',
    name: 'Movanic Deva',
    size: 'Medium',
    speed: {
      land: 30,
      fly: 40
    },
    attacks: [
      {
        name: 'Flaming Greatsword',
        type: 'melee',
        bonus: 23,
        damage: '2d12 slashing plus 1d6 fire plus 1d6 spirit',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Aura of Vitality',
        description: 'Allies within 20 feet of you gain fast healing 2.',
        traits: ['aura', 'healing']
      },
      {
        name: 'Dispelling Field',
        description: 'Once per round, you can attempt to counteract a magical effect on a creature you touch.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['disease'],
    resistances: {
      cold: 10,
      fire: 10
    },
    weaknesses: {
      evil: 5
    },
    description: 'Speed 30 feet, fly 40 feet; darkvision; immunity to disease; resistance 10 cold and fire; weakness 5 evil; Melee flaming greatsword, Damage 2d12 slashing plus 1d6 fire plus 1d6 spirit; Aura of Vitality (fast healing 2 to allies within 20 feet); Dispelling Field.'
  },
  {
    id: 'monadic-deva',
    name: 'Monadic Deva',
    size: 'Medium',
    speed: {
      land: 30,
      fly: 40
    },
    attacks: [
      {
        name: 'Holy Mace',
        type: 'melee',
        bonus: 23,
        damage: '2d6 bludgeoning plus 1d6 force plus 1d6 spirit',
        traits: ['shove']
      }
    ],
    abilities: [
      {
        name: 'Elemental Resistance',
        description: 'You have resistance 10 to acid, cold, electricity, and fire.',
        traits: []
      },
      {
        name: 'Solid Blow',
        description: 'When you critically hit with your mace, the target is pushed 10 feet.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['death effects'],
    resistances: {
      acid: 10,
      cold: 10,
      electricity: 10,
      fire: 10
    },
    weaknesses: {
      evil: 5
    },
    description: 'Speed 30 feet, fly 40 feet; darkvision; immunity to death effects; resistance 10 acid, cold, electricity, and fire; weakness 5 evil; Melee holy mace (shove), Damage 2d6 bludgeoning plus 1d6 force plus 1d6 spirit; Solid Blow (push 10 feet on critical hit).'
  },
  {
    id: 'astral-deva',
    name: 'Astral Deva',
    size: 'Medium',
    speed: {
      land: 40,
      fly: 75
    },
    attacks: [
      {
        name: 'Holy Warhammer',
        type: 'melee',
        bonus: 23,
        damage: '2d8 bludgeoning plus 1d6 spirit and 1d6 vitality',
        traits: ['shove']
      }
    ],
    abilities: [
      {
        name: 'Traveler\'s Aura',
        description: 'Allies within 20 feet are unaffected by difficult terrain and gain a +10-foot status bonus to Speed.',
        traits: ['aura']
      },
      {
        name: 'Messenger\'s Amnesty',
        description: 'You and all allies within 20 feet can\'t be attacked by summoned or called creatures unless those creatures are directly controlled.',
        traits: ['aura']
      }
    ],
    senses: {
      darkvision: 60
    },
    resistances: {
      cold: 15,
      fire: 15
    },
    weaknesses: {
      evil: 10
    },
    description: 'Speed 40 feet, fly 75 feet; darkvision; resistance 15 cold and fire; weakness 10 evil; Melee holy warhammer (shove), Damage 2d8 bludgeoning plus 1d6 spirit and 1d6 vitality; Traveler\'s Aura (+10-foot status bonus to Speed, ignore difficult terrain); Messenger\'s Amnesty (summoned creatures can\'t attack allies).'
  },
  {
    id: 'planetar',
    name: 'Planetar',
    size: 'Large',
    speed: {
      land: 35,
      fly: 100
    },
    attacks: [
      {
        name: 'Holy Greatsword',
        type: 'melee',
        bonus: 23,
        damage: '2d12 slashing plus 2d6 spirit',
        traits: ['reach'],
        range: 10
      }
    ],
    abilities: [
      {
        name: 'Blade of Justice',
        description: 'Your holy greatsword deals an extra 2d6 spirit damage to fiends and undead.',
        traits: []
      },
      {
        name: 'Holy Armaments',
        description: 'Any weapon you wield gains the holy rune\'s effect.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['death effects', 'disease'],
    resistances: {
      cold: 20,
      fire: 20
    },
    weaknesses: {
      evil: 15
    },
    description: 'Size Large; Speed 35 feet, fly 100 feet; darkvision; immunity to death effects and disease; resistance 20 cold and fire; weakness 15 evil; Melee holy greatsword (reach 10 feet), Damage 2d12 slashing plus 2d6 spirit (4d6 vs fiends/undead); Holy Armaments (weapons gain holy effect).'
  }
];

export const angelFormSpell: TransformationSpell = {
  id: 'angel-form',
  name: 'Angel Form',
  level: 7,
  school: 'transmutation',
  traditions: ['divine'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into a celestial battle form. When you cast this spell, choose an angel form from the options below. You gain the following statistics and abilities regardless of which battle form you choose: AC = 22 + your level; 15 temporary HP; darkvision; fly Speed; weakness 5 to evil; one or more unarmed melee attacks (specific to the form); Athletics modifier +23.',
  heightened: {
    9: 'Your battle form is Large and your attacks have 10-foot reach. You instead gain AC = 25 + your level, 25 temporary HP, attack modifier +28, damage bonus +12, and Athletics +30.'
  },
  forms: angelForms
};

