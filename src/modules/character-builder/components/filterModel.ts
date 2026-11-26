import { tr } from '../../../i18n'
import type { RuleEntry } from '../rules/types'
import type { PrereqResult } from '../engine/prereqs'

// Filtros avançados do seletor do Criador: o que a lista tem (facetas) e o que a pessoa marcou. Puro, sem React.

export type ActionKey = '1' | '2' | '3' | 'reaction' | 'free' | 'none'
export type Edition = 'remaster' | 'legacy' | 'homebrew'
export type Eligible = 'all' | 'ok' | 'maybe'
export type SortKey = 'name' | 'level-asc' | 'level-desc'

export interface PickerFilterState {
    minLevel: number | null
    maxLevel: number | null
    /** Magias: os ranks marcados (0 = truque), qualquer um deles. */
    ranks: number[]
    rarities: string[]
    actions: ActionKey[]
    traits: string[]
    editions: Edition[]
    eligible: Eligible
    traditions: string[]
    cantrip: 'all' | 'only' | 'none'
    categories: string[]
    maxPrice: number | null
    sort: SortKey
}

export const EMPTY_FILTERS: PickerFilterState = {
    minLevel: null, maxLevel: null, ranks: [], rarities: [], actions: [], traits: [], editions: [], eligible: 'all',
    traditions: [], cantrip: 'all', categories: [], maxPrice: null, sort: 'name',
}

export const RARITY_KEYS = ['common', 'uncommon', 'rare', 'unique'] as const
export const ACTION_KEYS: ActionKey[] = ['1', '2', '3', 'reaction', 'free', 'none']
export const TRADITION_KEYS = ['arcane', 'divine', 'occult', 'primal'] as const

export const ACTION_LABEL: Record<ActionKey, string> = {
    '1': '◆', '2': '◆◆', '3': '◆◆◆', reaction: tr('↺ reação', '↺ reaction'), free: tr('◇ livre', '◇ free'), none: tr('sem ação', 'no action'),
}
export const EDITION_LABEL: Record<Edition, string> = { remaster: tr('Remaster', 'Remaster'), legacy: tr('Legado', 'Legacy'), homebrew: tr('Da mesa', 'Homebrew') }
export const SORT_LABEL: Record<SortKey, string> = { name: tr('Nome', 'Name'), 'level-asc': tr('Nível ↑', 'Level ↑'), 'level-desc': tr('Nível ↓', 'Level ↓') }

const RARITY_WORDS = new Set(['common', 'uncommon', 'rare', 'unique'])

/** Nível da entrada (magia: o rank; truque, 0). */
export const levelOf = (e: RuleEntry): number => e.spell?.cantrip ? 0 : e.level ?? e.spell?.rank ?? 0
const rarityOf = (e: RuleEntry) => (e.rarity ?? 'common').toLowerCase()
const actionOf = (e: RuleEntry): ActionKey => (e.actions ?? 'none') as ActionKey
const editionOf = (e: RuleEntry): Edition => (e.homebrew ? 'homebrew' : e.remaster ? 'remaster' : 'legacy')
const traitsOf = (e: RuleEntry) => (e.traits ?? []).filter((t) => !RARITY_WORDS.has(t.toLowerCase()))
const categoryOf = (e: RuleEntry) => e.item?.category?.trim() || ''

/** O que a lista oferece: só aparece no painel o filtro que separa alguma coisa. */
export interface Facets {
    minLevel: number
    maxLevel: number
    rarities: string[]
    actions: ActionKey[]
    traits: { name: string; count: number }[]
    editions: Edition[]
    spells: boolean
    traditions: string[]
    categories: string[]
    prices: boolean
}

export function facetsOf(list: RuleEntry[]): Facets {
    const levels = list.map(levelOf)
    const traitCount = new Map<string, number>()
    for (const e of list) for (const t of traitsOf(e)) traitCount.set(t, (traitCount.get(t) ?? 0) + 1)
    const set = <T,>(f: (e: RuleEntry) => T) => [...new Set(list.map(f))]
    const spells = list.some((e) => e.type === 'spell')
    return {
        minLevel: levels.length ? Math.min(...levels) : 0,
        maxLevel: levels.length ? Math.max(...levels) : 0,
        rarities: RARITY_KEYS.filter((r) => list.some((e) => rarityOf(e) === r)),
        actions: ACTION_KEYS.filter((a) => list.some((e) => actionOf(e) === a)),
        traits: [...traitCount].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
        editions: (['remaster', 'legacy', 'homebrew'] as Edition[]).filter((ed) => set(editionOf).includes(ed)),
        spells,
        traditions: spells ? TRADITION_KEYS.filter((t) => list.some((e) => (e.spell?.traditions ?? []).some((x) => x.toLowerCase() === t))) : [],
        categories: set(categoryOf).filter(Boolean).sort(),
        prices: list.some((e) => (e.item?.price?.gp ?? 0) > 0),
    }
}

/** Quantos filtros estão ligados (a ordenação não conta). */
export function activeCount(f: PickerFilterState): number {
    return [f.minLevel !== null || f.maxLevel !== null, f.ranks.length, f.rarities.length, f.actions.length, f.traits.length, f.editions.length,
        f.eligible !== 'all', f.traditions.length, f.cantrip !== 'all', f.categories.length, f.maxPrice !== null].filter(Boolean).length
}

/** A entrada passa nos filtros? `eligibility` = o resultado dos pré-requisitos, quando a lista avalia. */
export function passes(e: RuleEntry, f: PickerFilterState, eligibility?: PrereqResult): boolean {
    const lvl = levelOf(e)
    if (f.minLevel !== null && lvl < f.minLevel) return false
    if (f.maxLevel !== null && lvl > f.maxLevel) return false
    if (f.ranks.length && !f.ranks.includes(lvl)) return false
    if (f.rarities.length && !f.rarities.includes(rarityOf(e))) return false
    if (f.actions.length && !f.actions.includes(actionOf(e))) return false
    if (f.traits.length) {
        const have = new Set(traitsOf(e).map((t) => t.toLowerCase()))
        if (!f.traits.every((t) => have.has(t.toLowerCase()))) return false
    }
    if (f.editions.length && !f.editions.includes(editionOf(e))) return false
    if (f.eligible === 'ok' && eligibility && eligibility !== 'ok') return false
    if (f.eligible === 'maybe' && eligibility === 'fail') return false
    if (f.traditions.length && !(e.spell?.traditions ?? []).some((t) => f.traditions.includes(t.toLowerCase()))) return false
    if (f.cantrip === 'only' && !e.spell?.cantrip) return false
    if (f.cantrip === 'none' && e.spell?.cantrip) return false
    if (f.categories.length && !f.categories.includes(categoryOf(e))) return false
    if (f.maxPrice !== null && (e.item?.price?.gp ?? 0) > f.maxPrice) return false
    return true
}

export function compareBy(sort: SortKey): (a: RuleEntry, b: RuleEntry) => number {
    if (sort === 'level-asc') return (a, b) => levelOf(a) - levelOf(b)
    if (sort === 'level-desc') return (a, b) => levelOf(b) - levelOf(a)
    return () => 0
}
