// Lazy fetch + localStorage cache for AON descriptions.
// Compartilhado entre módulos (PDF e Ficha Virtual). Cada função é uma
// chamada batch de tamanho 1 — o backend já dedupa e cacheia em memória.

import { useSyncExternalStore } from 'react'
import type { FeatDescription, SpellDescription, CompanionStats } from '../pathbuilder/types'
import { stateApi } from './mesa'
import { applyFix, subscribeFixes, type FixKind } from './translationFixes'

// v10: talentos/habilidades/itens passaram a ser objetos estruturados e param
// de ser cacheados quando a tradução falha (translationPending). A troca de
// versão descarta as descrições em inglês que a v9 gravou de forma permanente.
// v12: bastões ganharam o bloco `staff` (magias do degrau) e a resolução por
// nome deixou de descartar o qualificador — o que estava em cache aponta para o
// item base ("Staff of Healing" no lugar do Greater) e precisa ser descartado.
// v13: o AON parou de mandar o "---" no `text`; as magias chegavam sem entradas
// de heightening e com o cabeçalho colado na prosa. Agora vêm do `markdown`, com
// `scaling` (os números por rank) — o cache antigo não tem nem um nem outro.
// Os pacotes pré-traduzidos (`public/descriptions/`, e o da ficha publicada) carregam a versão com que foram gerados:
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

const isFixKind = (kind: Kind): kind is FixKind => kind !== 'companion'

/** A descrição com a correção de tradução da mesa por cima, quando há. */
function fixed<T>(kind: Kind, name: string, value: T | null): T | null {
    return value && isFixKind(kind) ? applyFix(kind, name, value as object) as T : value
}

function readCache<T>(kind: Kind, name: string): T | null {
    return fixed(kind, name, readRaw<T>(kind, name))
}

