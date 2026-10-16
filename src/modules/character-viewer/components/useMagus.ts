import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import type { BuildInfo } from '../../character-sheet/types'
import {
    CASCADE_TYPES,
    NO_MAGUS,
    activeCascade,
    hasArcaneCascade,
    isMagusEmpty,
    sanitizeMagus,
    type MagusStored,
} from '../magus'

/**
 * Arcane Cascade, Spellstrike e Summon Mythic Power do Magus, compartilhados com
 * a mesa (campo `magus`). A página monta o hook fora das abas: a postura muda o
 * dano dos Golpes da aba de Combate, que lê `effect` pelos modificadores.
 */
export function useMagus(syncKey: string, build: BuildInfo | null) {
    const [stored, setStored] = useSharedState<MagusStored>(syncKey, {
        empty: () => NO_MAGUS,
        sanitize: sanitizeMagus,
        isEmpty: isMagusEmpty,
    })

    const effect = useMemo(() => (build ? activeCascade(stored, build) : null), [stored, build])
    const canCascade = useMemo(() => (build ? hasArcaneCascade(build) : false), [build])

    const setCascade = useCallback((on: boolean) => {
        setStored((s) => (s.cascade === on ? s : { ...s, cascade: on }))
    }, [setStored])

    const setCascadeType = useCallback((type: string) => {
        if (!(CASCADE_TYPES as readonly string[]).includes(type)) return
        setStored((s) => (s.cascadeType === type ? s : { ...s, cascadeType: type }))
    }, [setStored])

    /** Usou o Spellstrike: só volta recarregando. */
    const spendSpellstrike = useCallback(() => {
        setStored((s) => (s.spent ? s : { ...s, spent: true }))
    }, [setStored])

    /** Recarregou (1 ação). */
    const rechargeSpellstrike = useCallback(() => {
        setStored((s) => (s.spent ? { ...s, spent: false } : s))
    }, [setStored])

    /** Gastou a Summon Mythic Power de hoje. */
    const markSummoned = useCallback(() => {
        setStored((s) => (s.summoned ? s : { ...s, summoned: true }))
    }, [setStored])

    /** Novo dia: a Summon Mythic Power volta; o Spellstrike volta carregado; a postura acaba. */
    const newDay = useCallback(() => {
        setStored((s) => ({ ...s, summoned: false, spent: false, cascade: false }))
    }, [setStored])

    // Viaja até a aba de Combate, que é `memo`.
    return useMemo(
        () => ({ stored, effect, canCascade, setCascade, setCascadeType, spendSpellstrike, rechargeSpellstrike, markSummoned, newDay }),
        [stored, effect, canCascade, setCascade, setCascadeType, spendSpellstrike, rechargeSpellstrike, markSummoned, newDay],
    )
}

export type MagusApi = ReturnType<typeof useMagus>
