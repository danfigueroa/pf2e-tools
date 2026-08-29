// Aflições do personagem na Ficha Virtual — mesma fatia da mesa que o
// gerenciador de Iniciativa escreve (`<slug>/afflictions`).
//
// A ficha é a ponta de LEITURA: quem aplica veneno é o GM, no combate. O
// jogador precisa ver em que estágio está, o que o estágio faz e quando cai a
// próxima salvaguarda — e poder tirar a aflição quando o grupo a curar.

import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import {
    sanitizeAfflictions,
    stageConditions,
    type AfflictionState,
} from '../../initiative-tracker/afflictions'
import type { ConditionState } from './useConditions'

export function useAfflictions(syncKey: string) {
    const [afflictions, setAfflictions] = useSharedState<AfflictionState[]>(syncKey, {
        empty: () => [],
        sanitize: sanitizeAfflictions,
        isEmpty: (list) => list.length === 0,
    })

    const remove = useCallback((id: string) => {
        setAfflictions((list) => list.filter((a) => a.id !== id))
    }, [setAfflictions])

    const clear = useCallback(() => setAfflictions(() => []), [setAfflictions])

    /** Condições que os estágios ativos impõem agora. */
    const conditions = useMemo((): ConditionState => {
        const out: ConditionState = {}
        for (const a of afflictions) {
            for (const [id, value] of Object.entries(stageConditions(a))) {
                out[id] = Math.max(out[id] ?? 0, value)
            }
        }
        return out
    }, [afflictions])

    return { afflictions, conditions, remove, clear }
}
