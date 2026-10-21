import { useCallback, useMemo } from 'react'
import type { BuildInfo } from '../../../pathbuilder/types'
import type { ConditionModifiers } from '../conditions'
import { actionsKeyFor, magusKeyFor } from '../charId'
import { castTimeOf, isConfluxSpell, pairCast, prepayStrike, spellIncludesStrike, type CastResource, type CastTime } from '../spellCast'
import { hasSpellstrike } from '../magus'
import { useActions, type ActionsApi } from './useActions'
import { useMagus } from './useMagus'
import type { MythicPointsApi } from './useMythicPoints'
import type { SpellSlotsApi } from './useSpellSlots'

export interface CastInput {
    name: string
    /** O campo `actions` da AON; ausente = a descrição ainda não foi baixada. */
    actionsText: string | undefined | null
    resource: CastResource
    /** `roll` = a rolagem do diálogo; `mark` = o pip/botão da lista. */
    via: 'roll' | 'mark'
    /** Magia de ação variável: quantas o jogador escolheu (senão vale o mínimo e o aviso). */
    chosenActions?: number | null
    /** Os traços da AON (em inglês): a magia de confluência (Focus + Magus) recarrega o Spellstrike. */
    traits?: readonly string[]
}

export interface CastReport {
    /** A outra via já tinha registrado esta conjuração: nada foi pago agora. */
    paired: boolean
    /** O que o app gastou, para o aviso. */
    spent: string[]
    /** O que não deu para contar ou faltou — o jogador precisa saber. */
    warnings: string[]
}

/**
 * Paga o TEMPO de uma atividade: N ações, a reação, ou nada (ação livre, conjuração longa).
 * Compartilhado pelas magias e pelos talentos ativáveis (`useActivity`): um só jeito de contar,
 * avisando em vez de impedir.
 */
export function payTime(
    actions: ActionsApi,
    time: CastTime,
    chosen: number | null | undefined,
    spent: string[],
    warnings: string[],
): void {
    const pay = (n: number) => {
        const lacking = actions.missing(n, 'any')
        actions.spend(n, 'any')
        spent.push(`${n} ${n === 1 ? 'ação' : 'ações'}`)
        if (lacking > 0) warnings.push(`faltaram ${lacking} ação(ões) neste turno`)
    }
    if (time.kind === 'actions') pay(time.n)
    else if (time.kind === 'variable') {
        if (chosen == null) warnings.push(`ação variável: contei ${time.min}; ajuste na faixa de Ações se gastou mais`)
        pay(chosen ?? time.min)
    } else if (time.kind === 'reaction') {
        if (actions.stored.reacted) warnings.push('a reação desta rodada já tinha sido usada')
        actions.spendReaction()
        spent.push('a reação')
    } else if (time.kind === 'unknown') {
        warnings.push('não sei quantas ações custa (abra a descrição); gaste na faixa de Ações')
    }
}

/**
 * Registra uma conjuração inteira: as ações (ou a reação) e o recurso — slot,
 * ponto de foco ou Ponto Mítico. O app só CONTA: faltar ação ou slot é avisado,
 * nunca impede (uma magia mal classificada não pode travar a ficha).
 *
 * E o que a conjuração faz na economia do Magus: a magia de confluência recarrega
 * o Spellstrike, e a que inclui um Golpe (Dimensional Assault) deixa esse Golpe
 * pago — sem isso, rolar o Golpe na aba de Combate cobraria a ação duas vezes.
 */
export function useSpellCast(build: BuildInfo, mods: ConditionModifiers, mythicPoints: MythicPointsApi, slots: SpellSlotsApi) {
    const actions = useActions(actionsKeyFor(build), mods)
    const magus = useMagus(magusKeyFor(build), build)

    const cast = useCallback((input: CastInput): CastReport => {
        if (pairCast(input.name, input.via)) return { paired: true, spent: [], warnings: [] }
        const spent: string[] = []
        const warnings: string[] = []

        const { resource } = input
        if (resource.kind === 'slot' || resource.kind === 'spontaneous') {
            if (slots.usedOf(resource.key) >= resource.total) warnings.push('sem slot disponível deste rank')
            else { slots.spendOne(resource.key, resource.total); spent.push('1 slot') }
        } else if (resource.kind === 'focus') {
            if (slots.focusUsed >= slots.focusMax) warnings.push('sem pontos de foco')
            else { slots.spendFocus(); spent.push('1 ponto de foco') }
        } else if (resource.kind === 'mythic') {
            if (mythicPoints.available <= 0) warnings.push('sem Pontos Míticos')
            else { mythicPoints.spend(); spent.push('1 Ponto Mítico') }
        }

        const time = castTimeOf(input.actionsText)
        payTime(actions, time, input.chosenActions, spent, warnings)
        if (isConfluxSpell(input.traits) && (time.kind === 'actions' || time.kind === 'variable') && hasSpellstrike(build) && magus.stored.spent) {
            magus.rechargeSpellstrike()
            spent.push('recarregou o Spellstrike')
        }
        if (spellIncludesStrike(input.name)) {
            prepayStrike()
            spent.push('o Golpe da magia (role-o na aba de Combate, sem gastar ação)')
        }
        return { paired: false, spent, warnings }
    }, [actions, slots, mythicPoints, magus, build])

    return useMemo(() => ({ cast }), [cast])
}

export type SpellCastApi = ReturnType<typeof useSpellCast>

/** "Fireball: gastou 1 slot e 2 ações — faltaram 1 ação(ões)…" para o aviso da lista. */
export function castMessage(name: string, r: CastReport): string {
    if (r.paired) return `${name}: a rolagem já gastou o slot e as ações — nada foi contado de novo.`
    const spent = r.spent.length ? `gastou ${r.spent.join(' e ')}` : 'nada a gastar'
    return `${name}: ${spent}${r.warnings.length ? ` — atenção: ${r.warnings.join('; ')}` : ''}.`
}