function readRaw<T>(kind: Kind, name: string): T | null {
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

// Correção de tradução nova (daqui ou de outro aparelho) muda o que o cache devolve.
subscribeFixes(() => {
    cacheVersion++
    cacheListeners.forEach((l) => l())
})

/** Muda a cada descrição gravada no cache (ou correção de tradução) — para re-renderizar quem lê dele. */
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
    return fixed(kind, name, result)
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
    return fixed('spell', name, result)
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
        unique.filter((n) => !readRaw<SpellDescription>('spell', n))

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
/** A descrição já está pronta neste aparelho (memória ou `localStorage`)? */
export function hasCachedDescription(kind: 'feat' | 'spell' | 'special' | 'item', name: string): boolean {
    return readRaw(kind, name) !== null
}

// --- Pacotes pré-traduzidos ---------------------------------------------------
//
// O elenco é pequeno e o que cada ficha descreve (magias, talentos,
// habilidades, itens) muda pouco, então tudo é resolvido e traduzido UMA vez e
// entregue pronto, por dois caminhos:
//   - estático (`/descriptions/<slug>.json`, CDN), gerado por
//     `scripts/build-description-bundle.mjs` para os presets do repositório;
//   - o da ficha PUBLICADA (`api/_lib/sheet-descriptions.js`, Redis), que o
//     servidor mantém sozinho — é por ela que chega um level-up.
// Os dois entram no cache em memória — o mesmo que as abas, o drawer e o
// Spellstrike leem —, então ninguém mais precisa saber de onde a descrição
// veio. Só na memória: o arquivo já tem o cache HTTP, e copiar centenas de
// entradas para o localStorage gastaria a cota à toa.
//
// Pacote ausente, de outra versão ou quebrado é ignorado em silêncio: a
// descrição segue pela API, como antes.

type BundleKind = Extract<Kind, 'spell' | 'feat' | 'special' | 'item'>
const BUNDLE_KINDS: BundleKind[] = ['spell', 'feat', 'special', 'item']

type Entries = Partial<Record<BundleKind, Record<string, { description?: unknown; translationPending?: boolean } | undefined>>>

/** Põe descrições prontas no cache em memória (sem sobrescrever) e avisa quem desenha dele. */
function seedEntries(entries: Entries | undefined): number {
    if (!entries || typeof entries !== 'object') return 0
    let added = 0
    for (const kind of BUNDLE_KINDS) {
        const bag = entries[kind]
        if (!bag || typeof bag !== 'object') continue
        for (const [name, entry] of Object.entries(bag)) {
            if (!entry || !isValidString(entry.description) || entry.translationPending) continue
            const k = key(kind, name)
            if (memory.has(k)) continue
            memory.set(k, entry)
            added++
        }
    }
    if (added > 0) {
        cacheVersion++
        cacheListeners.forEach((l) => l())
    }
    return added
}

const bundles = new Map<string, Promise<void>>()

/** Carrega (uma vez por sessão) o pacote estático do personagem. */
export function loadDescriptionBundle(slug: string): Promise<void> {
    if (!slug) return Promise.resolve()
    let loading = bundles.get(slug)
    if (!loading) {
        loading = fetchDescriptionBundle(slug)
        bundles.set(slug, loading)
    }
    return loading
}

async function fetchDescriptionBundle(slug: string): Promise<void> {
    try {
        const r = await fetch(`/descriptions/${encodeURIComponent(slug)}.json`)
        // Sem o arquivo, o servidor devolve o index.html do SPA: o `json()` falha e cai no catch.
        if (!r.ok) return
        const body = (await r.json()) as { version?: unknown; entries?: Entries }
        if (body.version === CACHE_VERSION) seedEntries(body.entries)
    } catch {
        // Pacote é atalho, nunca requisito.
    }
}

// --- Da ficha PUBLICADA (Redis) ---------------------------------------------------
//
// Abrir a ficha lê tudo num GET só. Se faltar algo — ficha recém-publicada,
// talento ou magia nova do nível 11 —, este aparelho pede ao servidor que
// complete (só o que falta vai à AON e ao LLM; com trava, um aparelho por vez)
// e recebe o novo na resposta. Os próximos já acham tudo lá.

export type DescriptionNameLists = Record<BundleKind, string[]>

interface SheetBundle {
    version?: unknown
    entries?: Entries
    misses?: Partial<Record<BundleKind, Record<string, unknown>>>
}

/**
 * Rodadas de "completa o que falta", cada uma dentro do `maxDuration` da
 * função (~30 s de trabalho). A primeira montagem de uma ficha inteira (~100
 * descrições) leva algumas; o laço para sozinho quando uma rodada não avança.
 */
const SHEET_ROUNDS = 12
const sheetBundles = new Map<string, Promise<void>>()

/**
 * Andamento da montagem neste aparelho, para a faixa da ficha publicada avisar
 * "preparando…" e "prontas". Só existe quando ESTE aparelho completou algo —
 * abrir uma ficha já pronta não mostra nada.
 */
export type SheetDescriptionsStatus =
    | { state: 'building'; remaining: number | null }
    | { state: 'done' }
    | { state: 'incomplete'; remaining: number }

const sheetStatus = new Map<string, SheetDescriptionsStatus>()
const sheetStatusListeners = new Set<() => void>()

function setSheetStatus(slug: string, status: SheetDescriptionsStatus | null) {
    if (status) sheetStatus.set(slug, status)
    else sheetStatus.delete(slug)
    sheetStatusListeners.forEach((l) => l())
}

export function useSheetDescriptionsStatus(slug: string | null): SheetDescriptionsStatus | null {
    return useSyncExternalStore(
        (listener) => { sheetStatusListeners.add(listener); return () => { sheetStatusListeners.delete(listener) } },
        () => (slug ? sheetStatus.get(slug) ?? null : null),
    )
}

/** Lê (e, se faltar algo, completa) as descrições traduzidas da ficha publicada `slug`. */
export function loadSheetDescriptions(slug: string, names: DescriptionNameLists): Promise<void> {
    const total = BUNDLE_KINDS.reduce((sum, kind) => sum + names[kind].length, 0)
    if (!slug || total === 0) return Promise.resolve()
    // A lista entra na chave: publicar o nível 11 no meio da sessão pede de novo.
    const flight = `${slug}\n${BUNDLE_KINDS.map((kind) => [...names[kind]].sort().join('|')).join('\n')}`
    let loading = sheetBundles.get(flight)
    if (!loading) {
        loading = syncSheetDescriptions(slug, names)
        sheetBundles.set(flight, loading)
    }
    return loading
}

/**
 * O pacote da ficha publicada, já semeado no cache: `null` se ainda não há (ou é
 * de outra versão), `undefined` se o pedido falhou.
 */
async function fetchSheetBundle(slug: string): Promise<SheetBundle | null | undefined> {
    const r = await fetch(stateApi(`?sheetDescriptions=${encodeURIComponent(slug)}`))
    if (!r.ok) return undefined
    const { bundle } = (await r.json()) as { bundle: SheetBundle | null }
    const current = bundle?.version === CACHE_VERSION ? bundle : null
    seedEntries(current?.entries)
    return current
}

/** Releitura do pacote publicado: um level-up no meio da sessão traz descrições novas. */
const SHEET_READ_TTL_MS = 5 * 60_000
const sheetReads = new Map<string, { at: number; reading: Promise<void> }>()

/**
 * Só LÊ (um GET) as descrições prontas da ficha publicada `slug`, sem completar
 * o que falta — para quem não está com a ficha aberta, como o cartão da regra
 * que outro jogador compartilhou. Quem completa é a ficha.
 */
export function readSheetDescriptions(slug: string): Promise<void> {
    if (!slug) return Promise.resolve()
    const last = sheetReads.get(slug)
    if (last && Date.now() - last.at < SHEET_READ_TTL_MS) return last.reading
    const reading = fetchSheetBundle(slug).then(() => undefined, () => undefined)
    sheetReads.set(slug, { at: Date.now(), reading })
    return reading
}

async function syncSheetDescriptions(slug: string, names: DescriptionNameLists): Promise<void> {
    try {
        const current = await fetchSheetBundle(slug)
        if (current === undefined) return

        // O que o servidor ainda não tem (ou não achou há pouco, `misses`, e desistiu por um dia).
        const known = (kind: BundleKind, n: string) => !!current?.entries?.[kind]?.[n] || current?.misses?.[kind]?.[n] != null
        if (BUNDLE_KINDS.every((kind) => names[kind].every((n) => known(kind, n)))) return

        setSheetStatus(slug, { state: 'building', remaining: null })
        for (let round = 0; round < SHEET_ROUNDS; round++) {
            const res = await fetch(stateApi(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sheet-descriptions', char: slug, names, version: CACHE_VERSION }),
            })
            if (!res.ok) break
            const out = (await res.json()) as { busy?: boolean; added?: Entries; remaining?: number }
            // Outro aparelho já está completando: o dele chega a quem abrir depois.
            if (out.busy) { setSheetStatus(slug, null); return }
            const added = out.added
                ? BUNDLE_KINDS.reduce((sum, kind) => sum + Object.keys(out.added?.[kind] ?? {}).length, 0)
                : 0
            seedEntries(out.added)
            const remaining = out.remaining ?? 0
            if (remaining === 0) { setSheetStatus(slug, { state: 'done' }); return }
            // Sem progresso (tradutor fora do ar): para, e a próxima abertura tenta de novo.
            if (added === 0) { setSheetStatus(slug, { state: 'incomplete', remaining }); return }
            setSheetStatus(slug, { state: 'building', remaining })
        }
        if (sheetStatus.get(slug)?.state === 'building') setSheetStatus(slug, null)
    } catch {
        // Atalho, nunca requisito: a descrição segue pela API.
        if (sheetStatus.get(slug)?.state === 'building') setSheetStatus(slug, null)
    }
}
