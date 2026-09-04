// Lista de magias da AON, para montar a lista de um monstro no escalar monstro.
//
// Mesmo desenho de `creatures.ts`: sem tradução por LLM (o endpoint devolve só
// campos estruturados do índice), cache de sessão em memória e dedupe de
// requisições em voo. O nome da magia fica em inglês — é a chave de busca na
// AON e o que o drawer de descrição consulta depois.

export interface AonSpell {
    name: string
    /** O RANK da magia (o índice chama de `level`). */
    rank: number
    /** `spell`, `cantrip` ou `focus`. */
    kind: string
    traditions: string[]
    traits: string[]
    rarity: string
    url: string
}

export interface SpellListFilters {
    tradition?: string | null
    /** Teto de rank: magia menor cabe em slot maior (é assim que se eleva). */
    maxRank?: number | null
    minRank?: number | null
    kind?: 'spell' | 'cantrip' | 'focus'
    /** Cursor em acertos do índice, como na busca de criaturas. */
    offset?: number
}

export interface SpellListResult {
    results: AonSpell[]
    total: number
    nextOffset: number
    hasMore: boolean
}

const EMPTY: SpellListResult = { results: [], total: 0, nextOffset: 0, hasMore: false }

const cache = new Map<string, SpellListResult>()
const inflight = new Map<string, Promise<SpellListResult>>()

export function searchSpellList(
    query: string,
    limit = 20,
    filters: SpellListFilters = {},
): Promise<SpellListResult> {
    const term = query.trim()
    const params = new URLSearchParams({ spells: '1', limit: String(limit) })
    if (term) params.set('q', term)
    if (filters.tradition) params.set('tradition', filters.tradition)
    if (filters.maxRank != null) params.set('maxRank', String(filters.maxRank))
    if (filters.minRank != null) params.set('minRank', String(filters.minRank))
    if (filters.kind) params.set('kind', filters.kind)
    if (filters.offset) params.set('offset', String(filters.offset))
    const cacheKey = params.toString()

    const cached = cache.get(cacheKey)
    if (cached) return Promise.resolve(cached)
    const pending = inflight.get(cacheKey)
    if (pending) return pending

    const request = (async () => {
        try {
            const r = await fetch(`/api/search?${cacheKey}`)
            if (!r.ok) return EMPTY
            const data = (await r.json()) as Partial<SpellListResult>
            const results = Array.isArray(data.results) ? data.results : []
            const result: SpellListResult = {
                results,
                total: typeof data.total === 'number' ? data.total : results.length,
                nextOffset: typeof data.nextOffset === 'number'
                    ? data.nextOffset
                    : (filters.offset ?? 0) + results.length,
                hasMore: data.hasMore === true,
            }
            cache.set(cacheKey, result)
            return result
        } catch {
            return EMPTY
        } finally {
            inflight.delete(cacheKey)
        }
    })()

    inflight.set(cacheKey, request)
    return request
}
