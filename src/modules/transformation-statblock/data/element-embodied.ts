import type { TransformationSpell, TransformationForm } from '../../../types';

// Element Embodied - rank 10 elemental battle form (Rage of Elements).
// Common statistics (verified): AC 25 + level, 30 temporary HP (40 for earth
// and wood), attack modifier +34, Gargantuan, darkvision, Athletics +34.
// Per-element attack damage below is modeled after the published forms; verify
// exact dice against the source book when tuning.
export const elementEmbodiedForms: TransformationForm[] = [
  {
    id: 'air',
    name: 'Air Elemental',
    size: 'Gargantuan',
    speed: {
      land: 10,
      fly: 90
    },
    attacks: [
      {
        name: 'Gust',
        type: 'melee',
        bonus: 34,
        damage: '3d8 bludgeoning plus 2d8 electricity',
        traits: ['reach 20']
      },
      {
        name: 'Lightning Lance',
        type: 'ranged',
        bonus: 34,
        damage: '4d6 electricity',
        traits: ['range 120']
      }
    ],
    abilities: [
      {
        name: 'Voo',
        description: 'Você tem um Deslocamento de voo e pode pairar no lugar.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['air', 'elemental'],
    description: 'Speed 10 feet, fly 90 feet; darkvision; Melee gust (reach 20), Damage 3d8 bludgeoning plus 2d8 electricity; Ranged lightning lance, Damage 4d6 electricity.'
  },
  {
    id: 'earth',
    name: 'Earth Elemental',
    size: 'Gargantuan',
    speed: {
      land: 30,
      burrow: 30
    },
    attacks: [
      {
        name: 'Fist',
        type: 'melee',
        bonus: 34,
        damage: '4d10 bludgeoning',
        traits: ['reach 20']
      }
    ],
    abilities: [
      {
        name: 'Deslizar pela Terra',
        description: 'Você pode Escavar através de terra e pedra com seu Deslocamento de escavação.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60,
      tremorsense: 60
    },
    hpBonus: 10,
    traits: ['earth', 'elemental'],
    description: 'Speed 30 feet, burrow 30 feet; 40 temporary HP; darkvision; tremorsense 60 feet; Melee fist (reach 20), Damage 4d10 bludgeoning; Earth Glide.'
  },
  {
    id: 'fire',
    name: 'Fire Elemental',
    size: 'Gargantuan',
    speed: {
      land: 60
    },
    attacks: [
      {
        name: 'Tendril',
        type: 'melee',
        bonus: 34,
        damage: '3d10 fire plus 2d6 persistent fire',
        traits: ['reach 20']
      }
    ],
    abilities: [
      {
        name: 'Chamas Envolventes',
        description: 'Criaturas que terminam o turno adjacentes a você sofrem dano de fogo.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    weaknesses: {
      cold: 10
    },
    traits: ['fire', 'elemental'],
    description: 'Speed 60 feet; weakness 10 cold; darkvision; Melee tendril (reach 20), Damage 3d10 fire plus 2d6 persistent fire; Engulfing Flames.'
  },
  {
    id: 'water',
    name: 'Water Elemental',
    size: 'Gargantuan',
    speed: {
      land: 20,
      swim: 90
    },
    attacks: [
      {
        name: 'Wave',
        type: 'melee',
        bonus: 34,
        damage: '4d8 bludgeoning',
        traits: ['reach 20', 'push']
      }
    ],
    abilities: [
      {
        name: 'Encharcar',
        description: 'Você pode Empurrar criaturas que atingir e apagar fogos não mágicos.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['water', 'elemental'],
    description: 'Speed 20 feet, swim 90 feet; darkvision; Melee wave (reach 20, push), Damage 4d8 bludgeoning; Drench.'
  },
  {
    id: 'metal',
    name: 'Metal Elemental',
    size: 'Gargantuan',
    speed: {
      land: 40
    },
    attacks: [
      {
        name: 'Blade',
        type: 'melee',
        bonus: 34,
        damage: '4d8 slashing plus 2d6 electricity',
        traits: ['reach 20']
      }
    ],
    abilities: [
      {
        name: 'Conduzir Energia',
        description: 'Você conduz eletricidade, causando dano de eletricidade adicional com seus ataques.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    traits: ['metal', 'elemental'],
    description: 'Speed 40 feet; darkvision; Melee blade (reach 20), Damage 4d8 slashing plus 2d6 electricity; Conduct Energy.'
  },
  {
    id: 'wood',
    name: 'Wood Elemental',
    size: 'Gargantuan',
    speed: {
      land: 30,
      climb: 30
    },
    attacks: [
      {
        name: 'Vine',
        type: 'melee',
        bonus: 34,
        damage: '3d10 bludgeoning plus 2d6 persistent bleed',
        traits: ['reach 25']
      }
    ],
    abilities: [
      {
        name: 'Rebrota Verdejante',
        description: 'Seu corpo se regenera constantemente, e seus cipós podem prender criaturas que você atingir.',
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    hpBonus: 10,
    weaknesses: {
      fire: 10
    },
    traits: ['wood', 'elemental'],
    description: 'Speed 30 feet, climb 30 feet; 40 temporary HP; weakness 10 fire; darkvision; Melee vine (reach 25), Damage 3d10 bludgeoning plus 2d6 persistent bleed; Verdant Regrowth.'
  }
];

export const elementEmbodiedSpell: TransformationSpell = {
  id: 'element-embodied',
  name: 'Element Embodied',
  level: 10,
  school: 'transmutation',
  traditions: ['arcane', 'primal'],
  cast: '3 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into a spectacular Gargantuan elemental. Choose air, earth, fire, water, metal, or wood; you must have enough space to expand into or the spell is lost. You gain the elemental trait and the trait for your chosen element, plus: AC = 25 + your level; 30 temporary HP (40 for earth or wood); darkvision; attack modifier +34 (unless your own is higher); Athletics +34.',
  forms: elementEmbodiedForms
};
