// Descrições pré-traduzidas da ficha PUBLICADA — magias, talentos, habilidades
// e itens. É o par automático de `public/descriptions/` (que é gerado à mão,
// pelo script, só para os presets do repositório).
//
// Um level-up chega pela publicação, e esperar alguém rodar um script para a
// ficha nova abrir rápida de novo não funciona na mesa. Aqui a ficha publicada
// tem tudo o que ela descreve já resolvido (o payload da API, com tradução,
// `scaling` das magias, degrau de bastão…), e quem abrir a ficha num aparelho
// novo recebe tudo num GET só — toda aba abre pronta, todo toque é instantâneo.
//
// No Postgres (ver a migration `traducoes_e_descricoes`):
//   descriptions            (version, kind, name) → payload   GLOBAL: a Heal do
//                           Thalos serve ao Ghan Buri e à outra mesa
//   description_misses      (kind, name) → quando a AON não achou   GLOBAL
//   sheet_description_sets  (mesa, slug) → version + os nomes que a ficha descreve
//   locks                   trava de geração (o SET NX EX do Redis)
// e o GET monta o pacote no banco (`sheet_descriptions`), no MESMO formato que o
// Redis guardava: { version, entries: { tipo: { nome: payload } }, misses }.
//
// - INCREMENTAL e ACUMULATIVO: só o que falta passa pela AON e pelo LLM, e os
//   nomes de antes ficam na lista da ficha — a versão anterior (o "Restaurar")
//   continua coberta, e o level-up 11 traduz só o que é novo.
// - Quem diz a lista é o cliente (`characterDescriptionNames`, em TS, com as
//   MESMAS funções das abas): reescrever isso aqui em JS seria uma cópia que
//   envelheceria em silêncio. O endpoint é público como o resto, e o pior que
//   um nome inventado faz é virar uma entrada inútil, limitada pelo teto.
// - A `version` é a `CACHE_VERSION` do cliente (o formato do payload). Chegou
//   outra? A ficha recomeça a lista, e as linhas da versão velha deixam de ser lidas.
// - Cabe no `maxDuration`: para de começar grupos depois de `BUDGET_MS` e
//   devolve quantos faltam; o cliente chama de novo.
// - O que falta parte do pacote estático do personagem
//   (`public/descriptions/<slug>.json`, que o `vercel.json` empacota junto da
//   função): num level-up quase tudo já está lá, e só o que é novo vai à AON e
//   ao LLM — a ficha publicada fica pronta em segundos, não em minutos.
// - Nunca grava inglês: payload com `translationPending` fica de fora e é
//   tentado na próxima chamada.
// - O que a AON não resolve (nome caseiro, grafia do Pathbuilder) vira miss e
//   só é tentado de novo depois de `MISS_RETRY_MS`: sem isso, cada abertura da
//   ficha pediria o mesmo nome inexistente à AON (e ao LLM, que tenta
//   descrevê-lo). Falha de TRADUÇÃO não conta como miss — é passageira.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { supabase } from './supabase.js'
import { sameJson } from './json.js'
import { resolveSpells } from './spells-core.js'
import { resolveFeats, resolveSpecials } from './feat-core.js'

const LOCK_SECONDS = 70

/** Os tipos do cache do cliente (`services/descriptions.ts`) e quem resolve cada um. */
const RESOLVERS = {
  spell: resolveSpells,
  feat: resolveFeats,
  special: resolveSpecials,
  // Itens vão pelo mesmo `/api/searches` das habilidades; o tipo separado é do cache do cliente.
  item: resolveSpecials,
}
export const DESCRIPTION_KINDS = Object.keys(RESOLVERS)

const MAX_NAMES_PER_KIND = 150
const MAX_STORED_PER_KIND = 300
const MAX_NAME_LENGTH = 120
const GROUP = 6
// O `maxDuration` é 60 s e um grupo frio leva até ~20 s (medido: 25 magias com
// o cache vazio, 44 s numa chamada): não começa outro grupo depois disto.
const BUDGET_MS = 30_000
const MISS_RETRY_MS = 24 * 60 * 60 * 1000

