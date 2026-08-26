// Lazy fetch + localStorage cache for AON descriptions.
// Compartilhado entre módulos (PDF e Ficha Virtual). Cada função é uma
// chamada batch de tamanho 1 — o backend já dedupa e cacheia em memória.

import type { FeatDescription, SpellDescription, CompanionStats } from '../modules/character-sheet/types'

// v10: talentos/habilidades/itens passaram a ser objetos estruturados e param
// de ser cacheados quando a tradução falha (translationPending). A troca de
// versão descarta as descrições em inglês que a v9 gravou de forma permanente.
// v12: bastões ganharam o bloco `staff` (magias do degrau) e a resolução por
// nome deixou de descartar o qualificador — o que estava em cache aponta para o
// item base ("Staff of Healing" no lugar do Greater) e precisa ser descartado.
const CACHE_VERSION = 'v12'

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

// Talentos e habilidades seguem a mesma regra das magias: payload com
// translationPending ficou em inglês por falha transitória do tradutor — é
// exibido, mas NÃO vai para o cache, para ser retraduzido na próxima consulta.
// (Cachear o inglês era o motivo de a ficha ficar presa em inglês para sempre.)
async function fetchEntry(
    kind: Extract<Kind, 'feat' | 'special' | 'item'>,
    endpoint: string,
    name: string,
): Promise<FeatDescription | null> {
    const cached = readCache<FeatDescription>(kind, name, true)
    if (cached) return cached

    const result = await fetchOne<FeatDescription>(endpoint, name, (data) => {
        const item = data[name] as FeatDescription | undefined
        if (!item || !isValidString(item.description)) return null
        return item
    })

    if (result && !result.translationPending) writeCache(kind, name, result)
    return result
}

export function fetchFeatDescription(name: string) {
    return fetchEntry('feat', '/api/feats', name)
}

export function fetchSpecialDescription(name: string) {
    return fetchEntry('special', '/api/searches', name)
}

export async function fetchSpellDescription(name: string): Promise<SpellDescription | null> {
    const cached = readCache<SpellDescription>('spell', name, true)
    if (cached) return cached

    const result = await fetchOne<SpellDescription>('/api/spells', name, (data) => {
        const item = data[name] as SpellDescription | undefined
        if (!item || !isValidString(item.description)) return null
        return item
    })

    // translationPending = ficou em EN por falha transitória de tradução;
    // exibe mas não cacheia, para retraduzir na próxima consulta.
    if (result && !result.translationPending) writeCache('spell', name, result)
    return result
}

// Pré-carrega todas as magias do personagem em chunks pequenos e sequenciais:
// um POST grande estouraria o timeout serverless (cada magia custa scraping AON
// + tradução Groq). Resultados vão para o mesmo cache usado por fetchSpellDescription.
// 3, não 5: o tradutor primário (Gemini free) é limitado a 15 req/min, e uma
// magia pode custar mais de uma chamada (prosa + heightening fora do dicionário).
// Chunks menores mantêm cada POST dentro do maxDuration e a barra de progresso
// avançando com frequência.
const PREFETCH_CHUNK_SIZE = 3

export async function prefetchSpellDescriptions(
    names: string[],
    onProgress?: (done: number, total: number) => void,
): Promise<void> {
    const unique = Array.from(new Set(names))
    const notCached = () =>
        unique.filter((n) => !readCache<SpellDescription>('spell', n, true))

    let pending = notCached()
    const total = pending.length
    onProgress?.(0, total)

    // Até 3 passadas: resultados com translationPending (falha transitória de
    // tradução, ex. rate limit do Groq) não entram no cache e são retentados
    // na passada seguinte — o backend retraduz.
    for (let pass = 0; pass < 3 && pending.length > 0; pass++) {
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
                        if (item && isValidString(item.description) && !item.translationPending) {
                            writeCache('spell', name, item)
                        }
                    }
                }
            } catch {
                // falha de rede num chunk não impede os demais
            }
            onProgress?.(total - notCached().length, total)
        }
        const stillPending = notCached()
        if (stillPending.length >= pending.length) break // sem progresso — parar
        pending = stillPending
    }
    onProgress?.(total - notCached().length, total)
}

export function fetchItemDescription(name: string) {
    return fetchEntry('item', '/api/searches', name)
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
    return readCache<FeatDescription>('feat', name, true)
}
export function getCachedSpecial(name: string) {
    return readCache<FeatDescription>('special', name, true)
}
export function getCachedSpell(name: string) {
    return readCache<SpellDescription>('spell', name, true)
}
