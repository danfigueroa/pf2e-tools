// Feed de rolagens da mesa: as últimas 30 rolagens de qualquer aparelho, para
// todo mundo ver — no Mapa, numa ficha, na Iniciativa.
//
// Chaves:
//   pf2e:rolls:v1    LISTA, a mais nova primeiro (LPUSH + LTRIM)
//   pf2e:rolls:rev   contador — sobe a cada rolagem, é o que o poll lê
//
// Custo no Upstash (cada comando conta, inclusive dentro de pipeline):
//   rolar           LPUSH + LTRIM + EXPIRE + INCR = 4
//   poll sem nada   GET = 1
//   poll com novas  GET + LRANGE = 2
// E no Mapa o contador entra como 4ª chave do MGET que o poll do mapa já faz
// (map-store.js `readRevs`): lá o feed sai sem comando a mais.
//
// Sem credenciais, cai num array em memória do processo, como o table-store.

import { redis } from './table-store.js'

const LIST_KEY = 'pf2e:rolls:v1'
export const ROLLS_REV_KEY = 'pf2e:rolls:rev'

export const ROLL_HISTORY = 30
/** Rolagem é coisa da sessão: um dia sem ninguém rolar e o feed some sozinho. */
const TTL_SECONDS = 24 * 60 * 60
export const MAX_ROLL_BYTES = 4096

let memoryRolls = []
let memoryRev = 0

/** O contador quando não há Redis (lido por map-store.js). */
export const memoryRollsRev = () => memoryRev

// ── Validação ────────────────────────────────────────────────────────────────
// ESPELHO de `src/dice/tableRoll.ts` (`sanitizeTableRoll`): o servidor é JS
// puro e não importa o TS do app. Mudou lá, muda aqui.

const DICE_FACES = [4, 6, 8, 10, 12, 20, 100]
const MAX_ROLL_DICE = 120
const HEX = /^#[0-9a-fA-F]{6}$/
const ID_RE = /^[a-z0-9-]{1,64}$/
const isInt = (v, max = 99999) => Number.isInteger(v) && Math.abs(v) <= max
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

function sanitizeDice(raw, budget) {
  if (!Array.isArray(raw) || raw.length > budget.left) return null
  const out = []
  for (const d of raw) {
    if (!d || typeof d !== 'object') return null
    if (!DICE_FACES.includes(d.faces)) return null
    if (!isInt(d.value) || d.value < 1 || d.value > d.faces) return null
    out.push({ faces: d.faces, value: d.value })
  }
  budget.left -= out.length
  return out
}

function sanitizePart(p, budget) {
  if (!p || typeof p !== 'object') return null
  const dice = sanitizeDice(p.dice, budget)
  if (!dice || !isInt(p.flat) || !isInt(p.total)) return null
  if (dice.reduce((s, d) => s + d.value, p.flat) !== p.total) return null
  return { label: str(p.label, 60), dice, flat: p.flat, total: p.total, ...(p.persistent === true ? { persistent: true } : {}) }
}

/** A rolagem limpa, ou `null` se algo não confere. `at` é sempre o do servidor. */
export function sanitizeRoll(r) {
  if (!r || typeof r !== 'object') return null
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return null
  if (typeof r.color !== 'string' || !HEX.test(r.color)) return null
  const budget = { left: MAX_ROLL_DICE }
  const out = { id: r.id, at: Date.now(), by: str(r.by, 40), color: r.color, title: str(r.title, 60) }
  if (typeof r.slug === 'string' && ID_RE.test(r.slug)) out.slug = r.slug
  if (typeof r.sub === 'string' && r.sub) out.sub = str(r.sub, 80)
  if (typeof r.note === 'string' && r.note) out.note = str(r.note, 300)

  if (r.check !== undefined) {
    const c = r.check
    if (!c || typeof c !== 'object') return null
    if (!isInt(c.d20) || c.d20 < 1 || c.d20 > 20 || !isInt(c.mod, 999) || !isInt(c.total)) return null
    if (c.d20 + c.mod !== c.total) return null
    const parts = Array.isArray(c.parts) ? c.parts.slice(0, 12) : []
    out.check = {
      d20: c.d20,
      mod: c.mod,
      total: c.total,
      mythic: c.mythic === true,
      parts: parts.filter((p) => p && typeof p === 'object' && isInt(p.value, 999))
        .map((p) => ({ label: str(p.label, 60), value: p.value })),
    }
  }

  if (r.damage !== undefined) {
    const d = r.damage
    if (!d || typeof d !== 'object' || !Array.isArray(d.parts) || d.parts.length > 8) return null
    const parts = []
    for (const p of d.parts) {
      const part = sanitizePart(p, budget)
      if (!part) return null
      parts.push(part)
    }
    if (!isInt(d.total)) return null
    out.damage = { parts, total: d.total }
    if (d.crit !== undefined) {
      if (!d.crit || typeof d.crit !== 'object' || !isInt(d.crit.total)) return null
      out.damage.crit = { total: d.crit.total, note: str(d.crit.note, 500) }
    }
    if (d.basic === true) out.damage.basic = true
  }

  if (r.initiative === true && out.check) out.initiative = true

  if (r.free !== undefined) {
    const part = sanitizePart(r.free, budget)
    if (!part) return null
    out.free = part
  }

  if (!out.check && !out.damage && !out.free) return null
  if (JSON.stringify(out).length > MAX_ROLL_BYTES) return null
  return out
}

// ── Leitura e escrita ────────────────────────────────────────────────────────

const parse = (raw) => {
  if (raw && typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

/** Grava a rolagem (já validada). Devolve a revisão nova. */
export async function addRoll(roll) {
  const r = redis()
  if (r) {
    const p = r.pipeline()
    p.lpush(LIST_KEY, JSON.stringify(roll))
    p.ltrim(LIST_KEY, 0, ROLL_HISTORY - 1)
    p.expire(LIST_KEY, TTL_SECONDS)
    p.incr(ROLLS_REV_KEY)
    const results = await p.exec()
    return Number(results[3]) || 0
  }
  memoryRolls = [roll, ...memoryRolls].slice(0, ROLL_HISTORY)
  memoryRev += 1
  return memoryRev
}

/**
 * O feed, se mudou desde `knownRev`. Com o mesmo número, só o contador — é o
 * caso comum do poll, e custa um GET.
 * @returns {Promise<{rev: number, rolls?: object[]}>}
 */
export async function readRolls(knownRev) {
  const r = redis()
  const rev = r ? Number(await r.get(ROLLS_REV_KEY)) || 0 : memoryRev
  if (knownRev != null && knownRev === rev) return { rev }
  const raw = r ? await r.lrange(LIST_KEY, 0, ROLL_HISTORY - 1) : memoryRolls
  return { rev, rolls: (raw || []).map(parse).filter(Boolean) }
}
