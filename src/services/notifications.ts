// O sino: o que aconteceu na mesa e a pessoa ainda não viu.
//
// Quem registra os eventos é o BANCO (triggers da migration `inicio_e_notificacoes`): ficha
// publicada, ficha atribuída a você, mapa ativado ou revelado, combate começou, regra
// compartilhada. Aqui se lê a lista (`GET ?events=1`), se ouve o canal `mesa:<mesa>:events`
// e se marca como lido — o "lido" é da CONTA, então o celular e o computador concordam.
//
// Item recebido de um colega é a exceção: já tem o próprio caminho (`services/gifts.ts`, que
// guarda o "visto" no aparelho) e entra aqui como notificação LOCAL, deste aparelho.
//
// O mesmo canal traz o `settings` (o GM mudou o nome da mesa ou a sessão), aplicado no estado
// da conta para a sidebar e a Início acompanharem.

import { useSyncExternalStore } from 'react'
import { mesaKey, stateApi } from './mesa'
import { listenMesaChannel } from './supabase'
import { applyMesaSettings, getAuthState, roleOf } from './auth'
import { isOwnRoll } from './rolls'

export type NotificationKind =
    | 'sheet-published'
    | 'sheet-assigned'
    | 'map-active'
    | 'map-revealed'
    | 'combat-started'
    | 'rule-shared'
    | 'gift'

export interface TableNotification {
    /** `s<n>` do servidor, `g<n>` local (item recebido). */
    key: string
    kind: NotificationKind
    data: Record<string, unknown>
    at: number
    read: boolean
}

interface ServerEvent { id: number; kind: NotificationKind; data: Record<string, unknown>; at: number; target?: string | null }

export interface NotificationsSnapshot {
    items: TableNotification[]
    unread: number
    ready: boolean
}

const MAX_LOCAL = 30
const LOCAL_KEY = mesaKey('pf2e:notifications:local')

let server: ServerEvent[] = []
let seen = 0
let local: TableNotification[] = readLocal()
let ready = false
let snapshot: NotificationsSnapshot = { items: [], unread: 0, ready: false }
const listeners = new Set<() => void>()

function readLocal(): TableNotification[] {
    try {
        const raw = localStorage.getItem(LOCAL_KEY)
        const list = raw ? (JSON.parse(raw) as TableNotification[]) : []
        return Array.isArray(list) ? list.filter((n) => n && n.kind === 'gift').slice(0, MAX_LOCAL) : []
    } catch { return [] }
}

function writeLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(local)) } catch { /* sem storage: vale nesta carga */ }
}

/**
 * O que NÃO vira notificação para quem fez: a própria publicação, a regra que este aparelho
 * compartilhou e — para o GM — mapa e combate, que só o GM faz.
 */
function relevant(e: ServerEvent): boolean {
    const auth = getAuthState()
    const me = auth.status === 'in' ? auth.user.id : null
    if (e.target && e.target !== me) return false
    if (e.kind === 'sheet-published' && me && e.data.by === me) return false
    if (e.kind === 'rule-shared' && typeof e.data.id === 'string' && isOwnRoll(e.data.id)) return false
    if (roleOf(auth).isGm && (e.kind === 'map-active' || e.kind === 'map-revealed' || e.kind === 'combat-started')) {
        return false
    }
    return true
}

function rebuild() {
    const items: TableNotification[] = [
        ...server.filter(relevant).map((e) => ({
            key: `s${e.id}`,
            kind: e.kind,
            data: e.data ?? {},
            at: e.at,
            read: e.id <= seen,
        })),
        ...local,
    ].sort((a, b) => b.at - a.at)
    snapshot = { items, unread: items.filter((n) => !n.read).length, ready }
    listeners.forEach((l) => l())
}

async function fetchEvents() {
    try {
        const res = await fetch(stateApi('?events=1'))
        if (!res.ok) return
        const body = (await res.json()) as { events?: ServerEvent[]; seen?: number }
        server = Array.isArray(body.events) ? body.events : []
        seen = Math.max(seen, Number(body.seen) || 0)
        ready = true
        rebuild()
    } catch { /* offline: fica a lista que já se tinha */ }
}

