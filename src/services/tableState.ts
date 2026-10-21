// Estado de jogo compartilhado da mesa: PV, slots de magia, foco e condições.
//
// O backend (`/api/state`) é a fonte da verdade; o `localStorage` fica como
// cache — pinta a ficha instantaneamente e mantém tudo funcionando quando não
// há banco configurado ou a rede cai. Um personagem é lido de uma vez só e
// gravado fatia a fatia, para dois jogadores editando coisas diferentes não se
// sobrescreverem.
//
// Leitura ao abrir a ficha e, depois, EM TEMPO REAL: cada escrita no banco é
// transmitida pelo Realtime do Supabase (canal privado `mesa:<mesa>:state`, por
// um trigger) e chega aqui já com o valor novo — o dano que o GM dá na
// Iniciativa aparece na ficha do jogador sozinho. Escrever continua sendo pelo
// `/api/state`: o servidor é o único que grava, com as validações de sempre.
// Sem Supabase (ou com o canal caído) o app volta ao de antes: sob demanda, com
// o botão "Atualizar".

import { currentMesa, mesaKey, stateApi } from './mesa'
import { authHeaderNow, currentUserId, getSupabase } from './supabase'

const CACHE_PREFIX = mesaKey('pf2e:table:v1:')

/** Espera entre a última edição e a subida — agrupa cliques repetidos num pip. */
const SAVE_DEBOUNCE_MS = 600

export type SyncPhase = 'idle' | 'loading' | 'saving' | 'offline'

export interface SyncStatus {
    phase: SyncPhase
    /** Última leitura bem-sucedida do servidor. */
    lastSyncedAt: number | null
    /** false = backend sem banco: o estado não sai deste aparelho. */
    storeReady: boolean
    /** O canal do Realtime está aberto: a mesa chega sozinha, sem "Atualizar". */
    live: boolean
}

/** Divide `"<slug>/<campo>"`. O campo pode conter `/`? Não — corta no primeiro. */
export function splitSyncKey(syncKey: string): { slug: string; field: string } {
    const at = syncKey.indexOf('/')
    if (at < 0) return { slug: syncKey, field: 'hp' }
    return { slug: syncKey.slice(0, at), field: syncKey.slice(at + 1) }
}

// --- Cache local -----------------------------------------------------------

const cacheKey = (slug: string, field: string) => `${CACHE_PREFIX}${slug}:${field}`

