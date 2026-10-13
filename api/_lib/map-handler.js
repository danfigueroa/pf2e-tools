// Rotas do mapa de combate, compartilhadas por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Moram no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?maps=1                          → lista + mapa ativo
//   GET  ?map=<id>                        → o mapa inteiro (com PV/token dos PCs)
//   GET  ?mapRev=<id>                     → só os contadores — é o poll
//   POST { action: 'map-create', name }
//   POST { action: 'map-rename', id, name }
//   POST { action: 'map-activate', id|null }
//   POST { action: 'map-delete', id }      → apaga também as imagens do Blob
//   POST { action: 'map-write', id, fields: { meta|pos:*|hp:*|drw:*: data|null } }
//   POST { action: 'map-sync', id, tokens, turn, hp } → a Iniciativa manda quem está no mapa
//   POST { action: 'map-clear-drawings', id } → apaga todos os desenhos
//   POST { action: 'blob-delete', url }    → imagem trocada (token do PC, do monstro)
//   POST ?blob=1  (corpo do @vercel/blob) → token de upload direto do navegador

import { handleUpload } from '@vercel/blob/client'
import { del } from '@vercel/blob'
import { isStoreConfigured } from './table-store.js'
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
    syncTokens,
    writeMapFields,
} from './map-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isStoreConfigured(), blobReady: isBlobConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

const isBlobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN

const MAP_ACTIONS = new Set([
    'map-create', 'map-rename', 'map-activate', 'map-delete', 'map-write', 'map-sync',
    'map-clear-drawings', 'blob-delete',
])

/** Falso quando a requisição não é de mapa — aí segue para as outras rotas do `state`. */
export function isMapRequest(method, query, body) {
    if (method === 'GET') return !!(query.maps || query.map || query.mapRev)
    if (method === 'POST') return !!query.blob || MAP_ACTIONS.has(body?.action)
    return false
}

const cleanName = (name) => String(name ?? '').trim().slice(0, 60)

/**
 * Só apaga o que é do NOSSO Blob: o endpoint é público, e um `url` qualquer
 * mandado aqui não pode virar um DELETE autenticado em outra coisa.
 */
const isBlobUrl = (url) => typeof url === 'string' && /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(url)

async function deleteBlobs(urls) {
    const ours = urls.filter(isBlobUrl)
    if (ours.length === 0 || !isBlobConfigured()) return
    try {
        await del(ours)
    } catch (error) {
        // Imagem órfã no Blob não pode impedir o mapa de sumir da lista.
        console.error('[map] Falha ao apagar imagens do Blob:', error)
    }
}

/**
 * @param request a requisição original (IncomingMessage) — o `handleUpload`
 *   precisa dela para validar a assinatura do aviso de upload concluído.
 */
export async function handleMapRequest(method, query, body, request) {
    if (method === 'GET') {
        if (query.maps) return ok(await listMaps())
        const id = String(query.map || query.mapRev)
        if (!isValidMapId(id)) return fail(400, 'Parâmetro "map" inválido')
        if (query.mapRev) return ok(await readRevs(id))
        const map = await readMap(id)
        if (!map) return fail(404, 'Mapa não encontrado')
        return ok({ map })
    }

    if (query.blob) {
        if (!isBlobConfigured()) return fail(503, 'Armazenamento de imagens não configurado')
        const result = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
                // Pastas fixas: nada de o cliente escolher onde gravar.
                if (!/^(maps|tokens)\/[a-z0-9-]{1,80}\.(webp|png|jpe?g)$/.test(pathname)) {
                    throw new Error('Caminho inválido')
                }
                return {
                    allowedContentTypes: ['image/webp', 'image/png', 'image/jpeg'],
                    maximumSizeInBytes: 8 * 1024 * 1024,
                    addRandomSuffix: true,
                }
            },
            // Nada a fazer: quem grava a URL no mapa é o próprio cliente, que já a
            // tem na mão. (Em dev o aviso nem chegaria — localhost não é público.)
            onUploadCompleted: async () => {},
        })
        return { status: 200, body: result }
    }

    const action = body.action

    if (action === 'map-create') {
        const name = cleanName(body.name) || 'Mapa sem nome'
        const map = await createMap(name)
        if (!map) return fail(400, 'Mapas demais — apague os que já foram jogados')
        return ok({ map })
    }

    if (action === 'blob-delete') {
        await deleteBlobs([body.url])
        return ok({})
    }

    if (action === 'map-activate' && body.id === null) {
        await setActiveMap(null)
        return ok({})
    }

    const id = String(body.id || '')
    if (!isValidMapId(id)) return fail(400, 'Campo "id" inválido')

    if (action === 'map-activate') {
        await setActiveMap(id)
        return ok({})
    }

    if (action === 'map-delete') {
        const urls = await deleteMap(id)
        await deleteBlobs(urls)
        return ok({})
    }

    if (action === 'map-rename') {
        const name = cleanName(body.name)
        if (!name) return fail(400, 'Nome vazio')
        const map = await readMap(id)
        if (!map) return fail(404, 'Mapa não encontrado')
        const rev = await writeMapFields(id, { meta: { ...map.meta, name } })
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
        }
        const rev = await writeMapFields(id, fields)
        if (rev === null) return fail(404, 'Mapa não encontrado')
        if (rev === -1) return fail(400, 'Desenhos demais neste mapa — apague alguns')
        return ok({ rev })
    }

    if (action === 'map-clear-drawings') {
        const rev = await clearDrawings(id)
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
        const rev = await syncTokens(id, tokens, turn, hp)
        if (rev === null) return fail(404, 'Mapa não encontrado')
        return ok({ rev })
    }

    return fail(400, 'Ação desconhecida')
}
