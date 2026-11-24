// Carrega os pacotes do catálogo (BASE-DE-REGRAS §5): Storage público por versão → cache no IndexedDB do aparelho
// (`pf2e:rules:<versão>:<lista>`, global, sem `mesaKey`) → `api/search.js?rules=` só se o Storage falhar.
// Nunca consulta a AON.
import { rulesVersionHint } from '../../../services/rulesVersion'
import type { RulesManifest } from './types'

const env = (import.meta.env ?? {}) as Partial<ImportMetaEnv>
const STORAGE = env.VITE_SUPABASE_URL ? `${env.VITE_SUPABASE_URL}/storage/v1/object/public/rules` : null
const DB_NAME = 'pf2e-rules'
const STORE = 'lists'
const LIST_RE = /^(core|feats|spells|items|companions|other)(\/[a-z0-9-]{1,60}){1,2}$/

const cacheKey = (version: string, list: string) => `pf2e:rules:${version}:${list}`

let dbPromise: Promise<IDBDatabase | null> | null = null

/** IndexedDB indisponível (aba privada, bloqueado) = só memória: o catálogo baixa de novo na próxima visita. */
function openDb(): Promise<IDBDatabase | null> {
    dbPromise ??= new Promise((resolve) => {
        try {
            const req = indexedDB.open(DB_NAME, 1)
            req.onupgradeneeded = () => req.result.createObjectStore(STORE)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => resolve(null)
        } catch {
            resolve(null)
        }
    })
    return dbPromise
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const db = await openDb()
    if (!db) return undefined
    return new Promise((resolve) => {
        try {
            const req = run(db.transaction(STORE, mode).objectStore(STORE))
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => resolve(undefined)
        } catch {
            resolve(undefined)
        }
    })
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<T>
}

/** Do Storage; se falhar, da rota de reserva (mesmo JSON). */
async function download<T>(version: string, list: string): Promise<T> {
    if (STORAGE) {
        try {
            return await fetchJson<T>(`${STORAGE}/${version}/${list}.json`)
        } catch {
            // segue para a reserva
        }
    }
    return fetchJson<T>(`/api/search?rules=${encodeURIComponent(list)}&v=${encodeURIComponent(version)}`)
}

let versionPromise: Promise<string> | null = null

/** Versão do catálogo: a do `?me=1`; sem ela (modo local), a do manifesto atual. */
export function rulesVersion(): Promise<string> {
    const hint = rulesVersionHint()
    if (hint) return Promise.resolve(hint)
    versionPromise ??= fetchJson<RulesManifest>('/api/search?rules=manifest').then((manifest) => manifest.version)
        .catch((error) => {
            versionPromise = null
            throw error
        })
    return versionPromise
}

const memory = new Map<string, Promise<unknown>>()

/** Uma lista do catálogo (`core/classes`, `feats/class/magus`…), da memória, do aparelho ou da rede. */
export function loadRuleList<T>(list: string, version?: string): Promise<T> {
    if (list !== 'core/tables' && list !== 'manifest' && !LIST_RE.test(list)) return Promise.reject(new Error(`lista inválida: ${list}`)) // i18n-ok: erro de programação, não vai para a tela
    const run = async () => {
        const v = version ?? await rulesVersion()
        const key = cacheKey(v, list)
        const cached = await idb<T>('readonly', (store) => store.get(key))
        if (cached !== undefined) return cached
        const data = await download<T>(v, list)
        await idb('readwrite', (store) => store.put(data, key))
        return data
    }
    const memoKey = `${version ?? ''}|${list}`
    let pending = memory.get(memoKey) as Promise<T> | undefined
    if (!pending) {
        pending = run().catch((error) => {
            memory.delete(memoKey)
            throw error
        })
        memory.set(memoKey, pending)
    }
    return pending
}

/** Apaga do aparelho as listas de versões que não são a atual (chamado depois de carregar a atual). */
export async function pruneRuleCache(current: string): Promise<void> {
    const keys = await idb<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
    const stale = (keys ?? []).filter((key) => typeof key === 'string' && key.startsWith('pf2e:rules:') && !key.startsWith(`pf2e:rules:${current}:`))
    for (const key of stale) await idb('readwrite', (store) => store.delete(key))
}
