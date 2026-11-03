// Publicação PREPARADA (migration `publicacao_preparada`): o JSON enviado vira um RASCUNHO, e a
// ficha só entra na mesa quando tudo o que ela precisa está no banco e conferido —
//
//   1. lookups      consultas da AON (traços de arma e armadura, consumíveis, escudos, regras de traço
//                   em pt e en), `sheet-warm.js`
//   2. companions   companheiros animais (pets do Pathbuilder) em pt e en, `resolveCompanions`
//   3. desc-pt      as descrições em português (`buildSheetDescriptions`, AON + LLM)
//   4. desc-en      as descrições em inglês (o texto da AON)
//   5. guide-pt     o guia "Como Jogar" em português, gerado da ficha
//   6. guide-en     o guia em inglês, gerado da ficha (não é tradução do português)
//   7. finish       confere tudo de novo e PROMOVE o rascunho a `sheets` (`promote_sheet_draft`)
//
// O trabalho não cabe numa chamada (60 s de `maxDuration`; uma ficha nova leva minutos), então o
// navegador de quem publicou chama `draft-step` em laço. Cada chamada faz o que couber em
// `BUDGET_MS`, grava o andamento no rascunho (que a mesa vê pelo canal `sheets`, evento `preparing`)
// e devolve:
//   { state: 'working' }               chame de novo já
//   { state: 'waiting', retryIn }      a IA/AON não avançou: chame de novo depois (recuo de 15 s a 2 min)
//   { state: 'ready', sheet }          promovida: a ficha da mesa
//   { state: 'error', error }          não há como seguir (sem chave de IA): só quem configura resolve
// O estado mora no servidor: fechar a aba e voltar, ou outro aparelho continuar, retoma de onde parou.
// Falha da IA nunca promove pela metade (decisão do usuário: esperar e tentar de novo).

import { supabase } from './supabase.js'
import { sameJson } from './json.js'
import { hasTranslationKey } from './aon.js'
import { warmSheetLookups } from './sheet-warm.js'
import { resolveCompanions } from './companion-core.js'
import { generateGuide, looksLikeGuide } from './guide-core.js'
import { buildSheetDescriptions, DESCRIPTION_KINDS, readSheetDescriptions } from './sheet-descriptions.js'
import { publishSheet, readSheet, saveGuide, sheetInfo } from './sheet-store.js'

export const DRAFT_STEPS = ['lookups', 'companions', 'desc-pt', 'desc-en', 'guide-pt', 'guide-en', 'finish']

const LOCK_SECONDS = 70
// Não começa um passo novo depois disto. Cada passo pesado tem também o próprio teto de início
// (`STARTS_BEFORE`), porque ele sozinho pode levar dezenas de segundos: uma rodada de descrições para de
// começar grupos aos 30 s e um grupo frio leva até ~20 s; um guia, até ~30 s.
const BUDGET_MS = 25_000
const STARTS_BEFORE = { lookups: 5_000, companions: 15_000, 'desc-pt': 5_000, 'desc-en': 5_000, 'guide-pt': 3_000, 'guide-en': 3_000, finish: 40_000 }
const MAX_COMPANIONS = 6
const BACKOFF_MS = [15_000, 30_000, 60_000, 120_000]
// `busy` (outro aparelho completando as descrições da mesma ficha) passa rápido.
const BUSY_RETRY_MS = 5_000

const backoff = (attempts) => BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[0]

// --- Armazenamento ------------------------------------------------------------

const fromRow = (row) => row && {
  slug: row.slug,
  json: row.json,
  name: row.name,
  className: row.class_name,
  level: row.level,
  names: row.names,
  version: row.version,
  companions: Array.isArray(row.companions) ? row.companions : [],
  baseGuide: row.base_guide ?? null,
  baseGuideEn: row.base_guide_en ?? null,
  guide: row.guide ?? null,
  progress: row.progress ?? {},
  createdBy: row.created_by ?? null,
  updatedAt: Date.parse(row.updated_at) || Date.now(),
}

