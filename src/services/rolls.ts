// Feed de rolagens da mesa, no cliente: as últimas rolagens de qualquer aparelho
// (`api/_lib/roll-store.js`), em TEMPO REAL.
//
// **Realtime.** Cada rolagem (e cada regra compartilhada) que o servidor grava
// é transmitida pelo banco no canal privado `mesa:<mesa>:rolls`, já com o
// conteúdo: com o canal aberto não há poll nenhum. A lista inteira só é lida na
// abertura e a cada (re)conexão — com o `rev` de antes, o servidor devolve só o
// número quando nada mudou.
//
// **Poll de reserva, quando não há canal** (sem Supabase, rede ruim): lê só o
// contador e a lista desce quando ele muda. Ritmo:
// - 1,5 s com a aba visível; nada com a aba oculta;
// - rajada de 1 s por 5 s depois de uma rolagem, daqui ou de fora (quem rolou
//   espera a resposta da mesa — o dano depois do ataque, a salvaguarda do alvo).
//
// **Regras compartilhadas** (`tableShare.ts`) andam no mesmo canal e na mesma
// resposta (`shares`).

import { useSyncExternalStore } from 'react'
import { ROLL_HISTORY, sanitizeTableRoll, type TableRoll } from '../dice/tableRoll'
import { sanitizeTableShare, type TableShare } from './tableShare'
import { stateApi } from './mesa'
import { authHeaderNow, listenMesaChannel } from './supabase'

const IDLE_MS = 1500
const BURST_MS = 1000
const BURST_WINDOW_MS = 5000
const SHARE_HISTORY = 5

export interface RollsSnapshot {
    /** A mais nova primeiro. */
    rolls: TableRoll[]
    /** Regras compartilhadas com a mesa, a mais nova primeiro. */
    shares: TableShare[]
    /** A primeira leitura já voltou — o que estava lá antes conta como "visto". */
    ready: boolean
}

let snapshot: RollsSnapshot = { rolls: [], shares: [], ready: false }
let rev: number | null = null
/** Rolagens daqui que o servidor ainda não devolveu. */
const pending = new Map<string, TableRoll>()
/** Toda rolagem (e todo compartilhamento) que saiu DESTE aparelho na sessão. */
const own = new Set<string>()

/** A rolagem saiu deste aparelho — o feed a mostra mesmo se chegou antes da primeira leitura. */
export const isOwnRoll = (id: string): boolean => own.has(id)

/** Um compartilhamento criado por outro caminho (o handout do diário, pelo `journal-reveal`) também é "daqui". */
export const markOwnShare = (id: string): void => { own.add(id) }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null
let burstUntil = 0
/** O canal do Realtime está aberto: nada de poll. */
let live = false
let realtimeStarted = false

/** Quem quer saber que a mesa rolou algo (o mapa acelera o próprio poll). */
const activityListeners = new Set<() => void>()
export function onFeedActivity(listener: () => void): () => void {
    activityListeners.add(listener)
    return () => { activityListeners.delete(listener) }
}
const noteActivity = () => activityListeners.forEach((l) => l())

function publish(server: TableRoll[] | null) {
    const base = server ?? snapshot.rolls.filter((r) => !pending.has(r.id))
    for (const r of base) pending.delete(r.id)
    const rolls = [...pending.values(), ...base]
        .sort((a, b) => b.at - a.at)
        .slice(0, ROLL_HISTORY)
    snapshot = { ...snapshot, rolls, ready: snapshot.ready || server !== null }
    listeners.forEach((l) => l())
}

function publishShares(list: TableShare[]) {
    snapshot = { ...snapshot, shares: list }
    listeners.forEach((l) => l())
}

async function fetchRolls(): Promise<void> {
    if (inflight) return inflight
    inflight = (async () => {
        try {
            const known = rev == null ? '' : `&rev=${rev}`
            const r = await fetch(stateApi(`?rolls=1${known}`))
            if (!r.ok) return
            const body = await r.json() as { rev?: number; rolls?: unknown[]; shares?: unknown[] }
            if (body.shares) {
                const list = body.shares.map(sanitizeTableShare).filter((x): x is TableShare => x !== null)
                if (list.some((x) => !snapshot.shares.some((o) => o.id === x.id))) {
                    if (snapshot.ready) { burst(); noteActivity() }
                    publishShares(list)
                }
            }
            if (body.rolls) {
                const list = body.rolls.map(sanitizeTableRoll).filter((x): x is TableRoll => x !== null)
                // Rolagem nova de fora: a mesa está ativa, acelera.
                if (snapshot.ready && list.some((x) => !snapshot.rolls.some((o) => o.id === x.id))) {
                    burst()
                    noteActivity()
                }
                publish(list)
            } else if (!snapshot.ready) {
                publish([])
            }
            if (typeof body.rev === 'number') rev = body.rev
        } catch {
            /* rede fora: o próximo poll tenta de novo */
        } finally {
            inflight = null
        }
    })()
    return inflight
}

