// Estado de jogo compartilhado da mesa (PV, slots de magia, foco, condições).
//
// Modelo: um HASH por personagem, um campo por fatia de estado.
//
//   pf2e:table:v1:<slug>
//     ├─ hp             → {"v":1,"data":{"current":57,"temp":0},"updatedAt":…}
//     ├─ slots          → {"v":1,"data":{"used":{…},"focusUsed":1},"updatedAt":…}
//     ├─ conditions     → {"v":1,"data":{"frightened":2},"updatedAt":…}
//     └─ pet:pet:urso#0 → {"v":1,"data":{"current":40,"temp":0},"updatedAt":…}
//
// Hash e não um documento único de propósito: com um JSON só por personagem,
// "última escrita vence" faria dois jogadores editando ao mesmo tempo se
// sobrescreverem (quem marca condição apagaria o dano que o outro marcou). Um
// HSET por campo dá atomicidade por fatia sem transação nem CAS, e a leitura
// continua sendo um HGETALL só.

import { Redis } from '@upstash/redis'

const KEY_PREFIX = 'pf2e:table:v1:'
export const STATE_VERSION = 1

// 180 dias: o Redis não cresce sem limite com fichas de teste, e nenhuma mesa
// real fica meio ano sem tocar num personagem.
const TTL_SECONDS = 180 * 24 * 60 * 60

// Teto por campo. O maior payload real é o de slots (uma entrada por magia
// preparada), na casa de 1 KB — 8 KB é folga larga e ainda barra abuso, já que
// o endpoint é público.
export const MAX_FIELD_BYTES = 8 * 1024

const SLUG_RE = /^[a-z0-9-]{1,64}$/
const FIELD_RE = /^(hp|slots|conditions|pet:[a-z0-9:#-]{1,80})$/

export const isValidSlug = (slug) => typeof slug === 'string' && SLUG_RE.test(slug)
export const isValidField = (field) => typeof field === 'string' && FIELD_RE.test(field)

// As duas nomenclaturas em circulação: a integração Upstash do marketplace da
// Vercel injeta KV_REST_API_*, o console da Upstash entrega UPSTASH_REDIS_REST_*.
function credentials() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    return url && token ? { url, token } : null
}

export const isStoreConfigured = () => credentials() !== null

// Client preguiçoso, no mesmo espírito de `callChat` em aon.js: as credenciais
// são lidas do env na hora do uso, não capturadas na carga do módulo.
let client = null
function redis() {
    if (!client) {
        const creds = credentials()
        if (!creds) return null
        client = new Redis(creds)
    }
    return client
}

// Sem Redis configurado o app não pode quebrar: cai num Map de processo. Em
// dev isso persiste enquanto o `npm run dev:api` estiver de pé; em serverless
// some entre invocações — é justamente por isso que o cliente também mantém
// cache em localStorage.
const memory = new Map()

/** Envelope gravado em cada campo. */
const envelope = (data) => ({ v: STATE_VERSION, data, updatedAt: Date.now() })

// O @upstash/redis desserializa JSON sozinho quando reconhece o formato, então
// um campo pode voltar como objeto ou como string. Aceita os dois.
function unwrap(raw) {
    const parsed = typeof raw === 'string' ? safeParse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null
    return 'data' in parsed ? parsed : null
}

function safeParse(raw) {
    try { return JSON.parse(raw) } catch { return null }
}

/**
 * Todo o estado de um personagem numa ida só.
 * @returns {Promise<Record<string, {data: unknown, updatedAt: number}>>}
 *          Mapa vazio quando o personagem ainda não tem estado (não é erro).
 */
export async function readCharacter(slug) {
    const key = KEY_PREFIX + slug
    const r = redis()

    const raw = r ? await r.hgetall(key) : memory.get(key)
    if (!raw) return {}

    const fields = {}
    for (const [field, value] of Object.entries(raw)) {
        const entry = unwrap(value)
        if (entry) fields[field] = { data: entry.data, updatedAt: entry.updatedAt ?? 0 }
    }
    return fields
}

/**
 * Grava uma fatia. Só o campo indicado é tocado — as outras fatias do mesmo
 * personagem não correm risco de serem sobrescritas.
 * @returns {Promise<number>} updatedAt gravado.
 */
export async function writeField(slug, field, data) {
    const key = KEY_PREFIX + slug
    const value = envelope(data)
    const r = redis()

    if (!r) {
        const current = memory.get(key) || {}
        current[field] = JSON.stringify(value)
        memory.set(key, current)
        return value.updatedAt
    }

    await r.hset(key, { [field]: JSON.stringify(value) })
    await r.expire(key, TTL_SECONDS)
    return value.updatedAt
}
