// GM Core p. 309, Advancing a Relic / Adjusting Treasure. Os marcos são os níveis típicos da campanha.
import { RELIC_BOOKS, RELIC_OPTIONS, type RelicOption } from './relicOptions'

export const RELIC_STAGES = [
    { level: 1, tier: 'minor', gp: 20 }, { level: 5, tier: 'minor', gp: 160 },
    { level: 9, tier: 'major', gp: 700 }, { level: 13, tier: 'major', gp: 3000 },
    { level: 17, tier: 'grand', gp: 15000 },
] as const

export interface PlayerRelic {
    id?: string
    legacyId?: string
    aspects: string[]
    gifts: Record<string, string>
    levels?: Record<string, number>
    allowEtching?: boolean
}
export interface PublishedRelic {
    key: string
    section: 'weapons' | 'armor' | 'equipment'
    index: number
    name: string
    seed: PlayerRelic
    etched: string[]
}

export const RELIC_ASPECTS = [...new Set(RELIC_OPTIONS.flatMap((g) => g.aspects))].sort()
export const LEGACY_RELIC_ASPECTS = new Set(RELIC_ASPECTS.filter((aspect) =>
    RELIC_OPTIONS.filter((g) => g.aspects.includes(aspect)).every((g) => RELIC_BOOKS[g.sourceId ?? 218].legacy)))
const byId = new Map(RELIC_OPTIONS.map((g) => [g.id, g]))

export function chosenGifts(seed?: PlayerRelic) {
    return RELIC_STAGES.flatMap((stage) => {
        const gift = byId.get(seed?.gifts?.[stage.level] ?? '')
        return gift ? [{ ...stage, slot: stage.level, level: seed?.levels?.[stage.level] ?? stage.level, gift }] : []
    })
}

export function activeRuneGifts(seed: PlayerRelic | undefined, level: number, host: RelicOption['host']) {
    return chosenGifts(seed).flatMap((s) => s.level <= level && s.gift.rune && s.gift.host === host ? [s.gift] : [])
}

/** GM Core pp. 224–225 e 309. Em relíquias com gravação, os encaixes são compartilhados.
 * Preserve a ordem da bancada: primeiro as runas gravadas, depois as dádivas despertas na ordem dos marcos. */
export function relicRuneCapacity(seed: PlayerRelic | undefined, level: number, host: RelicOption['host'], slots: number, etched: string[]) {
    const gifts = activeRuneGifts(seed, level, host)
    const used = etched.length + (seed?.allowEtching ? gifts.length : 0)
    const permittedEtched = !seed || seed.allowEtching || seed.legacyId
    return {
        gifts, used,
        activeEtched: !permittedEtched ? [] : seed ? etched.slice(0, slots) : etched,
        activeGifts: seed?.allowEtching ? gifts.slice(0, Math.max(0, slots - etched.length)) : gifts,
    }
}

/** Um upload pode trazer qualquer JSON em covil. Ignore referências inválidas antes de ler as escolhas na Ficha. */
export function publishedRelics(build: import('./types').BuildInfo): PublishedRelic[] {
    const rows = build.covil?.relics
    if (!Array.isArray(rows)) return []
    return rows.slice(0, 300).filter((r) => r && typeof r.key === 'string' && typeof r.name === 'string' &&
        ['weapons', 'armor', 'equipment'].includes(r.section) && Number.isInteger(r.index) && r.index >= 0 &&
        Array.isArray(build[r.section]) && r.index < build[r.section].length &&
        (r.seed?.legacyId === undefined || typeof r.seed.legacyId === 'string') &&
        (!r.seed?.levels || (typeof r.seed.levels === 'object' && Object.values(r.seed.levels).every((l) => Number.isInteger(l) && l >= 1 && l <= 20))) &&
        Array.isArray(r.seed?.aspects) && r.seed.aspects.every((a) => typeof a === 'string') &&
        r.seed.gifts && typeof r.seed.gifts === 'object' && !Array.isArray(r.seed.gifts) &&
        Array.isArray(r.etched) && r.etched.every((id) => typeof id === 'string'))
}
