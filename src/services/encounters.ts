// Encontros da Iniciativa na nuvem (api/_lib/encounter-store.js): o GM monta
// num aparelho e abre no outro. Um por mapa, mais o "Sem mapa" (`null`).
//
// Só o transporte: quando subir, quando baixar e quem vence mora em
// `useEncounterCloud`. O documento volta CRU daqui — quem o valida é
// `sanitizeEncounter`, o mesmo do `localStorage`.

import { stateApi } from './mesa'
import { authHeaderNow, listenMesaChannel } from './supabase'

export interface CloudEncounter {
    state: unknown
    updatedAt: number
}

/** O aviso do banco: o encontro daquele mapa mudou (sem o documento). */
export interface EncounterNotice {
    map: string | null
    updatedAt: number
    by: string | null
}

const mapParam = (mapId: string | null) => encodeURIComponent(mapId ?? 'none')

/**
 * A cópia da nuvem: o encontro, `null` se ninguém o subiu ainda, ou
 * `undefined` quando não deu para saber (sem rede, sem banco) — aí o aparelho
 * segue com o que tem, sem subir nem baixar nada.
 */
export async function fetchCloudEncounter(mapId: string | null): Promise<CloudEncounter | null | undefined> {
    try {
        const r = await fetch(stateApi(`?encounter=${mapParam(mapId)}`))
        if (!r.ok) return undefined
        const body = await r.json() as { encounter?: CloudEncounter | null; storeReady?: boolean }
        // Sem banco o servidor guarda em memória, que morre com a função: não é nuvem.
        if (!body.storeReady) return undefined
        return body.encounter ?? null
    } catch {
        return undefined
    }
}

/** Sobe o encontro. Devolve o `updatedAt` do servidor, ou `null` se não gravou. */
export async function pushCloudEncounter(mapId: string | null, state: unknown): Promise<number | null> {
    try {
        const r = await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify({ action: 'encounter-save', map: mapId, state }),
        })
        if (!r.ok) return null
        const body = await r.json() as { updatedAt?: number; storeReady?: boolean }
        return body.storeReady && typeof body.updatedAt === 'number' ? body.updatedAt : null
    } catch {
        return null
    }
}

// Um canal só, aberto na primeira assinatura e mantido: sair e entrar de novo
// no mesmo tópico em seguida (o StrictMode faz isso a cada montagem, e a troca
// de página também) devolvia o canal que estava saindo, e ninguém ouvia mais
// nada. Mesmo desenho do `startRealtime` do estado da mesa.
type NoticeListener = (notice: EncounterNotice) => void
type LiveListener = (live: boolean) => void
const noticeListeners = new Set<NoticeListener>()
const liveListeners = new Set<LiveListener>()
let channelStarted = false
let live = false

function startChannel() {
    if (channelStarted) return
    channelStarted = true
    void listenMesaChannel('encounters', {
        encounter: (payload) => {
            const p = payload as { map?: unknown; updatedAt?: unknown; by?: unknown } | null
            if (!p || typeof p.updatedAt !== 'number') return
            const notice: EncounterNotice = {
                map: typeof p.map === 'string' && p.map ? p.map : null,
                updatedAt: p.updatedAt,
                by: typeof p.by === 'string' ? p.by : null,
            }
            for (const listener of noticeListeners) listener(notice)
        },
    }, (next) => {
        live = next
        for (const listener of liveListeners) listener(next)
    }).then((stop) => {
        // Sem Supabase: a próxima assinatura tenta de novo.
        if (!stop) channelStarted = false
    })
}

/**
 * Ouve os avisos de encontro da mesa. `onLive` é chamado a cada (re)conexão —
 * e já na assinatura, se o canal estiver aberto. Devolve quem para de ouvir.
 */
export function listenEncounters(onNotice: NoticeListener, onLive: LiveListener): () => void {
    noticeListeners.add(onNotice)
    liveListeners.add(onLive)
    startChannel()
    if (live) onLive(true)
    return () => {
        noticeListeners.delete(onNotice)
        liveListeners.delete(onLive)
    }
}
