// Feed de rolagens da mesa: toda rolagem de qualquer aparelho, para todo mundo
// ver — no Mapa, numa ficha, na Iniciativa.
//
// No Postgres (migration `feed_de_rolagens`):
//   rolls    cada rolagem, PARA SEMPRE (é o histórico do diário da sessão); o GET
//            devolve as últimas 30, como a lista do Redis devolvia
//   shares   as regras compartilhadas com a mesa (talento, magia…); o GET devolve
//            as da última hora, até 5
// Cada inserção é transmitida pelo Realtime no canal privado `mesa:<mesa>:rolls`
// (eventos `roll` e `share`), por trigger: quem está com o app aberto recebe sem
// pedir. O `rev` (o maior `seq` das duas tabelas, que dividem uma sequência)
// sobrevive só para o poll de reserva, quando o Realtime não está aberto.
//
// Sem banco, cai num array em memória do processo, como o table-store.

import { supabase } from './supabase.js'

export const ROLL_HISTORY = 30
export const MAX_ROLL_BYTES = 8192
const SHARE_HISTORY = 5
const SHARE_WINDOW_MS = 60 * 60 * 1000

// Sem banco, um feed em memória por mesa.
const memoryFeeds = new Map()
function memoryFeed(mesa) {
  if (!memoryFeeds.has(mesa)) memoryFeeds.set(mesa, { rolls: [], shares: [], rev: 0 })
  return memoryFeeds.get(mesa)
}

// ── Validação ────────────────────────────────────────────────────────────────
// ESPELHO de `src/dice/tableRoll.ts` (`sanitizeTableRoll`): o servidor é JS
// puro e não importa o TS do app. Mudou lá, muda aqui.

const DICE_FACES = [4, 6, 8, 10, 12, 20, 100]
const MAX_ROLL_DICE = 120
const MAX_RAYS = 6
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

function sanitizeCheck(c) {
  if (!c || typeof c !== 'object') return null
  if (!isInt(c.d20) || c.d20 < 1 || c.d20 > 20 || !isInt(c.mod, 999) || !isInt(c.total)) return null
  if (c.d20 + c.mod !== c.total) return null
  const parts = Array.isArray(c.parts) ? c.parts.slice(0, 12) : []
  return {
    d20: c.d20,
    mod: c.mod,
    total: c.total,
    mythic: c.mythic === true,
    parts: parts.filter((p) => p && typeof p === 'object' && isInt(p.value, 999))
      .map((p) => ({ label: str(p.label, 60), value: p.value })),
  }
}

function sanitizeDamage(d, budget) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.parts) || d.parts.length > 8) return null
  const parts = []
  for (const p of d.parts) {
    const part = sanitizePart(p, budget)
    if (!part) return null
    parts.push(part)
  }
  if (!isInt(d.total)) return null
  const out = { parts, total: d.total }
  if (d.crit !== undefined) {
    if (!d.crit || typeof d.crit !== 'object' || !isInt(d.crit.total)) return null
    out.crit = { total: d.crit.total, note: str(d.crit.note, 500) }
  }
  if (d.basic === true) out.basic = true
  return out
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
    const check = sanitizeCheck(r.check)
    if (!check) return null
    out.check = check
  }

  if (r.damage !== undefined) {
    const damage = sanitizeDamage(r.damage, budget)
    if (!damage) return null
    out.damage = damage
  }

  if (r.rays !== undefined) {
    if (!Array.isArray(r.rays) || r.rays.length === 0 || r.rays.length > MAX_RAYS) return null
    const rays = []
    for (const ray of r.rays) {
      if (!ray || typeof ray !== 'object') return null
      const check = sanitizeCheck(ray.check)
      const damage = sanitizeDamage(ray.damage, budget)
      if (!check || !damage) return null
      rays.push({ check, damage })
    }
    out.rays = rays
  }

  if (r.initiative === true && out.check) out.initiative = true

  if (r.free !== undefined) {
    const part = sanitizePart(r.free, budget)
    if (!part) return null
    out.free = part
  }

  if (r.use !== undefined) {
    const text = r.use && typeof r.use === 'object' ? str(r.use.text, 120).trim() : ''
    if (!text) return null
    const desc = typeof r.use.desc === 'string' ? str(r.use.desc, 700).trim() : ''
    out.use = { text, ...(desc ? { desc } : {}) }
  }

  if (!out.check && !out.damage && !out.free && !out.rays && !out.use) return null
  if (JSON.stringify(out).length > MAX_ROLL_BYTES) return null
  return out
}

// ── Regra compartilhada ──────────────────────────────────────────────────────
// ESPELHO de `src/services/tableShare.ts` (`sanitizeTableShare`). Viaja só a
// REFERÊNCIA (tipo, nome, rank): quem recebe busca a descrição traduzida como o
// drawer da ficha busca, então não há prosa para validar aqui.
//
// `handout` é o que o GM mostra pelo Diário de Campanha: `name` é o título e
// `ref` o id em `journal_reveals`, de onde o cartão lê o texto e a imagem. Só o
// servidor o cria (`journal-reveal`); o `share-add` do cliente o recusa.

