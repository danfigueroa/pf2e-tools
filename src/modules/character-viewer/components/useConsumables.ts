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
 *
 * Item que o personagem só RECEBEU de um colega (`gifts.ts`) não está na ficha:
 * `of` é 0. O que vale para o contador é sempre a quantidade da FICHA; o que foi
 * passado entra como `extra` (a variação líquida), que só alarga o teto de uso.
 */
export interface ConsumedEntry {
    used: number
    of: number
}

export type ConsumedState = Record<string, ConsumedEntry>

// Teto de sanidade: o total real (ficha + recebido) quem limita é `consume`.
const MAX_USED = 999

const emptyState = (): ConsumedState => ({})

function sanitize(raw: unknown): ConsumedState {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState()
    const out: ConsumedState = {}
    Object.entries(raw as Record<string, unknown>).forEach(([name, value]) => {
        if (!value || typeof value !== 'object') return
        const v = value as Partial<ConsumedEntry>
        const used = Math.max(0, Math.floor(Number(v.used) || 0))
        const of = Math.max(0, Math.floor(Number(v.of) || 0))
        if (used > 0) out[name] = { used: Math.min(used, MAX_USED), of }
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
    const usedOf = useCallback((name: string, sheetQty: number): number => {
        const entry = state[name]
        return entry && entry.of === sheetQty ? entry.used : 0
    }, [state])

    /** `extra` = o que o personagem recebeu menos o que passou. */
    const remaining = useCallback((name: string, sheetQty: number, extra = 0): number =>
        Math.max(0, sheetQty + extra - usedOf(name, sheetQty)), [usedOf])

    /** Gasta uma unidade; ignora se já não houver nenhuma. */
    const consume = useCallback((name: string, sheetQty: number, extra = 0) => {
        setState((s) => {
            const prev = s[name]?.of === sheetQty ? s[name].used : 0
            if (prev >= sheetQty + extra) return s
            return { ...s, [name]: { used: prev + 1, of: sheetQty } }
        })
    }, [setState])

    /** Devolve uma unidade — o "Desfazer" e o "Devolver" de um item esgotado. */
    const restore = useCallback((name: string, sheetQty: number) => {
        setState((s) => {
            const prev = s[name]?.of === sheetQty ? s[name].used : 0
            if (prev <= 0) return s
            const next = { ...s }
            if (prev === 1) delete next[name]
            else next[name] = { used: prev - 1, of: sheetQty }
            return next
        })
    }, [setState])

    return { remaining, consume, restore }
}

export type ConsumablesApi = ReturnType<typeof useConsumables>
