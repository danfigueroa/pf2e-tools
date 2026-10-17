// Descrições pré-traduzidas da ficha PUBLICADA — magias, talentos, habilidades
// e itens. É o par automático de `public/descriptions/` (que é gerado à mão,
// pelo script, só para os presets do repositório).
//
// Um level-up chega pela publicação, e esperar alguém rodar um script para a
// ficha nova abrir rápida de novo não funciona na mesa. Aqui a ficha publicada
// guarda tudo o que ela descreve já resolvido (o payload da API, com tradução,
// `scaling` das magias, degrau de bastão…), e quem abrir a ficha num aparelho
// novo recebe tudo num GET só — toda aba abre pronta, todo toque é instantâneo.
//
//   pf2e:sheet:desc:v1:<slug> → { version,
//                                 entries: { spell|feat|special|item: { <nome>: payload } },
//                                 misses:  { spell|feat|special|item: { <nome>: quando } } }
//   pf2e:sheet:desc:lock:<slug> → trava de geração (SET NX, expira sozinha)
//
// - INCREMENTAL e ACUMULATIVO: só o que falta passa pela AON e pelo LLM, e o
//   que já havia fica — a versão anterior (o "Restaurar") continua coberta, e o
//   level-up 11 traduz só o que é novo.
// - Quem diz a lista é o cliente (`characterDescriptionNames`, em TS, com as
//   MESMAS funções das abas): reescrever isso aqui em JS seria uma cópia que
//   envelheceria em silêncio. O endpoint é público como o resto, e o pior que
//   um nome inventado faz é virar uma entrada inútil, limitada pelo teto.
// - A `version` é a `CACHE_VERSION` do cliente (o formato do payload). Chegou
//   outra? Recomeça do zero, como o localStorage faria.
// - Cabe no `maxDuration`: para de começar grupos depois de `BUDGET_MS` e
//   devolve quantos faltam; o cliente chama de novo.
// - Nunca grava inglês: payload com `translationPending` fica de fora e é
//   tentado na próxima chamada.
// - O que a AON não resolve (nome caseiro, grafia do Pathbuilder) vai para
//   `misses` e só é tentado de novo depois de `MISS_RETRY_MS`: sem isso, cada
//   abertura da ficha pediria o mesmo nome inexistente à AON (e ao LLM, que
//   tenta descrevê-lo). Falha de TRADUÇÃO não conta como miss — é passageira.

import { redis } from './table-store.js'
import { resolveSpells } from './spells-core.js'
import { resolveFeats, resolveSpecials } from './feat-core.js'

const KEY_PREFIX = 'pf2e:sheet:desc:v1:'
const LOCK_PREFIX = 'pf2e:sheet:desc:lock:'
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

// Sem Redis, Map de processo — mesma política do resto do estado.
const memory = new Map()
const memoryLocks = new Map()

const emptyBags = () => Object.fromEntries(DESCRIPTION_KINDS.map((k) => [k, {}]))

const bagsFrom = (raw) => Object.fromEntries(DESCRIPTION_KINDS.map((k) => {
  const bag = raw && typeof raw === 'object' ? raw[k] : null
  return [k, bag && typeof bag === 'object' ? bag : {}]
}))

export async function readSheetDescriptions(slug) {
  const r = redis()
  const raw = r ? await r.get(KEY_PREFIX + slug) : memory.get(slug) ?? null
  if (!raw || typeof raw !== 'object' || !raw.entries || typeof raw.entries !== 'object') return null
  return { version: raw.version, entries: bagsFrom(raw.entries), misses: bagsFrom(raw.misses) }
}

async function writeSheetDescriptions(slug, bundle) {
  const r = redis()
  if (r) await r.set(KEY_PREFIX + slug, bundle)
  else memory.set(slug, bundle)
}

async function lock(slug) {
  const r = redis()
  if (r) return (await r.set(LOCK_PREFIX + slug, 1, { nx: true, ex: LOCK_SECONDS })) === 'OK'
  const until = memoryLocks.get(slug) ?? 0
  if (until > Date.now()) return false
  memoryLocks.set(slug, Date.now() + LOCK_SECONDS * 1000)
  return true
}

async function unlock(slug) {
  const r = redis()
  if (r) await r.del(LOCK_PREFIX + slug)
  else memoryLocks.delete(slug)
}

/** Mesmo critério do cliente para guardar uma descrição no cache. */
const usable = (entry) =>
  !!entry && typeof entry.description === 'string' && entry.description.trim().length > 0 && !entry.translationPending

/**
 * Resolve o que falta das listas e grava junto do que já havia.
 * @returns `{ busy: true }` se outro aparelho já está gerando, senão
 *   `{ added: { tipo: { nome: payload } }, remaining }` — `remaining > 0` = chame de novo.
 */
export async function buildSheetDescriptions(slug, names, version) {
  if (!(await lock(slug))) return { busy: true }
  try {
    const started = Date.now()
    const current = await readSheetDescriptions(slug)
    const sameVersion = current?.version === version
    const entries = sameVersion ? bagsFrom(structuredClone(current.entries)) : emptyBags()
    const misses = sameVersion ? bagsFrom(structuredClone(current.misses)) : emptyBags()
    const recentMiss = (kind, n) => typeof misses[kind][n] === 'number' && started - misses[kind][n] < MISS_RETRY_MS
    const pending = (kind) => names[kind].filter((n) => !usable(entries[kind][n]) && !recentMiss(kind, n))

    const added = emptyBags()
    let changed = !sameVersion

    // Magias primeiro (a aba mais pesada), depois o resto, um grupo de cada vez.
    work: for (const kind of DESCRIPTION_KINDS) {
      const missing = pending(kind)
      for (let i = 0; i < missing.length; i += GROUP) {
        if (Date.now() - started >= BUDGET_MS) break work
        const group = missing.slice(i, i + GROUP)
        const resolved = await RESOLVERS[kind](group, true)
        resolved.forEach((entry, k) => {
          const name = group[k]
          if (usable(entry)) {
            entries[kind][name] = entry
            added[kind][name] = entry
            delete misses[kind][name]
            changed = true
          } else if (!entry?.translationPending) {
            misses[kind][name] = Date.now()
            changed = true
          }
        })
      }
    }

    if (changed) {
      for (const kind of DESCRIPTION_KINDS) {
        const wanted = new Set(names[kind])
        // Teto: some primeiro o que a ficha atual não usa mais (os mais velhos).
        const keys = Object.keys(entries[kind])
        if (keys.length > MAX_STORED_PER_KIND) {
          keys.filter((n) => !wanted.has(n)).slice(0, keys.length - MAX_STORED_PER_KIND)
            .forEach((n) => { delete entries[kind][n] })
        }
        for (const n of Object.keys(misses[kind])) if (!recentMiss(kind, n) && !wanted.has(n)) delete misses[kind][n]
      }
      await writeSheetDescriptions(slug, { version, entries, misses })
    }

    const remaining = DESCRIPTION_KINDS.reduce((sum, kind) => sum + pending(kind).length, 0)
    return { added, remaining }
  } finally {
    await unlock(slug)
  }
}
