// Lazy fetch + localStorage cache for AON descriptions.
// Compartilhado entre módulos (PDF e Ficha Virtual). Cada função é uma
// chamada batch de tamanho 1 — o backend já dedupa e cacheia em memória.

import { useSyncExternalStore } from 'react'
import type { FeatDescription, SpellDescription, CompanionStats } from '../modules/character-sheet/types'

// v10: talentos/habilidades/itens passaram a ser objetos estruturados e param
// de ser cacheados quando a tradução falha (translationPending). A troca de
// versão descarta as descrições em inglês que a v9 gravou de forma permanente.
// v12: bastões ganharam o bloco `staff` (magias do degrau) e a resolução por
// nome deixou de descartar o qualificador — o que estava em cache aponta para o
// item base ("Staff of Healing" no lugar do Greater) e precisa ser descartado.
// v13: o AON parou de mandar o "---" no `text`; as magias chegavam sem entradas
// de heightening e com o cabeçalho colado na prosa. Agora vêm do `markdown`, com
// `scaling` (os números por rank) — o cache antigo não tem nem um nem outro.
// O pacote pré-traduzido (`public/spells/`) carrega a versão com que foi gerado:
// subir esta constante faz o app ignorar os pacotes até alguém os regerar.
export const CACHE_VERSION = 'v13'

type Kind = 'feat' | 'spell' | 'special' | 'companion' | 'item'

// Backend que respondeu uma vez continua lá: a ficha não precisa perguntar de
// novo a cada vez que a página monta. Falha não é lembrada — o servidor pode
// subir depois (`npm run dev:api`) e a próxima montagem descobre.
let apiAvailable: Promise<boolean> | null = null

export function checkApiAvailable(): Promise<boolean> {
    if (!apiAvailable) {
        apiAvailable = probeApi()
        apiAvailable.then((ok) => { if (!ok) apiAvailable = null })
    }
    return apiAvailable
}

async function probeApi(): Promise<boolean> {
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

// Parse em memória na frente do localStorage, como em `gear.ts`. A lista de
// magias lê o cache de cada linha a cada render; sem isto, gastar um slot ou
// abrir o drawer refazia dezenas de `JSON.parse` de payloads de vários KB. De
// quebra, a mesma magia devolve sempre o mesmo objeto. Só guarda acerto: a
// ausência continua sendo conferida no localStorage, que é barato.
const memory = new Map<string, unknown>()

function readCache<T>(kind: Kind, name: string): T | null {
    const k = key(kind, name)
    if (memory.has(k)) return memory.get(k) as T
    try {
        const raw = localStorage.getItem(k)
        if (!raw) return null
        const value = JSON.parse(raw) as T
        memory.set(k, value)
        return value
    } catch {
        return null
    }
}

// Quem desenha a partir do cache (as linhas da aba de Magias) precisa saber
// quando ele ganha uma entrada: a seção é `memo` e não repinta só porque o
// drawer, que fez a busca, fechou.
let cacheVersion = 0
const cacheListeners = new Set<() => void>()

function subscribeCache(listener: () => void) {
    cacheListeners.add(listener)
    return () => { cacheListeners.delete(listener) }
}

/** Muda a cada descrição gravada no cache — para re-renderizar quem lê dele. */
export function useDescriptionCacheVersion(): number {
    return useSyncExternalStore(subscribeCache, () => cacheVersion)
}

function writeCache(kind: Kind, name: string, value: unknown) {
    const k = key(kind, name)
    memory.set(k, value)
    cacheVersion++
    cacheListeners.forEach((l) => l())
    try {
        localStorage.setItem(k, JSON.stringify(value))
    } catch {
        // quota exceeded — a memória segura a sessão
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
    const cached = readCache<FeatDescription>(kind, name)
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
    const cached = readCache<SpellDescription>('spell', name)
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
// O backend traduz o chunk inteiro numa chamada só (marcadores <<N>>), então o
// custo é por chunk e não por magia: o Gemini free (15 req/min, 4,2 s entre
// chamadas) levava ~10 s por magia quando eram uma ou duas chamadas cada.
// 6 cabe no TPM do Groq (fallback) e no maxDuration, e a barra avança a cada chunk.
const PREFETCH_CHUNK_SIZE = 6

export async function prefetchSpellDescriptions(
    names: string[],
    onProgress?: (done: number, total: number) => void,
): Promise<void> {
    const unique = Array.from(new Set(names))
    const notCached = () =>
        unique.filter((n) => !readCache<SpellDescription>('spell', n))

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
    const cached = readCache<CompanionStats>('companion', name)
    if (cached) return cached

    const result = await fetchOne<CompanionStats>('/api/companions', name, (data) => {
        const item = data[name] as CompanionStats | undefined
        return item ?? null
    })

    if (result) writeCache('companion', name, result)
    return result
}

export function getCachedFeat(name: string) {
    return readCache<FeatDescription>('feat', name)
}
export function getCachedSpecial(name: string) {
    return readCache<FeatDescription>('special', name)
}
export function getCachedSpell(name: string) {
    return readCache<SpellDescription>('spell', name)
}

// --- Pacote pré-traduzido ------------------------------------------------------
//
// As magias dos personagens da campanha mudam pouco, então são resolvidas e
// traduzidas UMA vez, por `scripts/build-spell-bundle.mjs`, e servidas como
// arquivo estático (`/spells/<slug>.json`, pelo CDN). Ao abrir a ficha o pacote
// entra no cache em memória — o mesmo que as linhas, o drawer e o Spellstrike
// leem —, então ninguém mais precisa saber de onde a magia veio. Fica só na
// memória: o arquivo já tem o cache HTTP, e copiá-lo para o localStorage
// gastaria a cota à toa.
//
// Pacote ausente, de outra versão ou quebrado é ignorado em silêncio: a magia
// segue pela API, como antes.

const bundles = new Map<string, Promise<void>>()

/** Carrega (uma vez por sessão) as magias pré-traduzidas do personagem. */
export function loadSpellBundle(slug: string): Promise<void> {
    if (!slug) return Promise.resolve()
    let loading = bundles.get(slug)
    if (!loading) {
        loading = fetchSpellBundle(slug)
        bundles.set(slug, loading)
    }
    return loading
}

async function fetchSpellBundle(slug: string): Promise<void> {
    try {
        const r = await fetch(`/spells/${encodeURIComponent(slug)}.json`)
        // Sem o arquivo, o servidor devolve o index.html do SPA: o `json()` falha e cai no catch.
        if (!r.ok) return
        const body = (await r.json()) as { version?: unknown; spells?: Record<string, SpellDescription | undefined> }
        if (body.version !== CACHE_VERSION || !body.spells || typeof body.spells !== 'object') return
        let added = false
        for (const [name, spell] of Object.entries(body.spells)) {
            if (!spell || !isValidString(spell.description) || spell.translationPending) continue
            const k = key('spell', name)
            if (memory.has(k)) continue
            memory.set(k, spell)
            added = true
        }
        if (added) {
            cacheVersion++
            cacheListeners.forEach((l) => l())
        }
    } catch {
        // Pacote é atalho, nunca requisito.
    }
}
