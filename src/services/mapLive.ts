// Mapa ao vivo: o que alguém está medindo ou arrastando aparece para todos que
// estão no mesmo mapa — a régua, a área de efeito (com a contagem de criaturas)
// e o arrasto de um token com as faixas de alcance. É o que a mesa ve num VTT.
//
// Broadcast do Realtime, DIRETO entre aparelhos, no canal privado
// `mesa:<mesa>:live:<mapa>` (migration `mapa_ao_vivo`, a única transmissão que
// o cliente pode fazer). Nada disso é estado: não passa pelo servidor nem pelo
// banco, e quem abre o mapa depois só vê o gesto que ainda está na tela de
// alguém (o batimento de 3 s o reenvia). Sem Supabase, cada um vê só o seu.
//
// Cada ABA é um remetente (`tabId`), não o aparelho: duas abas do mesmo aparelho
// se enxergam, como dois jogadores.

import { useCallback, useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { currentMesa } from './mesa'
import { getSupabase } from './supabase'
import { selfLabel } from './presence'
import type { Cell } from '../modules/battle-map/geometry'
import { sanitizeArea, type Area } from '../modules/battle-map/areas'

export type LiveGesture =
    | { kind: 'ruler'; from: Cell; to: Cell }
    | { kind: 'area'; area: Area }
    | { kind: 'move'; tokenId: string; from: Cell; to: Cell }

export interface LivePeer {
    /** A aba de quem mede. */
    from: string
    name: string
    gesture: LiveGesture
    at: number
}

/** Um gesto chega a ~10 mensagens por segundo, no máximo — o resto é junção. */
const SEND_MS = 100
/** Gesto parado na tela (régua solta, área fixada) é reenviado a cada tanto… */
const HEARTBEAT_MS = 3000
/** …e some de quem vê se o batimento parar (aba fechada, rede caiu). */
const STALE_MS = 8000
/** Sair do mapa e voltar logo (StrictMode, troca rápida) reaproveita o canal. */
const CLOSE_DELAY_MS = 3000

const tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

interface Room {
    channel: RealtimeChannel | null
    joined: boolean
    refs: number
    closeTimer: ReturnType<typeof setTimeout> | null
    timer: ReturnType<typeof setInterval> | null
    peers: Map<string, LivePeer>
    snapshot: LivePeer[]
    listeners: Set<() => void>
    /** O que ESTE aparelho está mostrando agora. */
    mine: LiveGesture | null
    lastSent: string
    lastSentAt: number
    trailing: ReturnType<typeof setTimeout> | null
}

const rooms = new Map<string, Room>()
const EMPTY: LivePeer[] = []

function notify(room: Room) {
    room.snapshot = [...room.peers.values()]
    room.listeners.forEach((l) => l())
}

// --- Validação do que chega (é de qualquer aparelho da mesa) ------------------

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000
const cell = (v: unknown): Cell | null => {
    const c = v as Partial<Cell> | null
    return c && num(c.x) && num(c.y) ? { x: Math.round(c.x!), y: Math.round(c.y!) } : null
}
const shortId = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null)

function sanitizeGesture(raw: unknown): LiveGesture | null {
    const g = raw as { kind?: unknown; from?: unknown; to?: unknown; area?: unknown; tokenId?: unknown } | null
    if (!g || typeof g !== 'object') return null
    if (g.kind === 'area') {
        const area = sanitizeArea(g.area)
        if (!area || (area.tokenId !== undefined && !shortId(area.tokenId))) return null
        return { kind: 'area', area }
    }
    const from = cell(g.from)
    const to = cell(g.to)
    if (!from || !to) return null
    if (g.kind === 'ruler') return { kind: 'ruler', from, to }
    const tokenId = shortId(g.tokenId)
    if (g.kind === 'move' && tokenId) return { kind: 'move', tokenId, from, to }
    return null
}

function receive(room: Room, raw: unknown) {
    const msg = raw as { from?: unknown; name?: unknown; g?: unknown } | null
    const from = shortId(msg?.from)
    if (!from || from === tabId) return
    const gesture = msg?.g === null ? null : sanitizeGesture(msg?.g)
    if (!gesture) {
        if (room.peers.delete(from)) notify(room)
        return
    }
    const name = typeof msg?.name === 'string' ? msg.name.slice(0, 40) : ''
    room.peers.set(from, { from, name, gesture, at: Date.now() })
    notify(room)
}

