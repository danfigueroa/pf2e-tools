// Estado de jogo compartilhado da mesa (PV, slots de magia, foco, condições,
// pontos míticos, ações do turno…).
//
// Modelo: no Postgres, uma LINHA por fatia (tabela `character_state`, chave
// mesa + slug + campo), com `data` (jsonb), `updated_at` (ms) e `updated_by`.
//
// Uma linha por fatia e não um documento único de propósito: com um JSON só por
// personagem, "última escrita vence" faria dois jogadores editando ao mesmo tempo
// se sobrescreverem (quem marca condição apagaria o dano que o outro marcou). O
// upsert de uma fatia não toca nas outras, e a leitura do personagem inteiro
// continua sendo uma consulta só. (No Redis era um HASH, um campo por fatia —
// mesma ideia.)
//
// Cada escrita é transmitida pelo Realtime no canal `mesa:<mesa>:state`, por um
// trigger do banco (migration `estado_da_mesa`): o cliente recebe sem pedir.
//
// O Redis continua aqui por TRANSIÇÃO: o mapa de combate e o feed de rolagens
// ainda moram nele (`redis()`), e o mapa descobre que o PV de alguém mudou pelo
// contador `pf2e:table:rev`, que `writeField` segue subindo. Os dois saem quando
// o mapa migrar.

import { Redis } from '@upstash/redis'
import { scoped } from './mesas.js'
import { supabase } from './supabase.js'

const KEY_PREFIX = 'pf2e:table:v1:'
export const STATE_VERSION = 1

// 180 dias sem escrita e o personagem sai do banco (pg_cron): ficha de teste não
// acumula, e nenhuma mesa real fica meio ano sem tocar num personagem.

// Teto por campo. O maior payload real é o de slots (uma entrada por magia
// preparada), na casa de 1 KB — 8 KB é folga larga e ainda barra abuso, já que
// o endpoint é público. (O CHECK da tabela repete a regra com folga.)
export const MAX_FIELD_BYTES = 8 * 1024

