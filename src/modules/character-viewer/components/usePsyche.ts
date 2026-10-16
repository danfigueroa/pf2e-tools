import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import type { BuildInfo } from '../../character-sheet/types'
import {
    NO_PSYCHE,
    activePsyche,
    hasUnleashPsyche,
    isPsycheEmpty,
    sanitizePsyche,
    strainConditions,
    type PsycheStored,
} from '../psyche'

/**
 * Unleash Psyche, compartilhada com a mesa (campo `psyche`). A página monta o
 * hook fora das abas: o Estupefato da ressaca entra nas condições e o bônus de
 * dano viaja nos modificadores até o diálogo de rolagem das magias.
 */
export function usePsyche(syncKey: string, build: BuildInfo | null) {
    const [stored, setStored] = useSharedState<PsycheStored>(syncKey, {
        empty: () => NO_PSYCHE,
        sanitize: sanitizePsyche,
        isEmpty: isPsycheEmpty,
    })

    const has = useMemo(() => (build ? hasUnleashPsyche(build) : false), [build])
    const effect = useMemo(() => activePsyche(stored, has), [stored, has])
    const strain = useMemo(() => strainConditions(stored, has), [stored, has])

    /** Libera a psique — só de repouso: na ressaca não se pode liberar de novo. */
    const unleash = useCallback(() => {
        setStored((s) => (s.phase === 'idle' ? { phase: 'unleashed', since: Date.now() } : s))
    }, [setStored])

    /** As 2 rodadas passaram: começa a ressaca. */
    const subside = useCallback(() => {
        setStored((s) => (s.phase === 'unleashed' ? { phase: 'strain', since: Date.now() } : s))
    }, [setStored])

    /** A ressaca passou (2 rodadas): volta ao normal. */
    const recover = useCallback(() => {
        setStored((s) => (s.phase === 'strain' ? NO_PSYCHE : s))
    }, [setStored])

    return useMemo(
        () => ({ stored, has, effect, strain, unleash, subside, recover }),
        [stored, has, effect, strain, unleash, subside, recover],
    )
}

export type PsycheApi = ReturnType<typeof usePsyche>
