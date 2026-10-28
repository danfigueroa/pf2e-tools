// O que os colegas passaram a este personagem. Cada jogador grava o `gave` na
// própria fatia (ver `character-viewer/gifts.ts`); aqui se lê, de uma vez, o que
// aponta para mim, e depois o Realtime do estado da mesa mantém atualizado.

import { mesaKey, stateApi } from './mesa'
import { ensureStateLive, onStateChange, subscribeStatus } from './tableState'
import { arrivals, sanitizeGave, sanitizeIncoming, type Incoming } from '../modules/character-viewer/gifts'

type Arrival = { from: string; name: string; n: number }

let me: string | null = null
let incoming: Incoming = {}
let loaded = false
const listeners = new Set<() => void>()
const arrivalListeners = new Set<(list: Arrival[]) => void>()

const seenKey = (slug: string) => mesaKey(`pf2e:gifts:seen:${slug}`)

function readSeen(slug: string): Incoming | null {
    try {
        const raw = localStorage.getItem(seenKey(slug))
        return raw ? sanitizeIncoming(JSON.parse(raw)) : null
    } catch { return null }
}

function writeSeen(slug: string, value: Incoming) {
    try { localStorage.setItem(seenKey(slug), JSON.stringify(value)) } catch { /* sem cache */ }
}

/**
 * Troca o retrato e avisa. A PRIMEIRA leitura nunca avisa (é o que já estava lá),
 * a menos que o aparelho tenha um "visto" guardado: aí o que chegou com o app
 * fechado aparece como aviso na volta.
 */
function setIncoming(next: Incoming, first: boolean) {
    if (!me) return
    const baseline = first ? readSeen(me) : incoming
    const fresh = baseline ? arrivals(baseline, next) : []
    incoming = next
    loaded = true
    writeSeen(me, next)
    listeners.forEach((l) => l())
    if (fresh.length > 0) arrivalListeners.forEach((l) => l(fresh))
}

export const getIncoming = (): Incoming => incoming
/** O personagem acompanhado agora (o da ficha aberta), a quem os avisos de `onArrival` se referem. */
export const trackedSlug = (): string | null => me
export const isIncomingLoaded = (): boolean => loaded

export function subscribeIncoming(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

export function onArrival(listener: (list: Arrival[]) => void): () => void {
    arrivalListeners.add(listener)
    return () => { arrivalListeners.delete(listener) }
}

async function fetchIncoming(slug: string) {
    try {
        const r = await fetch(stateApi(`?incoming=${encodeURIComponent(slug)}`))
        if (!r.ok) return
        const body = await r.json() as { incoming?: unknown }
        if (me !== slug) return
        setIncoming(sanitizeIncoming(body.incoming), !loaded)
    } catch { /* offline: fica o que já se tinha */ }
}

let wired = false
function wire() {
    if (wired || typeof window === 'undefined') return
    wired = true
    // Escrita `gave` de um colega (daqui ou de outro aparelho): pega só a parte que aponta para mim.
    onStateChange((slug, field, data) => {
        if (field !== 'gave' || !me || !loaded || slug === me) return
        const mine = sanitizeGave(data)[me]
        const next = { ...incoming }
        if (mine) next[slug] = mine
        else delete next[slug]
        setIncoming(next, false)
    })
    // Canal que reabre ou aba que volta: transmissão perdida não volta sozinha.
    let wasLive = false
    subscribeStatus((s) => {
        if (s.live && !wasLive && me) void fetchIncoming(me)
        wasLive = s.live
    })
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && me) void fetchIncoming(me)
    })
}

/** Passa a acompanhar o que chega a `slug` (o personagem da ficha aberta). */
export function trackIncoming(slug: string): void {
    wire()
    ensureStateLive()
    if (me === slug) return
    me = slug
    incoming = {}
    loaded = false
    listeners.forEach((l) => l())
    void fetchIncoming(slug)
}
