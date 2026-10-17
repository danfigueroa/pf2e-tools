// Magias pré-traduzidas da ficha PUBLICADA — o par automático de
// `public/spells/` (que é gerado à mão, pelo script, só para os presets).
//
// Um level-up chega pela publicação, e esperar alguém rodar um script para a
// ficha nova abrir rápida de novo não funciona na mesa. Aqui a ficha
// publicada guarda as magias já resolvidas (payload da API, com tradução e
// `scaling`), e quem abrir a ficha num aparelho novo recebe tudo num GET só.
//
//   pf2e:sheet:spells:v1:<slug> → { version, spells: { <nome>: payload }, misses: { <nome>: quando } }
//   pf2e:sheet:spells:lock:<slug> → trava de geração (SET NX, expira sozinha)
//
// - INCREMENTAL e ACUMULATIVO: só as magias que faltam passam pela AON e pelo
//   LLM, e as antigas ficam — a versão anterior (o "Restaurar") continua
//   coberta, e o level-up 11 traduz só o que é novo.
// - Quem diz a lista é o cliente (`characterSpellNames`, em TS, com o
//   `normalizeSpellCasters` do grimório): reescrever isso aqui em JS seria uma
//   cópia que envelheceria em silêncio. O endpoint é público como o resto, e o
//   pior que um nome inventado faz é virar uma entrada inútil, limitada pelo teto.
// - A `version` é a `CACHE_VERSION` do cliente (o formato do payload). Chegou
//   outra? Recomeça do zero, como o localStorage faria.
// - Cabe no `maxDuration`: para de começar grupos depois de `BUDGET_MS` e
//   devolve quantas faltam; o cliente chama de novo.
// - Nunca grava inglês: payload com `translationPending` fica de fora e é
//   tentado na próxima chamada.
// - Magia que a AON não resolve (nome caseiro, grafia do Pathbuilder) vai para
//   `misses` e só é tentada de novo depois de `MISS_RETRY_MS`: sem isso, cada
//   abertura da ficha pediria a mesma magia inexistente à AON (e ao LLM, que
//   tenta descrevê-la). Falha de TRADUÇÃO não conta como miss — é passageira.

import { redis } from './table-store.js'
import { resolveSpells } from './spells-core.js'

const KEY_PREFIX = 'pf2e:sheet:spells:v1:'
const LOCK_PREFIX = 'pf2e:sheet:spells:lock:'
const LOCK_SECONDS = 70

export const MAX_NAMES = 150
const MAX_STORED = 300
const MAX_NAME_LENGTH = 120
const GROUP = 6
// O `maxDuration` é 60 s e um grupo frio leva até ~20 s (medido: 25 magias com
// o cache vazio, 44 s numa chamada): não começa outro grupo depois disto.
const BUDGET_MS = 30_000
const MISS_RETRY_MS = 24 * 60 * 60 * 1000

const VERSION_RE = /^v\d{1,4}$/

export const isValidSpellVersion = (v) => typeof v === 'string' && VERSION_RE.test(v)

/** Nomes que o cliente mandou, limpos: strings curtas, sem repetir. */
export function cleanSpellNames(names) {
  if (!Array.isArray(names)) return null
  const out = [...new Set(names.filter((n) => typeof n === 'string').map((n) => n.trim()))]
    .filter((n) => n.length > 0 && n.length <= MAX_NAME_LENGTH)
  return out.length > 0 && out.length <= MAX_NAMES ? out : null
}

// Sem Redis, Map de processo — mesma política do resto do estado.
const memory = new Map()
const memoryLocks = new Map()

export async function readSheetSpells(slug) {
  const r = redis()
  const raw = r ? await r.get(KEY_PREFIX + slug) : memory.get(slug) ?? null
  if (!raw || typeof raw !== 'object' || !raw.spells || typeof raw.spells !== 'object') return null
  const misses = raw.misses && typeof raw.misses === 'object' ? raw.misses : {}
  return { version: raw.version, spells: raw.spells, misses }
}

async function writeSheetSpells(slug, bundle) {
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

const usable = (spell) =>
  !!spell && typeof spell.description === 'string' && spell.description.trim().length > 0 && !spell.translationPending

/**
 * Resolve o que falta da lista e grava junto do que já havia.
 * @returns `{ busy: true }` se outro aparelho já está gerando, senão
 *   `{ added: { nome: payload }, remaining }` — `remaining > 0` = chame de novo.
 */
export async function buildSheetSpells(slug, names, version) {
  if (!(await lock(slug))) return { busy: true }
  try {
    const started = Date.now()
    const current = await readSheetSpells(slug)
    const sameVersion = current?.version === version
    const spells = sameVersion ? { ...current.spells } : {}
    const misses = sameVersion ? { ...current.misses } : {}
    const recentMiss = (n) => typeof misses[n] === 'number' && started - misses[n] < MISS_RETRY_MS
    const missing = names.filter((n) => !usable(spells[n]) && !recentMiss(n))
    const added = {}
    let missed = false

    for (let i = 0; i < missing.length && Date.now() - started < BUDGET_MS; i += GROUP) {
      const group = missing.slice(i, i + GROUP)
      const resolved = await resolveSpells(group, true)
      resolved.forEach((spell, k) => {
        const name = group[k]
        if (usable(spell)) {
          spells[name] = spell
          added[name] = spell
          delete misses[name]
        } else if (!spell?.translationPending) {
          misses[name] = Date.now()
          missed = true
        }
      })
    }

    if (Object.keys(added).length > 0 || missed || !sameVersion) {
      // Teto: some primeiro o que a ficha atual não usa mais (as mais velhas).
      const keys = Object.keys(spells)
      if (keys.length > MAX_STORED) {
        const wanted = new Set(names)
        const drop = keys.filter((n) => !wanted.has(n)).slice(0, keys.length - MAX_STORED)
        for (const n of drop) delete spells[n]
      }
      for (const n of Object.keys(misses)) if (!recentMiss(n) && !names.includes(n)) delete misses[n]
      await writeSheetSpells(slug, { version, spells, misses })
    }

    const remaining = names.filter((n) => !usable(spells[n]) && !recentMiss(n)).length
    return { added, remaining }
  } finally {
    await unlock(slug)
  }
}
