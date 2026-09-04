// Tipos do módulo de escalar monstro.
//
// `MonsterDetail` é o que `/api/creature?name=` devolve: os números da AON com o DEGRAU
// de benchmark de cada um ao lado. `ScaledMonster` é o resultado da conta.

import type { ScaleColumn } from './data/creatureTables'

export type { ScaleColumn }

/** Número da ficha junto do degrau em que a AON o classificou. */
export interface ScaledStat {
    value: number
    scale: ScaleColumn | null
}

export interface ParsedDamage {
    /** `3d12+15`. `null` em golpe que não causa dano numérico ("attach"). */
    formula: string | null
    /** `piercing` */
    type: string | null
    /** `plus 2d6 fire` — nunca é reescalado. */
    riders: string | null
    raw: string
}

export interface ParsedStrike {
    category: 'melee' | 'ranged'
    name: string
    bonus: number
    actions: string | null
    traits: string[]
    damage: ParsedDamage | null
}

export interface ParsedAbility {
    name: string
    actions: string | null
    traits: string[]
    /** Prosa da AON, em inglês e intocada. */
    text: string
}

export interface SpellGroup {
    rank: string
    spells: string[]
}

export interface SpellcastingBlock {
    label: string
    dc: number | null
    attack: number | null
    groups: SpellGroup[]
}

export interface RecallEntry {
    label: string
    skill: string | null
    dc: number
}

export interface ParsedStatblock {
    traits: string[]
    sensesRaw: string | null
    languagesRaw: string | null
    skillsRaw: string | null
    itemsRaw: string | null
    speedRaw: string | null
    immunitiesRaw: string | null
    weaknessesRaw: string | null
    resistancesRaw: string | null
    strikes: ParsedStrike[]
    spellcasting: SpellcastingBlock[]
    abilities: ParsedAbility[]
    recallKnowledge: RecallEntry[]
}

export type AttributeKey =
    | 'strength' | 'dexterity' | 'constitution'
    | 'intelligence' | 'wisdom' | 'charisma'

export interface MonsterDetail {
    name: string
    level: number
    ac: ScaledStat
    hp: ScaledStat
    perception: ScaledStat
    saves: { fort: ScaledStat; ref: ScaledStat; will: ScaledStat }
    attributes: Record<AttributeKey, ScaledStat>
    /** Nome da perícia em minúsculas → modificador. */
    skills: Record<string, number>
    /** Um item por Strike, na ordem da ficha. */
    attackBonuses: number[]
    /** A AON COLAPSA repetições: quase sempre um item só, valendo para todos. */
    attackScales: (ScaleColumn | null)[]
    damageAverages: number[]
    damageScales: (ScaleColumn | null)[]
    spellDc: number | null
    spellDcScale: ScaleColumn | null
    spellAttack: number | null
    spellAttackScale: ScaleColumn | null
    traits: string[]
    size: string | null
    rarity: string | null
    family: string | null
    languages: string[]
    items: string[]
    speed: Record<string, number>
    sensesRaw: string | null
    resistances: Record<string, number>
    weaknesses: Record<string, number>
    immunities: string[]
    defenseNotes: string[]
    source: string | null
    url: string
    statblock: ParsedStatblock | null
}

/**
 * Chave de override. Estatísticas simples usam o próprio nome; as que existem
 * em série usam prefixo (`attack:0`, `skill:athletics`, `attr:strength`).
 */
export type StatKey = string

export type ScaleOverrides = Record<StatKey, ScaleColumn>

/** Uma linha do painel de ajuste. */
export interface ScaledRow {
    key: StatKey
    label: string
    /** Valor no nível original. */
    from: number
    /** Valor no nível-alvo. */
    to: number
    column: ScaleColumn | null
    /** A AON não classifica perícia: o degrau dela é deduzido do valor. */
    inferred: boolean
    /** Colunas disponíveis na tabela desta estatística. */
    columns: ScaleColumn[]
    kind: 'modifier' | 'flat'
    /**
     * Só nas linhas de dano: a fórmula tem que aparecer no painel, porque o
     * número (a média) não diz ao GM que `1d4+6` virou `2d6+8`.
     */
    formulaFrom?: string | null
    formulaTo?: string | null
}

/**
 * Habilidade com as CDs da prosa já no nível-alvo. O texto original fica junto
 * porque é ele que o `check-scaling` compara: reescalar para o próprio nível
 * tem que devolver a prosa idêntica.
 */
export interface ScaledAbility extends ParsedAbility {
    originalText: string
}

export interface ScaledStrike extends ParsedStrike {
    /** Bônus e dano já no nível-alvo. */
    damageFormula: string | null
    originalBonus: number
    originalFormula: string | null
}

export interface ScaledMonster {
    source: MonsterDetail
    level: number
    ac: number
    hp: number
    perception: number
    saves: { fort: number; ref: number; will: number }
    attributes: Record<AttributeKey, number>
    skills: Record<string, number>
    strikes: ScaledStrike[]
    spellcasting: SpellcastingBlock[]
    /** A prosa segue em inglês; só as CDs dentro dela acompanham o nível. */
    abilities: ScaledAbility[]
    resistances: Record<string, number>
    weaknesses: Record<string, number>
    /** Linhas do painel de ajuste, na ordem de exibição. */
    rows: ScaledRow[]
    /** O que a ferramenta NÃO ajustou e o GM precisa conferir. */
    warnings: string[]
}