// --- Envio --------------------------------------------------------------------

function transmit(room: Room, force = false) {
    if (room.trailing) { clearTimeout(room.trailing); room.trailing = null }
    const json = JSON.stringify(room.mine)
    if (!force && json === room.lastSent) return
    room.lastSent = json
    room.lastSentAt = Date.now()
    if (!room.joined || !room.channel) return
    void room.channel.send({ type: 'broadcast', event: 'g', payload: { from: tabId, name: selfLabel(), g: room.mine } })
}

/**
 * O gesto deste aparelho no mapa (`null` = nada na tela). Chamado a cada
 * movimento do ponteiro: repetido não sai, e o resto sai no máximo a cada 100 ms,
 * sempre com o ÚLTIMO estado. Apagar sai na hora.
 */
export function sendLive(mapId: string, gesture: LiveGesture | null) {
    const room = rooms.get(mapId)
    if (!room) return
    room.mine = gesture
    if (!gesture) { transmit(room); return }
    if (room.trailing) return
    const wait = room.lastSentAt + SEND_MS - Date.now()
    if (wait <= 0) transmit(room)
    else room.trailing = setTimeout(() => transmit(room), wait)
}

// --- Canal --------------------------------------------------------------------

async function open(mapId: string, room: Room) {
    const client = await getSupabase()
    if (!client || rooms.get(mapId) !== room) return
    const channel = client.channel(`mesa:${currentMesa.id}:live:${mapId}`, { config: { private: true } })
    room.channel = channel
    channel.on('broadcast', { event: 'g' }, ({ payload }) => receive(room, payload))
    channel.subscribe((state) => {
        room.joined = state === 'SUBSCRIBED'
        // Reconectou: quem estava olhando pode ter perdido o gesto parado.
        if (room.joined && room.mine) transmit(room, true)
        if (!room.joined && room.peers.size > 0) { room.peers.clear(); notify(room) }
    })
}

function tick(room: Room) {
    const now = Date.now()
    let changed = false
    for (const [id, peer] of room.peers) {
        if (now - peer.at > STALE_MS) { room.peers.delete(id); changed = true }
    }
    if (changed) notify(room)
    // Aba oculta não bate: para quem vê, o gesto some até ela voltar.
    if (room.mine && !document.hidden && now - room.lastSentAt >= HEARTBEAT_MS) transmit(room, true)
}

function acquire(mapId: string): Room {
    let room = rooms.get(mapId)
    if (!room) {
        room = {
            channel: null, joined: false, refs: 0, closeTimer: null, timer: null,
            peers: new Map(), snapshot: EMPTY, listeners: new Set(),
            mine: null, lastSent: 'null', lastSentAt: 0, trailing: null,
        }
        rooms.set(mapId, room)
        const r = room
        room.timer = setInterval(() => tick(r), 1000)
        void open(mapId, room)
    }
    if (room.closeTimer) { clearTimeout(room.closeTimer); room.closeTimer = null }
    room.refs++
    return room
}

function release(mapId: string, room: Room) {
    room.refs--
    if (room.refs > 0) return
    // Quem sai do mapa leva o gesto junto da tela dos outros.
    room.mine = null
    transmit(room)
    room.closeTimer = setTimeout(() => {
        if (room.refs > 0) return
        if (room.timer) clearInterval(room.timer)
        if (room.trailing) clearTimeout(room.trailing)
        rooms.delete(mapId)
        const channel = room.channel
        room.channel = null
        room.joined = false
        if (channel) void getSupabase().then((client) => client?.removeChannel(channel))
    }, CLOSE_DELAY_MS)
}

/**
 * Entra no canal ao vivo do mapa enquanto o componente estiver montado e devolve
 * os gestos dos OUTROS que estão nele.
 */
export function useMapLive(mapId: string): LivePeer[] {
    const subscribe = useCallback((listener: () => void) => {
        const room = acquire(mapId)
        room.listeners.add(listener)
        listener()
        return () => {
            room.listeners.delete(listener)
            release(mapId, room)
        }
    }, [mapId])
    return useSyncExternalStore(subscribe, () => rooms.get(mapId)?.snapshot ?? EMPTY, () => EMPTY)
}