const dbStore = (db) => {
  const check = ({ data, error }) => {
    if (error) throw error
    return data
  }
  return {
    read: async (mesa, slug) => fromRow(check(await db.from('sheet_drafts').select('*')
      .eq('mesa', mesa).eq('slug', slug).maybeSingle())),
    list: async (mesa) => check(await db.from('sheet_drafts')
      .select('slug, name, class_name, level, progress, created_by, updated_at').eq('mesa', mesa))
      .map(fromRow),
    write: async (mesa, draft) => {
      check(await db.from('sheet_drafts').upsert({
        mesa,
        slug: draft.slug,
        json: draft.json,
        name: draft.name,
        class_name: draft.className,
        level: draft.level,
        names: draft.names,
        version: draft.version,
        companions: draft.companions,
        base_guide: draft.baseGuide,
        base_guide_en: draft.baseGuideEn,
        guide: null,
        progress: draft.progress,
        created_by: draft.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
    },
    update: async (mesa, slug, fields) => {
      const row = { updated_at: new Date().toISOString() }
      if ('guide' in fields) row.guide = fields.guide
      if ('progress' in fields) row.progress = fields.progress
      check(await db.from('sheet_drafts').update(row).eq('mesa', mesa).eq('slug', slug))
    },
    remove: async (mesa, slug) => { check(await db.from('sheet_drafts').delete().eq('mesa', mesa).eq('slug', slug)) },
    promote: async (mesa, slug, by, owner) => {
      const row = check(await db.rpc('promote_sheet_draft', { p_mesa: mesa, p_slug: slug, p_by: by, p_owner: owner }))
      return row ? readSheet(mesa, slug) : null
    },
    lock: async (key) => check(await db.rpc('try_lock', { p_key: key, p_seconds: LOCK_SECONDS })) === true,
    unlock: async (key) => { check(await db.from('locks').delete().eq('key', key)) },
  }
}

// Sem Supabase: Maps de processo, como o resto (vale enquanto o `dev:api` estiver de pé).
const memoryStore = (() => {
  const drafts = new Map()
  const locks = new Map()
  const key = (mesa, slug) => `${mesa}|${slug}`
  return {
    read: async (mesa, slug) => drafts.get(key(mesa, slug)) ?? null,
    list: async (mesa) => [...drafts.entries()].filter(([k]) => k.startsWith(`${mesa}|`)).map(([, d]) => d),
    write: async (mesa, draft) => { drafts.set(key(mesa, draft.slug), { ...draft, guide: null, updatedAt: Date.now() }) },
    update: async (mesa, slug, fields) => {
      const d = drafts.get(key(mesa, slug))
      if (d) Object.assign(d, fields, { updatedAt: Date.now() })
    },
    remove: async (mesa, slug) => { drafts.delete(key(mesa, slug)) },
    promote: async (mesa, slug) => {
      const d = drafts.get(key(mesa, slug))
      if (!d) return null
      const sheet = await publishSheet(mesa, slug, d.json, d.createdBy)
      drafts.delete(key(mesa, slug))
      return (await saveGuide(mesa, slug, sheet.publishedAt, d.guide?.markdown ?? null, { en: d.guide?.en?.markdown ?? null })) ?? sheet
    },
    lock: async (k) => {
      if ((locks.get(k) ?? 0) > Date.now()) return false
      locks.set(k, Date.now() + LOCK_SECONDS * 1000)
      return true
    },
    unlock: async (k) => { locks.delete(k) },
  }
})()

const store = () => {
  const db = supabase()
  return db ? dbStore(db) : memoryStore
}

// --- Andamento ------------------------------------------------------------------

const nameCount = (names) => DESCRIPTION_KINDS.reduce((n, kind) => n + (names?.[kind]?.length ?? 0), 0)

/** O andamento inicial: todo passo pendente, e o "quanto falta" das descrições = a lista inteira. */
function freshProgress(names) {
  const n = nameCount(names)
  return {
    step: DRAFT_STEPS[0],
    steps: Object.fromEntries(DRAFT_STEPS.map((s) => [s, 'pending'])),
    remaining: { 'desc-pt': n, 'desc-en': n },
    names: n,
    attempts: 0,
    waiting: null,
    retryAt: null,
  }
}

/**
 * `done`/`total` para a barra: cada descrição conta 1 (nas duas línguas), e os demais passos contam 1
 * cada — o guia leva tanto quanto um punhado de descrições, mas a barra só precisa andar.
 */
export function progressView(progress) {
  const p = progress ?? {}
  const n = Number(p.names) || 0
  const steps = p.steps ?? {}
  let done = 0
  let total = 0
  for (const step of DRAFT_STEPS) {
    if (step === 'desc-pt' || step === 'desc-en') {
      total += n
      done += steps[step] === 'done' ? n : Math.max(0, n - (Number(p.remaining?.[step]) || 0))
    } else {
      total += 1
      if (steps[step] === 'done') done += 1
    }
  }
  return {
    step: p.step ?? DRAFT_STEPS[0],
    steps: Object.fromEntries(DRAFT_STEPS.map((s) => [s, steps[s] ?? 'pending'])),
    remaining: p.remaining ?? {},
    done,
    total: Math.max(total, 1),
    waiting: p.waiting ?? null,
    retryAt: p.retryAt ?? null,
    attempts: Number(p.attempts) || 0,
  }
}

const publicDraft = (draft) => draft && {
  slug: draft.slug,
  name: draft.name,
  className: draft.className,
  level: draft.level,
  createdBy: draft.createdBy,
  updatedAt: draft.updatedAt,
  progress: progressView(draft.progress),
}

export async function listDrafts(mesa) {
  return (await store().list(mesa)).map(publicDraft)
}

export async function readDraft(mesa, slug) {
  return publicDraft(await store().read(mesa, slug))
}

/** Quem criou o rascunho (para o portão: conduzir e descartar). `null` = não há rascunho. */
export async function draftCreator(mesa, slug) {
  const d = await store().read(mesa, slug)
  return d ? { createdBy: d.createdBy } : null
}

// --- Criar e descartar ------------------------------------------------------------

const cleanCompanions = (list) => [...new Set((Array.isArray(list) ? list : [])
  .filter((n) => typeof n === 'string').map((n) => n.trim()).filter((n) => n && n.length <= 80))].slice(0, MAX_COMPANIONS)

const cleanText = (text, max) => (typeof text === 'string' && text.trim() ? text.slice(0, max) : null)

/**
 * Cria (ou recomeça) o rascunho de `slug`. O handler já validou JSON, tamanho, nomes e permissão.
 * @returns o rascunho como o cliente o vê.
 */
export async function createDraft(mesa, slug, { json, names, version, companions, baseGuide, baseGuideEn, createdBy, maxGuideBytes }) {
  const info = sheetInfo(json)
  const draft = {
    slug,
    json,
    name: info.name,
    className: info.className,
    level: info.level,
    names,
    version,
    companions: cleanCompanions(companions),
    baseGuide: cleanText(baseGuide, maxGuideBytes),
    baseGuideEn: cleanText(baseGuideEn, maxGuideBytes),
    progress: freshProgress(names),
    createdBy: createdBy ?? null,
  }
  await store().write(mesa, draft)
  return publicDraft(await store().read(mesa, slug))
}

export async function discardDraft(mesa, slug) {
  await store().remove(mesa, slug)
}

/** Igual à ficha da mesa? (subir o mesmo JSON não tem o que preparar). */
export async function sameAsPublished(mesa, slug, json) {
  const current = await readSheet(mesa, slug)
  return !!current && sameJson(current.json, json)
}

// --- Conferência ------------------------------------------------------------------

/**
 * O que falta para a ficha estar completa (puro, coberto pelo `check-rolls`): toda descrição da
 * lista, nas DUAS línguas, tem entrada ou miss (a AON não a conhece), e os dois guias parecem um
 * guia. Devolve os passos que precisam rodar de novo — vazio = pronta.
 */
export function missingParts({ names, bundles, guide }) {
  const redo = []
  for (const [step, bundle] of [['desc-pt', bundles.pt], ['desc-en', bundles.en]]) {
    const complete = DESCRIPTION_KINDS.every((kind) => (names?.[kind] ?? []).every((n) =>
      !!bundle?.entries?.[kind]?.[n] || bundle?.misses?.[kind]?.[n] != null))
    if (!complete) redo.push(step)
  }
  if (!looksLikeGuide(guide?.markdown)) redo.push('guide-pt')
  if (!looksLikeGuide(guide?.en?.markdown)) redo.push('guide-en')
  return redo
}

// --- Um passo -----------------------------------------------------------------------

/** A base do guia: o da ficha que a mesa usa hoje (o editado à mão vence), senão o curado do cliente. */
function guideBase(current, draft, lang) {
  if (lang === 'en') return current?.guide?.en?.markdown ?? draft.baseGuideEn
  return current?.guide?.markdown ?? draft.baseGuide
}

/**
 * Faz o próximo pedaço do preparo de `slug`. `ctx.userId` = quem conduz; `ctx.enforce` = a cobrança
 * está ligada (aí a ficha NOVA ganha como dono quem criou o rascunho, como no `publish`).
 * Em `ready` devolve também `publishedBy` (quem criou o rascunho) e `created` (a ficha não existia).
 */
export async function stepDraft(mesa, slug, ctx = {}) {
  const db = store()
  const lockKey = `sheet-draft:${mesa}:${slug}`
  if (!(await db.lock(lockKey))) return { state: 'busy', retryIn: BUSY_RETRY_MS }
  try {
    const draft = await db.read(mesa, slug)
    if (!draft) {
      // Já promovido (outra aba terminou) ou descartado.
      const sheet = await readSheet(mesa, slug)
      return sheet ? { state: 'ready', sheet } : { state: 'gone' }
    }
    const progress = { ...freshProgress(draft.names), ...draft.progress }
    progress.steps = { ...freshProgress(draft.names).steps, ...draft.progress?.steps }
    progress.remaining = { ...freshProgress(draft.names).remaining, ...draft.progress?.remaining }

    const now = Date.now()
    if (progress.retryAt && progress.retryAt > now) {
      return { state: 'waiting', retryIn: progress.retryAt - now, draft: publicDraft(draft) }
    }
    if (!hasTranslationKey()) {
      return { state: 'error', error: 'Sem chave de IA configurada no servidor', draft: publicDraft(draft) }
    }

    const started = Date.now()
    let guide = draft.guide
    let current // a ficha da mesa hoje (base do guia), lida uma vez
    let wait = null // { reason, ms }
    let advanced = false

    const markDone = (step) => {
      progress.steps[step] = 'done'
      advanced = true
    }

    while (Date.now() - started < BUDGET_MS && !wait) {
      const step = DRAFT_STEPS.find((s) => progress.steps[s] !== 'done')
      if (!step) break
      progress.step = step
      // Passo pesado que não cabe no que sobrou da chamada fica para a próxima ('working').
      if (Date.now() - started > STARTS_BEFORE[step]) break

      if (step === 'lookups') {
        const { pendingTraits } = await warmSheetLookups(draft.json)
        if (pendingTraits > 0) wait = { reason: 'translation' }
        else markDone(step)
      } else if (step === 'companions') {
        if (draft.companions.length > 0) {
          const [pt] = await Promise.all([resolveCompanions(draft.companions, 'pt'), resolveCompanions(draft.companions, 'en')])
          // Não achado na AON (nome caseiro) não segura nada; tradução que falhou, sim.
          if (Object.values(pt).some((c) => c?.translationPending)) { wait = { reason: 'translation' }; continue }
        }
        markDone(step)
      } else if (step === 'desc-pt' || step === 'desc-en') {
        const lang = step === 'desc-en' ? 'en' : 'pt'
        const r = await buildSheetDescriptions(mesa, slug, draft.names, draft.version, lang)
        if (r.busy) { wait = { reason: 'busy', ms: BUSY_RETRY_MS }; continue }
        const added = Object.values(r.added ?? {}).reduce((n, bag) => n + Object.keys(bag).length, 0)
        progress.remaining[step] = r.remaining ?? 0
        if ((r.remaining ?? 0) === 0) markDone(step)
        else if (added === 0) wait = { reason: lang === 'pt' ? 'translation' : 'aon' }
        else advanced = true
      } else if (step === 'guide-pt' || step === 'guide-en') {
        // Um guia por chamada (`STARTS_BEFORE`): os dois juntos, com recuo de 429, passavam dos 60 s.
        const lang = step === 'guide-en' ? 'en' : 'pt'
        if (current === undefined) current = await readSheet(mesa, slug)
        const text = await generateGuide(draft.json, guideBase(current, draft, lang), lang).catch(() => null)
        if (!text) { wait = { reason: 'guide' }; continue }
        const at = Date.now()
        guide = lang === 'en'
          ? { ...(guide ?? {}), en: { markdown: text, generatedAt: at } }
          : { ...(guide ?? {}), markdown: text, generatedAt: at }
        await db.update(mesa, slug, { guide })
        markDone(step)
      } else if (step === 'finish') {
        const [pt, en] = await Promise.all([readSheetDescriptions(mesa, slug, 'pt'), readSheetDescriptions(mesa, slug, 'en')])
        const redo = missingParts({ names: draft.names, bundles: { pt, en }, guide })
        if (redo.length > 0) {
          // Algo se perdeu (miss que venceu, entrada apagada): volta ao passo dele.
          for (const s of redo) progress.steps[s] = 'pending'
          continue
        }
        if (current === undefined) current = await readSheet(mesa, slug)
        const publishedBy = draft.createdBy ?? ctx.userId ?? null
        const owner = ctx.enforce && !current ? publishedBy : null
        const sheet = await db.promote(mesa, slug, publishedBy, owner)
        if (!sheet) return { state: 'gone' }
        return { state: 'ready', sheet, publishedBy, created: !current }
      }
    }

    if (wait) {
      progress.attempts = (Number(progress.attempts) || 0) + 1
      const ms = wait.ms ?? backoff(progress.attempts)
      progress.waiting = wait.reason
      progress.retryAt = Date.now() + ms
      await db.update(mesa, slug, { progress })
      return { state: 'waiting', retryIn: ms, draft: publicDraft({ ...draft, guide, progress }) }
    }
    if (advanced) progress.attempts = 0
    progress.waiting = null
    progress.retryAt = null
    await db.update(mesa, slug, { progress })
    return { state: 'working', draft: publicDraft({ ...draft, guide, progress }) }
  } finally {
    await db.unlock(lockKey)
  }
}
