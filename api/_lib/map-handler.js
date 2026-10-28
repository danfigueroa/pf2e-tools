// Rotas do mapa de combate, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?maps=1                          → lista + mapa ativo
//   GET  ?map=<id>                        → o mapa inteiro (com PV/token dos PCs)
//   GET  ?mapRev=<id>[&rev=N&tableRev=M]  → os contadores — é o poll; com o
//                                           que o cliente já tem, o mapa vem
//                                           junto quando mudou
//        …&gm=1 nos três                  → inclui os mapas privados (Modo GM)
//   POST { action: 'map-create', name }   → nasce privado
//   POST { action: 'map-rename', id, name }
//   POST { action: 'map-visibility', id, private } → esconde/revela à mesa
//   POST { action: 'map-activate', id|null } → leva a mesa (e revela o mapa)
//   POST { action: 'map-delete', id }      → apaga também as imagens dele (maps/, monsters/)
//   POST { action: 'map-write', id, fields: { meta|pos:*|hp:*|drw:*: data|null } }
//   POST { action: 'map-sync', id, tokens, turn, hp } → a Iniciativa manda quem está no mapa
//   POST { action: 'map-clear-drawings', id } → apaga todos os desenhos
//   POST { action: 'image-delete', url }   → imagem trocada (token do PC, do monstro)
//                                            (`blob-delete`: o nome antigo, aceito igual)
//
// O ENVIO das imagens não passa por aqui: o navegador sobe direto para o
// Supabase Storage (ver api/_lib/images.js e services/images.ts).

import { isSupabaseConfigured } from './supabase.js'
import { forbidden, isGm } from './access.js'
import { deleteImages, isMapOwnedImage } from './images.js'
import {
    MAX_MAP_FIELD_BYTES,
    MAX_TOKENS,
    clearDrawings,
    createMap,
    deleteMap,
    isValidMapField,
    isValidMapId,
    isValidTokenId,
    listMaps,
    readMap,
    readRevs,
    setActiveMap,
    setMapPrivate,
    syncTokens,
    writeMapFields,
} from './map-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

const MAP_ACTIONS = new Set([
    'map-create', 'map-rename', 'map-visibility', 'map-activate', 'map-delete', 'map-write', 'map-sync',
    'map-clear-drawings', 'image-delete', 'blob-delete',
])

const ADMIN_ACTIONS = new Set([
    'map-create', 'map-rename', 'map-visibility', 'map-activate', 'map-delete', 'map-clear-drawings', 'map-sync',
])

/** Falso quando a requisição não é de mapa — aí segue para as outras rotas do `state`. */
export function isMapRequest(method, query, body) {
    if (method === 'GET') return !!(query.maps || query.map || query.mapRev)
    if (method === 'POST') return MAP_ACTIONS.has(body?.action)
    return false
}

const cleanName = (name) => String(name ?? '').trim().slice(0, 60)

// O que um jogador (não-GM) pode escrever no mapa: mover token, desenhar, pingar, rolar.
// O resto — `meta` (imagem, alinhamento, nome), PV de monstro e enquadramento — é do GM.
const PLAYER_FIELD = /^(pos|drw|ping|roll):/

/**
 * `ctx.access` (ver access.js) traz o papel real. Com a cobrança desligada vale o `gm=1`
 * da query, como antes do login — era só interface, e o servidor confiava nele.
 */
