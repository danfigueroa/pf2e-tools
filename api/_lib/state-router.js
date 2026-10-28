// O despacho do endpoint `/api/state`, compartilhado por `api/state.js` (Vercel) e
// `server/index.mjs` (dev). Antes cada um tinha a sua cópia; com o login, a regra de
// quem pode o quê precisa valer IGUAL nos dois — por isso mora num lugar só.
//
// Devolve sempre `{ status, body }`; quem chama só escreve a resposta.
//
// Ordem das rotas (importa): conta → [portão] → mapa → rolagens → correções → encontro
// → ficha → estado. A rota da ficha aceita qualquer POST com `action` e engoliria as
// anteriores, e a da conta vem antes do portão porque quem ainda não é membro precisa
// poder resgatar o convite que o torna um.

import {
    readCharacter,
    readField,
    readIncoming,
    writeField,
    isValidSlug,
    isValidField,
    isStoreConfigured,
    MAX_FIELD_BYTES,
} from './table-store.js'
import { handleSheetRequest, isSheetRequest } from './sheet-handler.js'
import { handleMapRequest, isMapRequest } from './map-handler.js'
import { handleRollRequest, isRollRequest } from './roll-handler.js'
import { handleEncounterRequest, isEncounterRequest } from './encounter-handler.js'
import { handleFixRequest, isFixRequest } from './fix-handler.js'
import { handleAuthRequest, isAuthRequest } from './auth-handler.js'
import { mesaFrom } from './mesas.js'
import { canEditSheet, forbidden, gate, resolveAccess } from './access.js'

const fail = (status, error) => ({ status, body: { error } })

/** Roda uma rota; erro inesperado vira 500 com a mensagem da rota (e o detalhe só no log). */
async function run(label, message, fn) {
    try {
        return await fn()
    } catch (error) {
        console.error(`[/api/state] ${label}:`, error)
        return fail(500, message)
    }
}

export async function routeState({ req, method, query, body }) {
    // A mesa vale para tudo abaixo (ver mesas.js). Vai na query também no POST.
    const mesa = mesaFrom(query)
    if (!mesa) return fail(400, 'Parâmetro "mesa" inválido')

    let access
    try {
        access = await resolveAccess(req, mesa)
    } catch (error) {
        console.error('[/api/state] Erro ao conferir o acesso:', error)
        return fail(503, 'Não foi possível conferir o seu acesso agora')
    }

    if (isAuthRequest(method, query, body)) {
        return run('Erro na conta', 'Erro ao tratar a conta', () => handleAuthRequest(mesa, method, query, body, access))
    }

    const denied = gate(access)
    if (denied) return denied
    const ctx = { userId: access.userId, access }

    if (isMapRequest(method, query, body)) {
        return run('Erro no mapa', 'Erro ao tratar o mapa', () => handleMapRequest(mesa, method, query, body, ctx))
    }
    if (isRollRequest(method, query, body)) {
        return run('Erro nas rolagens', 'Erro ao tratar as rolagens', () => handleRollRequest(mesa, method, query, body, ctx))
    }
    if (isFixRequest(method, query, body)) {
        return run('Erro na correção de tradução', 'Erro ao tratar a correção de tradução', () =>
            handleFixRequest(method, query, body, ctx))
    }
    if (isEncounterRequest(method, query, body)) {
        return run('Erro no encontro', 'Erro ao tratar o encontro', () =>
            handleEncounterRequest(mesa, method, query, body, ctx))
    }
    if (isSheetRequest(method, query, body)) {
        return run('Erro na ficha publicada', 'Erro ao tratar a ficha publicada', () =>
            handleSheetRequest(mesa, method, query, body, ctx))
    }

    if (method === 'GET' && query.incoming !== undefined) {
        // O que os colegas me passaram (`gave` de cada um que aponta para mim).
        const to = query.incoming
        if (!isValidSlug(to)) return fail(400, 'Parâmetro "incoming" inválido')
        return run('Erro ao ler o que me passaram', 'Erro ao ler o estado da mesa', async () => ({
            status: 200,
            body: { char: to, incoming: await readIncoming(mesa, to) },
        }))
    }

    if (method === 'GET') {
        const char = query.char
        if (!isValidSlug(char)) return fail(400, 'Parâmetro "char" inválido')
        // Uma fatia só (`?field=`): o poll leve do contador de ações do turno.
        const one = query.field
        if (one !== undefined) {
            if (!isValidField(one)) return fail(400, 'Parâmetro "field" inválido')
            return run('Erro ao ler o campo', 'Erro ao ler o estado da mesa', async () => {
                const entry = await readField(mesa, char, one)
                return {
                    status: 200,
                    body: { char, field: one, data: entry ? entry.data : null, updatedAt: entry ? entry.updatedAt : 0 },
                }
            })
        }
        return run('Erro ao ler', 'Erro ao ler o estado da mesa', async () => {
            const fields = await readCharacter(mesa, char)
            // Personagem sem estado ainda não é erro — devolve o mapa vazio.
            return { status: 200, body: { char, fields, storeReady: isStoreConfigured() } }
        })
    }

    if (method === 'POST') {
        const { char, field, data } = body || {}
        if (!isValidSlug(char)) return fail(400, 'Campo "char" inválido')
        if (!isValidField(field)) return fail(400, 'Campo "field" inválido')
        if (data === undefined) return fail(400, 'Campo "data" ausente')
        // O endpoint é público: um teto por escrita evita encher o banco.
        if (JSON.stringify(data).length > MAX_FIELD_BYTES) return fail(400, 'Estado grande demais')
        return run('Erro ao gravar', 'Erro ao gravar o estado da mesa', async () => {
            // PV, slots, condições… são do personagem: o dono da ficha e o GM escrevem; o resto só lê.
            if (!(await canEditSheet(access, mesa, char))) return forbidden('Este personagem é de outra pessoa')
            const updatedAt = await writeField(mesa, char, field, data, access.userId)
            return { status: 200, body: { ok: true, updatedAt, storeReady: isStoreConfigured() } }
        })
    }

    return fail(405, 'Method not allowed')
}
