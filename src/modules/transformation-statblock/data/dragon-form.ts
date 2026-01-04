import type { TransformationSpell, TransformationForm } from '../../../types'

// Dragon Form - dragon battle forms
export const dragonForms: TransformationForm[] = [
    {
        id: 'black-dragon',
        name: 'Black Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            swim: 60,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d12 piercing plus 2d6 acid',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '60-foot line of acid dealing 11d6 acid damage (basic Reflex save).',
                traits: ['acid'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            acid: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet, swim 60 feet; resistance 10 acid; Melee jaws, Damage 2d12 piercing plus 2d6 acid; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 60-foot line, 11d6 acid damage.',
    },
    {
        id: 'blue-dragon',
        name: 'Blue Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            burrow: 20,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d10 piercing plus 1d12 electricity',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '80-foot line of electricity dealing 6d12 electricity damage (basic Reflex save).',
                traits: ['electricity'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            electricity: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet, burrow 20 feet; resistance 10 electricity; Melee jaws, Damage 2d10 piercing plus 1d12 electricity; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 80-foot line, 6d12 electricity damage.',
    },
    {
        id: 'green-dragon',
        name: 'Green Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            swim: 40,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d12 piercing plus 2d6 poison',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '30-foot cone of poison dealing 10d6 poison damage (basic Fortitude save).',
                traits: ['poison'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            poison: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet, swim 40 feet; resistance 10 poison; Melee jaws, Damage 2d12 piercing plus 2d6 poison; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 30-foot cone, 10d6 poison damage.',
    },
    {
        id: 'red-dragon',
        name: 'Red Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d12 piercing plus 2d6 fire',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '30-foot cone of fire dealing 10d6 fire damage (basic Reflex save).',
                traits: ['fire'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            fire: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet; resistance 10 fire; Melee jaws, Damage 2d12 piercing plus 2d6 fire; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 30-foot cone, 10d6 fire damage.',
    },
    {
        id: 'white-dragon',
        name: 'White Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            climb: 40,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '3d6 piercing plus 2d6 cold',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '30-foot cone of cold dealing 10d6 cold damage (basic Reflex save).',
                traits: ['cold'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            cold: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet, climb 40 feet (ice only); resistance 10 cold; Melee jaws, Damage 3d6 piercing plus 2d6 cold; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 30-foot cone, 10d6 cold damage.',
    },
    {
        id: 'brass-dragon',
        name: 'Brass Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            burrow: 20,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d12 piercing plus 2d6 fire',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '60-foot line of fire dealing 11d6 fire damage (basic Reflex save).',
                traits: ['fire'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            fire: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet, burrow 20 feet; resistance 10 fire; Melee jaws, Damage 2d12 piercing plus 2d6 fire; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 60-foot line, 11d6 fire damage.',
    },
    {
        id: 'bronze-dragon',
        name: 'Bronze Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            swim: 40,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d10 piercing plus 1d12 electricity',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '80-foot line of electricity dealing 6d12 electricity damage (basic Reflex save).',
                traits: ['electricity'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            electricity: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet, swim 40 feet; resistance 10 electricity; Melee jaws, Damage 2d10 piercing plus 1d12 electricity; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 80-foot line, 6d12 electricity damage.',
    },
    {
        id: 'copper-dragon',
        name: 'Copper Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            climb: 40,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d12 piercing plus 2d6 acid',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '60-foot line of acid dealing 10d6 acid damage (basic Reflex save).',
                traits: ['acid'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            acid: 10,
        },
        description:
            'Speed 40 feet, fly 100 feet, climb 40 feet (stone only); resistance 10 acid; Melee jaws, Damage 2d12 piercing plus 2d6 acid; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 60-foot line, 10d6 acid damage.',
    },
    {
        id: 'gold-dragon',
        name: 'Gold Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
            swim: 40,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d12 piercing plus 2d6 fire',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '30-foot cone of fire dealing 10d6 fire damage (basic Reflex save).',
                traits: ['fire'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            fire: 10,
        },
        weaknesses: {
            cold: 5,
        },
        description:
            'Speed 40 feet, fly 100 feet, swim 40 feet; resistance 10 fire; weakness 5 cold; Melee jaws, Damage 2d12 piercing plus 2d6 fire; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 30-foot cone, 10d6 fire damage.',
    },
    {
        id: 'silver-dragon',
        name: 'Silver Dragon',
        size: 'Large',
        speed: {
            land: 40,
            fly: 100,
        },
        attacks: [
            {
                name: 'Jaws',
                type: 'melee',
                bonus: 22,
                damage: '2d12 piercing plus 2d6 cold',
                traits: [],
            },
            {
                name: 'Claw',
                type: 'melee',
                bonus: 22,
                damage: '3d10 slashing',
                traits: ['agile'],
            },
            {
                name: 'Tail',
                type: 'melee',
                bonus: 20,
                damage: '3d10 bludgeoning',
                traits: ['reach'],
                range: 10,
            },
        ],
        abilities: [
            {
                name: 'Breath Weapon',
                description:
                    '30-foot cone of cold dealing 10d6 cold damage (basic Reflex save).',
                traits: ['cold'],
            },
        ],
        senses: {
            darkvision: 60,
            scent: 60,
        },
        resistances: {
            cold: 10,
        },
        weaknesses: {
            fire: 5,
        },
        description:
            'Speed 40 feet, fly 100 feet; resistance 10 cold; weakness 5 fire; Melee jaws, Damage 2d12 piercing plus 2d6 cold; Melee claw (agile), Damage 3d10 slashing; Melee tail (reach 10 feet), Damage 3d10 bludgeoning; breath weapon 30-foot cone, 10d6 cold damage.',
    },
]

export const dragonFormSpell: TransformationSpell = {
    id: 'dragon-form',
    name: 'Dragon Form',
    level: 6,
    school: 'transmutation',
    traditions: ['arcane', 'primal'],
    cast: '2 actions',
    range: 'self',
    targets: 'you',
    duration: '1 minute',
    description:
        'Calling upon powerful transformative magic, you gain a Large dragon battle form. You must choose a dragon type when you cast this spell. You have hands in this battle form and can take manipulate actions. You gain the following statistics and abilities: AC = 18 + your level; 10 temporary HP; darkvision and scent (imprecise) 60 feet; resistance 10 to the damage type of your breath weapon; one or more unarmed melee attacks; Athletics modifier +22; fly Speed 100 feet.',
    heightened: {
        8: 'Your battle form is Huge, your fly Speed is 150 feet, your attacks have 15-foot reach. You instead gain AC = 21 + your level, 20 temporary HP, attack modifier +28, damage bonus +12, and Athletics +28.',
    },
    forms: dragonForms,
}
