import { useCallback, useMemo } from 'react'
import { CONDITIONS_BY_ID, computeConditionModifiers, type ConditionModifiers } from '../conditions'
import { useSharedState } from './useSharedState'
import { readLegacy } from '../charId'

/** Prefixo da versão que só gravava local — lido uma vez, para migrar. */
const LEGACY_PREFIX = 'pf2e:viewer:conditions:'

/**
 * Condições marcadas pelo jogador: `{ id: valor }`. Condições sem valor ficam
 * com 1. Só o que o jogador escolheu é guardado — as condições impostas
 * (Inconsciente → Cego, Desprevenido, Caído) são derivadas no cálculo, então
 * tirar a origem tira as impostas junto.
 */
export type ConditionState = Record<string, number>

export function sanitizeConditions(raw: unknown): ConditionState {
    if (!raw || typeof raw !== 'object') return {}
    const state: ConditionState = {}
    Object.entries(raw as Record<string, unknown>).forEach(([id, v]) => {
        // Ignora ids que sumiram do catálogo entre versões.
        if (!CONDITIONS_BY_ID[id]) return
        const n = Math.max(1, Math.floor(Number(v) || 1))
        state[id] = CONDITIONS_BY_ID[id].valued ? n : 1
    })
    return state
}

const isEmpty = (s: ConditionState) => Object.keys(s).length === 0

/** Condições ativas + os modificadores que elas produzem, compartilhadas com a mesa. */
export function useConditions(syncKey: string, level: number, legacyKey?: string) {
    const [state, setState] = useSharedState<ConditionState>(syncKey, {
        empty: () => ({}),
        sanitize: sanitizeConditions,
        legacy: legacyKey ? () => {
            const raw = readLegacy(LEGACY_PREFIX, legacyKey)
            return raw === null ? null : sanitizeConditions(raw)
        } : undefined,
        isEmpty,
    })

    /** Define o valor de uma condição; 0 (ou menos) a remove. */
    const setCondition = useCallback((id: string, value: number) => {
        const def = CONDITIONS_BY_ID[id]
        if (!def) return
        setState((s) => {
            const next = { ...s }
            const v = Math.floor(value)
            if (v <= 0) delete next[id]
            else next[id] = def.valued ? v : 1
            return next
        })
    }, [setState])

    const toggle = useCallback((id: string) => {
        setState((s) => {
            if (s[id] != null) {
                const next = { ...s }
                delete next[id]
                return next
            }
            return { ...s, [id]: 1 }
        })
    }, [setState])

    const adjust = useCallback((id: string, delta: number) => {
        setState((s) => {
            const def = CONDITIONS_BY_ID[id]
            if (!def?.valued) return s
            const next = { ...s }
            const value = (s[id] ?? 0) + delta
            if (value <= 0) delete next[id]
            else next[id] = value
            return next
        })
    }, [setState])

    const clear = useCallback(() => setState(() => ({})), [setState])

    const mods: ConditionModifiers = useMemo(
        () => computeConditionModifiers(state, level),
        [state, level],
    )

    return { state, mods, setCondition, toggle, adjust, clear }
}

export type ConditionsApi = ReturnType<typeof useConditions>
