import { useCallback } from 'react'
import { useSharedState } from './useSharedState'

/**
 * Pontos Míticos gastos, compartilhados com a mesa — mesma mecânica dos slots
 * de magia e dos pontos de foco: guarda **quantos** foram gastos, nunca quais,
 * então o estado sobrevive a um re-upload da ficha.
 *
 * Nasceu já sincronizado (não existiu versão local-only), por isso não há
 * migração de chave legada como em `useSpellSlots`/`useConditions`.
 */
export interface MythicPointsState {
    used: number
}

const emptyState = (): MythicPointsState => ({ used: 0 })

function sanitize(raw: unknown): MythicPointsState {
    if (!raw || typeof raw !== 'object') return emptyState()
    const saved = raw as Partial<MythicPointsState>
    return { used: Math.max(0, Math.floor(Number(saved.used) || 0)) }
}

const isEmpty = (s: MythicPointsState) => s.used === 0

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function useMythicPoints(syncKey: string, max: number) {
    const [state, setState] = useSharedState<MythicPointsState>(syncKey, {
        empty: emptyState,
        sanitize,
        isEmpty,
    })

    // O pool pode encolher entre versões; clampar no render evita reler o
    // estado da mesa só porque `max` mudou (mesma razão do foco).
    const used = clamp(state.used, 0, max)
    const available = max - used

    /** Define quantos pontos estão gastos — é o clique num pip. */
    const setUsed = useCallback((next: number) => {
        setState((s) => {
            const value = clamp(Math.floor(next), 0, max)
            return s.used === value ? s : { used: value }
        })
    }, [setState, max])

    /** Gasta 1 ponto; ignora se não houver disponível. */
    const spend = useCallback(() => {
        setState((s) => (s.used >= max ? s : { used: s.used + 1 }))
    }, [setState, max])

    /** Início do dia: o pool volta cheio. */
    const resetAll = useCallback(() => setState(emptyState), [setState])

    return { used, available, max, setUsed, spend, resetAll }
}

export type MythicPointsApi = ReturnType<typeof useMythicPoints>