export function readLocal(slug: string, field: string): unknown | null {
    try {
        const raw = localStorage.getItem(cacheKey(slug, field))
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

export function writeLocal(slug: string, field: string, data: unknown): void {
    try {
        localStorage.setItem(cacheKey(slug, field), JSON.stringify(data))
    } catch {
        // quota excedida — o servidor continua sendo a fonte da verdade
    }
}

// --- Status ----------------------------------------------------------------

let status: SyncStatus = { phase: 'idle', lastSyncedAt: null, storeReady: true, live: false }
const statusListeners = new Set<(s: SyncStatus) => void>()

export const getStatus = (): SyncStatus => status

export function subscribeStatus(listener: (s: SyncStatus) => void): () => void {
    statusListeners.add(listener)
    return () => { statusListeners.delete(listener) }
}

function setStatus(patch: Partial<SyncStatus>) {
    status = { ...status, ...patch }
    statusListeners.forEach((l) => l(status))
}

// --- Snapshots por personagem ----------------------------------------------

type Snapshot = Record<string, unknown>

const snapshots = new Map<string, Snapshot>()
const snapshotListeners = new Map<string, Set<(s: Snapshot) => void>>()

/** Avisa os hooks de um personagem que chegou estado novo do servidor. */
export function subscribeSnapshot(slug: string, listener: (s: Snapshot) => void): () => void {
    let set = snapshotListeners.get(slug)
    if (!set) { set = new Set(); snapshotListeners.set(slug, set) }
    set.add(listener)
    return () => { set!.delete(listener) }
}

function publishSnapshot(slug: string, snapshot: Snapshot) {
    snapshots.set(slug, snapshot)
    snapshotListeners.get(slug)?.forEach((l) => l(snapshot))
}

// --- Edições locais por fatia ----------------------------------------------

// Duas instâncias do mesmo hook sobre a mesma fatia (o PV na Visão Geral e o
// Inventário que cura com uma poção) não se enxergavam: `saveField` só gravava.
// Este canal avisa as outras instâncias da mesma fatia de cada edição feita
// neste aparelho. Os acordeões do celular hoje montam só o aberto, mas as duas
// seções ainda coexistem durante a animação de trocar de acordeão.
const fieldListeners = new Map<string, Set<(data: unknown) => void>>()

export function subscribeField(slug: string, field: string, listener: (data: unknown) => void): () => void {
    const id = `${slug}/${field}`
    let set = fieldListeners.get(id)
    if (!set) { set = new Set(); fieldListeners.set(id, set) }
    set.add(listener)
    return () => { set!.delete(listener) }
}

// --- Leitura ---------------------------------------------------------------

// Mesmo padrão de dedupe de `descriptions.ts`: várias seções da ficha montam
// ao mesmo tempo e todas pedem o mesmo personagem.
const inflight = new Map<string, Promise<Snapshot>>()

/**
 * Todas as fatias de um personagem. Repetir a chamada durante a mesma montagem
 * reaproveita a requisição; `force` (botão "Atualizar") ignora o que já foi lido.
 */
export function loadCharacter(slug: string, force = false): Promise<Snapshot> {
    if (!force) {
        const cached = snapshots.get(slug)
        if (cached) return Promise.resolve(cached)
        const pending = inflight.get(slug)
        if (pending) return pending
    }

    setStatus({ phase: 'loading' })
    startRealtime()

    const promise = (async (): Promise<Snapshot> => {
        try {
            const r = await fetch(stateApi(`?char=${encodeURIComponent(slug)}`))
            if (!r.ok) throw new Error(String(r.status))
            const body = await r.json() as {
                fields?: Record<string, { data: unknown; updatedAt?: number }>
                storeReady?: boolean
            }
            const snapshot: Snapshot = {}
            Object.entries(body.fields ?? {}).forEach(([field, entry]) => {
                snapshot[field] = entry?.data
                noteSeen(`${slug}/${field}`, entry?.updatedAt)
            })
            // O que este aparelho editou e ainda não subiu é mais novo que o
            // servidor: sem isso, uma releitura no meio da edição (a reconexão
            // do Realtime, o "Atualizar") desfaria na tela o que vai ser gravado.
            for (const entry of pending.values()) {
                if (entry.slug === slug) snapshot[entry.field] = entry.data
            }
            publishSnapshot(slug, snapshot)
            setStatus({
                phase: 'idle',
                lastSyncedAt: Date.now(),
                storeReady: body.storeReady !== false,
            })
            return snapshot
        } catch {
            // Servidor fora do ar: o cache local segura a sessão.
            setStatus({ phase: 'offline' })
            return snapshots.get(slug) ?? {}
        } finally {
            inflight.delete(slug)
        }
    })()

    inflight.set(slug, promise)
    return promise
}

/**
 * Relê UMA fatia (1 comando no servidor) e a reaplica nos hooks abertos — o poll
 * leve do contador de ações do turno, que o GM zera da Iniciativa em outro
 * aparelho. Nunca atropela uma escrita local ainda na fila: o valor do servidor
 * seria anterior a ela. Devolve se mudou.
 */
export async function pullField(slug: string, field: string): Promise<boolean> {
    const id = `${slug}/${field}`
    if (pending.has(id)) return false
    try {
        const r = await fetch(stateApi(`?char=${encodeURIComponent(slug)}&field=${encodeURIComponent(field)}`))
        if (!r.ok) return false
        const body = await r.json() as { data?: unknown }
        // Escreveram aqui enquanto a resposta vinha: a escrita local é a mais nova.
        if (pending.has(id)) return false
        const data = body.data
        if (data === null || data === undefined) return false
        const current = readLocal(slug, field)
        if (JSON.stringify(current) === JSON.stringify(data)) return false
        writeLocal(slug, field, data)
        const snapshot = snapshots.get(slug)
        if (snapshot) snapshot[field] = data
        fieldListeners.get(id)?.forEach((l) => l(data))
        return true
    } catch {
        return false
    }
}

/** Botão "Atualizar": relê do servidor e reaplica em todos os hooks abertos. */
export async function refresh(slug: string): Promise<void> {
    await loadCharacter(slug, true)
}

// --- Escrita ---------------------------------------------------------------

const timers = new Map<string, ReturnType<typeof setTimeout>>()
/** Valor mais recente por fatia; a última edição da janela é a que sobe. */
const pending = new Map<string, { slug: string; field: string; data: unknown }>()

/**
 * Grava uma fatia. Otimista: o cache local é atualizado na hora e a subida é
 * agrupada, para um jogador clicando vários pips não render uma requisição
 * por clique.
 */
export function saveField(slug: string, field: string, data: unknown): void {
    writeLocal(slug, field, data)

    // Mantém o snapshot coerente com o que este aparelho acabou de fazer, para
    // um `loadCharacter` sem force não devolver o valor antigo.
    const snapshot = snapshots.get(slug)
    if (snapshot) snapshot[field] = data

    const id = `${slug}/${field}`
    fieldListeners.get(id)?.forEach((l) => l(data))
    pending.set(id, { slug, field, data })

    const existing = timers.get(id)
    if (existing) clearTimeout(existing)
    timers.set(id, setTimeout(() => { void flush(id) }, SAVE_DEBOUNCE_MS))
}

async function flush(id: string): Promise<void> {
    timers.delete(id)
    const entry = pending.get(id)
    if (!entry) return

    setStatus({ phase: 'saving' })
    try {
        const r = await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify({ char: entry.slug, field: entry.field, data: entry.data }),
        })
        if (!r.ok) throw new Error(String(r.status))
        const body = await r.json() as { storeReady?: boolean; updatedAt?: number }
        // A transmissão desta escrita (ou de uma anterior, atrasada) não pode
        // voltar a tela para trás.
        noteSeen(id, body.updatedAt)
        // Só descarta o pendente se ainda for o valor que subiu: uma edição
        // durante a requisição precisa continuar na fila.
        if (pending.get(id) === entry) pending.delete(id)
        setStatus({
            phase: 'idle',
            lastSyncedAt: Date.now(),
            storeReady: body.storeReady !== false,
        })
    } catch {
        // Fica pendente: a próxima edição da mesma fatia reagenda a subida.
        setStatus({ phase: 'offline' })
    }
}

