// Rotas das fichas publicadas, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` e não num arquivo novo
// pelo limite de 12 funções serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?sheets=1                        → lista das fichas publicadas
//   GET  ?sheet=<slug>                    → a ficha publicada (com o guia)
//   POST { action: 'draft-create', sheet, names, version, companions?, baseGuide?, baseGuideEn? }
//                                         → o JSON enviado vira um RASCUNHO (ver sheet-draft.js): a ficha
//                                           só entra na mesa quando tudo está preparado no banco
//   POST { action: 'draft-step', char }   → faz o próximo pedaço do preparo (o cliente chama em laço)
//   POST { action: 'draft-discard', char } → desiste do rascunho
//   GET  ?sheetDraft=<slug>               → o andamento de um rascunho (sem o JSON)
//   POST { action: 'publish', sheet }     → publica um JSON do Pathbuilder NA HORA, sem preparo
//                                           (scripts e cliente antigo; o app usa o rascunho)
//   POST { action: 'guide', char, baseGuide? } → gera o guia da versão atual
//   POST { action: 'restore', char, version? } → volta a uma versão do histórico (a anterior sem `version`)
//   GET  ?sheetVersions=<slug>            → o histórico da ficha (sem o JSON de cada versão)
//   GET  ?sheetDescriptions=<slug>[&lang=en] → magias, talentos, habilidades e itens já traduzidos
//                                         (ou, em inglês, como a AON escreve)
//   POST { action: 'sheet-descriptions', char, names: { spell, feat, special, item }, version, lang? }
//                                         → resolve o que falta (ver sheet-descriptions.js)
//
// Tudo dentro da mesa do pedido (`mesa`, ver mesas.js). `ctx.userId` é quem pediu,
// gravado como autor ao publicar; `ctx.access` (ver access.js) diz o papel dele na mesa.
//
// Com a cobrança ligada (`AUTH_REQUIRED`), a ficha tem DONO: quem a publica pela primeira
// vez é o dono, e só o dono e o GM publicam por cima, pedem o guia ou restauram. Ficha sem
// dono (as publicadas antes do login) é só do GM até ele atribuí-la.

import { warmSheetLookups } from './sheet-warm.js'
import { hasTranslationKey } from './aon.js'
import { isValidSlug } from './table-store.js'
import { isSupabaseConfigured } from './supabase.js'
import { canEditSheet, forbidden, forgetOwner, sheetOwner } from './access.js'
import {
  MAX_GUIDE_BYTES,
  MAX_SHEET_BYTES,
  listSheetVersions,
  listSheets,
  publishSheet,
  readForGuide,
  claimSheet,
  readSheet,
  restorePrevious,
  saveGuide,
  editGuide,
  sheetInfo,
  slugFromName,
} from './sheet-store.js'
import { generateGuide } from './guide-core.js'
import {
  buildSheetDescriptions,
  cleanDescriptionNames,
  isValidDescriptionVersion,
  readSheetDescriptions,
} from './sheet-descriptions.js'
import { recordFeat, safely } from './trophy-store.js'
import { createDraft, discardDraft, draftCreator, listDrafts, readDraft, sameAsPublished, stepDraft } from './sheet-draft.js'

// Fichas e descrições moram no Supabase; sem ele, num Map de processo.
const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

/** Falso quando a requisição não é de ficha — aí segue a rota do estado. */
export function isSheetRequest(method, query, body) {
  if (method === 'GET') return !!(query.sheets || query.sheet || query.sheetDescriptions || query.sheetVersions || query.sheetDraft)
  if (method === 'POST') return typeof body?.action === 'string'
  return false
}

