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
        name: 'Autoimolação',
        description: 'Todos os seus ataques corpo a corpo causam 2d8 de dano de fogo adicional. Você ganha imunidade a fogo e fraqueza 10 a frio.',
        traits: ['fire']
      },
      {
        name: 'Manto de Chamas',
        description: 'Qualquer criatura que tocar você ou acertá-lo com ataque desarmado ou arma corpo a corpo sem alcance sofre 2d6 de dano de fogo.',
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
        name: 'Inexorável',
        description: 'Você pode escavar rocha sólida e não pode ser agarrado, imobilizado ou contido por meios não mágicos.',
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
        description: 'Uma vez por rodada, como parte de uma ação de Nadar, você causa 3d6 de dano cortante a qualquer criatura por quem nadar.',
        traits: []
      },
      {
        name: 'Aquático',
        description: 'Pode respirar debaixo da água.',
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
        name: 'Nuvem de Tinta',
        description: 'Uma vez por minuto, você pode emitir uma nuvem de tinta com raio de 30 pés, criando camuflagem por 1 minuto na água.',
        traits: []
      },
      {
        name: 'Aquático',
        description: 'Pode respirar debaixo da água.',
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
        name: 'Atropelar',
        description: 'Você se Desloca até o dobro do seu Deslocamento e pode atravessar espaços de criaturas Grandes ou menores. Cada criatura por quem passar sofre 2d8 de dano contundente (salvamento de Reflexos básico).',
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