const SHARE_TYPES = ['feat', 'special', 'item', 'spell', 'handout']
/** Até 120 caracteres, sem quebra de linha nem outro caractere de controle. */
const validName = (v) =>
  typeof v === 'string' && v.length <= 120 && !!v.trim() && ![...v].some((c) => c.charCodeAt(0) < 32)

function sanitizeCaster(c) {
  if (!c || typeof c !== 'object') return null
  if (!isInt(c.dc, 99) || c.dc < 0 || !isInt(c.attack, 99)) return null
  const name = str(c.name, 40)
  if (!name) return null
  return { name, dc: c.dc, attack: c.attack, tradition: str(c.tradition, 20) }
}

/** O compartilhamento limpo, ou `null`. `at` é sempre o do servidor. */
export function sanitizeShare(s) {
  if (!s || typeof s !== 'object') return null
  if (typeof s.id !== 'string' || !ID_RE.test(s.id)) return null
  if (typeof s.color !== 'string' || !HEX.test(s.color)) return null
  if (!SHARE_TYPES.includes(s.type)) return null
  if (!validName(s.name)) return null
  const out = { id: s.id, at: Date.now(), by: str(s.by, 40), color: s.color, type: s.type, name: s.name }
  if (typeof s.slug === 'string' && ID_RE.test(s.slug)) out.slug = s.slug
  // Só talento e magia têm nível no pedido de descrição.
  if ((s.type === 'feat' || s.type === 'spell') && isInt(s.level, 30) && s.level >= 0) out.level = s.level
  if (s.type === 'spell') {
    const caster = sanitizeCaster(s.caster)
    if (caster) out.caster = caster
  }
  if (s.type === 'handout') {
    if (typeof s.ref !== 'string' || !ID_RE.test(s.ref)) return null
    out.ref = s.ref
  }
  return out
}

// ── Leitura e escrita ────────────────────────────────────────────────────────

const check = ({ data, error }) => {
  if (error) throw error
  return data
}

/** O contador atual (o caminho lento: só quando a inserção não devolveu o `seq`). */
async function currentRev(db, mesa) {
  return Number(check(await db.rpc('read_feed', { p_mesa: mesa, p_known: -1 }))?.rev) || 0
}

/**
 * Grava uma linha do feed (rolagem ou compartilhamento, já validado) e devolve
 * a revisão nova. Mandar a mesma de novo (um reenvio) não duplica.
 */
async function addToFeed(mesa, table, column, item, author) {
  const db = supabase()
  if (!db) {
    const feed = memoryFeed(mesa)
    if (table === 'rolls') feed.rolls = [item, ...feed.rolls].slice(0, ROLL_HISTORY)
    else feed.shares = [item, ...feed.shares].slice(0, SHARE_HISTORY)
    feed.rev += 1
    return feed.rev
  }
  const row = { id: item.id, mesa, at: item.at, author, [column]: item }
  if (table === 'rolls' && item.slug) row.slug = item.slug
  const { data, error } = await db.from(table).insert(row).select('seq').single()
  if (error?.code === '23505') return currentRev(db, mesa)
  if (error) throw error
  return Number(data.seq)
}

/** Grava a rolagem (já validada). Devolve a revisão nova. */
export const addRoll = (mesa, roll, author = null) => addToFeed(mesa, 'rolls', 'roll', roll, author)

/** Grava o compartilhamento (já validado). Devolve a revisão nova. */
export const addShare = (mesa, share, author = null) => addToFeed(mesa, 'shares', 'share', share, author)

/**
 * O feed, se mudou desde `knownRev`. Com o mesmo número, só o contador — é o
 * caso comum do poll de reserva. Uma consulta (`read_feed`).
 * @returns {Promise<{rev: number, rolls?: object[], shares?: object[]}>}
 */
export async function readRolls(mesa, knownRev) {
  const db = supabase()
  if (!db) {
    const feed = memoryFeed(mesa)
    if (knownRev != null && knownRev === feed.rev) return { rev: feed.rev }
    const since = Date.now() - SHARE_WINDOW_MS
    return { rev: feed.rev, rolls: feed.rolls, shares: feed.shares.filter((x) => x.at > since) }
  }
  const out = check(await db.rpc('read_feed', { p_mesa: mesa, p_known: knownRev }))
  return { ...out, rev: Number(out.rev) || 0 }
}

// ── Diário da sessão ─────────────────────────────────────────────────────────
// O DIA DE JOGO vai das 6h às 6h no horário de Brasília (`diary_day` no banco):
// uma sessão que passa da meia-noite continua sendo uma só.

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
/** O mesmo `diary_day` do banco, para o fallback em memória. */
const diaryDay = (at) => DAY_FMT.format(new Date(at - 6 * 60 * 60 * 1000))

