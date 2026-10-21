// Rotas das correções de tradução, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?fixes=1                                → { fixes: [{ kind, name, fields, previous, updatedAt }] }
//   POST { action: 'fix-save', kind, name, fields } → { fix }   (`fields: {}` = voltar à tradução automática)
//
// Globais: a mesa do pedido não muda nada aqui. Vem ANTES da ficha publicada nos
// dois servidores: a rota da ficha aceita qualquer POST com `action`.

import { isSupabaseConfigured } from './supabase.js'
import { isValidFixKey, listFixes, sanitizeFixFields, saveFix } from './fix-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

/** Falso quando a requisição não é de correção — aí segue para as outras rotas do `state`. */
export function isFixRequest(method, query, body) {
    if (method === 'GET') return !!query.fixes
    if (method === 'POST') return body?.action === 'fix-save'
    return false
}

/** `ctx.userId`: a sessão anônima de quem corrigiu, gravada em `updated_by`. */
export async function handleFixRequest(method, query, body, ctx = {}) {
    if (method === 'GET') return ok({ fixes: await listFixes() })
    const { kind, name } = body ?? {}
    if (!isValidFixKey(kind, name)) return fail(400, 'Tipo ou nome inválido')
    const fields = sanitizeFixFields(kind, body.fields)
    if (!fields) return fail(400, 'Correção inválida')
    return ok({ fix: await saveFix(kind, name, fields, ctx.userId ?? null) })
}
