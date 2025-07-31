import type { TransformationSpell, TransformationForm } from '../../../types';

// Animal forms available for Animal Form spell
export const animalForms: TransformationForm[] = [
  {
    id: 'ape',
    name: 'Ape',
    size: 'Medium',
    speed: {
      land: 25,
      climb: 20
    },
    attacks: [
      {
        name: 'Fist',
        type: 'melee',
        bonus: 9,
        damage: '2d6 bludgeoning',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 25 feet, climb 20 feet; Melee fist, Damage 2d6 bludgeoning.'
  },
  {
    id: 'bear',
    name: 'Bear',
    size: 'Medium',
    speed: {
      land: 30
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d8 piercing',
        traits: []
      },
      {
        name: 'Claw',
        type: 'melee',
        bonus: 9,
        damage: '1d8 slashing',
        traits: ['agile']
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 30 feet; Melee jaws, Damage 2d8 piercing; Melee claw (agile), Damage 1d8 slashing.'
  },
  {
    id: 'bull',
    name: 'Bull',
    size: 'Medium',
    speed: {
      land: 30
    },
    attacks: [
      {
        name: 'Horn',
        type: 'melee',
        bonus: 9,
        damage: '2d8 piercing',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 30 feet; Melee horn, Damage 2d8 piercing.'
  },
  {
    id: 'canine',
    name: 'Canine',
    size: 'Medium',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d8 piercing',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 40 feet; Melee jaws, Damage 2d8 piercing.'
  },
  {
    id: 'cat',
    name: 'Cat',
    size: 'Medium',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d6 piercing',
        traits: []
      },
      {
        name: 'Claw',
        type: 'melee',
        bonus: 9,
        damage: '1d10 slashing',
        traits: ['agile']
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 40 feet; Melee jaws, Damage 2d6 piercing; Melee claw (agile), Damage 1d10 slashing.'
  },
  {
    id: 'deer',
    name: 'Deer',
    size: 'Medium',
    speed: {
      land: 50
    },
    attacks: [
      {
        name: 'Antler',
        type: 'melee',
        bonus: 9,
        damage: '2d6 piercing',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 50 feet; Melee antler, Damage 2d6 piercing.'
  },
  {
    id: 'frog',
    name: 'Frog',
    size: 'Medium',
    speed: {
      land: 25,
      swim: 25
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d6 bludgeoning',
        traits: []
      },
      {
        name: 'Tongue',
        type: 'melee',
        bonus: 9,
        damage: '2d4 bludgeoning',
        traits: ['reach'],
        range: 15
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 25 feet, swim 25 feet; Melee jaws, Damage 2d6 bludgeoning; Melee tongue (reach 15 feet), Damage 2d4 bludgeoning.'
  },
  {
    id: 'shark',
    name: 'Shark',
    size: 'Medium',
    speed: {
      swim: 35
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d8 piercing',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Aquatic',
        description: 'Can breathe underwater but not in air',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Swim 35 feet; Melee jaws, Damage 2d8 piercing; breathe underwater but not in air.'
  },
  {
    id: 'snake',
    name: 'Snake',
    size: 'Medium',
    speed: {
      land: 20,
      climb: 20,
      swim: 20
    },
    attacks: [
      {
        name: 'Fangs',
        type: 'melee',
        bonus: 9,
        damage: '2d4 piercing plus 1d6 poison',
        traits: []
      }
    ],
    abilities: [],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 20 feet, climb 20 feet, swim 20 feet; Melee fangs, Damage 2d4 piercing plus 1d6 poison.'
  },
  {
    id: 'crab',
    name: 'Crab',
    size: 'Medium',
    speed: {
      land: 25,
      swim: 15
    },
    attacks: [
      {
        name: 'Big Claw',
        type: 'melee',
        bonus: 9,
        damage: '2d8 piercing',
        traits: []
      },
      {
        name: 'Little Claw',
        type: 'melee',
        bonus: 9,
        damage: '2d4 piercing',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Amphibious',
        description: 'Can breathe in water and in air',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 25 feet, swim 15 feet; Melee big claw, Damage 2d8 piercing; Melee little claw (agile), Damage 2d4 piercing; can breathe in water and in air.'
  },
  {
    id: 'crocodile',
    name: 'Crocodile',
    size: 'Medium',
    speed: {
      land: 25,
      swim: 30
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d8 piercing',
        traits: []
      },
      {
        name: 'Tail',
        type: 'melee',
        bonus: 9,
        damage: '1d8 bludgeoning',
        traits: ['agile']
      }
    ],
    abilities: [
      {
        name: 'Hold Breath',
        description: 'Can hold breath for the duration of the transformation',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 25 feet, swim 30 feet; Melee jaws, Damage 2d8 piercing; Melee tail (agile), Damage 1d8 bludgeoning; can hold your breath for the duration of the transformation.'
  },
  {
    id: 'orca',
    name: 'Orca',
    size: 'Medium',
    speed: {
      swim: 35
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d8 piercing',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Hold Breath',
        description: 'Can hold breath for the duration of the transformation',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Swim 35 feet; Melee jaws, Damage 2d8 piercing; can hold your breath for the duration of the transformation.'
  },
  {
    id: 'seal',
    name: 'Seal',
    size: 'Medium',
    speed: {
      land: 20,
      swim: 30
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 9,
        damage: '2d6 piercing',
        traits: ['grapple']
      }
    ],
    abilities: [
      {
        name: 'Hold Breath',
        description: 'Can hold breath for the duration of the transformation',
        traits: []
      }
    ],
    senses: {
      lowLightVision: true,
      scent: 30
    },
    description: 'Speed 20 feet, swim 30 feet; Melee jaws (grapple), Damage 2d6 piercing; can hold your breath for the duration of the transformation.'
  }
];

// Animal Form spell data
export const animalFormSpell: TransformationSpell = {
  id: 'animal-form',
  name: 'Animal Form',
  level: 2,
  school: 'transmutation',
  traditions: ['primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You call upon primal energy to transform yourself into a Medium animal battle form. When you first cast this spell, choose ape, bear, bull, canine, cat, deer, frog, shark, or snake.',
  heightened: {
    3: 'You instead gain 10 temporary HP, AC = 17 + your level, attack modifier +14, damage bonus +5, and Athletics +14.',
    4: 'Your battle form is Large and your attacks have 10-foot reach. You instead gain 15 temporary HP, AC = 18 + your level, attack modifier +16, damage bonus +9, and Athletics +16.',
    5: 'Your battle form is Huge and your attacks have 15-foot reach. You instead gain 20 temporary HP, AC = 18 + your level, attack modifier +18, damage bonus +7 and double the number of damage dice, and Athletics +20.'
  },
  forms: animalForms
};

// Dinosaur Form spell data
export const dinosaurFormSpell: TransformationSpell = {
  id: 'dinosaur-form',
  name: 'Dinosaur Form',
  level: 4,
  school: 'transmutation',
  traditions: ['primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You call upon primal energy to transform yourself into a Large dinosaur battle form. When you first cast this spell, choose ankylosaurus, brontosaurus, deinonychus, stegosaurus, triceratops, or tyrannosaurus.',
  heightened: {
    5: 'Your battle form is Huge and your attacks have 15-foot reach. You instead gain 20 temporary HP, AC = 18 + your level, attack modifier +18, damage bonus +15, and Athletics +20.',
    7: 'Your battle form is Gargantuan and your attacks have 20-foot reach. You instead gain 25 temporary HP, AC = 19 + your level, attack modifier +25, damage bonus +19, and Athletics +25.'
  },
  forms: [
    {
      id: 'ankylosaurus',
      name: 'Ankylosaurus',
      size: 'Large',
      speed: {
        land: 25
      },
      attacks: [
        {
          name: 'Tail',
          type: 'melee',
          bonus: 18,
          damage: '2d6 bludgeoning',
          traits: ['backswing', 'reach'],
          range: 10
        },
        {
          name: 'Foot',
          type: 'melee',
          bonus: 18,
          damage: '2d6 bludgeoning',
          traits: []
        }
      ],
      abilities: [],
      senses: {
        lowLightVision: true,
        scent: 30
      },
      description: 'Speed 25 feet; Melee tail (backswing, reach 10 feet), Damage 2d6 bludgeoning; Melee foot, Damage 2d6 bludgeoning.'
    },
    {
      id: 'brontosaurus',
      name: 'Brontosaurus',
      size: 'Large',
      speed: {
        land: 25
      },
      attacks: [
        {
          name: 'Tail',
          type: 'melee',
          bonus: 18,
          damage: '2d6 bludgeoning',
          traits: ['reach'],
          range: 15
        },
        {
          name: 'Foot',
          type: 'melee',
          bonus: 18,
          damage: '2d8 bludgeoning',
          traits: []
        }
      ],
      abilities: [],
      senses: {
        lowLightVision: true,
        scent: 30
      },
      description: 'Speed 25 feet; Melee tail (reach 15 feet), Damage 2d6 bludgeoning; Melee foot, Damage 2d8 bludgeoning.'
    },
    {
      id: 'deinonychus',
      name: 'Deinonychus',
      size: 'Large',
      speed: {
        land: 40
      },
      attacks: [
        {
          name: 'Talon',
          type: 'melee',
          bonus: 18,
          damage: '2d4 piercing plus 1 persistent bleed',
          traits: ['agile']
        },
        {
          name: 'Jaws',
          type: 'melee',
          bonus: 18,
          damage: '1d10 piercing',
          traits: []
        }
      ],
      abilities: [],
      senses: {
        lowLightVision: true,
        scent: 30
      },
      description: 'Speed 40 feet; Melee talon (agile), Damage 2d4 piercing plus 1 persistent bleed; Melee jaws, Damage 1d10 piercing.'
    },
    {
      id: 'stegosaurus',
      name: 'Stegosaurus',
      size: 'Large',
      speed: {
        land: 30
      },
      attacks: [
        {
          name: 'Tail',
          type: 'melee',
          bonus: 18,
          damage: '2d8 piercing',
          traits: ['reach'],
          range: 10
        }
      ],
      abilities: [],
      senses: {
        lowLightVision: true,
        scent: 30
      },
      description: 'Speed 30 feet; Melee tail (reach 10 feet), Damage 2d8 piercing.'
    },
    {
      id: 'triceratops',
      name: 'Triceratops',
      size: 'Large',
      speed: {
        land: 30
      },
      attacks: [
        {
          name: 'Horn',
          type: 'melee',
          bonus: 18,
          damage: '2d8 piercing',
          traits: []
        },
        {
          name: 'Foot',
          type: 'melee',
          bonus: 18,
          damage: '2d6 bludgeoning',
          traits: []
        }
      ],
      abilities: [],
      senses: {
        lowLightVision: true,
        scent: 30
      },
      description: 'Speed 30 feet; Melee horn, Damage 2d8 piercing; Melee foot, Damage 2d6 bludgeoning.'
    },
    {
      id: 'tyrannosaurus',
      name: 'Tyrannosaurus',
      size: 'Large',
      speed: {
        land: 30
      },
      attacks: [
        {
          name: 'Jaws',
          type: 'melee',
          bonus: 18,
          damage: '1d12 piercing',
          traits: ['deadly', 'reach'],
          range: 10
        },
        {
          name: 'Tail',
          type: 'melee',
          bonus: 18,
          damage: '1d10 bludgeoning',
          traits: ['reach'],
          range: 10
        }
      ],
      abilities: [],
      senses: {
        lowLightVision: true,
        scent: 30
      },
      description: 'Speed 30 feet; Melee jaws (deadly d12, reach 10 feet), Damage 1d12 piercing; Melee tail (reach 10 feet), Damage 1d10 bludgeoning.'
    }
  ]
};

// Export all spells (for future expansion)
export const transformationSpells: TransformationSpell[] = [
  animalFormSpell,
  dinosaurFormSpell
];

// Helper function to get forms for a specific spell
export const getFormsForSpell = (spellId: string): TransformationForm[] => {
  return animalFormSpell.forms.filter(form => form.id.includes(spellId.split('-')[0]));
};

// Helper function to get spell by id
export const getSpellById = (spellId: string): TransformationSpell | undefined => {
  return transformationSpells.find(spell => spell.id === spellId);
};