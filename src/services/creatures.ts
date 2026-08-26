// Busca de criaturas na AON para o gerenciador de iniciativa.
//
// Diferente de `descriptions.ts`, aqui não há tradução por LLM envolvida: o
// endpoint devolve só campos estruturados do índice do AON. O cache é de
// sessão (memória) porque o GM costuma repetir a mesma busca dentro de um
// encontro, mas não faz sentido guardar no localStorage a lista de resultados
// de cada termo digitado.

export interface AonCreature {
    name: string
    /** Pode ser negativo (criaturas de nível -1). */
    level: number
    hp: number
    ac: number
    perception: number
    saves: { fort: number; ref: number; will: number }
    traits: string[]
    size: string | null
    rarity: string | null
    family: string | null
    /** Tipo de dano canônico em inglês → valor. */
    resistances: Record<string, number>
    weaknesses: Record<string, number>
    immunities: string[]
    /** Defesas com ressalva, que não viram número ("físico 5 exceto ferro frio"). */
    defenseNotes: string[]
    speed: Record<string, number>
    source: string | null
    url: string
}

export interface CreatureSearchFilters {
    /** Níveis aceitam negativo (criaturas de nível -1). `null` = sem limite. */
    minLevel?: number | null
    maxLevel?: number | null
    /**
     * Cursor da próxima página, contado em **acertos do índice** (não em
     * criaturas devolvidas): a deduplicação de legacy/reimpressões faz os dois
     * números divergirem. Use o `nextOffset` da página anterior.
     */
    offset?: number
}

export interface CreatureSearchResult {
    results: AonCreature[]
    /** Acertos no índice antes da deduplicação — serve para avisar que há mais. */
    total: number
    /** Cursor a mandar de volta para pedir a página seguinte. */
    nextOffset: number
    /** Resposta confiável para "acabou?" — `total` é anterior à deduplicação. */
    hasMore: boolean
}

const EMPTY: CreatureSearchResult = { results: [], total: 0, nextOffset: 0, hasMore: false }

const cache = new Map<string, CreatureSearchResult>()
const inflight = new Map<string, Promise<CreatureSearchResult>>()

/**
 * Busca criaturas por nome, por faixa de nível, ou pelos dois.
 * Devolve vazio em qualquer falha — a UI segue viva.
 */
export function searchCreatures(
    query: string,
    limit = 8,
    filters: CreatureSearchFilters = {},
): Promise<CreatureSearchResult> {
    const term = query.trim().toLowerCase()
    const min = filters.minLevel ?? null
    const max = filters.maxLevel ?? null
    const offset = Math.max(filters.offset ?? 0, 0)

    // Sem nome e sem faixa não há o que buscar (e o backend recusaria).
    if (term.length < 2 && min === null && max === null) return Promise.resolve(EMPTY)

    const params = new URLSearchParams({ limit: String(limit) })
    if (term) params.set('q', term)
    if (min !== null) params.set('minLevel', String(min))
    if (max !== null) params.set('maxLevel', String(max))
    if (offset > 0) params.set('offset', String(offset))
    const cacheKey = params.toString()

    const cached = cache.get(cacheKey)
    if (cached) return Promise.resolve(cached)

    const pending = inflight.get(cacheKey)
    if (pending) return pending

    const request = (async () => {
        try {
            const r = await fetch(`/api/creature?${cacheKey}`)
            if (!r.ok) return EMPTY
            const data = (await r.json()) as Partial<CreatureSearchResult>
            const results = Array.isArray(data.results) ? data.results : []
            const result: CreatureSearchResult = {
                results,
                total: typeof data.total === 'number' ? data.total : 0,
                nextOffset: typeof data.nextOffset === 'number' ? data.nextOffset : offset + results.length,
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
