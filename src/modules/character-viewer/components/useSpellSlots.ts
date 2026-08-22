import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'pf2e:viewer:slots:'

/**
 * Slots gastos do dia. Tudo é contagem, nunca índice de slot: assim o estado
 * sobrevive a um re-upload da ficha em que a ordem da lista mudou.
 *
 * - Conjurador preparado: uma chave por magia preparada (cada cópia = 1 slot).
 * - Conjurador espontâneo: uma chave por nível (os slots são intercambiáveis).
 * - Foco: contador único, o pool de pontos do personagem.
 */
export interface SpellSlotsState {
    used: Record<string, number>
    focusUsed: number
}

/** Chave de um grupo de slots. `name` só para preparados (slot = magia preparada). */
export const slotKey = (casterIdx: number, casterName: string, spellLevel: number, name?: string): string =>
    `${casterIdx}:${casterName}|${spellLevel}${name ? `|${name}` : ''}`

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const emptyState = (): SpellSlotsState => ({ used: {}, focusUsed: 0 })

function loadState(key: string, focusMax: number): SpellSlotsState {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key)
        if (raw) {
            const saved = JSON.parse(raw) as Partial<SpellSlotsState>
            const used: Record<string, number> = {}
            Object.entries(saved.used ?? {}).forEach(([k, v]) => {
                const n = Math.max(0, Math.floor(Number(v) || 0))
                if (n > 0) used[k] = n
            })
            return { used, focusUsed: clamp(Math.floor(Number(saved.focusUsed) || 0), 0, focusMax) }
        }
    } catch { /* noop */ }
    return emptyState()
}

/** Slots de magia gastos/disponíveis, persistidos em localStorage por personagem. */
export function useSpellSlots(key: string, focusMax: number) {
    const [state, setState] = useState<SpellSlotsState>(() => loadState(key, focusMax))

    // Recarrega ao trocar de personagem (ou quando o pool de foco muda de tamanho).
    useEffect(() => {
        setState(loadState(key, focusMax))
    }, [key, focusMax])

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state))
        } catch { /* noop */ }
    }, [key, state])

    const usedOf = useCallback((groupKey: string) => state.used[groupKey] ?? 0, [state.used])

    /** Define quantos slots do grupo estão gastos (0 = todos disponíveis). */
    const setUsed = useCallback((groupKey: string, next: number, total: number) => {
        const value = clamp(Math.floor(next), 0, total)
        setState((s) => {
            if ((s.used[groupKey] ?? 0) === value) return s
            const used = { ...s.used }
            if (value === 0) delete used[groupKey]
            else used[groupKey] = value
            return { ...s, used }
        })
    }, [])

    /** Gasta um slot do grupo; ignora se não houver disponível. */
    const spendOne = useCallback((groupKey: string, total: number) => {
        setState((s) => {
            const current = s.used[groupKey] ?? 0
            if (current >= total) return s
            return { ...s, used: { ...s.used, [groupKey]: current + 1 } }
        })
    }, [])

    const setFocusUsed = useCallback((next: number) => {
        setState((s) => ({ ...s, focusUsed: clamp(Math.floor(next), 0, focusMax) }))
    }, [focusMax])

    const spendFocus = useCallback(() => {
        setState((s) => (s.focusUsed >= focusMax ? s : { ...s, focusUsed: s.focusUsed + 1 }))
    }, [focusMax])

    /** Início do dia: devolve todos os slots e pontos de foco. */
    const resetAll = useCallback(() => setState(emptyState()), [])

    const spentCount = useMemo(
        () => Object.values(state.used).reduce((sum, n) => sum + n, 0) + state.focusUsed,
        [state],
    )

    return {
        usedOf,
        setUsed,
        spendOne,
        focusUsed: state.focusUsed,
        focusMax,
        setFocusUsed,
        spendFocus,
        resetAll,
        spentCount,
    }
}

export type SpellSlotsApi = ReturnType<typeof useSpellSlots>
