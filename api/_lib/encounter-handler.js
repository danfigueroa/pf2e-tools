// Rotas dos encontros da Iniciativa na nuvem, compartilhadas por `api/state.js`
// (Vercel) e `server/index.mjs` (dev). Moram no endpoint `state` pelo limite de
// 12 funções serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?encounter=<mapId|none>                  → { encounter: { state, updatedAt } | null }
//   POST { action: 'encounter-save', map, state } → { updatedAt }  (`map` null = "Sem mapa")
//
// Vem ANTES da ficha publicada nos dois servidores: a rota da ficha aceita
// qualquer POST com `action` e engoliria esta.

import { isSupabaseConfigured } from './supabase.js'
import { forbidden } from './access.js'
import { encounterKey, isValidEncounter, readEncounter, writeEncounter } from './encounter-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

/** Falso quando a requisição não é de encontro — aí segue para as outras rotas do `state`. */
export function isEncounterRequest(method, query, body) {
    if (method === 'GET') return query.encounter !== undefined
    if (method === 'POST') return body?.action === 'encounter-save'
    return false
}

/**
 * `ctx.userId`: quem gravou, que volta no aviso do Realtime (eco). Montar o encontro é do GM:
 * com a cobrança ligada (`ctx.access.enforce`), jogador só lê.
 */
export async function handleEncounterRequest(mesa, method, query, body, ctx = {}) {
    const key = encounterKey(method === 'GET' ? query.encounter : body?.map)
    if (key === null) return fail(400, 'Mapa inválido')
    if (method === 'GET') return ok({ encounter: await readEncounter(mesa, key) })
    if (ctx.access?.enforce && ctx.access.role !== 'gm') return forbidden('Só o GM monta o encontro')
    if (!isValidEncounter(body?.state)) return fail(400, 'Encontro inválido')
    const updatedAt = await writeEncounter(mesa, key, body.state, ctx.userId ?? null)
    if (updatedAt === null) return fail(404, 'Mapa não encontrado')
    return ok({ updatedAt })
}
