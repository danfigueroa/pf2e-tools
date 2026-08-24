// Estado de jogo compartilhado da mesa: PV, slots de magia, foco e condições.
//
// O backend (`/api/state`) é a fonte da verdade; o `localStorage` fica como
// cache — pinta a ficha instantaneamente e mantém tudo funcionando quando não
// há Redis configurado ou a rede cai. Um personagem é lido de uma vez só
// (HGETALL) e gravado fatia a fatia, para dois jogadores editando coisas
// diferentes não se sobrescreverem.
//
// A sincronia é sob demanda: puxa ao abrir a ficha e no botão "Atualizar".
// Não há polling nem conexão persistente.

const CACHE_PREFIX = 'pf2e:table:v1:'

/** Espera entre a última edição e a subida — agrupa cliques repetidos num pip. */
const SAVE_DEBOUNCE_MS = 600

export type SyncPhase = 'idle' | 'loading' | 'saving' | 'offline'

export interface SyncStatus {
    phase: SyncPhase
    /** Última leitura bem-sucedida do servidor. */
    lastSyncedAt: number | null
    /** false = backend sem Redis: o estado não sai deste aparelho. */
    storeReady: boolean
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

let status: SyncStatus = { phase: 'idle', lastSyncedAt: null, storeReady: true }
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

    const promise = (async (): Promise<Snapshot> => {
        try {
            const r = await fetch(`/api/state?char=${encodeURIComponent(slug)}`)
            if (!r.ok) throw new Error(String(r.status))
            const body = await r.json() as {
                fields?: Record<string, { data: unknown }>
                storeReady?: boolean
            }
            const snapshot: Snapshot = {}
            Object.entries(body.fields ?? {}).forEach(([field, entry]) => {
                snapshot[field] = entry?.data
            })
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
        const r = await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ char: entry.slug, field: entry.field, data: entry.data }),
        })
        if (!r.ok) throw new Error(String(r.status))
        const body = await r.json() as { storeReady?: boolean }
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
