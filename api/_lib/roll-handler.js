// Rotas do feed de rolagens, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?rolls=1[&rev=N]               → o contador; com `rev` diferente (ou
//                                          sem `rev`), as últimas 30 rolagens
//   POST { action: 'roll-add', roll }   → grava uma rolagem já sorteada
//   POST { action: 'share-add', share } → compartilha uma regra (talento, magia…)
//                                          com a mesa; o GET a devolve em `shares`
//
// Vem ANTES da ficha publicada nos dois servidores: a rota da ficha aceita
// qualquer POST com `action` e engoliria esta.

import { isRedisConfigured } from './table-store.js'
import { addRoll, addShare, readRolls, sanitizeRoll, sanitizeShare } from './roll-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isRedisConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

/** Falso quando a requisição não é do feed — aí segue para as outras rotas do `state`. */
export function isRollRequest(method, query, body) {
  if (method === 'GET') return !!query.rolls
  if (method === 'POST') return body?.action === 'roll-add' || body?.action === 'share-add'
  return false
}

export async function handleRollRequest(mesa, method, query, body) {
  if (method === 'GET') {
    const known = query.rev != null && query.rev !== '' ? Number(query.rev) : null
    return ok(await readRolls(mesa, Number.isFinite(known) ? known : null))
  }
  if (body?.action === 'share-add') {
    const share = sanitizeShare(body?.share)
    if (!share) return fail(400, 'Compartilhamento inválido')
    const rev = await addShare(mesa, share)
    return ok({ rev, share })
  }
  const roll = sanitizeRoll(body?.roll)
  if (!roll) return fail(400, 'Rolagem inválida')
  const rev = await addRoll(mesa, roll)
  return ok({ rev, roll })
}