export async function handleSheetRequest(mesa, method, query, body, ctx = {}) {
  if (method === 'GET') {
    // Os rascunhos em preparo vão junto: a mesa vê "em preparo" sem abrir nada.
    if (query.sheets) {
      const [sheets, drafts] = await Promise.all([listSheets(mesa), listDrafts(mesa)])
      return ok({ sheets, drafts })
    }
    if (query.sheetDraft) {
      const slug = String(query.sheetDraft)
      if (!isValidSlug(slug)) return fail(400, 'Parâmetro "sheetDraft" inválido')
      return ok({ draft: await readDraft(mesa, slug) })
    }
    if (query.sheetVersions) {
      const slug = String(query.sheetVersions)
      if (!isValidSlug(slug)) return fail(400, 'Parâmetro "sheetVersions" inválido')
      return ok({ versions: await listSheetVersions(mesa, slug) })
    }
    if (query.sheetDescriptions) {
      const slug = String(query.sheetDescriptions)
      if (!isValidSlug(slug)) return fail(400, 'Parâmetro "sheetDescriptions" inválido')
      return ok({ bundle: await readSheetDescriptions(mesa, slug, query.lang === 'en' ? 'en' : 'pt') })
    }
    const slug = String(query.sheet)
    if (!isValidSlug(slug)) return fail(400, 'Parâmetro "sheet" inválido')
    const sheet = await readSheet(mesa, slug)
    return ok({ sheet })
  }

  const action = body.action

  if (action === 'draft-create') {
    const json = body.sheet
    const info = sheetInfo(json)
    if (!info) return fail(400, 'Não parece um JSON do Pathbuilder (falta build.name ou build.level)')
    if (JSON.stringify(json).length > MAX_SHEET_BYTES) return fail(400, 'Ficha grande demais')
    const names = cleanDescriptionNames(body.names)
    if (!names) return fail(400, 'Campo "names" inválido')
    if (!isValidDescriptionVersion(body.version)) return fail(400, 'Campo "version" inválido')
    // O slug sai do nome da própria ficha, como no `publish`.
    const draftSlug = slugFromName(info.name)
    const { access } = ctx
    const existed = access?.enforce ? (await sheetOwner(mesa, draftSlug)).exists : true
    if (existed && !(await canEditSheet(access, mesa, draftSlug))) {
      return forbidden('Esta ficha é de outra pessoa — só o dono ou o GM publica por cima')
    }
    // Ficha nova que outra pessoa já está preparando: só o GM passa por cima.
    if (!existed && access?.enforce && access.role !== 'gm') {
      const other = await draftCreator(mesa, draftSlug)
      if (other && other.createdBy !== access.userId) return forbidden('Outra pessoa já está preparando esta ficha')
    }
    if (await sameAsPublished(mesa, draftSlug, json)) return fail(409, 'Igual à ficha publicada — não há o que atualizar')
    const draft = await createDraft(mesa, draftSlug, {
      json,
      names,
      version: body.version,
      companions: body.companions,
      baseGuide: body.baseGuide,
      baseGuideEn: body.baseGuideEn,
      createdBy: ctx.userId ?? null,
      maxGuideBytes: MAX_GUIDE_BYTES,
    })
    return ok({ draft })
  }

  if (action === 'publish') {
    const json = body.sheet
    const info = sheetInfo(json)
    if (!info) return fail(400, 'Não parece um JSON do Pathbuilder (falta build.name ou build.level)')
    if (JSON.stringify(json).length > MAX_SHEET_BYTES) return fail(400, 'Ficha grande demais')
    // O slug sai do nome da própria ficha, nunca do que o cliente disser: é a
    // mesma identidade do estado da mesa, e uma ficha publicada no slug de
    // outro personagem sobrescreveria alguém.
    const publishSlug = slugFromName(info.name)
    const { access } = ctx
    const existed = access?.enforce ? (await sheetOwner(mesa, publishSlug)).exists : true
    if (existed && !(await canEditSheet(access, mesa, publishSlug))) {
      return forbidden('Esta ficha é de outra pessoa — só o dono ou o GM publica por cima')
    }
    const sheet = await publishSheet(mesa, publishSlug, json, ctx.userId ?? null)
    if (access?.enforce && !existed) {
      await claimSheet(mesa, publishSlug, ctx.userId)
      forgetOwner(mesa, publishSlug)
      sheet.ownerId = ctx.userId
    }
    await safely('ficha publicada', async () => {
      const owner = sheet.ownerId && sheet.ownerId === ctx.userId ? ctx.userId : null
      if (!owner) return
      const gained = sheet.previous?.level ? sheet.level - sheet.previous.level : 0
      if (gained > 0) await recordFeat(mesa, owner, 'level-up', { slug: publishSlug, level: sheet.level, gained }, false)
      await recordFeat(mesa, owner, 'sheet-published', { slug: publishSlug, level: sheet.level })
    })
    // As consultas da ficha à AON ficam no banco já na publicação (não segura a resposta mais que alguns segundos).
    await Promise.race([warmSheetLookups(json).catch(() => {}), new Promise((r) => setTimeout(r, 8000))])
    return ok({ sheet })
  }

  const slug = String(body.char || '')
  if (!isValidSlug(slug)) return fail(400, 'Campo "char" inválido')

  if (action === 'draft-step' || action === 'draft-discard') {
    // Conduz ou descarta: quem criou o rascunho, o dono da ficha que já existe, ou o GM.
    const creator = await draftCreator(mesa, slug)
    const { access } = ctx
    const allowed = !access?.enforce || access.role === 'gm'
      || (creator && creator.createdBy === access.userId)
      || ((await sheetOwner(mesa, slug)).exists && (await canEditSheet(access, mesa, slug)))
    if (!allowed) return forbidden('Esta ficha está sendo preparada por outra pessoa')
    if (action === 'draft-discard') {
      await discardDraft(mesa, slug)
      return ok({ discarded: true })
    }
    const out = await stepDraft(mesa, slug, { userId: ctx.userId ?? null, enforce: !!access?.enforce })
    if (out.state === 'ready' && out.sheet) {
      if (out.created) forgetOwner(mesa, slug)
      const sheet = out.sheet
      await safely('ficha publicada', async () => {
        const owner = sheet.ownerId && sheet.ownerId === out.publishedBy ? out.publishedBy : null
        if (!owner) return
        const gained = sheet.previous?.level ? sheet.level - sheet.previous.level : 0
        if (gained > 0) await recordFeat(mesa, owner, 'level-up', { slug, level: sheet.level, gained }, false)
        await recordFeat(mesa, owner, 'sheet-published', { slug, level: sheet.level })
      })
    }
    const { publishedBy: _by, created: _created, ...reply } = out
    return ok(reply)
  }

  // Gerar o guia e restaurar alteram a ficha: dono ou GM. As descrições (abaixo) não —
  // abrir a ficha de outra pessoa completa o pacote dela, e isso é de todos.
  if ((action === 'guide' || action === 'guide-edit' || action === 'restore') && !(await canEditSheet(ctx.access, mesa, slug))) {
    return forbidden('Esta ficha é de outra pessoa — só o dono ou o GM faz isso')
  }

  if (action === 'guide') {
    if (!hasTranslationKey()) return fail(503, 'Sem chave de IA configurada no servidor')
    const current = await readForGuide(mesa, slug)
    if (!current) return fail(404, 'Ficha não publicada')
    // Base do guia novo: o gerado para a versão anterior; senão, o que o
    // cliente mostrava (o curado à mão em `combatGuides.ts`, que só o
    // frontend conhece).
    const clientBase = typeof body.baseGuide === 'string' ? body.baseGuide.slice(0, MAX_GUIDE_BYTES) : null
    const clientBaseEn = typeof body.baseGuideEn === 'string' ? body.baseGuideEn.slice(0, MAX_GUIDE_BYTES) : null
    // Os dois idiomas juntos (a publicação), cada um GERADO da ficha — o inglês não é
    // tradução do português. `lang: 'en'` pede só o inglês (ficha publicada antes dele).
    const want = body.lang === 'en' ? ['en'] : body.lang === 'pt' ? ['pt'] : ['pt', 'en']
    const [pt, en] = await Promise.all([
      want.includes('pt') ? generateGuide(current.json, current.previousGuide ?? clientBase, 'pt').catch(() => null) : null,
      want.includes('en') ? generateGuide(current.json, current.previousGuideEn ?? clientBaseEn, 'en').catch(() => null) : null,
    ])
    if (!pt && !en) return fail(502, 'A IA não devolveu um guia válido — tente de novo')
    const sheet = await saveGuide(mesa, slug, current.publishedAt, pt, { en, current: current.guide })
    if (!sheet) return fail(409, 'A ficha mudou enquanto o guia era gerado')
    return ok({ sheet })
  }

  if (action === 'guide-edit') {
    // O guia escrito à mão pelo dono: só o texto, na língua pedida. Sem IA.
    const markdown = typeof body.markdown === 'string' ? body.markdown.replace(/\r\n?/g, '\n').trim() : ''
    if (!markdown) return fail(400, 'O guia não pode ficar vazio')
    if (Buffer.byteLength(markdown, 'utf8') > MAX_GUIDE_BYTES) return fail(413, 'Guia grande demais')
    const publishedAt = Number(body.publishedAt)
    if (!Number.isSafeInteger(publishedAt)) return fail(400, 'Campo "publishedAt" inválido')
    const sheet = await editGuide(mesa, slug, publishedAt, body.lang === 'en' ? 'en' : 'pt', markdown)
    if (!sheet) return fail(409, 'A ficha foi publicada de novo enquanto você editava — reabra a ficha')
    return ok({ sheet })
  }

  if (action === 'sheet-descriptions') {
    // O idioma do PACOTE vai no corpo: a publicação pede os dois, qualquer que seja o de quem publica.
    const lang = body.lang === 'en' ? 'en' : body.lang === 'pt' ? 'pt' : (ctx.lang ?? 'pt')
    // Inglês é o texto da AON: não precisa de chave de IA.
    if (lang === 'pt' && !hasTranslationKey()) return fail(503, 'Sem chave de IA configurada no servidor')
    const names = cleanDescriptionNames(body.names)
    if (!names) return fail(400, 'Campo "names" inválido')
    if (!isValidDescriptionVersion(body.version)) return fail(400, 'Campo "version" inválido')
    // Só de ficha publicada: os presets que ninguém publicou têm o pacote estático.
    if (!(await readSheet(mesa, slug))) return fail(404, 'Ficha não publicada')
    return ok(await buildSheetDescriptions(mesa, slug, names, body.version, lang))
  }

  if (action === 'restore') {
    const version = body.version == null ? null : Number(body.version)
    if (version !== null && !Number.isSafeInteger(version)) return fail(400, 'Campo "version" inválido')
    const sheet = await restorePrevious(mesa, slug, version, ctx.userId ?? null)
    if (!sheet) return fail(404, version === null ? 'Não há versão anterior' : 'Versão não encontrada')
    return ok({ sheet })
  }

  return fail(400, 'Ação desconhecida')
}