export async function handleMapRequest(mesa, method, query, body, ctx = {}) {
    const gm = isGm(ctx.access, query.gm === '1')
    if (method === 'GET') {
        // Mapa privado só sai para o GM: quem não é não recebe nome, imagem nem tokens.
        if (query.maps) return ok(await listMaps(mesa, gm))
        const id = String(query.map || query.mapRev)
        if (!isValidMapId(id)) return fail(400, 'Parâmetro "map" inválido')
        if (query.mapRev) {
            // O poll diz o que já tem (`rev`, `tableRev`). Se mudou, o mapa vem
            // NA MESMA resposta — antes eram dois pedidos, e o segundo era uma
            // ida e volta inteira a mais até a tela de quem estava olhando.
            const revs = await readRevs(mesa, id)
            const known = query.rev != null && query.tableRev != null
            const stale = known && (String(revs.rev) !== String(query.rev) || String(revs.tableRev) !== String(query.tableRev))
            if (!stale) return ok(revs)
            const map = await readMap(mesa, id)
            if (map?.private && !gm) return ok({ ...revs, hidden: true })
            return ok(map ? { ...revs, map } : revs)
        }
        const map = await readMap(mesa, id)
        if (!map) return fail(404, 'Mapa não encontrado')
        if (map.private && !gm) {
            // Os contadores vão junto: com eles o poll de quem espera a revelação
            // continua sendo só o MGET, sem baixar o hash a cada volta.
            return { status: 403, body: { error: 'Mapa privado', private: true, rev: map.rev, tableRev: map.tableRev } }
        }
        return ok({ map })
    }

    const action = body.action

    // Administrar mapas e a mesa é do GM. A Iniciativa (`map-sync`) também: é o GM quem monta o encontro.
    if (ADMIN_ACTIONS.has(action) && !gm && ctx.access?.enforce) return forbidden()

    if (action === 'map-create') {
        const name = cleanName(body.name) || 'Mapa sem nome'
        const map = await createMap(mesa, name)
        if (!map) return fail(400, 'Mapas demais — apague os que já foram jogados')
        return ok({ map })
    }

    if (action === 'image-delete' || action === 'blob-delete') {
        await deleteImages([body.url])
        return ok({})
    }

    if (action === 'map-activate' && body.id === null) {
        await setActiveMap(mesa, null)
        return ok({})
    }

    const id = String(body.id || '')
    if (!isValidMapId(id)) return fail(400, 'Campo "id" inválido')

    if (action === 'map-activate') {
        // Levar a mesa a um mapa que ela não pode ver não faz sentido: revela junto.
        if ((await setMapPrivate(mesa, id, false)) === null) return fail(404, 'Mapa não encontrado')
        await setActiveMap(mesa, id)
        return ok({})
    }

    if (action === 'map-visibility') {
        const rev = await setMapPrivate(mesa, id, body.private === true)
        if (rev === null) return fail(404, 'Mapa não encontrado')
        return ok({ rev })
    }

    if (action === 'map-delete') {
        const urls = await deleteMap(mesa, id)
        await deleteImages(urls.filter(isMapOwnedImage))
        return ok({})
    }

    if (action === 'map-rename') {
        const name = cleanName(body.name)
        if (!name) return fail(400, 'Nome vazio')
        const map = await readMap(mesa, id)
        if (!map) return fail(404, 'Mapa não encontrado')
        const rev = await writeMapFields(mesa, id, { meta: { ...map.meta, name } })
        return ok({ rev })
    }

    if (action === 'map-write') {
        const fields = body.fields
        if (!fields || typeof fields !== 'object') return fail(400, 'Campo "fields" ausente')
        const entries = Object.entries(fields)
        if (entries.length === 0 || entries.length > 50) return fail(400, 'Quantidade de campos inválida')
        for (const [field, data] of entries) {
            if (!isValidMapField(field) || field === 'turn' || field.startsWith('tok:')) {
                return fail(400, `Campo "${field}" inválido`)
            }
            if (JSON.stringify(data).length > MAX_MAP_FIELD_BYTES) return fail(400, 'Campo grande demais')
            if (ctx.access?.enforce && !gm && !PLAYER_FIELD.test(field)) return forbidden()
        }
        const rev = await writeMapFields(mesa, id, fields)
        if (rev === null) return fail(404, 'Mapa não encontrado')
        if (rev === -1) return fail(400, 'Desenhos demais neste mapa — apague alguns')
        return ok({ rev })
    }

    if (action === 'map-clear-drawings') {
        const rev = await clearDrawings(mesa, id)
        if (rev === null) return fail(404, 'Mapa não encontrado')
        return ok({ rev })
    }

    if (action === 'map-sync') {
        const tokens = Array.isArray(body.tokens) ? body.tokens : null
        if (!tokens || tokens.length > MAX_TOKENS) return fail(400, 'Lista de tokens inválida')
        for (const t of tokens) {
            if (!t || !isValidTokenId(t.id)) return fail(400, 'Token inválido')
            if (JSON.stringify(t).length > MAX_MAP_FIELD_BYTES) return fail(400, 'Token grande demais')
        }
        const hp = body.hp && typeof body.hp === 'object' ? body.hp : {}
        if (Object.keys(hp).some((tid) => !isValidTokenId(tid))) return fail(400, 'PV inválido')
        const turn = isValidTokenId(body.turn) ? body.turn : null
        const rev = await syncTokens(mesa, id, tokens, turn, hp)
        if (rev === null) return fail(404, 'Mapa não encontrado')
        return ok({ rev })
    }

    return fail(400, 'Ação desconhecida')
}
