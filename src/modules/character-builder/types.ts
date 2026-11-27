/* i18n-ignore-file */
// Tipos do Criador: o BuildState (o que o jogador escolheu, gravado em `character_builds.state`), o cabeçalho que a
// API devolve e as regras de criação da mesa. Formato em docs/character-builder/MODELO-DE-DADOS.md §1–3.
// A forma aceita é a do `sanitize.ts` (par do `api/_lib/build-sanitize.js`).
import type { AttributeKey } from './rules/types'

export type { AttributeKey } from './rules/types'

export type VariantKey = 'freeArchetype' | 'ancestralParagon' | 'abp' | 'pwl' | 'dualClass' | 'gradualBoosts'

export type Choice =
    /** `name`: o nome do talento caseiro (`custom:`), o que o catálogo não tem e o Pathbuilder exportou. */
    | { id: string; qualifier?: string; name?: string }
    | { boosts: AttributeKey[] }
    | { skills: string[] }
    | { lore: string }
    | { value: string }

export interface InventoryEntry {
    key: string
    item: string
    qty: number
    container?: string
    worn?: boolean
    invested?: boolean
    equipped?: boolean
    acquired: 'bought' | 'given'
    runes?: { potency?: number; striking?: number; resilient?: number; reinforcing?: number; property?: string[] }
    material?: { id: string; grade?: 'low' | 'standard' | 'high' }
    weapon?: {
        attackAttribute?: AttributeKey
        extraTraits?: string[]
        extraDamage?: string[]
        large?: boolean
        increaseDice?: boolean
        overrides?: { attack?: number; damage?: number; proficiency?: number }
    }
    relic?: import('../../pathbuilder/playerRelic').PlayerRelic
    customName?: string
    /**
     * Números de um item caseiro (`custom:`) que entra nas contas: a arma ou armadura que o Pathbuilder exporta sem
     * estar no catálogo (o Braço Sônico, as vestes de uma relíquia). Sem isso, o caseiro é só o nome.
     */
    custom?: {
        /** `name`: o nome do item no Pathbuilder, quando o `customName` é o apelido ("Mirage Edge"). */
        weapon?: { name?: string; die: string; damageType: string; category: 'simple' | 'martial' | 'advanced' | 'unarmed'; range?: number }
        armor?: { category: 'unarmored' | 'light' | 'medium' | 'heavy'; ac: number; dexCap?: number }
    }
}

export interface CasterChoices {
    repertoire?: Record<string, string[]>
    signature?: string[]
    spellbook?: string[]
    prepared?: Record<string, string[]>
    bonusSlots?: Record<string, number>
}

export interface Adjustment {
    id: string
    label: string
    reason: string
    effect: {
        kind: 'resistance' | 'speed' | 'hp' | 'itemBonus' | 'proficiency' | 'sense' | 'language' | 'innateSpell'
        target?: string
        value?: number | string
    }
}

export interface CompanionChoice {
    key: string
    kind: 'animal' | 'familiar' | 'eidolon' | 'construct' | 'other'
    name: string
    type?: string
    choices: Record<string, Choice>
}

export interface BuildState {
    schema: 2
    rulesVersion: string
    name: string
    level: number
    xp: number
    options: {
        variants?: Partial<Record<VariantKey, boolean>>
        mythic?: { enabled: boolean; startLevel?: number; rank?: number }
        legacyRelics?: boolean
        separateKits?: boolean
    }
    origin: {
        ancestry?: string
        heritage?: string
        background?: string
        alternateBoosts?: boolean
        voluntaryFlaws?: AttributeKey[]
        languages?: string[]
        deity?: string
        sanctification?: 'holy' | 'unholy' | null
        /** Origem fora do catálogo (Android, Fleshwarp…), com o que o export diz dela; os ids são `custom:`. */
        custom?: {
            ancestry?: { name: string; hp?: number; size?: string; speed?: number }
            heritage?: { name: string }
            background?: { name: string }
        }
    }
    class: { id?: string; keyAttribute?: AttributeKey; dual?: string }
    choices: Record<string, Choice>
    manual: {
        attributeOverride?: Partial<Record<AttributeKey, number>>
        extraBoosts?: Record<string, AttributeKey[]>
        extraSkillIncreases?: Record<string, number>
        extraFeatSlots?: { level: number; kind: 'general' | 'class' | 'ancestry' | 'skill' }[]
        adjustments?: Adjustment[]
    }
    inventory: InventoryEntry[]
    money: { pp: number; gp: number; sp: number; cp: number }
    /** Livro de fórmulas (ids de item). */
    formulas: string[]
    spellcasting: Record<string, CasterChoices>
    companions: CompanionChoice[]
    details: { age?: string; gender?: string; pronouns?: string; ethnicity?: string; nationality?: string; portrait?: string }
    history: { at: string; by: string; note: string; kind: 'retrain' | 'override' | 'gm-grant' }[]
}

/** Cabeçalho de um build como a API devolve (`?builds=1`; `?build=` traz também o `state`). */
export interface BuildHeader {
    id: string
    slug: string
    ownerId: string | null
    name: string
    className: string | null
    level: number
    rulesVersion: string
    rev: number
    createdAt: number | null
    updatedAt: number | null
    updatedBy: string | null
    publishedRev: number | null
    deletedAt: number | null
    /** O retrato do build (`details.portrait`); a lista usa quando a mesa ainda não tem o token. */
    portrait?: string | null
    /** Só na lista: nome de exibição do dono na mesa. */
    ownerName?: string | null
    canEdit?: boolean
}

export interface BuildRecord extends BuildHeader {
    state: BuildState
}

export type Rarity = 'allow' | 'ask' | 'deny'

export interface MesaVariants {
    freeArchetype: boolean
    mythic: { enabled: boolean; progression: 'level' | 'trials'; destinyAsArchetype?: boolean }
    ancestralParagon: boolean
    abp: boolean
    pwl: boolean
    dualClass: boolean
    gradualBoosts: boolean
}

export interface MesaRules {
    sources: { allow: string[]; deny?: string[]; legacy?: string[] }
    legacy: boolean
    rarity: { uncommon: Rarity; rare: Rarity }
    variants: MesaVariants
    startingLevel: number
    wealth: 'table' | 'free'
    exceptions: { buildId: string; ids: string[]; note?: string }[]
}
