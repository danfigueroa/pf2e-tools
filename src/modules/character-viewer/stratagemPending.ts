// O d20 do Devise a Stratagem, rolado ANTES do Golpe.
//
// A regra (Player Core 2 pg. 103, conferida na AON): "Roll a d20, then decide on an attack stratagem or skill
// stratagem." Escolhendo o de ataque, o PRIMEIRO Golpe contra a criatura antes do início do próximo turno usa esse
// d20 no lugar da rolagem; o de perícia dá +1 no próximo teste de INT/SAB/CAR ou Percepção sobre ela e proíbe
// golpeá-la. Por isso o d20 sai sozinho, sem ir à mesa: só vira rolagem se for usado no Golpe — e aí conta uma vez
// nas estatísticas, como qualquer d20. Descartado, não conta em lugar nenhum.
//
// Fica em memória por personagem (não na mesa): fechar o diálogo não rerola, e o d20 vale até ser usado,
// descartado, o turno mudar (`actions.turn`, que a Iniciativa e o "Novo turno" trocam) ou passarem 15 minutos.

import { useSyncExternalStore } from 'react'
import { rollDie } from '../../dice/roll'
import type { TableRoll } from '../../dice/tableRoll'

export interface PendingStratagem {
    d20: number
    /** O `actions.turn` de quando foi rolado. */
    turn: number
    at: number
}

const TTL_MS = 15 * 60 * 1000
const pending = new Map<string, PendingStratagem>()
const listeners = new Set<() => void>()
const emit = () => { for (const l of listeners) l() }

/** O d20 ainda válido deste personagem, ou `null`. */
export function readStratagem(slug: string, turn: number, now = Date.now()): PendingStratagem | null {
    const p = pending.get(slug)
    if (!p) return null
    if (p.turn !== turn || now - p.at > TTL_MS) return null
    return p
}

/** O d20 guardado, sem conferir o turno (só o prazo): o diálogo do Golpe abre com o estratagema ligado se houver. */
export function peekStratagem(slug: string, now = Date.now()): PendingStratagem | null {
    const p = pending.get(slug)
    return p && now - p.at <= TTL_MS ? p : null
}

/** Rola o d20 do estratagema e o guarda. */
export function rollStratagem(slug: string, turn: number, d20 = rollDie(20), now = Date.now()): PendingStratagem {
    const p = { d20, turn, at: now }
    pending.set(slug, p)
    emit()
    return p
}

/** Usado no Golpe ou descartado. */
export function clearStratagem(slug: string): void {
    if (pending.delete(slug)) emit()
}

/** O d20 do estratagema no lugar do rolado: o Golpe (ou o primeiro do Flurry). O total segue `d20 + mod`. */
export function withStratagemD20(roll: TableRoll, d20: number): TableRoll {
    if (roll.check) return { ...roll, check: { ...roll.check, d20, total: d20 + roll.check.mod } }
    if (roll.rays?.length) {
        return { ...roll, rays: roll.rays.map((r, i) => (i === 0 ? { ...r, check: { ...r.check, d20, total: d20 + r.check.mod } } : r)) }
    }
    return roll
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }

/** Assina o d20 pendente (a faixa do Investigador e o diálogo do Golpe). */
export function useStratagemPending(slug: string, turn: number): PendingStratagem | null {
    const snap = useSyncExternalStore(subscribe, () => pending.get(slug) ?? null)
    return snap && readStratagem(slug, turn) ? snap : null
}
