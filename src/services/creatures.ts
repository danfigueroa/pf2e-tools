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

const cache = new Map<string, AonCreature[]>()
const inflight = new Map<string, Promise<AonCreature[]>>()

/** Busca criaturas por nome. Devolve `[]` em qualquer falha — a UI segue viva. */
export function searchCreatures(query: string, limit = 8): Promise<AonCreature[]> {
    const term = query.trim().toLowerCase()
    if (term.length < 2) return Promise.resolve([])

    const cacheKey = `${term}:${limit}`
    const cached = cache.get(cacheKey)
    if (cached) return Promise.resolve(cached)

    const pending = inflight.get(cacheKey)
    if (pending) return pending

    const request = (async () => {
        try {
            const r = await fetch(`/api/creature?q=${encodeURIComponent(term)}&limit=${limit}`)
            if (!r.ok) return []
            const data = (await r.json()) as { results?: AonCreature[] }
            const results = Array.isArray(data.results) ? data.results : []
            cache.set(cacheKey, results)
            return results
        } catch {
            return []
        } finally {
            inflight.delete(cacheKey)
        }
    })()

    inflight.set(cacheKey, request)
    return request
}
