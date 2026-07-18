import type { TransformationSpell, TransformationForm } from '../../../types';

// Ooze Form - ooze battle forms (Rage of Elements / Player Core reprint)
// Note: dice-only damage strings; the flat damage bonus (+5) comes from the
// spell progression (damageMod) in StatBlockGenerator, matching other forms.
export const oozeForms: TransformationForm[] = [
  {
    id: 'black-pudding',
    name: 'Black Pudding',
    size: 'Medium',
    speed: {
      land: 15,
      climb: 15
    },
    attacks: [
      {
        name: 'Pseudopod',
        type: 'melee',
        bonus: 14,
        damage: '2d6 bludgeoning plus 1d8 acid',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Sentido de Movimento',
        description: 'Você não enxerga, mas percebe o movimento de criaturas em até 30 pés (impreciso).',
        traits: []
      },
      {
        name: 'Corpo Corrosivo',
        description: 'Uma criatura que acertar você com um ataque desarmado sofre dano de ácido do seu corpo.',
        traits: []
      }
    ],
    senses: {},
    immunities: ['critical hits', 'precision damage', 'visual effects'],
    resistances: {
      acid: 5,
      piercing: 5,
      slashing: 5
    },
    traits: ['ooze'],
    description: 'Speed 15 feet, climb 15 feet; immune to critical hits, precision damage, visual effects; resistance 5 to acid, piercing, slashing; motion sense 30 feet (no vision); Melee pseudopod, Damage 2d6 bludgeoning plus 1d8 acid.'
  },
  {
    id: 'gelatinous-cube',
    name: 'Gelatinous Cube',
    size: 'Medium',
    speed: {
      land: 15
    },
    attacks: [
      {
        name: 'Cube Face',
        type: 'melee',
        bonus: 14,
        damage: '1d6 acid',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Sentido de Movimento',
        description: 'Você não enxerga, mas percebe o movimento de criaturas em até 30 pés (impreciso).',
        traits: []
      },
      {
        name: 'Toque Entorpecente',
        description: 'Uma criatura atingida pela face do cubo deve ser bem-sucedida em um salvamento de Fortitude ou fica atordoada 1 (atordoada 1 e paralisada por 1 rodada em uma falha crítica).',
        traits: ['incapacitation']
      }
    ],
    senses: {},
    immunities: ['critical hits', 'precision damage', 'visual effects'],
    resistances: {
      acid: 5,
      piercing: 5,
      slashing: 5
    },
    traits: ['ooze'],
    description: 'Speed 15 feet; immune to critical hits, precision damage, visual effects; resistance 5 to acid, piercing, slashing; motion sense 30 feet (no vision); Melee cube face, Damage 1d6 acid plus numbing touch (Fortitude save or stunned 1).'
  },
  {
    id: 'gray-ooze',
    name: 'Gray Ooze',
    size: 'Medium',
    speed: {
      land: 15,
      climb: 15,
      swim: 15
    },
    attacks: [
      {
        name: 'Pseudopod',
        type: 'melee',
        bonus: 14,
        damage: '1d6 bludgeoning plus 1d6 acid',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Sentido de Movimento',
        description: 'Você não enxerga, mas percebe o movimento de criaturas em até 30 pés (impreciso).',
        traits: []
      },
      {
        name: 'Agarrar',
        description: 'Você pode usar seu pseudópode para Agarrar uma criatura que atingir.',
        traits: []
      }
    ],
    senses: {},
    immunities: ['critical hits', 'precision damage', 'visual effects'],
    resistances: {
      acid: 5,
      piercing: 5,
      slashing: 5
    },
    traits: ['ooze'],
    description: 'Speed 15 feet, climb 15 feet, swim 15 feet; immune to critical hits, precision damage, visual effects; resistance 5 to acid, piercing, slashing; motion sense 30 feet (no vision); Melee pseudopod, Damage 1d6 bludgeoning plus 1d6 acid; Grab.'
  },
  {
    id: 'ochre-jelly',
    name: 'Ochre Jelly',
    size: 'Medium',
    speed: {
      land: 15,
      climb: 10
    },
    attacks: [
      {
        name: 'Pseudopod',
        type: 'melee',
        bonus: 14,
        damage: '1d8 bludgeoning plus 1d8 acid',
        traits: []
      }
    ],
    abilities: [
      {
        name: 'Sentido de Movimento',
        description: 'Você não enxerga, mas percebe o movimento de criaturas em até 30 pés (impreciso).',
        traits: []
      },
      {
        name: 'Agarrar',
        description: 'Você pode usar seu pseudópode para Agarrar uma criatura que atingir.',
        traits: []
      }
    ],
    senses: {},
    immunities: ['critical hits', 'precision damage', 'visual effects'],
    resistances: {
      acid: 5,
      piercing: 5,
      slashing: 5,
      electricity: 5
    },
    traits: ['ooze'],
    description: 'Speed 15 feet, climb 10 feet; immune to critical hits, precision damage, visual effects; resistance 5 to acid, piercing, slashing, electricity; motion sense 30 feet (no vision); Melee pseudopod, Damage 1d8 bludgeoning plus 1d8 acid; Grab.'
  }
];

export const oozeFormSpell: TransformationSpell = {
  id: 'ooze-form',
  name: 'Ooze Form',
  level: 3,
  school: 'transmutation',
  traditions: ['arcane', 'occult'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into an ooze battle form. When you cast this spell, choose black pudding, gelatinous cube, gray ooze, or ochre jelly. You gain the ooze trait and the following statistics regardless of form: AC = 7 + your level; 20 temporary HP; no vision but motion sense 30 feet; immunity to critical hits, precision damage, and visual effects; resistance 5 to acid, piercing, and slashing; attack modifier +14 (unless your own is higher); Athletics +14.',
  heightened: {
    4: 'Your battle form is Large and your attacks have 10-foot reach.',
    5: 'Your battle form is Huge and your attacks have 15-foot reach.',
    8: 'Your battle form is Gargantuan (20-foot space) and your attacks have 20-foot reach.'
  },
  forms: oozeForms
};
