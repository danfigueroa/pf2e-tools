// Rotas do Diário de Campanha, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?journal=list                          → { docs: resumo[] }            (GM)
//   GET  ?journal=<id>                          → { doc | null }               (GM)
//   POST { action: 'journal-save', doc, base }  → { updatedAt } | 409          (GM)
//   POST { action: 'journal-delete', id }       → { ok }                       (GM)
//   POST { action: 'journal-reveal', reveal, by, color }
//                                               → { share }: mostra à mesa     (GM)
//   GET  ?reveal=<id>                           → { reveal | null }            (qualquer membro)
//
// O diário tem segredos: tudo, menos o `?reveal=`, exige o GM DE VERDADE
// SEMPRE, mesmo com `AUTH_REQUIRED` desligado — como a gestão de conta. Sem
// Supabase (modo local) não há como saber quem é o GM, e o cliente também libera.
//
// Vem ANTES da ficha publicada nos dois servidores: a rota da ficha aceita
// qualquer POST com `action` e engoliria esta.

import { isSupabaseConfigured } from './supabase.js'
import { forbidden, memberRole } from './access.js'
import { imagePath } from './images.js'
import { addShare, sanitizeShare } from './roll-store.js'
import { ID_RE, addReveal, cleanDoc, cleanReveal, deleteDoc, listDocs, readDoc, readReveal, writeDoc } from './journal-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

const ACTIONS = new Set(['journal-save', 'journal-delete', 'journal-reveal'])

/** Falso quando a requisição não é do diário — aí segue para as outras rotas do `state`. */
export function isJournalRequest(method, query, body) {
    if (method === 'GET') return query.journal !== undefined || query.reveal !== undefined
    if (method === 'POST') return ACTIONS.has(body?.action)
    return false
}

async function isRealGm(mesa, access) {
    if (!isSupabaseConfigured()) return true
    if (!access?.userId) return false
    return (access.role ?? (await memberRole(mesa, access.userId))) === 'gm'
}

/** URL de imagem que o cartão dos jogadores pode mostrar: do nosso Storage, ou `idb:` sem Supabase. */
const validImage = (url) =>
    typeof url === 'string' && (imagePath(url) !== null || (!isSupabaseConfigured() && /^idb:[a-z0-9-]{1,64}$/.test(url)))

export async function handleJournalRequest(mesa, method, query, body, ctx = {}) {
    if (method === 'GET' && query.reveal !== undefined) {
        if (!ID_RE.test(String(query.reveal))) return fail(400, 'Referência inválida')
        return ok({ reveal: await readReveal(mesa, String(query.reveal)) })
    }

    if (!(await isRealGm(mesa, ctx.access))) return forbidden('Só o GM abre o diário de campanha')
    const by = ctx.userId ?? null

    if (method === 'GET') {
        if (query.journal === 'list') return ok({ docs: await listDocs(mesa) })
        if (!ID_RE.test(String(query.journal))) return fail(400, 'Documento inválido')
        return ok({ doc: await readDoc(mesa, String(query.journal)) })
    }

    if (body.action === 'journal-save') {
        const doc = cleanDoc(body.doc)
        if (!doc) return fail(400, 'Documento inválido')
        const base = body.base === null || body.base === undefined ? null : Number(body.base)
        if (base !== null && !Number.isFinite(base)) return fail(400, 'Versão inválida')
        const out = await writeDoc(mesa, doc, base, by)
        if (out.conflict) {
            const current = await readDoc(mesa, doc.id)
            return { status: 409, body: { error: 'Editado em outro aparelho', code: 'conflict', doc: current } }
        }
        return ok({ updatedAt: out.updatedAt })
    }

    if (body.action === 'journal-delete') {
        if (typeof body.id !== 'string' || !ID_RE.test(body.id)) return fail(400, 'Documento inválido')
        await deleteDoc(mesa, body.id)
        return ok({ ok: true })
    }

    // journal-reveal: grava o que foi mostrado e o põe no feed (o cartão de todos).
    const raw = body.reveal ?? {}
    if (raw.image !== undefined && raw.image !== null && !validImage(raw.image)) return fail(400, 'Imagem inválida')
    const reveal = cleanReveal(raw)
    if (!reveal) return fail(400, 'Nada para mostrar')
    const share = sanitizeShare({
        id: reveal.id, by: body.by, color: body.color, type: 'handout', name: reveal.title, ref: reveal.id,
    })
    if (!share) return fail(400, 'Compartilhamento inválido')
    await addReveal(mesa, reveal, by)
    const rev = await addShare(mesa, share, by)
    return ok({ rev, share })
}
