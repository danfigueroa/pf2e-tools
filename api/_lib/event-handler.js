// Notificações da mesa (o sino). Quem ESCREVE os eventos são os triggers do banco (migration
// `inicio_e_notificacoes`): ficha publicada ou atribuída, mapa ativado ou revelado, combate
// iniciado, regra compartilhada. Aqui só se lê e se marca como lido. Mora no endpoint `state`
// pelo limite de 12 funções serverless (ver CLAUDE.md).
//
//   GET  ?events=1                       → { events: [{ id, kind, data, at }], seen }
//   POST { action: 'events-seen', upTo } → { seen }
//
// O "lido" é da CONTA (`mesa_members.events_seen`), não do aparelho: o que foi visto no
// celular não aparece de novo no computador. Sem login (cobrança desligada, sem sessão) a
// lista volta vazia — não há de quem ler.

import { supabase, isSupabaseConfigured } from './supabase.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

/** Quantas notificações a lista traz: o resto é velho demais para importar. */
const LIMIT = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isEventRequest(method, query, body) {
    if (method === 'GET') return query.events !== undefined
    if (method === 'POST') return body?.action === 'events-seen'
    return false
}

function check(result) {
    if (result.error) throw new Error(result.error.message)
    return result.data
}

async function readSeen(db, mesa, userId) {
    const row = check(
        await db.from('mesa_members').select('events_seen').eq('mesa', mesa).eq('user_id', userId).maybeSingle(),
    )
    return Number(row?.events_seen ?? 0)
}

export async function handleEventRequest(mesa, method, query, body, ctx = {}) {
    const db = supabase()
    // Vem do JWT já conferido; a checagem é porque o id entra no texto do filtro abaixo.
    const userId = UUID.test(String(ctx.userId ?? '')) ? ctx.userId : null
    if (!db || !userId) return ok({ events: [], seen: 0 })

    if (method === 'GET') {
        const rows = check(
            await db
                .from('mesa_events')
                .select('id, kind, data, at')
                .eq('mesa', mesa)
                // A ficha atribuída a alguém é só dele; o resto é da mesa inteira.
                .or(`target_user.is.null,target_user.eq.${userId}`)
                .order('id', { ascending: false })
                .limit(LIMIT),
        )
        return ok({
            events: (rows ?? []).map((r) => ({ id: Number(r.id), kind: r.kind, data: r.data ?? {}, at: Date.parse(r.at) })),
            seen: await readSeen(db, mesa, userId),
        })
    }

    const upTo = Number(body?.upTo)
    if (!Number.isSafeInteger(upTo) || upTo < 0) return fail(400, 'Campo "upTo" inválido')
    // Só anda para a frente: um aparelho atrasado não "desle" o que outro já leu.
    check(
        await db
            .from('mesa_members')
            .update({ events_seen: upTo })
            .eq('mesa', mesa)
            .eq('user_id', userId)
            .lt('events_seen', upTo),
    )
    return ok({ seen: await readSeen(db, mesa, userId) })
}