function onEvent(payload: unknown) {
    const p = payload as { id?: unknown; kind?: unknown; data?: unknown; at?: unknown; target?: unknown }
    const id = Number(p.id)
    if (!Number.isSafeInteger(id) || typeof p.kind !== 'string' || server.some((e) => e.id === id)) return
    server = [
        {
            id,
            kind: p.kind as NotificationKind,
            data: (p.data && typeof p.data === 'object' ? p.data : {}) as Record<string, unknown>,
            at: typeof p.at === 'string' ? Date.parse(p.at) : Date.now(),
            target: typeof p.target === 'string' ? p.target : null,
        },
        ...server,
    ].slice(0, 50)
    rebuild()
}

function onSettings(payload: unknown) {
    const p = payload as { name?: unknown; sessionStartedAt?: unknown; nextSessionAt?: unknown }
    applyMesaSettings({
        ...(typeof p.name === 'string' ? { name: p.name } : {}),
        sessionStartedAt: typeof p.sessionStartedAt === 'string' ? p.sessionStartedAt : null,
        nextSessionAt: typeof p.nextSessionAt === 'string' ? p.nextSessionAt : null,
    })
}

/** Item recebido de um colega, na ficha que esta conta possui. */
export function pushGiftNotification(slug: string, list: { from: string; name: string; n: number }[]) {
    const at = Date.now()
    const fresh: TableNotification[] = list.map((g, i) => ({
        key: `g${at}-${i}`,
        kind: 'gift',
        data: { slug, from: g.from, name: g.name, n: g.n },
        at,
        read: false,
    }))
    local = [...fresh, ...local].slice(0, MAX_LOCAL)
    writeLocal()
    rebuild()
}

/** Abriu o sino: tudo o que está na lista vira lido (no servidor, para todos os aparelhos). */
export async function markAllRead() {
    const top = Math.max(0, ...server.map((e) => e.id))
    local = local.map((n) => (n.read ? n : { ...n, read: true }))
    writeLocal()
    if (top > seen) seen = top
    rebuild()
    if (top <= 0) return
    try {
        await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'events-seen', upTo: top }),
        })
    } catch { /* offline: a próxima abertura do sino tenta de novo */ }
}

let started = false

/** Liga o sino (uma vez, no `MainLayout`, já logado). */
export function startNotifications() {
    if (started || typeof window === 'undefined') return
    started = true
    rebuild()
    void fetchEvents()
    void listenMesaChannel('events', { event: onEvent, settings: onSettings }, (live) => {
        // A cada (re)conexão: o que chegou com o canal fechado não volta sozinho.
        if (live) void fetchEvents()
    })
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void fetchEvents()
    })
    void watchGifts()
}

/**
 * Itens recebidos: o `gifts.ts` acompanha UM personagem por vez (o da ficha aberta). Sem ficha
 * aberta, passa a acompanhar o da pessoa; o aviso só vira notificação quando o personagem
 * acompanhado é dela (abrir a ficha de outro não traz o presente dele para cá).
 * Importados sob demanda: nada disso entra no bundle principal.
 */
async function watchGifts() {
    const auth = getAuthState()
    if (auth.status !== 'in') return
    const [{ onArrival, trackIncoming, trackedSlug }, { listPublished }] = await Promise.all([
        import('./gifts'),
        import('./sheets'),
    ])
    const owned = new Set((await listPublished()).filter((s) => s.ownerId === auth.user.id).map((s) => s.slug))
    onArrival((list) => {
        const slug = trackedSlug()
        if (slug && owned.has(slug)) pushGiftNotification(slug, list)
    })
    const first = [...owned][0]
    if (first && !trackedSlug()) trackIncoming(first)
}

const subscribe = (cb: () => void) => {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
}
const getSnapshot = () => snapshot

export const useNotifications = (): NotificationsSnapshot => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
