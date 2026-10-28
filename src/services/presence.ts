// Quem está com o app aberto na mesa, e onde: o Presence do Realtime no canal
// privado `mesa:<mesa>:presence` (migration `presenca`, a única extensão que o
// cliente pode mandar). Cada aparelho anuncia o próprio nome (opcional, do
// aparelho), a página e a ficha aberta; o canal avisa quem entrou e saiu — fechar a
// aba ou perder a rede tira o aparelho da lista sozinho.
//
// Sem identidade de verdade (não há login), o aparelho é a sessão anônima: duas
// abas do mesmo aparelho são uma pessoa só na lista.

import { useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { currentMesa } from './mesa'
import { getSupabase, currentUserId } from './supabase'
import { getAuthState, roleOf } from './auth'

export interface Peer {
    /** A conta (a chave do Presence é a sessão logada; antes do login era o aparelho). */
    id: string
    /** Nome da pessoa na mesa (ou o usuário), para as iniciais dos avatares. */
    who: string
    /** O nome que a pessoa deu a este aparelho (pode faltar). */
    name: string
    /** A ficha aberta: slug e nome do personagem. */
    slug: string | null
    character: string | null
    /** A rota (`/ficha-virtual`, `/mapa/abc`…). */
    page: string
    /** Aba visível agora; `false` = o app está aberto em segundo plano. */
    visible: boolean
    self: boolean
}

interface Meta {
    who?: unknown
    name?: unknown
    slug?: unknown
    character?: unknown
    page?: unknown
    visible?: unknown
    at?: unknown
}

const NAME_KEY = 'pf2e:device-name'

function readName(): string {
    try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' }
}

let deviceName = readName()
let page = typeof window === 'undefined' ? '/' : window.location.pathname
// A ficha aberta, de quem a abriu por último (a página e o painel do mapa podem coexistir).
const openSheets: { token: object; slug: string; character: string }[] = []

let peers: Peer[] = []
const listeners = new Set<() => void>()
let channel: RealtimeChannel | null = null
let joined = false
let started = false
let trackTimer: ReturnType<typeof setTimeout> | null = null

function notify() { listeners.forEach((l) => l()) }

const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '')

function payload() {
    const sheet = openSheets[openSheets.length - 1]
    const role = roleOf(getAuthState())
    return {
        who: role.displayName || role.username || '',
        name: deviceName,
        slug: sheet?.slug ?? null,
        character: sheet?.character ?? null,
        page,
        visible: typeof document === 'undefined' || document.visibilityState === 'visible',
        at: Date.now(),
    }
}

/** Uma pessoa por aparelho: das abas abertas, vale a visível mais recente. */
function readPeers(state: Record<string, Meta[]>): Peer[] {
    const me = currentUserId()
    const out: Peer[] = []
    for (const [id, metas] of Object.entries(state)) {
        const best = [...metas].sort((a, b) =>
            Number(b.visible === true) - Number(a.visible === true) || (Number(b.at) || 0) - (Number(a.at) || 0))[0]
        if (!best) continue
        out.push({
            id,
            who: str(best.who, 40),
            name: str(best.name, 40),
            slug: str(best.slug, 64) || null,
            character: str(best.character) || null,
            page: str(best.page, 120) || '/',
            visible: best.visible === true,
            self: id === me,
        })
    }
    // Você primeiro; depois quem está olhando agora, por nome.
    const label = (p: Peer) => (p.name || p.character || '').toLowerCase()
    return out.sort((a, b) => Number(b.self) - Number(a.self) || Number(b.visible) - Number(a.visible) || label(a).localeCompare(label(b)))
}

/** Reanuncia (com junção): trocar de página duas vezes seguidas manda uma mensagem só. */
function retrack() {
    if (!joined || !channel) return
    if (trackTimer) clearTimeout(trackTimer)
    trackTimer = setTimeout(() => {
        trackTimer = null
        void channel?.track(payload())
    }, 300)
}

async function start() {
    if (started) return
    started = true
    const client = await getSupabase()
    const me = currentUserId()
    if (!client || !me) { started = false; return }
    channel = client.channel(`mesa:${currentMesa.id}:presence`, { config: { private: true, presence: { key: me } } })
    channel.on('presence', { event: 'sync' }, () => {
        peers = readPeers((channel?.presenceState() ?? {}) as Record<string, Meta[]>)
        notify()
    })
    channel.subscribe((status) => {
        joined = status === 'SUBSCRIBED'
        if (joined) void channel?.track(payload())
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            peers = []
            notify()
        }
    })
    document.addEventListener('visibilitychange', retrack)
}

/** Começa a anunciar este aparelho — chamado pelo layout, com o app ocioso. */
export function startPresence() {
    if (typeof window === 'undefined') return
    const run = () => { void start() }
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 5000 })
    else setTimeout(run, 2000)
}

export function setPresencePage(path: string) {
    if (path === page) return
    page = path
    retrack()
}

/**
 * Anuncia a ficha aberta. Devolve quem a tira — só ela: fechar o painel do mapa não
 * apaga a ficha que a página ainda mostra.
 */
export function announceSheet(slug: string, character: string): () => void {
    const token = {}
    openSheets.push({ token, slug, character })
    retrack()
    return () => {
        const i = openSheets.findIndex((s) => s.token === token)
        if (i >= 0) openSheets.splice(i, 1)
        retrack()
    }
}

export const getDeviceName = () => deviceName

/** Como a lista mostra este aparelho: o nome dele, senão o personagem da ficha aberta. */
export function selfLabel(): string {
    return deviceName || roleOf(getAuthState()).displayName || openSheets[openSheets.length - 1]?.character || ''
}

export function setDeviceName(name: string) {
    deviceName = name.trim().slice(0, 40)
    try {
        if (deviceName) localStorage.setItem(NAME_KEY, deviceName)
        else localStorage.removeItem(NAME_KEY)
    } catch {
        // sem storage: vale nesta sessão
    }
    retrack()
    notify()
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

/** Quem está na mesa agora (vazio sem Supabase ou antes de o canal abrir). */
export function usePresence(): Peer[] {
    return useSyncExternalStore(subscribe, () => peers, () => peers)
}

/** O nome deste aparelho, para o editor da lista. */
export function useDeviceName(): string {
    return useSyncExternalStore(subscribe, getDeviceName, getDeviceName)
}