/** Os dias de jogo com rolagem, o mais recente primeiro: `{ day, count, first, last, people }`. */
export async function readDiaryDays(mesa) {
  const db = supabase()
  if (!db) {
    const days = new Map()
    for (const roll of memoryFeed(mesa).rolls) {
      const day = diaryDay(roll.at)
      const d = days.get(day) ?? { day, count: 0, first: roll.at, last: roll.at, who: new Set() }
      d.count++
      d.first = Math.min(d.first, roll.at)
      d.last = Math.max(d.last, roll.at)
      d.who.add(roll.slug ?? roll.by)
      days.set(day, d)
    }
    return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1))
      .map(({ who, ...d }) => ({ ...d, people: who.size }))
  }
  return check(await db.rpc('diary_days', { p_mesa: mesa })).map((d) => ({
    day: d.day, count: Number(d.count), first: Number(d.first), last: Number(d.last), people: Number(d.people),
  }))
}

/** As rolagens de um dia de jogo (`YYYY-MM-DD`), na ordem em que aconteceram. */
export async function readDiaryRolls(mesa, day) {
  const db = supabase()
  if (!db) return memoryFeed(mesa).rolls.filter((r) => diaryDay(r.at) === day).sort((a, b) => a.at - b.at)
  return check(await db.rpc('diary_rolls', { p_mesa: mesa, p_day: day }))
}


// ── Histórico da mesa ────────────────────────────────────────────────────────
// O resumo de cada pessoa em cada dia de jogo (`diary_summary` no banco), que o
// cliente soma para os troféus de todas as sessões. ESPELHO de `summarize` em
// `src/modules/session-diary/stats.ts` — o `check-rolls` confere os dois com os
// mesmos casos, e o `check-diary` confere o SQL contra o cliente.

const summaryKey = (roll) => roll.slug || `nome:${(roll.by || 'Alguém').trim().toLowerCase()}`
const checksOfRoll = (roll) => (roll.rays ? roll.rays.map((r) => r.check) : roll.check ? [roll.check] : [])
const damageOfRoll = (roll) => (roll.rays ? roll.rays.reduce((n, r) => n + r.damage.total, 0) : roll.damage?.total ?? 0)

/** As rolagens (em ordem) resumidas por (dia, pessoa), ordenadas por dia e chave. */
export function summarizeRolls(rolls) {
  const rows = new Map()
  for (const roll of rolls) {
    const day = diaryDay(roll.at)
    const key = summaryKey(roll)
    const id = `${day}|${key}`
    let s = rows.get(id)
    if (!s) {
      s = {
        day, key, name: roll.by || 'Alguém', color: roll.color,
        rolls: 0, damage: 0, checks: 0, d20Sum: 0, nat20: 0, nat1: 0, mythic: 0,
        hist: new Array(20).fill(0), best: null, worst: null, biggestHit: null,
      }
      rows.set(id, s)
    }
    s.rolls++
    const checks = checksOfRoll(roll)
    for (const c of checks) {
      s.checks++
      s.d20Sum += c.d20
      s.hist[c.d20 - 1]++
      if (c.d20 === 20) s.nat20++
      if (c.d20 === 1) s.nat1++
      if (!s.best || c.total > s.best.total) s.best = { total: c.total, title: roll.title, at: roll.at }
      if (!s.worst || c.total < s.worst.total) s.worst = { total: c.total, title: roll.title, at: roll.at }
    }
    if (checks.some((c) => c.mythic)) s.mythic++
    const dmg = damageOfRoll(roll)
    if (dmg > 0) {
      s.damage += dmg
      if (!s.biggestHit || dmg > s.biggestHit.total) s.biggestHit = { total: dmg, title: roll.title, at: roll.at }
    }
  }
  return [...rows.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

const summaryMark = (m) => (m && typeof m === 'object' ? { total: Number(m.total), title: String(m.title ?? ''), at: Number(m.at) } : null)

/** O resumo de todos os dias de jogo da mesa (o mais antigo primeiro). */
export async function readDiarySummary(mesa) {
  const db = supabase()
  if (!db) return summarizeRolls([...memoryFeed(mesa).rolls].sort((a, b) => a.at - b.at))
  return check(await db.rpc('diary_summary', { p_mesa: mesa })).map((s) => ({
    day: s.day, key: s.key, name: s.name, color: s.color,
    rolls: Number(s.rolls), damage: Number(s.damage), checks: Number(s.checks), d20Sum: Number(s.d20Sum),
    nat20: Number(s.nat20), nat1: Number(s.nat1), mythic: Number(s.mythic),
    // O banco manda `{ "20": 3 }`; aqui vira a contagem das 20 faces.
    hist: Array.from({ length: 20 }, (_, i) => Number(s.hist?.[String(i + 1)] ?? 0)),
    best: summaryMark(s.best), worst: summaryMark(s.worst), biggestHit: summaryMark(s.biggestHit),
  }))
}
