/* i18n-ignore-file */
// Tipos do motor (MOTOR-DE-REGRAS). TS puro: nada de React, rede nem `character-viewer/`, para o `check-builder` rodar.
import type { AttributeKey, RuleEntry } from '../rules/types'
import type { MesaRules } from '../types'
import type { BoostGroup } from './attributes'
import type { SkillSlot } from './skills'

export type { AttributeKey } from '../rules/types'

export const ATTRIBUTES: readonly AttributeKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** As 16 perícias e o atributo de cada uma (Player Core pg. 225, "Skills"). */
export const SKILL_ATTRIBUTE = {
    acrobatics: 'dex', arcana: 'int', athletics: 'str', crafting: 'int', deception: 'cha', diplomacy: 'cha',
    intimidation: 'cha', medicine: 'wis', nature: 'wis', occultism: 'int', performance: 'cha', religion: 'wis',
    society: 'int', stealth: 'dex', survival: 'wis', thievery: 'dex',
} as const satisfies Record<string, AttributeKey>
export type SkillKey = keyof typeof SKILL_ATTRIBUTE
export const SKILL_KEYS = Object.keys(SKILL_ATTRIBUTE) as SkillKey[]

/** Catálogo que o motor recebe: as entradas já baixadas, por id (`tipo:aon_id`). */
export interface RulesIndex {
    get(id: string | undefined): RuleEntry | undefined
    /** Idiomas comuns e do catálogo, para validar escolhas. */
    languages: RuleEntry[]
}

export interface CompileContext {
    rules: RulesIndex
    mesaRules?: MesaRules
}

export type WarningLevel = 'info' | 'warn' | 'error'

export interface Warning {
    code: string
    level: WarningLevel
    message: string
    /** Slot ou id envolvido (para o painel levar até a escolha). */
    ref?: string
}

/** Uma escolha que falta até o nível atual. */
export interface Pending {
    key: string
    label: string
    level: number
    /** Quantas ainda faltam no slot (boosts, perícias, idiomas). */
    missing: number
}

export interface BreakdownPart {
    label: string
    value: number
}

/** Um número com a memória de cálculo ("Treinado +3 · SAB +2"). */
export interface Stat {
    total: number
    parts: BreakdownPart[]
}

/** 0 destreinado … 4 lendário. */
export type Rank = 0 | 1 | 2 | 3 | 4

export interface AttributeResult {
    /** Modificador final. */
    mod: Record<AttributeKey, number>
    /** Boost parcial pendente (Player Core pg. 17). */
    partial: Record<AttributeKey, boolean>
    /** Grupos de boosts na forma do `breakdown` do export do Pathbuilder. */
    breakdown: {
        ancestryFree: AttributeKey[]
        ancestryBoosts: AttributeKey[]
        ancestryFlaws: AttributeKey[]
        backgroundBoosts: AttributeKey[]
        classBoosts: AttributeKey[]
        mapLevelledBoosts: Record<string, AttributeKey[]>
    }
}

export interface SkillResult {
    rank: Record<SkillKey, Rank>
    lores: { key: string; name: string; rank: Rank }[]
}

export interface Compiled {
    level: number
    attributes: AttributeResult
    skills: SkillResult
    stats: {
        hp: Stat
        ac: Stat
        fortitude: Stat
        reflex: Stat
        will: Stat
        perception: Stat
        classDC: Stat | null
        speed: Stat
    }
    proficiency: {
        perception: Rank
        fortitude: Rank
        reflex: Rank
        will: Rank
        classDC: Rank
        attacks: Partial<Record<'simple' | 'martial' | 'advanced' | 'unarmed', Rank>>
        defenses: Partial<Record<'light' | 'medium' | 'heavy' | 'unarmored', Rank>>
    }
    size: string | null
    senses: string[]
    languages: string[]
    /** Idiomas à escolha (INT do 1º nível + aumentos de INT). */
    languageSlots: number
    keyAttribute: AttributeKey | null
    pending: Pending[]
    warnings: Warning[]
    /** Chaves de `choices` que algum slot usa (as outras são órfãs). */
    usedChoices: string[]
    /** Para a tela: grupos de boosts, slots de perícia e treinos automáticos (de onde vieram). */
    boostGroups: BoostGroup[]
    skillSlots: SkillSlot[]
    automaticSkills: { ref: string; source: string }[]
}
