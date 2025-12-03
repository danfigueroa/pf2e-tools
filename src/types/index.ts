// Core types for the Pathfinder 2e tools system

export interface Ability {
    name: string
    description: string
    traits?: string[]
}

export interface Speed {
    land?: number
    fly?: number
    swim?: number
    climb?: number
    burrow?: number
}

export interface Senses {
    darkvision?: number
    lowLightVision?: boolean
    scent?: number
    tremorsense?: number
    truesight?: number
    blindsight?: number
}

export interface AbilityScores {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
}

export interface SavingThrows {
    fortitude: number
    reflex: number
    will: number
}

export interface Skills {
    [skillName: string]: number
}

export interface Attack {
    name: string
    bonus: number
    damage: string
    traits?: string[]
    range?: number
    type: 'melee' | 'ranged'
}

export interface StatBlock {
    name: string
    level: number
    traits: string[]
    perception: number
    languages: string[]
    skills: Skills
    abilityScores: AbilityScores
    items: string[]
    ac: number
    savingThrows: SavingThrows
    hp: number
    immunities?: string[]
    resistances?: { [damageType: string]: number }
    weaknesses?: { [damageType: string]: number }
    speed: Speed
    attacks: Attack[]
    abilities: Ability[]
    senses: Senses
    size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'
    rarity: 'Common' | 'Uncommon' | 'Rare' | 'Unique'
    alignment: string
    creatureType: string
}

export interface TransformationSpell {
    id: string
    name: string
    level: number
    school: string
    traditions: string[]
    cast: string
    range: string
    targets: string
    duration: string
    description: string
    heightened?: { [level: number]: string }
    forms: TransformationForm[]
}

export interface TransformationForm {
    id: string
    name: string
    size: StatBlock['size']
    speed: Speed
    attacks: Attack[]
    abilities: Ability[]
    senses: Senses
    abilityModifiers?: Partial<AbilityScores>
    acBonus?: number
    hpBonus?: number
    resistances?: { [damageType: string]: number }
    immunities?: string[]
    weaknesses?: { [damageType: string]: number }
    traits?: string[]
    requirements?: string
    description: string
}

export interface PlayerCharacter {
    name: string
    level: number
    class: string
    ancestry: string
    background: string
    abilityScores: AbilityScores
    skills: Skills
    proficiencyBonus: number
    classFeatures: string[]
    equipment: string[]
    baseHP?: number
}

export interface TransformationConfig {
    spell: TransformationSpell
    selectedForm: TransformationForm | undefined
    casterLevel: number
    character: PlayerCharacter
}

export interface ExportOptions {
    format: 'pdf' | 'png' | 'jpg'
    includeBackground: boolean
    paperSize: 'A4' | 'Letter' | 'Custom'
}
