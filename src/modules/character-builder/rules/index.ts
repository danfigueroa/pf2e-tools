// Consultas do Criador sobre os pacotes do catálogo. Cada função baixa só as listas de que precisa (MODELO-DE-DADOS §4).
import { loadRuleList, pruneRuleCache, rulesVersion } from './loader'
import type { RuleEntry, RuleSource } from './types'

export type { RuleEntry, RuleSource } from './types'

/** Mesmo slug do `rules-packages.js` (`feats/class/<slug>`). */
export const ruleListSlug = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const list = (path: string) => loadRuleList<RuleEntry[]>(path)

/** Lista que falta no pacote (classe sem talentos próprios, por exemplo) vira lista vazia, não erro. */
const optional = (path: string) => list(path).catch(() => [] as RuleEntry[])

/** Abre o catálogo da versão atual e limpa do aparelho as versões antigas. */
export async function openRules(): Promise<string> {
    const version = await rulesVersion()
    void pruneRuleCache(version)
    return version
}

export const classes = () => list('core/classes')
export const ancestries = () => list('core/ancestries')
export const heritages = () => list('core/heritages')
export const backgrounds = () => list('core/backgrounds')
export const classOptions = () => list('core/class-features')
export const deities = () => list('core/deities')
export const languages = () => list('core/languages')
export const archetypes = () => list('core/archetypes')
export const sources = () => loadRuleList<RuleSource[]>('core/sources')

export interface FeatQuery {
    className?: string
    ancestry?: string
    /** Heranças versáteis com talentos próprios (Nephilim, Aiuvarin…). */
    versatileHeritage?: string
    archetypes?: string[]
    general?: boolean
    skill?: boolean
    mythic?: boolean
    /** Teto de nível (inclusive). O pré-requisito não filtra: vira aviso no motor. */
    maxLevel?: number
}

/** Talentos das listas pedidas, sem repetir o que está em duas (classe e arquétipo), ordenados por nível e nome. */
export async function featsFor(query: FeatQuery): Promise<RuleEntry[]> {
    const paths = [
        query.className && `feats/class/${ruleListSlug(query.className)}`,
        query.ancestry && `feats/ancestry/${ruleListSlug(query.ancestry)}`,
        query.versatileHeritage && `feats/ancestry/${ruleListSlug(query.versatileHeritage)}`,
        ...(query.archetypes ?? []).map((archetype) => `feats/archetype/${ruleListSlug(archetype)}`),
        query.general && 'feats/general',
        query.skill && 'feats/skill',
        query.mythic && 'feats/mythic',
    ].filter((path): path is string => Boolean(path))
    const seen = new Set<string>()
    const out: RuleEntry[] = []
    for (const entries of await Promise.all(paths.map(optional))) {
        for (const entry of entries) {
            if (seen.has(entry.id) || (query.maxLevel !== undefined && (entry.level ?? 0) > query.maxLevel)) continue
            seen.add(entry.id)
            out.push(entry)
        }
    }
    return out.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))
}

export type Tradition = 'arcane' | 'divine' | 'occult' | 'primal'

/** Magias de uma tradição até um rank; `cantrips: false` tira os truques. Foco e rituais têm listas próprias. */
export async function spellsFor(tradition: Tradition, maxRank = 10, { cantrips = true } = {}): Promise<RuleEntry[]> {
    const entries = await list(`spells/${tradition}`)
    return entries.filter((entry) => (entry.spell?.rank ?? entry.level ?? 0) <= maxRank && (cantrips || !entry.spell?.cantrip))
}

export const focusSpells = () => list('spells/focus')
export const rituals = () => list('spells/rituals')

export type ItemList = 'weapons' | 'armor' | 'shields' | 'runes' | 'materials' | 'consumables' | 'worn' | 'held'
    | 'staves-wands' | 'gear' | 'relics'

/** Itens de uma lista, com teto de nível opcional. */
export async function itemsBy(kind: ItemList, maxLevel?: number): Promise<RuleEntry[]> {
    const entries = await list(`items/${kind}`)
    return maxLevel === undefined ? entries : entries.filter((entry) => (entry.level ?? 0) <= maxLevel)
}

/** Tabelas curadas (slots de magia, riqueza inicial, rótulos do export), geradas da AON. */
export const ruleTables = () => loadRuleList<{ spellSlots: unknown; wealth: unknown; exports: unknown }>('core/tables')