const VERSION_RE = /^v\d{1,4}$/

export const isValidDescriptionVersion = (v) => typeof v === 'string' && VERSION_RE.test(v)

/** `{ spell: [...], feat: [...] }` que o cliente mandou, limpo: strings curtas, sem repetir. */
export function cleanDescriptionNames(names) {
  if (!names || typeof names !== 'object' || Array.isArray(names)) return null
  const out = {}
  let total = 0
  for (const kind of DESCRIPTION_KINDS) {
    const list = Array.isArray(names[kind]) ? names[kind] : []
    const clean = [...new Set(list.filter((n) => typeof n === 'string').map((n) => n.trim()))]
      .filter((n) => n.length > 0 && n.length <= MAX_NAME_LENGTH)
    if (clean.length > MAX_NAMES_PER_KIND) return null
    out[kind] = clean
    total += clean.length
  }
  return total > 0 ? out : null
}

const emptyBags = () => Object.fromEntries(DESCRIPTION_KINDS.map((k) => [k, {}]))

const bagsFrom = (raw) => Object.fromEntries(DESCRIPTION_KINDS.map((k) => {
  const bag = raw && typeof raw === 'object' ? raw[k] : null
  return [k, bag && typeof bag === 'object' ? bag : {}]
}))

// --- Armazenamento ------------------------------------------------------------
//
// Duas implementações da mesma interface: o Postgres e, sem credenciais, Maps de
// processo (mesma política do resto do estado — em dev vale enquanto o
// `dev:api` estiver de pé). Erro do banco sobe: o handler responde 500 e o
// cliente tenta de novo.

const dbStore = (db) => {
  const check = ({ data, error }) => {
    if (error) throw error
    return data
  }
  return {
    readBundle: async (mesa, slug) =>
      check(await db.rpc('sheet_descriptions', { p_mesa: mesa, p_slug: slug })),
    readSet: async (mesa, slug) =>
      check(await db.from('sheet_description_sets').select('version, names')
        .eq('mesa', mesa).eq('slug', slug).maybeSingle()),
    writeSet: async (mesa, slug, version, names) => {
      check(await db.from('sheet_description_sets')
        .upsert({ mesa, slug, version, names, updated_at: new Date().toISOString() }))
    },
    /** Quais destes nomes já têm descrição (só o nome: o payload não precisa sair do banco). */
    knownNames: async (version, kind, names) => {
      if (names.length === 0) return new Set()
      const rows = check(await db.from('descriptions').select('name')
        .eq('version', version).eq('kind', kind).in('name', names))
      return new Set(rows.map((r) => r.name))
    },
    writeEntries: async (version, kind, bag) => {
      const at = new Date().toISOString()
      const rows = Object.entries(bag).map(([name, payload]) => ({ version, kind, name, payload, updated_at: at }))
      if (rows.length > 0) check(await db.from('descriptions').upsert(rows))
    },
    /** `Map<nome, ms>` de quando a AON não achou cada nome. */
    readMisses: async (kind, names) => {
      if (names.length === 0) return new Map()
      const rows = check(await db.from('description_misses').select('name, missed_at')
        .eq('kind', kind).in('name', names))
      return new Map(rows.map((r) => [r.name, Date.parse(r.missed_at)]))
    },
    writeMisses: async (kind, names, at) => {
      const iso = new Date(at).toISOString()
      if (names.length > 0) check(await db.from('description_misses').upsert(names.map((name) => ({ kind, name, missed_at: iso }))))
    },
    clearMisses: async (kind, names) => {
      if (names.length > 0) check(await db.from('description_misses').delete().eq('kind', kind).in('name', names))
    },
    lock: async (key, seconds) => check(await db.rpc('try_lock', { p_key: key, p_seconds: seconds })) === true,
    unlock: async (key) => { check(await db.from('locks').delete().eq('key', key)) },
  }
}

