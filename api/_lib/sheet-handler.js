// Rotas das fichas publicadas, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` e não num arquivo novo
// pelo limite de 12 funções serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?sheets=1                        → lista das fichas publicadas
//   GET  ?sheet=<slug>                    → a ficha publicada (com o guia)
//   POST { action: 'publish', sheet }     → publica um JSON do Pathbuilder
//   POST { action: 'guide', char, baseGuide? } → gera o guia da versão atual
//   POST { action: 'restore', char }      → volta à versão anterior

import { hasTranslationKey } from './aon.js'
import { isStoreConfigured, isValidSlug } from './table-store.js'
import {
  MAX_GUIDE_BYTES,
  MAX_SHEET_BYTES,
  listSheets,
  publishSheet,
  readForGuide,
  readSheet,
  restorePrevious,
  saveGuide,
  sheetInfo,
  slugFromName,
} from './sheet-store.js'
import { generateGuide } from './guide-core.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isStoreConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

/** Falso quando a requisição não é de ficha — aí segue a rota do estado. */
export function isSheetRequest(method, query, body) {
  if (method === 'GET') return !!(query.sheets || query.sheet)
  if (method === 'POST') return typeof body?.action === 'string'
  return false
}

export async function handleSheetRequest(method, query, body) {
  if (method === 'GET') {
    if (query.sheets) return ok({ sheets: await listSheets() })
    const slug = String(query.sheet)
    if (!isValidSlug(slug)) return fail(400, 'Parâmetro "sheet" inválido')
    const sheet = await readSheet(slug)
    return ok({ sheet })
  }

  const action = body.action

  if (action === 'publish') {
    const json = body.sheet
    const info = sheetInfo(json)
    if (!info) return fail(400, 'Não parece um JSON do Pathbuilder (falta build.name ou build.level)')
    if (JSON.stringify(json).length > MAX_SHEET_BYTES) return fail(400, 'Ficha grande demais')
    // O slug sai do nome da própria ficha, nunca do que o cliente disser: é a
    // mesma identidade do estado da mesa, e uma ficha publicada no slug de
    // outro personagem sobrescreveria alguém.
    const sheet = await publishSheet(slugFromName(info.name), json)
    return ok({ sheet })
  }

  const slug = String(body.char || '')
  if (!isValidSlug(slug)) return fail(400, 'Campo "char" inválido')

  if (action === 'guide') {
    if (!hasTranslationKey()) return fail(503, 'Sem chave de IA configurada no servidor')
    const current = await readForGuide(slug)
    if (!current) return fail(404, 'Ficha não publicada')
    // Base do guia novo: o gerado para a versão anterior; senão, o que o
    // cliente mostrava (o curado à mão em `combatGuides.ts`, que só o
    // frontend conhece).
    const clientBase = typeof body.baseGuide === 'string' ? body.baseGuide.slice(0, MAX_GUIDE_BYTES) : null
    const markdown = await generateGuide(current.json, current.previousGuide ?? clientBase)
    if (!markdown) return fail(502, 'A IA não devolveu um guia válido — tente de novo')
    const sheet = await saveGuide(slug, current.publishedAt, markdown)
    if (!sheet) return fail(409, 'A ficha mudou enquanto o guia era gerado')
    return ok({ sheet })
  }

  if (action === 'restore') {
    const sheet = await restorePrevious(slug)
    if (!sheet) return fail(404, 'Não há versão anterior')
    return ok({ sheet })
  }

  return fail(400, 'Ação desconhecida')
}