const SLUG_RE = /^[a-z0-9-]{1,64}$/
// A mesma lista do CHECK de `character_state` (migration `estado_da_mesa`).
const FIELD_RE = /^(hp|slots|conditions|afflictions|persistent|mythic|consumed|shield|token|size|rage|psyche|energy|magus|ranger|rogue|actions|uses|companions|pet:[a-z0-9:#-]{1,80})$/

// Contador de escritas no estado dos personagens, um por mesa. O mapa de combate
// o lê junto da própria revisão (um MGET) para saber que o PV de alguém mudou
// pela Ficha Virtual ou pela Iniciativa sem perguntar personagem a personagem.
const TABLE_REV_KEY = 'pf2e:table:rev'
export const tableRevKey = (mesa) => scoped(mesa, TABLE_REV_KEY)
/** A chave do personagem no cache em memória (sem banco). */
const characterKey = (mesa, slug) => scoped(mesa, KEY_PREFIX + slug)

export const isValidSlug = (slug) => typeof slug === 'string' && SLUG_RE.test(slug)
export const isValidField = (field) => typeof field === 'string' && FIELD_RE.test(field)

// As duas nomenclaturas em circulação: a integração Upstash do marketplace da
// Vercel injeta KV_REST_API_*, o console da Upstash entrega UPSTASH_REDIS_REST_*.
function credentials() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
    return url && token ? { url, token } : null
}

/** Redis configurado — o que o mapa e o feed de rolagens ainda usam. */
export const isRedisConfigured = () => credentials() !== null

/** Onde o estado dos personagens mora: o Supabase. */
export const isStoreConfigured = () => supabase() !== null

// Client preguiçoso, no mesmo espírito de `callChat` em aon.js: as credenciais
// são lidas do env na hora do uso, não capturadas na carga do módulo.
let client = null
export function redis() {
    if (!client) {
        const creds = credentials()
        if (!creds) return null
        client = new Redis(creds)
    }
    return client
}

// Sem banco configurado o app não pode quebrar: cai num Map de processo. Em
// dev isso persiste enquanto o `npm run dev:api` estiver de pé; em serverless
// some entre invocações — é justamente por isso que o cliente também mantém
// cache em localStorage.
const memory = new Map()
const memoryRevs = new Map()

/** O contador acima quando não há Redis (lido por map-store.js). */
export const memoryTableRev = (mesa) => memoryRevs.get(tableRevKey(mesa)) || 0

/** Envelope gravado em cada campo do cache em memória. */
const envelope = (data) => ({ v: STATE_VERSION, data, updatedAt: Date.now() })

function unwrap(raw) {
    const parsed = typeof raw === 'string' ? safeParse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null
    return 'data' in parsed ? parsed : null
}

function safeParse(raw) {
    try { return JSON.parse(raw) } catch { return null }
}

const check = ({ data, error }) => {
    if (error) throw error
    return data
}

/**
 * Todo o estado de um personagem numa ida só.
 * @returns {Promise<Record<string, {data: unknown, updatedAt: number}>>}
 *          Mapa vazio quando o personagem ainda não tem estado (não é erro).
 */
export async function readCharacter(mesa, slug) {
    const db = supabase()
    if (!db) {
        const raw = memory.get(characterKey(mesa, slug))
        const fields = {}
        for (const [field, value] of Object.entries(raw ?? {})) {
            const entry = unwrap(value)
            if (entry) fields[field] = { data: entry.data, updatedAt: entry.updatedAt ?? 0 }
        }
        return fields
    }
    const rows = check(await db.from('character_state').select('field, data, updated_at')
        .eq('mesa', mesa).eq('slug', slug))
    return Object.fromEntries(rows.map((r) => [r.field, { data: r.data, updatedAt: Number(r.updated_at) }]))
}

/**
 * Algumas fatias de vários personagens numa consulta só — o mapa lê `hp`,
 * `token` e `size` de todo PC no tabuleiro.
 * @returns {Promise<Record<string, Record<string, unknown>>>} slug → campo → data
 */
export async function readCharacterSlices(mesa, slugs, fields) {
    if (slugs.length === 0) return {}
    const out = Object.fromEntries(slugs.map((slug) => [slug, {}]))
    const db = supabase()
    if (!db) {
        for (const slug of slugs) {
            const all = await readCharacter(mesa, slug)
            for (const f of fields) if (all[f]) out[slug][f] = all[f].data
        }
        return out
    }
    const rows = check(await db.from('character_state').select('slug, field, data')
        .eq('mesa', mesa).in('slug', slugs).in('field', fields))
    for (const r of rows) out[r.slug][r.field] = r.data
    return out
}

/**
 * UMA fatia de um personagem, para o que precisa chegar rápido sem reler o
 * personagem inteiro — o poll das ações do turno, quando o tempo real não está
 * ligado.
 * @returns {Promise<{data: unknown, updatedAt: number} | null>}
 */
export async function readField(mesa, slug, field) {
    const db = supabase()
    if (!db) {
        const entry = unwrap(memory.get(characterKey(mesa, slug))?.[field])
        return entry ? { data: entry.data, updatedAt: entry.updatedAt ?? 0 } : null
    }
    const row = check(await db.from('character_state').select('data, updated_at')
        .eq('mesa', mesa).eq('slug', slug).eq('field', field).maybeSingle())
    return row ? { data: row.data, updatedAt: Number(row.updated_at) } : null
}

/**
 * Grava uma fatia. Só o campo indicado é tocado — as outras fatias do mesmo
 * personagem não correm risco de serem sobrescritas. `by` = a sessão anônima de
 * quem escreveu (ou null): o cliente a usa para ignorar o eco da própria escrita.
 * @returns {Promise<number>} updatedAt gravado.
 */
export async function writeField(mesa, slug, field, data, by = null) {
    const updatedAt = Date.now()
    const db = supabase()

    if (!db) {
        const key = characterKey(mesa, slug)
        const current = memory.get(key) || {}
        current[field] = JSON.stringify({ ...envelope(data), updatedAt })
        memory.set(key, current)
        memoryRevs.set(tableRevKey(mesa), memoryTableRev(mesa) + 1)
        return updatedAt
    }

    check(await db.from('character_state')
        .upsert({ mesa, slug, field, data, updated_at: updatedAt, updated_by: by }))
    // Transição: o mapa ainda descobre a mudança pelo contador do Redis.
    const r = redis()
    if (r) {
        try {
            await r.incr(tableRevKey(mesa))
        } catch (error) {
            console.error('[table-store] Falha ao subir o contador do mapa:', error)
        }
    }
    return updatedAt
}