/** Reenvia o que ficou pendente por falha de rede. */
export async function flushPending(): Promise<void> {
    await Promise.all(Array.from(pending.keys()).map((id) => flush(id)))
}

// --- Tempo real ------------------------------------------------------------

/** O `updatedAt` mais novo conhecido de cada fatia (`slug/campo`). */
const lastSeen = new Map<string, number>()

function noteSeen(id: string, updatedAt: number | undefined) {
    if (typeof updatedAt === 'number' && updatedAt > (lastSeen.get(id) ?? 0)) lastSeen.set(id, updatedAt)
}

/** O canal está aberto — quem faz poll (as ações do turno) pode parar. */
export const isLive = (): boolean => status.live

interface StateMessage { slug?: unknown; field?: unknown; data?: unknown; updatedAt?: unknown; by?: unknown }

/**
 * Uma escrita de outro aparelho, como o banco a transmitiu. Mesmas regras do
 * `pullField`: nunca atropela uma escrita local na fila, e nada mais velho que o
 * que já se tem entra.
 */
function applyRemote(msg: StateMessage) {
    const { slug, field, data, updatedAt, by } = msg
    if (typeof slug !== 'string' || typeof field !== 'string' || typeof updatedAt !== 'number') return
    if (data === undefined || data === null) return
    // O eco da própria escrita: a tela já mostra isso (e talvez algo mais novo).
    if (typeof by === 'string' && by === currentUserId()) return
    const id = `${slug}/${field}`
    if (pending.has(id)) return
    if (updatedAt <= (lastSeen.get(id) ?? 0)) return
    lastSeen.set(id, updatedAt)
    if (JSON.stringify(readLocal(slug, field)) === JSON.stringify(data)) return
    writeLocal(slug, field, data)
    const snapshot = snapshots.get(slug)
    if (snapshot) snapshot[field] = data
    // Um snapshot PARCIAL: os hooks de cada fatia ignoram os campos ausentes.
    snapshotListeners.get(slug)?.forEach((l) => l({ [field]: data }))
}

/** Relê os personagens abertos — o que mudou enquanto o canal estava fechado. */
function resync() {
    for (const slug of snapshots.keys()) void loadCharacter(slug, true)
}

let realtimeStarted = false
let hiddenSince: number | null = null

/**
 * Abre o canal da mesa uma vez, na primeira leitura de personagem. A cada
 * SUBSCRIBED — o primeiro e cada reconexão — relê os abertos (um GET por
 * personagem): transmissão perdida com o canal fechado não volta sozinha.
 */
function startRealtime() {
    if (realtimeStarted || typeof window === 'undefined') return
    realtimeStarted = true
    void getSupabase().then((client) => {
        if (!client) { realtimeStarted = false; return }
        client
            .channel(`mesa:${currentMesa.id}:state`, { config: { private: true } })
            .on('broadcast', { event: 'state' }, ({ payload }) => applyRemote(payload as StateMessage))
            .subscribe((state) => {
                const live = state === 'SUBSCRIBED'
                if (live !== status.live) setStatus({ live })
                // Inclusive a primeira: no celular o SDK pode chegar segundos
                // depois da leitura, e o que mudou nesse meio não seria visto.
                if (live) resync()
            })
    })
    // Celular que volta do bolso: o socket pode ter morrido sem avisar ainda.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { hiddenSince = Date.now(); return }
        if (hiddenSince !== null && Date.now() - hiddenSince > 10_000) resync()
        hiddenSince = null
    })
}