function burst() {
    burstUntil = Date.now() + BURST_WINDOW_MS
}

function schedule(delay?: number) {
    if (timer) clearTimeout(timer)
    timer = null
    if (live || listeners.size === 0 || (typeof document !== 'undefined' && document.hidden)) return
    const wait = delay ?? (Date.now() < burstUntil ? BURST_MS : IDLE_MS)
    timer = setTimeout(tick, wait)
}

async function tick() {
    timer = null
    await fetchRolls()
    schedule()
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden || listeners.size === 0) return
        // Com o canal: confere uma vez (o socket pode ter morrido no bolso), e
        // com o `rev` de antes isso custa só o número. Sem: o poll volta.
        if (live) void fetchRolls()
        else schedule(0)
    })
}

/** Uma rolagem que o banco transmitiu (a daqui também volta por aqui, e é casada pelo id). */
function receiveRoll(payload: unknown) {
    const roll = sanitizeTableRoll((payload as { roll?: unknown })?.roll)
    if (!roll) return
    const known = snapshot.rolls.some((x) => x.id === roll.id && !pending.has(x.id))
    pending.delete(roll.id)
    publish([roll, ...snapshot.rolls.filter((x) => x.id !== roll.id && !pending.has(x.id))])
    if (!known && !own.has(roll.id)) noteActivity()
}

function receiveShare(payload: unknown) {
    const share = sanitizeTableShare((payload as { share?: unknown })?.share)
    if (!share || snapshot.shares.some((x) => x.id === share.id)) return
    publishShares([share, ...snapshot.shares].slice(0, SHARE_HISTORY))
    if (!own.has(share.id)) noteActivity()
}

function startRealtime() {
    if (realtimeStarted) return
    realtimeStarted = true
    void listenMesaChannel('rolls', { roll: receiveRoll, share: receiveShare }, (open) => {
        live = open
        // A cada (re)conexão, o que passou com o canal fechado. Sem canal, o poll volta.
        void fetchRolls().then(() => schedule())
    }).then((stop) => { if (!stop) realtimeStarted = false })
}

/** Manda uma rolagem à mesa. Otimista: aparece aqui na hora. */
export async function postRoll(roll: TableRoll): Promise<void> {
    own.add(roll.id)
    pending.set(roll.id, roll)
    publish(null)
    burst()
    schedule()
    try {
        const r = await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify({ action: 'roll-add', roll }),
        })
        if (!r.ok) return
        const body = await r.json() as { rev?: number; roll?: unknown }
        const saved = sanitizeTableRoll(body.roll)
        // A revisão só andou por causa desta rolagem: não há o que baixar.
        if (typeof body.rev === 'number' && rev !== null && body.rev === rev + 1) rev = body.rev
        if (saved) {
            pending.delete(roll.id)
            publish([saved, ...snapshot.rolls.filter((x) => x.id !== saved.id && !pending.has(x.id))])
        }
    } catch {
        /* sem rede: a rolagem fica só neste aparelho */
    }
}

/**
 * Compartilha uma regra com a mesa. Sem cópia otimista: quem compartilhou já
 * está com a descrição aberta, e o cartão não aparece no aparelho de origem.
 */
export async function postShare(share: TableShare): Promise<boolean> {
    own.add(share.id)
    burst()
    schedule()
    try {
        const r = await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify({ action: 'share-add', share }),
        })
        return r.ok
    } catch {
        return false
    }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    if (listeners.size === 1) {
        startRealtime()
        void fetchRolls().then(() => schedule())
    }
    return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && timer) {
            clearTimeout(timer)
            timer = null
        }
    }
}

const SERVER: RollsSnapshot = { rolls: [], shares: [], ready: false }

/** O feed, acompanhado (canal ou poll) enquanto algum componente o estiver usando. */
export function useTableRolls(): RollsSnapshot {
    return useSyncExternalStore(subscribe, () => snapshot, () => SERVER)
}

const getShares = () => snapshot.shares
const NO_SHARES: TableShare[] = []

/** As regras compartilhadas — repinta só quando elas mudam, não a cada rolagem. */
export function useTableShares(): { shares: TableShare[]; ready: boolean } {
    const shares = useSyncExternalStore(subscribe, getShares, () => NO_SHARES)
    const ready = useSyncExternalStore(subscribe, () => snapshot.ready, () => false)
    return { shares, ready }
}
