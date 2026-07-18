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
        name: 'Fundir-se à Árvore',
        description: 'Você pode entrar em uma árvore e se esconder nela. Dentro dela, você tem camuflagem total e percebe os arredores com seus sentidos normais.',
        traits: []
      },
      {
        name: 'Empatia Natural',
        description: 'Você pode se comunicar com plantas e animais.',
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
        name: 'Ataque em Matilha',
        description: 'Seus ataques causam 1d6 de dano adicional a criaturas ao alcance de pelo menos um aliado seu.',
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
        name: 'Beleza Cegante',
        description: 'Uma vez por rodada, você pode tentar ofuscar uma criatura em até 30 pés que possa ver você (salvamento de Vontade).',
        traits: ['emotion', 'visual']
      },
      {
        name: 'Respiração Aquática',
        description: 'Você pode respirar debaixo da água.',
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
        name: 'Invisibilidade',
        description: 'Você pode ficar invisível à vontade por 1 minuto ou até atacar.',
        traits: ['illusion']
      },
      {
        name: 'Aspergir Pó de Pixie',
        description: 'Você pode conceder a um aliado adjacente um Deslocamento de voo de 45 pés por 1 rodada.',
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
        name: 'Ligeiro',
        description: 'Você recebe +10 pés de bônus de condição no seu Deslocamento terrestre e ignora terreno difícil.',
        traits: []
      },
      {
        name: 'Passo na Floresta',
        description: 'Você ignora terreno difícil causado por plantas e vegetação rasteira.',
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
        name: 'Botas de Ferro',
        description: 'Seus ataques de bota ignoram os primeiros 5 pontos de resistência a dano físico do alvo.',
        traits: []
      },
      {
        name: 'Stomp',
        description: 'Se você acertar uma criatura caída com um ataque de bota, ela sofre 2d6 de dano de sangramento persistente adicional.',
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

