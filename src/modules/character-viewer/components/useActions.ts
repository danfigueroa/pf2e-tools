import { useCallback, useEffect, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { pullField, splitSyncKey } from '../../../services/tableState'
import type { ConditionModifiers } from '../conditions'
import {
    NO_ACTIONS,
    actionBudget,
    actionsLeft,
    applySpend,
    isActionsEmpty,
    newTurn,
    sanitizeActions,
    shortfall,
    type ActionKind,
    type ActionsStored,
} from '../actions'

/** O poll leve do `actions`: 1 comando no servidor a cada tanto, só com a aba visível. */
const POLL_MS = 5000

/**
 * Ações do turno, compartilhadas com a mesa (campo `actions`). Várias partes da
 * ficha chamam este hook (a faixa, o diálogo do Golpe, as faixas de classe) e
 * dividem o estado — mas só a faixa liga o `poll`: a Iniciativa, no aparelho do
 * mestre, zera o contador quando o turno começa, e o jogador precisa ver isso
 * sem apertar "Atualizar".
 */
export function useActions(syncKey: string, mods: ConditionModifiers, poll = false) {
    const [stored, setStored] = useSharedState<ActionsStored>(syncKey, {
        empty: () => NO_ACTIONS,
        sanitize: sanitizeActions,
        isEmpty: isActionsEmpty,
    })

    const budget = useMemo(() => actionBudget(mods), [mods])
    const left = useMemo(() => actionsLeft(stored, budget), [stored, budget])

    // Os dois leem o orçamento pelo valor mais recente: o handler não pode ficar preso a um render velho.
    const spend = useCallback((cost: number, kind: ActionKind = 'any') => {
        setStored((s) => applySpend(s, budget, cost, kind))
    }, [setStored, budget])

    const missing = useCallback((cost: number, kind: ActionKind = 'any') => shortfall(stored, budget, cost, kind), [stored, budget])

    const startTurn = useCallback(() => setStored(() => newTurn()), [setStored])

    const toggleReaction = useCallback(() => setStored((s) => ({ ...s, reacted: !s.reacted })), [setStored])

    /** Clique num pip: define quantas ações gerais estão gastas. */
    const setUsed = useCallback((used: number) => {
        setStored((s) => (s.used === used ? s : { ...s, used: Math.max(0, Math.min(9, used)) }))
    }, [setStored])

    /** Gasta a reação da rodada (idempotente: quem já reagiu continua tendo reagido). */
    const spendReaction = useCallback(() => setStored((s) => (s.reacted ? s : { ...s, reacted: true })), [setStored])

    const toggleQuick = useCallback(() => setStored((s) => ({ ...s, quickUsed: !s.quickUsed })), [setStored])

    useEffect(() => {
        if (!poll) return
        const { slug } = splitSyncKey(syncKey)
        if (!slug) return
        const tick = () => { if (document.visibilityState === 'visible') void pullField(slug, 'actions') }
        const id = setInterval(tick, POLL_MS)
        return () => clearInterval(id)
    }, [poll, syncKey])

    return useMemo(
        () => ({ stored, budget, left, spend, missing, startTurn, toggleReaction, spendReaction, setUsed, toggleQuick }),
        [stored, budget, left, spend, missing, startTurn, toggleReaction, spendReaction, setUsed, toggleQuick],
    )
}

export type ActionsApi = ReturnType<typeof useActions>
