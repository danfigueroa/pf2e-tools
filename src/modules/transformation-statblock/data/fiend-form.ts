import type { TransformationSpell, TransformationForm } from '../../../types';

// Fiend Form - fiend battle forms
export const fiendForms: TransformationForm[] = [
  {
    id: 'demon-brimorak',
    name: 'Brimorak (Fire Demon)',
    size: 'Medium',
    speed: {
      land: 30
    },
    attacks: [
      {
        name: 'Flaming Sword',
        type: 'melee',
        bonus: 22,
        damage: '1d6 slashing plus 1d6 fire',
        traits: []
      },
      {
        name: 'Hoof',
        type: 'melee',
        bonus: 22,
        damage: '1d4 bludgeoning plus 2d6 fire',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Smoke Vision',
        description: 'You can see through smoke as if it weren\'t there.',
        traits: []
      },
      {
        name: 'Burning Touch',
        description: 'Creatures that touch you or hit you with unarmed attacks take 1d6 fire damage.',
        traits: ['fire', 'aura']
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['fire'],
    weaknesses: {
      cold: 5,
      'cold iron': 5,
      good: 5
    },
    description: 'Speed 30 feet; darkvision; immunity to fire; weakness 5 to cold, cold iron, and good; Melee flaming sword, Damage 1d6 slashing plus 1d6 fire; Melee hoof (agile), Damage 1d4 bludgeoning plus 2d6 fire; creatures touching you take 1d6 fire.'
  },
  {
    id: 'demon-dretch',
    name: 'Dretch (Sloth Demon)',
    size: 'Small',
    speed: {
      land: 20
    },
    attacks: [
      {
        name: 'Claw',
        type: 'melee',
        bonus: 22,
        damage: '2d6 slashing plus 1d6 poison',
        traits: ['agile']
      },
      {
        name: 'Bite',
        type: 'melee',
        bonus: 22,
        damage: '2d8 piercing',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Stench',
        description: 'Creatures within 15 feet must succeed at a Fortitude save or become sickened 1.',
        traits: ['aura', 'poison']
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['poison'],
    weaknesses: {
      'cold iron': 5,
      good: 5
    },
    description: 'Size Small; Speed 20 feet; darkvision; immunity to poison; weakness 5 to cold iron and good; Melee claw (agile), Damage 2d6 slashing plus 1d6 poison; Melee bite, Damage 2d8 piercing; Stench 15-foot aura sickens creatures.'
  },
  {
    id: 'devil-barbazu',
    name: 'Barbazu (Bearded Devil)',
    size: 'Medium',
    speed: {
      land: 35
    },
    attacks: [
      {
        name: 'Glaive',
        type: 'melee',
        bonus: 22,
        damage: '2d8 slashing plus 1d6 persistent bleed',
        traits: ['deadly d8', 'forceful', 'reach'],
        range: 10
      },
      {
        name: 'Beard',
        type: 'melee',
        bonus: 22,
        damage: '1d8 piercing plus 1d6 poison',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Wounding Strike',
        description: 'Your glaive Strikes deal 1d6 persistent bleed damage.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['fire'],
    resistances: {
      physical: 5
    },
    weaknesses: {
      good: 5
    },
    description: 'Speed 35 feet; darkvision; immunity to fire; resistance 5 physical (except silver); weakness 5 good; Melee glaive (deadly d8, forceful, reach 10 feet), Damage 2d8 slashing plus 1d6 persistent bleed; Melee beard, Damage 1d8 piercing plus 1d6 poison.'
  },
  {
    id: 'devil-erinys',
    name: 'Erinys (Fury Devil)',
    size: 'Medium',
    speed: {
      land: 25,
      fly: 40
    },
    attacks: [
      {
        name: 'Longsword',
        type: 'melee',
        bonus: 22,
        damage: '1d8 slashing plus 1d6 evil',
        traits: []
      },
      {
        name: 'Composite Longbow',
        type: 'ranged',
        bonus: 22,
        damage: '1d8 piercing plus 1d6 poison',
        traits: ['deadly d10', 'volley 30 feet'],
        range: 100
      }
    ],
    abilities: [
      {
        name: 'Flames of Fury',
        description: 'Your ranged Strikes deal an additional 1d6 fire damage.',
        traits: ['fire']
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['fire'],
    resistances: {
      physical: 5
    },
    weaknesses: {
      good: 5
    },
    description: 'Speed 25 feet, fly 40 feet; darkvision; immunity to fire; resistance 5 physical (except silver); weakness 5 good; Melee longsword, Damage 1d8 slashing plus 1d6 evil; Ranged composite longbow (deadly d10, volley 30 feet), Damage 1d8 piercing plus 1d6 poison plus 1d6 fire.'
  },
  {
    id: 'daemon-ceustodaemon',
    name: 'Ceustodaemon (Guardian Daemon)',
    size: 'Large',
    speed: {
      land: 25
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 22,
        damage: '2d10 piercing plus 1d6 evil',
        traits: []
      },
      {
        name: 'Claw',
        type: 'melee',
        bonus: 22,
        damage: '2d6 slashing plus 1d6 evil',
        traits: ['agile', 'reach'],
        range: 10
      }
    ],
    abilities: [
      {
        name: 'Breath Weapon',
        description: 'Once per round, you breathe a 30-foot cone of fire dealing 6d6 fire damage (basic Reflex save).',
        traits: ['fire']
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['death effects'],
    resistances: {
      cold: 10,
      electricity: 10,
      fire: 10
    },
    weaknesses: {
      good: 5
    },
    description: 'Size Large; Speed 25 feet; darkvision; immunity to death effects; resistance 10 cold, electricity, and fire; weakness 5 good; Melee jaws, Damage 2d10 piercing plus 1d6 evil; Melee claw (agile, reach 10 feet), Damage 2d6 slashing plus 1d6 evil; Breath Weapon 30-foot cone, 6d6 fire damage.'
  },
  {
    id: 'daemon-piscodaemon',
    name: 'Piscodaemon (Wrath Daemon)',
    size: 'Medium',
    speed: {
      land: 25,
      swim: 40
    },
    attacks: [
      {
        name: 'Claw',
        type: 'melee',
        bonus: 22,
        damage: '2d10 slashing plus Grab',
        traits: []
      },
      {
        name: 'Tentacle',
        type: 'melee',
        bonus: 22,
        damage: '1d10 bludgeoning plus poison',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Constrict',
        description: 'When you have a creature grabbed, you can deal 2d10 bludgeoning damage to it as a single action.',
        traits: []
      },
      {
        name: 'Amphibious',
        description: 'Can breathe in water and air.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['death effects', 'poison'],
    resistances: {
      cold: 10,
      electricity: 10,
      fire: 10
    },
    weaknesses: {
      good: 5
    },
    description: 'Speed 25 feet, swim 40 feet; darkvision; immunity to death effects and poison; resistance 10 cold, electricity, and fire; weakness 5 good; Melee claw, Damage 2d10 slashing plus Grab; Melee tentacle (agile), Damage 1d10 bludgeoning plus poison; Constrict 2d10 bludgeoning.'
  }
];

export const fiendFormSpell: TransformationSpell = {
  id: 'fiend-form',
  name: 'Fiend Form',
  level: 6,
  school: 'transmutation',
  traditions: ['divine', 'occult'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into a Medium fiend battle form. When you cast this spell, choose a demon, devil, or daemon form. You gain the following statistics and abilities regardless of which battle form you choose: AC = 20 + your level; 15 temporary HP; darkvision; one or more unarmed melee attacks (specific to the form); Athletics modifier +22.',
  heightened: {
    7: 'Your battle form is Large and your attacks have 10-foot reach. You instead gain AC = 22 + your level, 20 temporary HP, attack modifier +25, damage bonus +10, and Athletics +25.',
    8: 'Your battle form is Huge and your attacks have 15-foot reach. You instead gain AC = 22 + your level, 25 temporary HP, attack modifier +28, damage bonus +14, and Athletics +28.'
  },
  forms: fiendForms
};

