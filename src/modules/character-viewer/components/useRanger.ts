import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import type { BuildInfo } from '../../character-sheet/types'
import { NO_RANGER, activeRanger, isRangerEmpty, sanitizeRanger, type RangerStored } from '../ranger'

/**
 * Hunt Prey e Gravity Weapon do Patrulheiro, compartilhadas com a mesa (campo
 * `ranger`). A página monta o hook fora das abas: o efeito viaja nos
 * modificadores até o diálogo do Golpe.
 */
export function useRanger(syncKey: string, build: BuildInfo | null) {
    const [stored, setStored] = useSharedState<RangerStored>(syncKey, {
        empty: () => NO_RANGER,
        sanitize: sanitizeRanger,
        isEmpty: isRangerEmpty,
    })

    const effect = useMemo(() => (build ? activeRanger(stored, build) : null), [stored, build])

    const setPrey = useCallback((on: boolean) => {
        setStored((s) => (s.prey === on ? s : { ...s, prey: on }))
    }, [setStored])

    const setGravity = useCallback((on: boolean) => {
        setStored((s) => (s.gravity === on ? s : { ...s, gravity: on }))
    }, [setStored])

    // Viaja até a aba de Combate, que é `memo`.
    return useMemo(() => ({ stored, effect, setPrey, setGravity }), [stored, effect, setPrey, setGravity])
}

export type RangerApi = ReturnType<typeof useRanger>
