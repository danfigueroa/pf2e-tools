import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { NO_ROGUE, SIMPLE_POISON, isRogueEmpty, sanitizeRogue, type RogueStored } from '../rogue'

/**
 * Veneno na arma (Poison Weapon), compartilhado com a mesa (campo `rogue`):
 * quem pega o Golpe seguinte vê qual veneno está na lâmina.
 */
export function useRogue(syncKey: string) {
    const [stored, setStored] = useSharedState<RogueStored>(syncKey, {
        empty: () => NO_ROGUE,
        sanitize: sanitizeRogue,
        isEmpty: isRogueEmpty,
    })

    const setPoison = useCallback((name: string) => setStored((s) => ({ ...s, poison: name })), [setStored])
    /** Aplica uma dose do veneno simples: a arma fica envenenada e a dose sai da conta do dia. */
    const applySimple = useCallback(() => setStored((s) => ({ poison: SIMPLE_POISON, simpleUsed: s.simpleUsed + 1 })), [setStored])
    const clearPoison = useCallback(() => setStored((s) => (s.poison === null ? s : { ...s, poison: null })), [setStored])
    /** Preparação diária: as doses voltam (e o que sobrou expirou). */
    const newDay = useCallback(() => setStored((s) => ({
        poison: s.poison === SIMPLE_POISON ? null : s.poison,
        simpleUsed: 0,
    })), [setStored])

    return useMemo(() => ({ stored, setPoison, applySimple, clearPoison, newDay }), [stored, setPoison, applySimple, clearPoison, newDay])
}

export type RogueApi = ReturnType<typeof useRogue>
