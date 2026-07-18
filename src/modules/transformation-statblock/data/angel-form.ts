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
        name: 'Memória Perfeita',
        description: 'Você recorda perfeitamente tudo o que viu ou ouviu e recebe +4 em testes para lembrar de coisas.',
        traits: []
      },
      {
        name: 'Repositório de Saber',
        description: 'Você pode rolar Recordar Conhecimento usando Religião ou Ofício no lugar da perícia normal.',
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
        name: 'Harmonizar',
        description: 'Você pode usar Atuação para conjurar uma magia curar de uma ação uma vez por rodada, curando 2d8 PV de uma criatura em até 30 pés.',
        traits: ['healing', 'sonic']
      },
      {
        name: 'Coro Ensurdecedor',
        description: 'Uma vez por rodada, você pode criar uma explosão de som. Criaturas em até 15 pés sofrem 2d6 de dano sônico (salvamento de Fortitude básico).',
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
        name: 'Aura de Vitalidade',
        description: 'Aliados em até 20 pés de você ganham cura acelerada 2.',
        traits: ['aura', 'healing']
      },
      {
        name: 'Campo Dissipador',
        description: 'Uma vez por rodada, você pode tentar anular um efeito mágico em uma criatura que tocar.',
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
        name: 'Resistência Elemental',
        description: 'Você tem resistência 10 a ácido, frio, eletricidade e fogo.',
        traits: []
      },
      {
        name: 'Golpe Sólido',
        description: 'Quando você acerta um acerto crítico com sua maça, o alvo é empurrado 10 pés.',
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
        name: 'Aura do Viajante',
        description: 'Aliados em até 20 pés não são afetados por terreno difícil e ganham +10 pés de bônus de condição no Deslocamento.',
        traits: ['aura']
      },
      {
        name: 'Salvo-conduto do Mensageiro',
        description: 'Você e todos os aliados em até 20 pés não podem ser atacados por criaturas invocadas ou chamadas, a menos que sejam controladas diretamente.',
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
        name: 'Lâmina da Justiça',
        description: 'Seu espadão sagrado causa 2d6 de dano de espírito adicional contra corruptores e mortos-vivos.',
        traits: []
      },
      {
        name: 'Armamentos Sagrados',
        description: 'Qualquer arma que você empunhar ganha o efeito da runa sagrada.',
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

