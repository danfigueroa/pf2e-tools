// Como está o combate da mesa: a rodada, de quem é a vez e a ordem — para o selo "Rodada N"
// da sidebar e a prévia da Iniciativa na Início. Só LEITURA do encontro na nuvem
// (`services/encounters.ts`) do mapa onde a mesa está (ou do "Sem mapa").
//
// Leve de propósito (vai no chunk principal com a sidebar): não importa o módulo da
// Iniciativa nem o store do mapa. O documento é lido com tolerância, campo a campo; quem
// valida de verdade é o `sanitizeEncounter` da Iniciativa, ao abrir.

import { useSyncExternalStore } from 'react'
import { stateApi } from './mesa'
import { fetchCloudEncounter, listenEncounters } from './encounters'
import { onTableEvent } from './notifications'

export interface CombatEntry {
    id: string
    name: string
    initiative: number
    kind: 'pc' | 'npc'
    slug: string | null
    /** PV do monstro (o do personagem é da mesa, não do encontro). */
    hp: { current: number; max: number } | null
    defeated: boolean
}

export interface CombatStatus {
    /** 0 = encontro montado, combate ainda não começou. */
    round: number
    activeId: string | null
    mapId: string | null
    order: CombatEntry[]
}

/** `undefined` = ainda não leu; `null` = nenhum encontro. */
let status: CombatStatus | null | undefined
let mapId: string | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

function read(state: unknown, map: string | null): CombatStatus | null {
    if (!state || typeof state !== 'object') return null
    const s = state as { round?: unknown; activeId?: unknown; combatants?: unknown }
    const list = Array.isArray(s.combatants) ? s.combatants : []
    const order: CombatEntry[] = list.flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return []
        const c = raw as Record<string, unknown>
        if (typeof c.id !== 'string' || typeof c.name !== 'string') return []
        const npc = c.kind === 'npc'
        return [{
            id: c.id,
            name: c.name,
            initiative: num(c.initiative),
            kind: npc ? 'npc' : 'pc',
            slug: typeof c.slug === 'string' ? c.slug : null,
            hp: npc ? { current: num(c.current), max: Math.max(1, num(c.maxHp, 1)) } : null,
            defeated: c.defeated === true,
        } satisfies CombatEntry]
    })
    if (order.length === 0) return null
    return {
        round: num(s.round),
        activeId: typeof s.activeId === 'string' ? s.activeId : null,
        mapId: map,
        order,
    }
}

async function load() {
    try {
        const res = await fetch(stateApi('?maps=1'))
        const body = res.ok ? ((await res.json()) as { activeId?: string | null }) : {}
        mapId = body.activeId ?? null
    } catch { /* sem rede: segue com o mapa de antes */ }
    const cloud = await fetchCloudEncounter(mapId)
    if (cloud === undefined) {
        if (status === undefined) status = null
    } else {
        status = cloud ? read(cloud.state, mapId) : null
    }
    emit()
}

let started = false
let timer: ReturnType<typeof setTimeout> | null = null
/** Junta avisos seguidos (o GM passa vários turnos em sequência) numa leitura só. */
const reload = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; void load() }, 400)
}

function start() {
    if (started || typeof window === 'undefined') return
    started = true
    void load()
    // O encontro do mapa da mesa mudou (passar turno, dano, entrar alguém).
    listenEncounters((notice) => { if (notice.map === mapId) reload() }, (live) => { if (live) reload() })
    // A mesa foi levada a outro mapa, ou o combate começou: o encontro que vale é outro.
    onTableEvent((kind) => { if (kind === 'map-active' || kind === 'combat-started') reload() })
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reload() })
}

const subscribe = (cb: () => void) => {
    start()
    listeners.add(cb)
    return () => { listeners.delete(cb) }
}
const get = () => status

/** O combate da mesa; `undefined` enquanto lê, `null` sem encontro. */
export const useCombatStatus = (): CombatStatus | null | undefined => useSyncExternalStore(subscribe, get, get)