const memoryStore = (() => {
  const sets = new Map()
  const entries = new Map()
  const misses = new Map()
  const locks = new Map()
  const entryKey = (version, kind, name) => `${version}|${kind}|${name}`
  const missKey = (kind, name) => `${kind}|${name}`
  return {
    readBundle: async (mesa, slug) => {
      const set = sets.get(`${mesa}|${slug}`)
      if (!set) return null
      const now = Date.now()
      const bag = (fn) => Object.fromEntries(DESCRIPTION_KINDS.map((kind) => [kind, Object.fromEntries(
        (set.names[kind] ?? []).map((n) => [n, fn(kind, n)]).filter(([, v]) => v != null),
      )]))
      return {
        version: set.version,
        entries: bag((kind, n) => entries.get(entryKey(set.version, kind, n))),
        misses: bag((kind, n) => {
          const at = misses.get(missKey(kind, n))
          return at != null && now - at < MISS_RETRY_MS ? at : null
        }),
      }
    },
    readSet: async (mesa, slug) => sets.get(`${mesa}|${slug}`) ?? null,
    writeSet: async (mesa, slug, version, names) => { sets.set(`${mesa}|${slug}`, { version, names }) },
    knownNames: async (version, kind, names) => new Set(names.filter((n) => entries.has(entryKey(version, kind, n)))),
    writeEntries: async (version, kind, bag) => {
      for (const [name, payload] of Object.entries(bag)) entries.set(entryKey(version, kind, name), payload)
    },
    readMisses: async (kind, names) => new Map(names
      .filter((n) => misses.has(missKey(kind, n)))
      .map((n) => [n, misses.get(missKey(kind, n))])),
    writeMisses: async (kind, names, at) => { for (const n of names) misses.set(missKey(kind, n), at) },
    clearMisses: async (kind, names) => { for (const n of names) misses.delete(missKey(kind, n)) },
    lock: async (key, seconds) => {
      if ((locks.get(key) ?? 0) > Date.now()) return false
      locks.set(key, Date.now() + seconds * 1000)
      return true
    },
    unlock: async (key) => { locks.delete(key) },
  }
})()

const store = () => {
  const db = supabase()
  return db ? dbStore(db) : memoryStore
}

// A trava é da mesa, como a ficha publicada que a pediu; as descrições não.
const lockKey = (mesa, slug) => `sheet-desc:${mesa}:${slug}`

export async function readSheetDescriptions(mesa, slug) {
  const raw = await store().readBundle(mesa, slug)
  if (!raw || typeof raw !== 'object' || !raw.entries || typeof raw.entries !== 'object') return null
  return { version: raw.version, entries: bagsFrom(raw.entries), misses: bagsFrom(raw.misses) }
}

/**
 * Os nomes que a ficha passa a descrever: os de antes (mesma versão) mais os de
 * agora, na ordem em que entraram. Passou do teto, saem primeiro os mais velhos
 * que a ficha atual não usa mais.
 */
function mergeNames(previous, names) {
  return Object.fromEntries(DESCRIPTION_KINDS.map((kind) => {
    const before = Array.isArray(previous?.[kind]) ? previous[kind] : []
    const seen = new Set(before)
    const merged = [...before, ...names[kind].filter((n) => !seen.has(n))]
    if (merged.length <= MAX_STORED_PER_KIND) return [kind, merged]
    const wanted = new Set(names[kind])
    let drop = merged.length - MAX_STORED_PER_KIND
    return [kind, merged.filter((n) => wanted.has(n) || drop-- <= 0)]
  }))
}

/**
 * O pacote estático do personagem (o mesmo que o CDN serve), base da primeira
 * montagem. Do disco: em dev é o repositório, na Vercel o `includeFiles` do
 * `vercel.json`. Se o disco não tiver (configuração mudou), pede ao domínio de
 * produção. Sem nenhum dos dois, a montagem só fica mais lenta.
 */
