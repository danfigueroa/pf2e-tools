import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import {
    NO_SIZE_EFFECT,
    activeSizeEffect,
    sanitizeSizeEffect,
    type SizeEffectId,
    type SizeEffectStored,
} from '../sizeEffects'

const isEmpty = (s: SizeEffectStored) => !s.active && !s.used

/**
 * Enlarge/Shrink ligado no personagem, compartilhado com a mesa (campo `size`).
 * A página monta este hook fora das abas: o efeito mexe nas condições (que
 * ficam fora das abas) e no dano da aba de Combate.
 */
export function useSizeEffect(syncKey: string, baseSize: string | null | undefined) {
    const [stored, setStored] = useSharedState<SizeEffectStored>(syncKey, {
        empty: () => NO_SIZE_EFFECT,
        sanitize: sanitizeSizeEffect,
        isEmpty,
    })

    /** Liga o efeito e gasta a ativação do dia. */
    const activate = useCallback((id: SizeEffectId) => {
        setStored(() => ({ active: id, used: true, since: Date.now() }))
    }, [setStored])

    /** Volta ao tamanho normal. A ativação do dia continua gasta. */
    const deactivate = useCallback(() => {
        setStored((s) => (s.active ? { active: null, used: true } : s))
    }, [setStored])

    /** Novo dia: a ativação volta, e o efeito (se ainda ligado) continua. */
    const recharge = useCallback(() => {
        setStored((s) => (s.active ? { ...s, used: true } : NO_SIZE_EFFECT))
    }, [setStored])

    const effect = activeSizeEffect(stored, baseSize)

    // Viaja até a aba de Combate, que é `memo`.
    return useMemo(
        () => ({ stored, effect, activate, deactivate, recharge }),
        [stored, effect, activate, deactivate, recharge],
    )
}

export type SizeEffectApi = ReturnType<typeof useSizeEffect>
