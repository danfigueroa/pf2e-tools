import { useCallback } from 'react'
import { useSharedState } from './useSharedState'

/**
 * Consumíveis gastos, compartilhados com a mesa — o Pathbuilder não sabe que o
 * jogador bebeu a poção, e o JSON da ficha não é editado à mão (seria perdido
 * no próximo export).
 *
 * Guarda por nome **quantos** foram usados, nunca qual cópia, como os slots.
 * `of` é a quantidade que a ficha tinha quando o uso foi marcado: se um export
 * novo chegar com outra quantidade, o jogador já atualizou o Pathbuilder e o
 * gasto contaria duas vezes — o contador daquele item recomeça do zero.
 */
export interface ConsumedEntry {
    used: number
    of: number
}

export type ConsumedState = Record<string, ConsumedEntry>

const emptyState = (): ConsumedState => ({})

function sanitize(raw: unknown): ConsumedState {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState()
    const out: ConsumedState = {}
    Object.entries(raw as Record<string, unknown>).forEach(([name, value]) => {
        if (!value || typeof value !== 'object') return
        const v = value as Partial<ConsumedEntry>
        const used = Math.max(0, Math.floor(Number(v.used) || 0))
        const of = Math.max(0, Math.floor(Number(v.of) || 0))
        if (used > 0 && of > 0) out[name] = { used: Math.min(used, of), of }
    })
    return out
}

const isEmpty = (s: ConsumedState) => Object.keys(s).length === 0

export function useConsumables(syncKey: string) {
    const [state, setState] = useSharedState<ConsumedState>(syncKey, {
        empty: emptyState,
        sanitize,
        isEmpty,
    })

    /** Quantos usados valem para a quantidade que a ficha tem AGORA. */
    const usedOf = useCallback((name: string, qty: number): number => {
        const entry = state[name]
        return entry && entry.of === qty ? Math.min(entry.used, qty) : 0
    }, [state])

    const remaining = useCallback((name: string, qty: number): number =>
        Math.max(0, qty - usedOf(name, qty)), [usedOf])

    /** Gasta uma unidade; ignora se já não houver nenhuma. */
    const consume = useCallback((name: string, qty: number) => {
        setState((s) => {
            const prev = s[name]?.of === qty ? s[name].used : 0
            if (prev >= qty) return s
            return { ...s, [name]: { used: prev + 1, of: qty } }
        })
    }, [setState])

    /** Devolve uma unidade — o "Desfazer" e o "Devolver" de um item esgotado. */
    const restore = useCallback((name: string, qty: number) => {
        setState((s) => {
            const prev = s[name]?.of === qty ? s[name].used : 0
            if (prev <= 0) return s
            const next = { ...s }
            if (prev === 1) delete next[name]
            else next[name] = { used: prev - 1, of: qty }
            return next
        })
    }, [setState])

    return { remaining, consume, restore }
}

export type ConsumablesApi = ReturnType<typeof useConsumables>