async function staticBundle(slug) {
  try {
    return JSON.parse(await readFile(join(process.cwd(), 'public', 'descriptions', `${slug}.json`), 'utf8'))
  } catch { /* segue para o CDN */ }
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (!host) return null
  try {
    const r = await fetch(`https://${host}/descriptions/${encodeURIComponent(slug)}.json`)
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

/** Mesmo critério do cliente para guardar uma descrição no cache. */
const usable = (entry) =>
  !!entry && typeof entry.description === 'string' && entry.description.trim().length > 0 && !entry.translationPending

/**
 * Resolve o que falta das listas e grava junto do que já havia.
 * @returns `{ busy: true }` se outro aparelho já está gerando, senão
 *   `{ added: { tipo: { nome: payload } }, remaining }` — `remaining > 0` = chame de novo.
 */
export async function buildSheetDescriptions(mesa, slug, names, version) {
  const db = store()
  if (!(await db.lock(lockKey(mesa, slug), LOCK_SECONDS))) return { busy: true }
  try {
    const started = Date.now()
    // Uma ida ao banco por consulta, todas juntas: em sequência eram ~10 viagens.
    const [set, ...lookups] = await Promise.all([
      db.readSet(mesa, slug),
      ...DESCRIPTION_KINDS.flatMap((kind) => [db.knownNames(version, kind, names[kind]), db.readMisses(kind, names[kind])]),
    ])
    const sameVersion = set?.version === version
    const nextNames = mergeNames(sameVersion ? set.names : null, names)

    const known = {}
    const missedAt = {}
    DESCRIPTION_KINDS.forEach((kind, i) => {
      known[kind] = lookups[2 * i]
      missedAt[kind] = lookups[2 * i + 1]
    })
    const recentMiss = (kind, n) => missedAt[kind].has(n) && started - missedAt[kind].get(n) < MISS_RETRY_MS
    const pending = (kind) => names[kind].filter((n) => !known[kind].has(n) && !recentMiss(kind, n))

    const added = emptyBags()
    const keep = async (kind, bag) => {
      const found = Object.keys(bag)
      if (found.length === 0) return
      await db.writeEntries(version, kind, bag)
      await db.clearMisses(kind, found.filter((n) => missedAt[kind].has(n)))
      for (const n of found) {
        known[kind].add(n)
        missedAt[kind].delete(n)
        added[kind][n] = bag[n]
      }
    }

    // O pacote estático primeiro: o que ele tem não precisa de AON nem de LLM.
    if (DESCRIPTION_KINDS.some((kind) => pending(kind).length > 0)) {
      const base = await staticBundle(slug)
      if (base?.version === version) {
        for (const kind of DESCRIPTION_KINDS) {
          const seed = {}
          for (const n of pending(kind)) {
            const entry = base.entries?.[kind]?.[n]
            if (usable(entry)) seed[n] = entry
          }
          await keep(kind, seed)
        }
      }
    }

    // Magias primeiro (a aba mais pesada), depois o resto, um grupo de cada vez.
    work: for (const kind of DESCRIPTION_KINDS) {
      const missing = pending(kind)
      for (let i = 0; i < missing.length; i += GROUP) {
        if (Date.now() - started >= BUDGET_MS) break work
        const group = missing.slice(i, i + GROUP)
        const resolved = await RESOLVERS[kind](group, true)
        const found = {}
        const notFound = []
        resolved.forEach((entry, k) => {
          if (usable(entry)) found[group[k]] = entry
          else if (!entry?.translationPending) notFound.push(group[k])
        })
        await keep(kind, found)
        const at = Date.now()
        await db.writeMisses(kind, notFound, at)
        for (const n of notFound) missedAt[kind].set(n, at)
      }
    }

    if (!sameVersion || !sameJson(set.names, nextNames)) {
      await db.writeSet(mesa, slug, version, nextNames)
    }

    const remaining = DESCRIPTION_KINDS.reduce((sum, kind) => sum + pending(kind).length, 0)
    return { added, remaining }
  } finally {
    await db.unlock(lockKey(mesa, slug))
  }
}
