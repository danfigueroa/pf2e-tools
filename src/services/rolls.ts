// Feed de rolagens da mesa, no cliente: as últimas 30 rolagens de qualquer
// aparelho (`api/_lib/roll-store.js`), acompanhadas por poll.
//
// **Por que poll, e por que tão leve.** A Vercel serverless não segura conexão,
// e o usuário não quer serviço externo de tempo real — a mesma decisão do Mapa.
// O poll lê só UM contador (`GET pf2e:rolls:rev`, 1 comando no Upstash) e a lista
// só desce quando ele muda. Ritmo:
// - 3 s com a aba visível; nada com a aba oculta;
// - rajada de 1 s por 5 s depois de uma rolagem, daqui ou de fora (quem rolou
//   espera a resposta da mesa — o dano depois do ataque, a salvaguarda do alvo).
//
// **Com o Mapa aberto, o feed não faz poll próprio.** O poll do mapa já lê o
// contador como 4ª chave do MGET dele (sem comando a mais) e avisa por
// `noteRollsRev`; o feed só busca a lista quando o número muda. Mapa e
// Iniciativa ligada a mapa não custam nada a mais. Se o mapa parar de avisar
// (a página fechou), o poll próprio volta sozinho.

import { useSyncExternalStore } from 'react'
import { ROLL_HISTORY, sanitizeTableRoll, type TableRoll } from '../dice/tableRoll'

const API = '/api/state'

const IDLE_MS = 3000
const BURST_MS = 1000
const BURST_WINDOW_MS = 5000
/** Sem aviso do mapa há mais que isso, o poll próprio retoma (o lento do mapa é 4 s). */
const EXTERNAL_GRACE_MS = 6000

export interface RollsSnapshot {
    /** A mais nova primeiro. */
    rolls: TableRoll[]
    /** A primeira leitura já voltou — o que estava lá antes conta como "visto". */
    ready: boolean
}

let snapshot: RollsSnapshot = { rolls: [], ready: false }
let rev: number | null = null
/** Rolagens daqui que o servidor ainda não devolveu. */
const pending = new Map<string, TableRoll>()
/** Toda rolagem que saiu DESTE aparelho na sessão. */
const own = new Set<string>()

/** A rolagem saiu deste aparelho — o feed a mostra mesmo se chegou antes da primeira leitura. */
export const isOwnRoll = (id: string): boolean => own.has(id)
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null
let burstUntil = 0
let externalAt = 0

function publish(server: TableRoll[] | null) {
    const base = server ?? snapshot.rolls.filter((r) => !pending.has(r.id))
    for (const r of base) pending.delete(r.id)
    const rolls = [...pending.values(), ...base]
        .sort((a, b) => b.at - a.at)
        .slice(0, ROLL_HISTORY)
    snapshot = { rolls, ready: snapshot.ready || server !== null }
    listeners.forEach((l) => l())
}

async function fetchRolls(): Promise<void> {
    if (inflight) return inflight
    inflight = (async () => {
        try {
            const known = rev == null ? '' : `&rev=${rev}`
            const r = await fetch(`${API}?rolls=1${known}`)
            if (!r.ok) return
            const body = await r.json() as { rev?: number; rolls?: unknown[] }
            if (body.rolls) {
                const list = body.rolls.map(sanitizeTableRoll).filter((x): x is TableRoll => x !== null)
                // Rolagem nova de fora: a mesa está ativa, acelera.
                if (snapshot.ready && list.some((x) => !snapshot.rolls.some((o) => o.id === x.id))) burst()
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
    if (listeners.size === 0 || (typeof document !== 'undefined' && document.hidden)) return
    const wait = delay ?? (Date.now() < burstUntil ? BURST_MS : IDLE_MS)
    timer = setTimeout(tick, wait)
}

async function tick() {
    timer = null
    // O mapa está lendo o contador por nós: só confere de novo mais tarde.
    if (Date.now() - externalAt > EXTERNAL_GRACE_MS) await fetchRolls()
    schedule()
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && listeners.size > 0) schedule(0)
    })
}

/**
 * O poll do mapa leu o contador do feed (4ª chave do MGET dele). Se mudou,
 * busca a lista — e o poll próprio fica em pausa enquanto esses avisos vierem.
 */
export function noteRollsRev(next: number | undefined): void {
    if (typeof next !== 'number') return
    externalAt = Date.now()
    if (rev === null || next !== rev) void fetchRolls()
}

/** Manda uma rolagem à mesa. Otimista: aparece aqui na hora. */
export async function postRoll(roll: TableRoll): Promise<void> {
    own.add(roll.id)
    pending.set(roll.id, roll)
    publish(null)
    burst()
    schedule()
    try {
        const r = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    if (listeners.size === 1) {
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

const SERVER: RollsSnapshot = { rolls: [], ready: false }

/** O feed, acompanhado pelo poll enquanto algum componente o estiver usando. */
export function useTableRolls(): RollsSnapshot {
    return useSyncExternalStore(subscribe, () => snapshot, () => SERVER)
}
