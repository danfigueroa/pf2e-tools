import type { TransformationSpell, TransformationForm } from '../../../types';

// Fey Form - fey battle forms
export const feyForms: TransformationForm[] = [
  {
    id: 'dryad',
    name: 'Dryad',
    size: 'Medium',
    speed: {
      land: 25
    },
    attacks: [
      {
        name: 'Branch',
        type: 'melee',
        bonus: 16,
        damage: '1d12 bludgeoning',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Tree Meld',
        description: 'You can Step into a tree and hide within it. While inside, you gain total concealment and can perceive your surroundings using normal senses.',
        traits: []
      },
      {
        name: 'Nature Empathy',
        description: 'You can communicate with plants and animals.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    weaknesses: {
      'cold iron': 5
    },
    description: 'Speed 25 feet; weakness 5 cold iron; Melee branch, Damage 1d12 bludgeoning; Tree Meld (hide within trees); Nature Empathy (communicate with plants and animals).'
  },
  {
    id: 'elananx',
    name: 'Elananx',
    size: 'Medium',
    speed: {
      land: 30
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 16,
        damage: '1d6 piercing plus 1d6 fire',
        traits: []
      },
      {
        name: 'Claw',
        type: 'melee',
        bonus: 16,
        damage: '1d6 slashing',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Pack Attack',
        description: 'Your Strikes deal 1d6 extra damage to creatures within reach of at least one of your allies.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60,
      scent: 30
    },
    weaknesses: {
      'cold iron': 5
    },
    description: 'Speed 30 feet; darkvision; scent (imprecise) 30 feet; weakness 5 cold iron; Melee jaws, Damage 1d6 piercing plus 1d6 fire; Melee claw (agile), Damage 1d6 slashing; Pack Attack deals +1d6 damage near allies.'
  },
  {
    id: 'nymph',
    name: 'Nymph',
    size: 'Medium',
    speed: {
      land: 25,
      swim: 25
    },
    attacks: [
      {
        name: 'Aqueous Fist',
        type: 'melee',
        bonus: 16,
        damage: '1d10 bludgeoning',
        traits: ['finesse']
      }
    ],
    abilities: [
      {
        name: 'Blinding Beauty',
        description: 'Once per round, you can attempt to dazzle a creature within 30 feet that can see you (Will save).',
        traits: ['emotion', 'visual']
      },
      {
        name: 'Water Breathing',
        description: 'You can breathe underwater.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    weaknesses: {
      'cold iron': 5
    },
    description: 'Speed 25 feet, swim 25 feet; weakness 5 cold iron; Melee aqueous fist (finesse), Damage 1d10 bludgeoning; Blinding Beauty (dazzle a creature within 30 feet); Water Breathing.'
  },
  {
    id: 'pixie',
    name: 'Pixie',
    size: 'Small',
    speed: {
      land: 15,
      fly: 45
    },
    attacks: [
      {
        name: 'Sword',
        type: 'melee',
        bonus: 16,
        damage: '1d8 slashing',
        traits: ['agile', 'finesse']
      }
    ],
    abilities: [
      {
        name: 'Invisibility',
        description: 'You can become invisible at will for 1 minute or until you attack.',
        traits: ['illusion']
      },
      {
        name: 'Sprinkle Pixie Dust',
        description: 'You can grant an adjacent ally a fly Speed of 45 feet for 1 round.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    weaknesses: {
      'cold iron': 5
    },
    description: 'Size Small; Speed 15 feet, fly 45 feet; weakness 5 cold iron; Melee sword (agile, finesse), Damage 1d8 slashing; Invisibility (become invisible at will); Sprinkle Pixie Dust (grant ally fly speed).'
  },
  {
    id: 'satyr',
    name: 'Satyr',
    size: 'Medium',
    speed: {
      land: 35
    },
    attacks: [
      {
        name: 'Dagger',
        type: 'melee',
        bonus: 16,
        damage: '1d6 piercing',
        traits: ['agile', 'finesse', 'versatile S']
      },
      {
        name: 'Horns',
        type: 'melee',
        bonus: 16,
        damage: '1d8 bludgeoning',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Fleet',
        description: 'You gain a +10-foot status bonus to your land Speed and ignore difficult terrain.',
        traits: []
      },
      {
        name: 'Woodland Stride',
        description: 'You ignore difficult terrain from plants and undergrowth.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    weaknesses: {
      'cold iron': 5
    },
    description: 'Speed 35 feet; weakness 5 cold iron; Melee dagger (agile, finesse, versatile S), Damage 1d6 piercing; Melee horns, Damage 1d8 bludgeoning; Fleet (+10-foot status bonus to Speed); Woodland Stride (ignore plant difficult terrain).'
  },
  {
    id: 'redcap',
    name: 'Redcap',
    size: 'Small',
    speed: {
      land: 50
    },
    attacks: [
      {
        name: 'Scythe',
        type: 'melee',
        bonus: 16,
        damage: '2d10 slashing',
        traits: ['deadly d10', 'trip']
      },
      {
        name: 'Boot',
        type: 'melee',
        bonus: 16,
        damage: '1d6 bludgeoning',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Iron Boots',
        description: 'Your boot Strikes ignore the first 5 points of a target\'s resistance to physical damage.',
        traits: []
      },
      {
        name: 'Stomp',
        description: 'If you hit a prone creature with a boot Strike, the creature takes an additional 2d6 persistent bleed damage.',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true
    },
    weaknesses: {
      'cold iron': 5
    },
    description: 'Size Small; Speed 50 feet; weakness 5 cold iron; Melee scythe (deadly d10, trip), Damage 2d10 slashing; Melee boot (agile), Damage 1d6 bludgeoning; Iron Boots (ignore 5 resistance); Stomp (prone targets take 2d6 persistent bleed).'
  }
];

export const feyFormSpell: TransformationSpell = {
  id: 'fey-form',
  name: 'Fey Form',
  level: 4,
  school: 'transmutation',
  traditions: ['occult', 'primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You call upon the First World to transform into a fey battle form. When you cast this spell, choose dryad, elananx, nymph, pixie, satyr, or redcap. You gain the following statistics and abilities regardless of which battle form you choose: AC = 19 + your level; 15 temporary HP; low-light vision; weakness 5 to cold iron; one or more melee unarmed attacks (specific to the form); Acrobatics modifier +16.',
  heightened: {
    5: 'Your battle form is Large. You instead gain AC = 19 + your level, 20 temporary HP, attack modifier +18, damage bonus +6, and Acrobatics +20.',
    6: 'Your battle form is Huge and has 15-foot reach. You instead gain AC = 22 + your level, 25 temporary HP, attack modifier +21, damage bonus +11, and Acrobatics +23.'
  },
  forms: feyForms
};

