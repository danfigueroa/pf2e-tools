import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { readLegacy } from '../charId'

/** Prefixo da versão que só gravava local — lido uma vez, para migrar. */
const LEGACY_PREFIX = 'pf2e:viewer:slots:'

/**
 * Slots gastos do dia, compartilhados com a mesa. Tudo é contagem, nunca índice
 * de slot: assim o estado sobrevive a um re-upload da ficha em que a ordem da
 * lista mudou.
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

function sanitize(raw: unknown): SpellSlotsState {
    if (!raw || typeof raw !== 'object') return emptyState()
    const saved = raw as Partial<SpellSlotsState>
    const used: Record<string, number> = {}
    Object.entries(saved.used ?? {}).forEach(([k, v]) => {
        const n = Math.max(0, Math.floor(Number(v) || 0))
        if (n > 0) used[k] = n
    })
    return { used, focusUsed: Math.max(0, Math.floor(Number(saved.focusUsed) || 0)) }
}

const isEmpty = (s: SpellSlotsState) => s.focusUsed === 0 && Object.keys(s.used).length === 0

/** Slots de magia gastos/disponíveis, compartilhados com a mesa. */
export function useSpellSlots(syncKey: string, focusMax: number, legacyKey?: string) {
    const [state, setState] = useSharedState<SpellSlotsState>(syncKey, {
        empty: emptyState,
        sanitize,
        legacy: legacyKey ? () => {
            const raw = readLegacy(LEGACY_PREFIX, legacyKey)
            return raw === null ? null : sanitize(raw)
        } : undefined,
        isEmpty,
    })

    // O pool de foco pode encolher (troca de ficha); clampar no render evita
    // reler o estado da mesa só porque `focusMax` mudou.
    const focusUsed = clamp(state.focusUsed, 0, focusMax)

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
    }, [setState])

    /** Gasta um slot do grupo; ignora se não houver disponível. */
    const spendOne = useCallback((groupKey: string, total: number) => {
        setState((s) => {
            const current = s.used[groupKey] ?? 0
            if (current >= total) return s
            return { ...s, used: { ...s.used, [groupKey]: current + 1 } }
        })
    }, [setState])

    const setFocusUsed = useCallback((next: number) => {
        setState((s) => ({ ...s, focusUsed: clamp(Math.floor(next), 0, focusMax) }))
    }, [setState, focusMax])

    const spendFocus = useCallback(() => {
        setState((s) => (s.focusUsed >= focusMax ? s : { ...s, focusUsed: s.focusUsed + 1 }))
    }, [setState, focusMax])

    /** Início do dia: devolve todos os slots e pontos de foco — para a mesa toda. */
    const resetAll = useCallback(() => setState(emptyState), [setState])

    const spentCount = useMemo(
        () => Object.values(state.used).reduce((sum, n) => sum + n, 0) + focusUsed,
        [state.used, focusUsed],
    )

    return {
        usedOf,
        setUsed,
        spendOne,
        focusUsed,
        focusMax,
        setFocusUsed,
        spendFocus,
        resetAll,
        spentCount,
    }
}

export type SpellSlotsApi = ReturnType<typeof useSpellSlots>
