// Cliente da busca de aflições na AON (`/api/search?affliction=`).
//
// Mesma forma de `services/creatures.ts`: cache em memória e dedupe de
// requisições em voo. Sem `localStorage` e sem tradução envolvida.

import type { AfflictionDef } from '../modules/initiative-tracker/afflictions'

const cache = new Map<string, AfflictionDef[]>()
const inflight = new Map<string, Promise<AfflictionDef[]>>()

/** Nunca rejeita: a UI trata "não achei" e "deu erro" do mesmo jeito. */
export async function searchAfflictions(query: string, limit = 10): Promise<AfflictionDef[]> {
    const term = query.trim()
    if (term.length < 2) return []

    const key = `${term.toLowerCase()}:${limit}`
    const cached = cache.get(key)
    if (cached) return cached

    const pending = inflight.get(key)
    if (pending) return pending

    const request = (async (): Promise<AfflictionDef[]> => {
        try {
            const params = new URLSearchParams({ affliction: term, limit: String(limit) })
            const res = await fetch(`/api/search?${params}`)
            if (!res.ok) return []
            const data = (await res.json()) as { results?: AfflictionDef[] }
            const results = Array.isArray(data.results) ? data.results : []
            cache.set(key, results)
            return results
        } catch {
            return []
        } finally {
            inflight.delete(key)
        }
    })()

    inflight.set(key, request)
    return request
}
