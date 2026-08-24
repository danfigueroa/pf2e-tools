import { defenseValue, isImmune } from './defenses'
import type { TargetDefense } from './types'

/** Resultado da salvaguarda do alvo. `none` = dano direto (ataque comum). */
export type SaveOutcome = 'critFail' | 'fail' | 'success' | 'critSuccess' | 'none'

export const OUTCOME_LABELS: Record<SaveOutcome, string> = {
    critFail: 'Falha crítica',
    fail: 'Falha',
    success: 'Sucesso',
    critSuccess: 'Sucesso crítico',
    none: 'Direto',
}

const MULTIPLIERS: Record<SaveOutcome, number> = {
    critFail: 2,
    fail: 1,
    success: 0.5,
    critSuccess: 0,
    none: 1,
}

export interface DamageBreakdown {
    base: number
    multiplier: number
    afterMultiplier: number
    immune: boolean
    weakness: number
    resistance: number
    /** Dano que efetivamente chega ao alvo, já com fraqueza e resistência. */
    final: number
    absorbedByTemp: number
    toHp: number
    tempAfter: number
    currentAfter: number
}

/**
 * Ordem RAW, e é ela que o memorial exibido segue:
 * base → multiplicador da salvaguarda → imunidade → fraqueza → resistência →
 * PV temporários → PV.
 *
 * A absorção por PV temporários também acontece dentro de
 * `useHpTracker.applyDamage`/`npcDamage`; aqui ela é recalculada só para a
 * prévia. Os dois usam os mesmos números, então não divergem.
 */
export function computeDamage(
    input: { amount: number; type: string; outcome: SaveOutcome },
    target: TargetDefense,
): DamageBreakdown {
    const base = Math.max(0, Math.floor(input.amount))
    const multiplier = MULTIPLIERS[input.outcome]
    const afterMultiplier = Math.floor(base * multiplier)

    const immune = isImmune(target.immunities, input.type)
    const weakness = immune || afterMultiplier <= 0 ? 0 : defenseValue(target.weaknesses, input.type)
    const resistance = immune || afterMultiplier <= 0 ? 0 : defenseValue(target.resistances, input.type)

    const final = immune ? 0 : Math.max(0, afterMultiplier + weakness - resistance)

    const absorbedByTemp = Math.min(target.temp, final)
    const toHp = final - absorbedByTemp

    return {
        base,
        multiplier,
        afterMultiplier,
        immune,
        weakness,
        resistance,
        final,
        absorbedByTemp,
        toHp,
        tempAfter: target.temp - absorbedByTemp,
        currentAfter: Math.max(0, target.current - toHp),
    }
}

/** Memorial em uma linha: "24 → ×½ 12 → fraqueza +5 = 17 → resistência 5 = 12". */
export function describeDamage(b: DamageBreakdown, typeLabel: string): string {
    if (b.immune) return `Imune a ${typeLabel} — 0 de dano`

    const steps: string[] = [`${b.base}`]
    if (b.multiplier !== 1) {
        steps.push(`${b.multiplier === 0.5 ? '÷2' : `×${b.multiplier}`} = ${b.afterMultiplier}`)
    }
    if (b.weakness > 0) steps.push(`fraqueza ${typeLabel} +${b.weakness}`)
    if (b.resistance > 0) steps.push(`resistência ${typeLabel} −${b.resistance}`)
    // O total só acrescenta informação quando defesa entrou na conta: depois de
    // "×2 = 48" repetir "total 48" é ruído.
    if (b.weakness > 0 || b.resistance > 0) steps.push(`total ${b.final}`)
    if (b.absorbedByTemp > 0) steps.push(`${b.absorbedByTemp} absorvido por PV temporários`)

    return steps.join(' → ')
}
