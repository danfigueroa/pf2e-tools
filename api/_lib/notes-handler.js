// Rotas das Anotações do personagem, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?notes=<slug>                                  → { notes: { data, updatedAt } | null }  (qualquer membro)
//   POST { action: 'notes-save', char, data, base }     → { updatedAt } | 409                    (dono da ficha e GM)
//
// Vem ANTES da ficha publicada nos dois servidores: a rota da ficha aceita
// qualquer POST com `action` e engoliria esta.

import { isSupabaseConfigured } from './supabase.js'
import { canEditSheet, forbidden } from './access.js'
import { isValidSlug } from './table-store.js'
import { cleanNotes, readNotes, writeNotes } from './notes-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

/** Falso quando a requisição não é das anotações — aí segue para as outras rotas do `state`. */
export function isNotesRequest(method, query, body) {
    if (method === 'GET') return query.notes !== undefined
    if (method === 'POST') return body?.action === 'notes-save'
    return false
}

export async function handleNotesRequest(mesa, method, query, body, ctx = {}) {
    if (method === 'GET') {
        if (!isValidSlug(query.notes)) return fail(400, 'Personagem inválido')
        return ok({ notes: await readNotes(mesa, query.notes) })
    }

    if (!isValidSlug(body.char)) return fail(400, 'Personagem inválido')
    if (!(await canEditSheet(ctx.access, mesa, body.char))) return forbidden('Este personagem é de outra pessoa')
    const data = cleanNotes(body.data)
    if (!data) return fail(400, 'Anotações inválidas ou grandes demais')
    const base = body.base === null || body.base === undefined ? null : Number(body.base)
    if (base !== null && !Number.isFinite(base)) return fail(400, 'Versão inválida')

    const out = await writeNotes(mesa, body.char, data, base, ctx.userId ?? null)
    if (out.conflict) {
        const current = await readNotes(mesa, body.char)
        return { status: 409, body: { error: 'Editado em outro aparelho', code: 'conflict', notes: current } }
    }
    return ok({ updatedAt: out.updatedAt })
}
