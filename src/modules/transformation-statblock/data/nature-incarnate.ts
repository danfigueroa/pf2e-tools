import type { TransformationSpell, TransformationForm } from '../../../types';
import { tr } from '../../../i18n';

// Nature Incarnate - ultimate nature battle forms
export const natureIncarnateForms: TransformationForm[] = [
  {
    id: 'green-man',
    name: 'Green Man',
    size: 'Gargantuan',
    speed: {
      land: 40,
      climb: 40
    },
    attacks: [
      {
        name: 'Vines',
        type: 'melee',
        bonus: 34,
        damage: '6d8 bludgeoning plus Grab',
        traits: ['reach'],
        range: 30
      },
      {
        name: 'Thorns',
        type: 'ranged',
        bonus: 34,
        damage: '6d6 piercing',
        traits: [],
        range: 100
      }
    ],
    abilities: [
      {
        name: tr('Língua Verde', 'Green Tongue'),
        description: tr('Você pode se comunicar com plantas e ordenar que se movam ou executem ações simples.', 'You can communicate with plants and command them to move or perform simple actions.'),
        traits: []
      },
      {
        name: tr('Ira da Floresta', 'Wrath of the Forest'),
        description: tr('Plantas em uma emanação de 60 pés são terreno difícil para seus inimigos.', 'Plants in a 60-foot emanation are difficult terrain for your enemies.'),
        traits: ['aura']
      },
      {
        name: tr('Regeneração', 'Regeneration'),
        description: tr('Você ganha cura acelerada 10. Essa cura é desativada enquanto você estiver em uma área sem plantas ou se sofrer dano de fogo.', 'You gain fast healing 10. This healing is deactivated while you are in an area without plants or if you take fire damage.'),
        traits: []
      },
      {
        name: tr('Explosão Verdejante', 'Verdant Burst'),
        description: tr('Quando você seria reduzido a 0 PV, você pode liberar uma emanação de 30 pés de energia curativa. Todos os aliados na área curam 10d10 PV, e plantas crescem como se um ano tivesse passado.', 'When you would be reduced to 0 HP, you can release a 30-foot emanation of healing energy. All allies in the area heal 10d10 HP, and plants grow as if a year had passed.'),
        traits: ['healing']
      }
    ],
    senses: {
      darkvision: 60,
      tremorsense: 60
    },
    resistances: {
      bludgeoning: 10,
      piercing: 10
    },
    weaknesses: {
      fire: 15
    },
    description: 'Size Gargantuan; Speed 40 feet, climb 40 feet; tremorsense (imprecise) 60 feet; resistance 10 bludgeoning and piercing; weakness 15 fire; fast healing 10; Melee vines (reach 30 feet), Damage 6d8 bludgeoning plus Grab; Ranged thorns (range 100 feet), Damage 6d6 piercing; Green Tongue; Forest\'s Wrath 60-foot aura of difficult terrain; Verdant Burst heals allies and grows plants when reduced to 0 HP.'
  },
  {
    id: 'kaiju',
    name: 'Kaiju',
    size: 'Gargantuan',
    speed: {
      land: 50,
      swim: 50
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 34,
        damage: '6d10 piercing plus Improved Grab',
        traits: ['reach'],
        range: 30
      },
      {
        name: 'Claws',
        type: 'melee',
        bonus: 34,
        damage: '6d8 slashing',
        traits: ['agile', 'reach'],
        range: 25
      },
      {
        name: 'Tail',
        type: 'melee',
        bonus: 34,
        damage: '6d6 bludgeoning plus Knockdown',
        traits: ['reach'],
        range: 35
      }
    ],
    abilities: [
      {
        name: tr('Fúria Destrutiva', 'Destructive Fury'),
        description: tr('Seus ataques causam dano dobrado a objetos e estruturas.', 'Your attacks deal double damage to objects and structures.'),
        traits: []
      },
      {
        name: tr('Pisão Devastador', 'Devastating Stomp'),
        description: tr('Você se Desloca até metade do seu Deslocamento e então pisoteia, causando 4d10 de dano contundente a todas as criaturas em uma emanação de 20 pés (salvamento de Reflexos básico).', 'You Stride up to half your Speed and then stomp, dealing 4d10 bludgeoning damage to all creatures in a 20-foot emanation (basic Reflex save).'),
        traits: []
      },
      {
        name: tr('Imparável', 'Unstoppable'),
        description: tr('Você é imune a lentidão e paralisia. Você trata todo terreno difícil como terreno normal.', 'You are immune to slowed and paralyzed. You treat all difficult terrain as normal terrain.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60
    },
    immunities: ['paralyzed', 'slowed'],
    resistances: {
      physical: 15
    },
    description: 'Size Gargantuan; Speed 50 feet, swim 50 feet; darkvision; immunity to paralyzed and slowed; resistance 15 physical; Melee jaws (reach 30 feet), Damage 6d10 piercing plus Improved Grab; Melee claws (agile, reach 25 feet), Damage 6d8 slashing; Melee tail (reach 35 feet), Damage 6d6 bludgeoning plus Knockdown; Destructive Frenzy (double damage to structures); Devastating Stomp (4d10 bludgeoning in 20-foot emanation); Unstoppable.'
  },
  {
    id: 'primordial-elemental',
    name: 'Primordial Elemental',
    size: 'Gargantuan',
    speed: {
      land: 50,
      fly: 50,
      swim: 50,
      burrow: 50
    },
    attacks: [
      {
        name: tr('Golpe Elemental', 'Elemental Strike'),
        type: 'melee',
        bonus: 34,
        damage: '4d12 bludgeoning plus 4d6 energy (choose type)',
        traits: ['reach'],
        range: 25
      }
    ],
    abilities: [
      {
        name: tr('Sintonia Elemental', 'Elemental Attunement'),
        description: tr('Escolha ar, terra, fogo ou água ao se transformar. Você ganha imunidade ao elemento escolhido e fraqueza 15 ao elemento oposto.', 'Choose air, earth, fire or water when you transform. You gain immunity to the chosen element and weakness 15 to the opposing element.'),
        traits: []
      },
      {
        name: tr('Surto Elemental', 'Elemental Surge'),
        description: tr('Uma vez por rodada, você pode liberar uma linha de 60 pés ou cone de 30 pés do seu elemento, causando 10d6 de dano do tipo do seu elemento (salvamento de Reflexos básico).', 'Once per round, you can release a 60-foot line or 30-foot cone of your element, dealing 10d6 damage of your element\'s type (basic Reflex save).'),
        traits: []
      },
      {
        name: 'Aura Primal',
        description: tr('Você emana uma aura do seu elemento em uma emanação de 30 pés. Criaturas do seu elemento ficam apressadas 1, enquanto criaturas vulneráveis ao seu elemento ficam lentas 1.', 'You emanate an aura of your element in a 30-foot emanation. Creatures of your element are quickened 1, while creatures vulnerable to your element are slowed 1.'),
        traits: ['aura']
      }
    ],
    senses: {
      darkvision: 60,
      tremorsense: 60
    },
    immunities: ['bleed', 'paralyzed', 'poison', 'sleep'],
    description: 'Size Gargantuan; all Speeds 50 feet; tremorsense (imprecise) 60 feet; immunity to bleed, paralyzed, poison, sleep, and one element (choose); weakness 15 to opposing element; Melee elemental strike (reach 25 feet), Damage 4d12 bludgeoning plus 4d6 energy; Elemental Surge 60-foot line or 30-foot cone, 10d6 elemental damage; Primal Aura quickens allies, slows enemies.'
  },
  {
    id: 'world-serpent',
    name: 'World Serpent',
    size: 'Gargantuan',
    speed: {
      land: 40,
      swim: 100,
      burrow: 40
    },
    attacks: [
      {
        name: 'Jaws',
        type: 'melee',
        bonus: 34,
        damage: '6d12 piercing plus 2d6 poison plus Grab',
        traits: ['reach'],
        range: 30
      },
      {
        name: tr('Constrição', 'Constrict'),
        type: 'melee',
        bonus: 34,
        damage: '6d6 bludgeoning plus 2d6 poison',
        traits: []
      },
      {
        name: tr('Chicotada de Cauda', 'Tail Lash'),
        type: 'melee',
        bonus: 34,
        damage: '6d8 bludgeoning',
        traits: ['reach'],
        range: 40
      }
    ],
    abilities: [
      {
        name: tr('Toxina Primordial', 'Primordial Toxin'),
        description: tr('Sua mordida e constrição aplicam um veneno potente que causa 4d6 de dano de veneno persistente com um salvamento de Fortitude falho.', 'Your bite and constrict apply a potent poison that deals 4d6 persistent poison damage on a failed Fortitude save.'),
        traits: ['poison']
      },
      {
        name: tr('Anéis do Mundo', 'Coils of the World'),
        description: tr('Você pode Agarrar criaturas de até tamanho Enorme. Enquanto tiver uma criatura agarrada, pode usar Constrição nela como uma única ação.', 'You can Grab creatures up to Huge size. While you have a creature grabbed, you can use Constrict on it as a single action.'),
        traits: []
      },
      {
        name: tr('Engolir Inteiro', 'Swallow Whole'),
        description: tr('Criaturas Grandes ou menores que você agarrou podem ser engolidas. Criaturas engolidas sofrem 6d6 de dano contundente e 6d6 de ácido por rodada.', 'Large or smaller creatures you have grabbed can be swallowed. Swallowed creatures take 6d6 bludgeoning and 6d6 acid damage per round.'),
        traits: []
      }
    ],
    senses: {
      darkvision: 60,
      tremorsense: 120
    },
    immunities: ['poison'],
    resistances: {
      physical: 10
    },
    description: 'Size Gargantuan; Speed 40 feet, swim 100 feet, burrow 40 feet; tremorsense (imprecise) 120 feet; immunity to poison; resistance 10 physical; Melee jaws (reach 30 feet), Damage 6d12 piercing plus 2d6 poison plus Grab; Melee tail lash (reach 40 feet), Damage 6d8 bludgeoning; Constrict 6d6 bludgeoning plus 2d6 poison; Swallow Whole (6d6 bludgeoning plus 6d6 acid).'
  }
];

export const natureIncarnateSpell: TransformationSpell = {
  id: 'nature-incarnate',
  name: 'Nature Incarnate',
  level: 10,
  school: 'transmutation',
  traditions: ['primal'],
  cast: '2 actions',
  range: 'self',
  targets: 'you',
  duration: '1 minute',
  description: 'You transform into an incarnation of nature, becoming a Gargantuan avatar of the natural world. Choose one of the forms below when you cast this spell. You gain the following statistics and abilities regardless of which battle form you choose: AC = 25 + your level; 30 temporary HP; ignore difficult terrain and greater difficult terrain; one or more unarmed melee attacks (specific to the form), which are the only attacks you can use. You have hands in this battle form and can use manipulate actions.',
  heightened: {},
  forms: natureIncarnateForms
};

