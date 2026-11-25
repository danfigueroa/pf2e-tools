/* i18n-ignore-file */
// Regras de criação da mesa: forma e padrões. PAR de `DEFAULT_MESA_RULES`/`sanitizeMesaRules` em
// `api/_lib/build-store.js` (regra global 7); o `check-builder` confere os dois com os mesmos casos.
import type { MesaRules, Rarity } from './types'
import type { RuleEntry } from './rules/types'

const RARITY: readonly string[] = ['allow', 'ask', 'deny']
const SOURCE_RE = /^source:source-[0-9]{1,6}$/
const ID_RE = /^[a-z][a-z-]{0,30}:[a-z0-9][a-z0-9-]{0,60}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

type Obj = Record<string, unknown>

export const DEFAULT_MESA_RULES: MesaRules = Object.freeze({
    sources: { allow: [] },
    legacy: false,
    rarity: { uncommon: 'ask', rare: 'ask' },
    variants: {
        freeArchetype: false,
        mythic: { enabled: false, progression: 'level' },
        ancestralParagon: false,
        abp: false,
        pwl: false,
        dualClass: false,
        gradualBoosts: false,
    },
    startingLevel: 1,
    wealth: 'table',
    exceptions: [],
}) as MesaRules

const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const sourceList = (v: unknown): string[] => (Array.isArray(v)
    ? [...new Set(v.filter((s): s is string => typeof s === 'string' && SOURCE_RE.test(s)))].slice(0, 500) : [])
const rarity = (v: unknown, fallback: Rarity): Rarity => (typeof v === 'string' && RARITY.includes(v) ? v as Rarity : fallback)

/** As regras na forma aceita; o que falta ou não serve volta ao padrão. Nunca `null`. */
export function sanitizeMesaRules(input: unknown): MesaRules {
    const v = isObj(input) ? input : {}
    const d = DEFAULT_MESA_RULES
    const sources = isObj(v.sources) ? v.sources : {}
    const rar = isObj(v.rarity) ? v.rarity : {}
    const variants = isObj(v.variants) ? v.variants : {}
    const mythic = isObj(variants.mythic) ? variants.mythic : {}
    const deny = sourceList(sources.deny)
    return {
        sources: { allow: sourceList(sources.allow), ...(deny.length ? { deny } : {}),
            ...(Array.isArray(sources.legacy) ? { legacy: sourceList(sources.legacy) } : {}) },
        legacy: flag(v.legacy, d.legacy),
        rarity: { uncommon: rarity(rar.uncommon, d.rarity.uncommon), rare: rarity(rar.rare, d.rarity.rare) },
        variants: {
            freeArchetype: flag(variants.freeArchetype, false),
            mythic: {
                enabled: flag(mythic.enabled, false),
                progression: mythic.progression === 'trials' ? 'trials' : 'level',
                ...(typeof mythic.destinyAsArchetype === 'boolean' ? { destinyAsArchetype: mythic.destinyAsArchetype } : {}),
            },
            ancestralParagon: flag(variants.ancestralParagon, false),
            abp: flag(variants.abp, false),
            pwl: flag(variants.pwl, false),
            dualClass: flag(variants.dualClass, false),
            gradualBoosts: flag(variants.gradualBoosts, false),
        },
        startingLevel: typeof v.startingLevel === 'number' && Number.isInteger(v.startingLevel) && v.startingLevel >= 1 && v.startingLevel <= 20
            ? v.startingLevel : d.startingLevel,
        wealth: v.wealth === 'free' ? 'free' : 'table',
        exceptions: (Array.isArray(v.exceptions) ? v.exceptions : []).slice(0, 100).flatMap((e: unknown) => {
            if (!isObj(e) || typeof e.buildId !== 'string' || !UUID_RE.test(e.buildId)) return []
            const ids = Array.isArray(e.ids) ? [...new Set(e.ids.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)))].slice(0, 50) : []
            if (!ids.length) return []
            const note = typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, 200) : undefined
            return [{ buildId: e.buildId, ids, ...(note ? { note } : {}) }]
        }),
    }
}

/** A mesa escolheu livros? Lista vazia = o GM ainda não restringiu: nada é filtrado nem avisado por livro. */
export const restrictsSources = (rules: MesaRules) => rules.sources.allow.length > 0

/** Em regras antigas, o interruptor de legado usava a mesma lista de livros do Remaster. */
export function allowsLegacyBook(rules: MesaRules, source: string): boolean {
    return !(rules.sources.deny ?? []).includes(source) && (rules.sources.legacy !== undefined
        ? rules.sources.legacy.includes(source)
        : rules.legacy && (!restrictsSources(rules) || rules.sources.allow.includes(source)))
}

export function allowsBook(entry: Pick<RuleEntry, 'remaster' | 'source'>, rules: MesaRules): boolean {
    if (!entry.remaster) return allowsLegacyBook(rules, entry.source.id)
    return (!restrictsSources(rules) || rules.sources.allow.includes(entry.source.id)) && !(rules.sources.deny ?? []).includes(entry.source.id)
}

/** Liberado na mesa (livro, legado e raridade que não seja "negar")? `null` = sem regras da mesa (modo local). */
export function allowedAtTable(entry: Pick<RuleEntry, 'remaster' | 'rarity' | 'source'>, rules: MesaRules | null): boolean | null {
    if (!rules) return null
    // Conteúdo da mesa: foi o GM quem criou, então vale sempre.
    if (entry.source.id === 'mesa') return true
    const rarity = entry.rarity === 'uncommon' ? rules.rarity.uncommon : entry.rarity === 'rare' || entry.rarity === 'unique' ? rules.rarity.rare : 'allow'
    return allowsBook(entry, rules) && rarity !== 'deny'
}
