import { useCallback, useMemo } from 'react'
import type { BuildInfo } from '../../../pathbuilder/types'
import type { ConditionModifiers } from '../conditions'
import { actionsKeyFor, usesKeyFor } from '../charId'
import type { ActivityInfo } from '../activities'
import { prepayStrike } from '../spellCast'
import { useActions } from './useActions'
import type { MythicPointsApi } from './useMythicPoints'
import { payTime, type CastReport } from './useSpellCast'
import { useUses } from './useUses'

/**
 * Usa um talento ou habilidade ativável: paga o tempo (ações ou reação) e, se for talento mítico
 * que gasta ponto, o Ponto Mítico. O app só CONTA — faltar ação, reação ou ponto é avisado, nunca
 * impede. "Uma vez por dia" marca o uso até o Novo dia.
 */
export function useActivity(build: BuildInfo, mods: ConditionModifiers, mythicPoints: MythicPointsApi) {
    const actions = useActions(actionsKeyFor(build), mods)
    const uses = useUses(usesKeyFor(build))

    const activate = useCallback((name: string, info: ActivityInfo): CastReport => {
        const spent: string[] = []
        const warnings: string[] = []
        if (info.mythicPoint) {
            if (mythicPoints.available <= 0) warnings.push('sem Pontos Míticos')
            else { mythicPoints.spend(); spent.push('1 Ponto Mítico') }
        }
        payTime(actions, info.time, undefined, spent, warnings)
        if (info.daily) uses.mark(name)
        // Sudden Charge, Vicious Swing…: o custo já inclui o Golpe — o próximo Golpe do diálogo não cobra de novo.
        if (info.includesStrike) {
            prepayStrike()
            spent.push('o Golpe (o próximo Golpe não gasta ação)')
        }
        return { paired: false, spent, warnings }
    }, [actions, mythicPoints, uses])

    return useMemo(() => ({ activate, uses }), [activate, uses])
}
