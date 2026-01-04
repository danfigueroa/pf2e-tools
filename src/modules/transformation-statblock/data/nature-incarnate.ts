import type { TransformationSpell, TransformationForm } from '../../../types';

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
        name: 'Green Tongue',
        description: 'You can communicate with plants and command them to move or take simple actions.',
        traits: []
      },
      {
        name: 'Forest\'s Wrath',
        description: 'Plants in a 60-foot emanation are difficult terrain for your enemies.',
        traits: ['aura']
      },
      {
        name: 'Regeneration',
        description: 'You gain fast healing 10. This fast healing is deactivated while you are in an area without plants or if affected by fire damage.',
        traits: []
      },
      {
        name: 'Verdant Burst',
        description: 'When you would be reduced to 0 HP, you can release a 30-foot emanation of healing energy. All allies in the area heal 10d10 HP, and plants grow as if a year had passed.',
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
        name: 'Destructive Frenzy',
        description: 'Your Strikes deal double damage to objects and structures.',
        traits: []
      },
      {
        name: 'Devastating Stomp',
        description: 'You Stride up to half your Speed and then stomp, dealing 4d10 bludgeoning damage to all creatures in a 20-foot emanation (basic Reflex save).',
        traits: []
      },
      {
        name: 'Unstoppable',
        description: 'You are immune to slowed and paralyzed. You treat all difficult terrain as normal terrain.',
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
        name: 'Elemental Strike',
        type: 'melee',
        bonus: 34,
        damage: '4d12 bludgeoning plus 4d6 energy (choose type)',
        traits: ['reach'],
        range: 25
      }
    ],
    abilities: [
      {
        name: 'Elemental Attunement',
        description: 'Choose air, earth, fire, or water when you transform. You gain immunity to your chosen element and weakness 15 to the opposing element.',
        traits: []
      },
      {
        name: 'Elemental Surge',
        description: 'Once per round, you can release a 60-foot line or 30-foot cone of your chosen element, dealing 10d6 damage of your element\'s type (basic Reflex save).',
        traits: []
      },
      {
        name: 'Primal Aura',
        description: 'You emanate an aura of your element in a 30-foot emanation. Creatures of your element are quickened 1, while creatures vulnerable to your element are slowed 1.',
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
        name: 'Constrict',
        type: 'melee',
        bonus: 34,
        damage: '6d6 bludgeoning plus 2d6 poison',
        traits: []
      },
      {
        name: 'Tail Lash',
        type: 'melee',
        bonus: 34,
        damage: '6d8 bludgeoning',
        traits: ['reach'],
        range: 40
      }
    ],
    abilities: [
      {
        name: 'Primordial Toxin',
        description: 'Your bite and constrict deliver a potent poison that deals 4d6 persistent poison damage on a failed Fortitude save.',
        traits: ['poison']
      },
      {
        name: 'Coils of the World',
        description: 'You can Grab creatures up to Huge size. While you have a creature grabbed, you can use Constrict on it as a single action.',
        traits: []
      },
      {
        name: 'Swallow Whole',
        description: 'Large or smaller creatures you have grabbed can be swallowed. Swallowed creatures take 6d6 bludgeoning and 6d6 acid damage each round.',
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

