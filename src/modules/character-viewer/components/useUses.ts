import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'

/**
 * Atividades de uso limitado já gastas hoje ("uma vez por dia"), compartilhadas com a mesa —
 * o Pathbuilder não sabe de nada disso. Guarda **quantas vezes** por nome do talento, como os
 * consumíveis e os slots; o "Novo dia" zera tudo.
 */
export type UsesState = Record<string, number>

const emptyState = (): UsesState => ({})

function sanitize(raw: unknown): UsesState {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState()
    const out: UsesState = {}
    Object.entries(raw as Record<string, unknown>).forEach(([name, v]) => {
        const n = Math.max(0, Math.min(99, Math.floor(Number(v) || 0)))
        if (n > 0 && name.length <= 80) out[name] = n
    })
    return out
}

const isEmpty = (s: UsesState) => Object.keys(s).length === 0

export function useUses(syncKey: string) {
    const [state, setState] = useSharedState<UsesState>(syncKey, { empty: emptyState, sanitize, isEmpty })

    const usedOf = useCallback((name: string) => state[name] ?? 0, [state])
    const mark = useCallback((name: string) => setState((s) => ({ ...s, [name]: (s[name] ?? 0) + 1 })), [setState])
    const unmark = useCallback((name: string) => setState((s) => {
        if (!s[name]) return s
        const next = { ...s }
        if (s[name] <= 1) delete next[name]
        else next[name] = s[name] - 1
        return next
    }), [setState])
    /** Novo dia: devolve tudo. */
    const resetAll = useCallback(() => setState(() => ({})), [setState])

    return useMemo(() => ({ usedOf, mark, unmark, resetAll }), [usedOf, mark, unmark, resetAll])
}

export type UsesApi = ReturnType<typeof useUses>
