import { useCallback, useEffect, useMemo, useState } from 'react'
import { CONDITIONS_BY_ID, computeConditionModifiers, type ConditionModifiers } from '../conditions'

const STORAGE_PREFIX = 'pf2e:viewer:conditions:'

/**
 * Condições marcadas pelo jogador: `{ id: valor }`. Condições sem valor ficam
 * com 1. Só o que o jogador escolheu é guardado — as condições impostas
 * (Inconsciente → Cego, Desprevenido, Caído) são derivadas no cálculo, então
 * tirar a origem tira as impostas junto.
 */
export type ConditionState = Record<string, number>

function loadState(key: string): ConditionState {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key)
        if (raw) {
            const saved = JSON.parse(raw) as Record<string, unknown>
            const state: ConditionState = {}
            Object.entries(saved).forEach(([id, v]) => {
                // Ignora ids que sumiram do catálogo entre versões.
                if (!CONDITIONS_BY_ID[id]) return
                const n = Math.max(1, Math.floor(Number(v) || 1))
                state[id] = CONDITIONS_BY_ID[id].valued ? n : 1
            })
            return state
        }
    } catch { /* noop */ }
    return {}
}

/** Condições ativas + os modificadores que elas produzem, por personagem. */
export function useConditions(key: string, level: number) {
    const [state, setState] = useState<ConditionState>(() => loadState(key))

    // Recarrega ao trocar de personagem.
    useEffect(() => {
        setState(loadState(key))
    }, [key])

    useEffect(() => {
        try {
            // Sem condição ativa não há o que guardar — evita lixo no storage.
            if (Object.keys(state).length === 0) localStorage.removeItem(STORAGE_PREFIX + key)
            else localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state))
        } catch { /* noop */ }
    }, [key, state])

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
    }, [])

    const toggle = useCallback((id: string) => {
        setState((s) => {
            if (s[id] != null) {
                const next = { ...s }
                delete next[id]
                return next
            }
            return { ...s, [id]: 1 }
        })
    }, [])

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
    }, [])

    const clear = useCallback(() => setState({}), [])

    const mods: ConditionModifiers = useMemo(
        () => computeConditionModifiers(state, level),
        [state, level],
    )

    return { state, mods, setCondition, toggle, adjust, clear }
}

export type ConditionsApi = ReturnType<typeof useConditions>
