import { useMemo, useState } from 'react'
import type { BuildInfo } from '../../../pathbuilder/types'
import type { TableRoll } from '../../../dice/tableRoll'
import type { ConditionModifiers } from '../conditions'
import type { MythicPointsApi } from './useMythicPoints'
import { legacyCharKey, slotsKeyFor, usesKeyFor } from '../charId'
import { useUses } from './useUses'
import { useSpellSlots } from './useSpellSlots'
import { useSpellCast } from './useSpellCast'
import { NO_RESOURCE } from '../spellCast'
import {
    fortuneSourcesFor, hasSureStrikeCast, sureStrikeResource, takeSureStrikeCast, withFortune,
    WISH_FOR_LUCK_USE, type FortuneContext, type FortuneId, type FortuneSource,
} from '../fortune'

/**
 * O chip de fortuna do diálogo de rolagem (Sure Strike nos ataques, Wish for Luck em ataque, salvaguarda e
 * perícia). Escolher não gasta nada; ROLAR paga — o Wish for Luck marca o 1×/dia, o Sure Strike conjura (1 ação +
 * a cópia preparada) se ainda não foi conjurado pelo "Conjurar" — e troca o d20 pelo maior de dois.
 * Nada fica lembrado de uma rolagem para a outra.
 */
export function useFortune(build: BuildInfo, mods: ConditionModifiers, mythicPoints: MythicPointsApi, ctx: FortuneContext | null) {
    const sources = useMemo(() => (ctx ? fortuneSourcesFor(build, ctx) : []), [build, ctx])
    const uses = useUses(usesKeyFor(build))
    const slots = useSpellSlots(slotsKeyFor(build), build.focusPoints ?? 0, legacyCharKey(build))
    const spellCast = useSpellCast(build, mods, mythicPoints, slots)
    const [picked, setPicked] = useState<FortuneId | null>(null)
    const wishUsed = uses.usedOf(WISH_FOR_LUCK_USE) > 0
    // Lido ao abrir o diálogo (é estado do módulo, não da mesa): basta para o rótulo do chip.
    const [sureCast] = useState(hasSureStrikeCast)
    const active: FortuneSource | null = sources.find((s) => s.id === picked && !(s.id === 'wish-for-luck' && wishUsed)) ?? null

    /** Paga e aplica. Chamar no clique de rolar, com a rolagem já montada. */
    const apply = (roll: TableRoll): TableRoll => {
        if (!active) return roll
        if (active.id === 'wish-for-luck') uses.mark(WISH_FOR_LUCK_USE)
        else if (!takeSureStrikeCast()) {
            const resource = sureStrikeResource(build, slots, active.label) ?? NO_RESOURCE
            spellCast.cast({ name: active.label, actionsText: 'Single Action', resource, via: 'roll' })
            // A conjuração acabou de deixar o crédito: consumido por este ataque.
            takeSureStrikeCast()
        }
        return withFortune(roll, active.note)
    }

    /** Devolve o uso do dia (marcado por engano, ou o dia virou sem o "Novo dia"). */
    const restoreWish = () => uses.unmark(WISH_FOR_LUCK_USE)

    return { sources, picked: active?.id ?? null, setPicked, active, wishUsed, sureCast, apply, restoreWish }
}

export type FortuneApi = ReturnType<typeof useFortune>
