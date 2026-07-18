// Lazy fetch + localStorage cache for AON descriptions.
// Compartilhado entre módulos (PDF e Ficha Virtual). Cada função é uma
// chamada batch de tamanho 1 — o backend já dedupa e cacheia em memória.

import type { SpellDescription, CompanionStats } from '../modules/character-sheet/types'

const CACHE_VERSION = 'v7'

type Kind = 'feat' | 'spell' | 'special' | 'companion' | 'item'

export async function checkApiAvailable(): Promise<boolean> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        const r = await fetch('/api/health', { signal: controller.signal })
        clearTimeout(timeoutId)
        return r.ok
    } catch {
        return false
    }
}

function key(kind: Kind, name: string) {
    return `pf2e:${CACHE_VERSION}:${kind}:${name}`
}

function readCache<T>(kind: Kind, name: string, parse = false): T | null {
    try {
        const raw = localStorage.getItem(key(kind, name))
        if (!raw) return null
        return parse ? (JSON.parse(raw) as T) : (raw as unknown as T)
    } catch {
        return null
    }
}

function writeCache(kind: Kind, name: string, value: unknown) {
    try {
        const v = typeof value === 'string' ? value : JSON.stringify(value)
        localStorage.setItem(key(kind, name), v)
    } catch {
        // quota exceeded — silently ignore
    }
}

// Para evitar duplicar requisições simultâneas para o mesmo item
const inflight = new Map<string, Promise<unknown>>()

async function fetchOne<T>(
    endpoint: string,
    name: string,
    extract: (data: Record<string, unknown>) => T | null,
): Promise<T | null> {
    const flightKey = `${endpoint}:${name}`
    if (inflight.has(flightKey)) {
        return inflight.get(flightKey) as Promise<T | null>
    }

    const promise = (async () => {
        try {
            const r = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: [name] }),
            })
            if (!r.ok) return null
            const data = await r.json()
            return extract(data)
        } catch {
            return null
        } finally {
            inflight.delete(flightKey)
        }
    })()

    inflight.set(flightKey, promise)
    return promise
}

function isValidString(v: unknown): v is string {
    if (typeof v !== 'string') return false
    const t = v.trim()
    return t.length > 0 && t !== 'null' && t !== 'undefined'
}

export async function fetchFeatDescription(name: string): Promise<string | null> {
    const cached = readCache<string>('feat', name)
    if (cached) return cached

    const result = await fetchOne<string>('/api/feats', name, (data) => {
        const item = data[name] as { description?: unknown } | undefined
        return isValidString(item?.description) ? item!.description as string : null
    })

    if (result) writeCache('feat', name, result)
    return result
}

export async function fetchSpecialDescription(name: string): Promise<string | null> {
    const cached = readCache<string>('special', name)
    if (cached) return cached

    const result = await fetchOne<string>('/api/searches', name, (data) => {
        const item = data[name] as { description?: unknown } | undefined
        return isValidString(item?.description) ? item!.description as string : null
    })

    if (result) writeCache('special', name, result)
    return result
}

export async function fetchSpellDescription(name: string): Promise<SpellDescription | null> {
    const cached = readCache<SpellDescription>('spell', name, true)
    if (cached) return cached

    const result = await fetchOne<SpellDescription>('/api/spells', name, (data) => {
        const item = data[name] as SpellDescription | undefined
        if (!item || !isValidString(item.description)) return null
        return item
    })

    if (result) writeCache('spell', name, result)
    return result
}

// Pré-carrega todas as magias do personagem em chunks pequenos e sequenciais:
// um POST grande estouraria o timeout serverless (cada magia custa scraping AON
// + tradução Groq). Resultados vão para o mesmo cache usado por fetchSpellDescription.
const PREFETCH_CHUNK_SIZE = 5

export async function prefetchSpellDescriptions(
    names: string[],
    onProgress?: (done: number, total: number) => void,
): Promise<void> {
    const pending = Array.from(new Set(names)).filter(
        (n) => !readCache<SpellDescription>('spell', n, true),
    )
    const total = pending.length
    let done = 0
    onProgress?.(0, total)

    for (let i = 0; i < pending.length; i += PREFETCH_CHUNK_SIZE) {
        const chunk = pending.slice(i, i + PREFETCH_CHUNK_SIZE)
        try {
            const r = await fetch('/api/spells', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: chunk }),
            })
            if (r.ok) {
                const data = (await r.json()) as Record<string, SpellDescription | undefined>
                for (const name of chunk) {
                    const item = data[name]
                    if (item && isValidString(item.description)) writeCache('spell', name, item)
                }
            }
        } catch {
            // falha de rede num chunk não impede os demais
        }
        done += chunk.length
        onProgress?.(done, total)
    }
}

export async function fetchItemDescription(name: string): Promise<string | null> {
    const cached = readCache<string>('item', name)
    if (cached) return cached

    const result = await fetchOne<string>('/api/searches', name, (data) => {
        const item = data[name] as { description?: unknown } | undefined
        return isValidString(item?.description) ? item!.description as string : null
    })

    if (result) writeCache('item', name, result)
    return result
}

export async function fetchCompanionStats(name: string): Promise<CompanionStats | null> {
    const cached = readCache<CompanionStats>('companion', name, true)
    if (cached) return cached

    const result = await fetchOne<CompanionStats>('/api/companions', name, (data) => {
        const item = data[name] as CompanionStats | undefined
        return item ?? null
    })

    if (result) writeCache('companion', name, result)
    return result
}

export function getCachedFeat(name: string) {
    return readCache<string>('feat', name)
}
export function getCachedSpecial(name: string) {
    return readCache<string>('special', name)
}
export function getCachedSpell(name: string) {
    return readCache<SpellDescription>('spell', name, true)
}
