import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { NO_ROGUE, isRogueEmpty, sanitizeRogue, type RogueStored } from '../rogue'

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

    const setPoison = useCallback((name: string) => setStored(() => ({ poison: name })), [setStored])
    const clearPoison = useCallback(() => setStored((s) => (s.poison === null ? s : NO_ROGUE)), [setStored])

    return useMemo(() => ({ stored, setPoison, clearPoison }), [stored, setPoison, clearPoison])
}

export type RogueApi = ReturnType<typeof useRogue>
