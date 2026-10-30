// Rotas dos Troféus do Covil, compartilhadas por `api/state.js` (Vercel) e `server/index.mjs`
// (dev). Moram no endpoint `state` pelo limite de 12 funções serverless (ver CLAUDE.md).
//
//   GET ?trophies=me        → o meu perfil (avalia antes: o que ficou pendente desbloqueia aqui)
//   GET ?trophies=<userId>  → o perfil de um colega — só de quem está nesta mesa
//   GET ?trophies=ranking   → os membros da mesa com pontos de jogador e de GM
//   GET ?trophies=summary   → o meu resumo leve (pontos e os últimos), para a sidebar e a Início
//
// O troféu é da CONTA (global); a mesa do pedido só decide quem dá para ver.

import { isSupabaseConfigured } from './supabase.js'
import { memberRole } from './access.js'
import { evaluate, isUserId, safely, trophyProfile, trophyRanking, trophySummary } from './trophy-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

export function isTrophyRequest(method, query) {
    return method === 'GET' && query.trophies !== undefined
}

export async function handleTrophyRequest(mesa, method, query, body, ctx = {}) {
    const which = String(query.trophies ?? '')
    if (which === 'ranking') return ok({ ranking: await trophyRanking(mesa) })
    if (which === 'summary') return ok({ summary: await trophySummary(ctx.userId) })
    if (which === 'me') {
        if (!isUserId(ctx.userId)) return ok(await trophyProfile(null))
        await safely('avaliar', () => evaluate(mesa, ctx.userId))
        return ok(await trophyProfile(ctx.userId))
    }
    if (!isUserId(which)) return fail(400, 'Conta inválida')
    if (!(await memberRole(mesa, which))) return fail(403, 'Essa pessoa não está nesta mesa')
    return ok(await trophyProfile(which))
}
