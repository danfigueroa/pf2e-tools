import { defenseValue, isImmune } from './defenses'
import { blockSplit } from '../character-viewer/shield'
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
    /** Quanto a Dureza do escudo segurou (Bloqueio com Escudo); 0 sem bloqueio. */
    blocked: number
    /** O que o escudo toma — o mesmo que passa para o alvo, salvo no Destructive Block. */
    toShield: number
    /** Dano que efetivamente chega ao alvo, já com fraqueza, resistência e escudo. */
    final: number
    absorbedByTemp: number
    toHp: number
    tempAfter: number
    currentAfter: number
}

/**
 * Ordem RAW, e é ela que o memorial exibido segue:
 * base → multiplicador da salvaguarda → imunidade → fraqueza → resistência →
 * escudo → PV temporários → PV.
 *
 * O escudo entra depois das defesas: o Bloqueio com Escudo segura o dano que
 * a criatura TOMARIA, e esse já passou por resistência e fraqueza. O que sobra
 * da Dureza vai inteiro para o alvo e, de novo inteiro, para o escudo.
 *
 * A absorção por PV temporários também acontece dentro de
 * `useHpTracker.applyDamage`/`npcDamage`; aqui ela é recalculada só para a
 * prévia. Os dois usam os mesmos números, então não divergem.
 */
export function computeDamage(
    input: {
        amount: number
        type: string
        outcome: SaveOutcome
        /** Dureza do escudo que bloqueia; `null`/ausente = sem bloqueio. */
        blockHardness?: number | null
        /** Destructive Block: o dobro da Dureza segura, e o escudo toma o dobro. */
        blockDestructive?: boolean
    },
    target: TargetDefense,
): DamageBreakdown {
    const base = Math.max(0, Math.floor(input.amount))
    const multiplier = MULTIPLIERS[input.outcome]
    const afterMultiplier = Math.floor(base * multiplier)

    const immune = isImmune(target.immunities, input.type)
    const weakness = immune || afterMultiplier <= 0 ? 0 : defenseValue(target.weaknesses, input.type)
    const resistance = immune || afterMultiplier <= 0 ? 0 : defenseValue(target.resistances, input.type)

    const afterDefense = immune ? 0 : Math.max(0, afterMultiplier + weakness - resistance)
    const split = input.blockHardness != null
        ? blockSplit(afterDefense, input.blockHardness, !!input.blockDestructive)
        : null
    const blocked = split?.absorbed ?? 0
    const final = afterDefense - blocked
    const toShield = split?.toShield ?? 0

    const absorbedByTemp = Math.min(target.temp, final)
    const toHp = final - absorbedByTemp

    return {
        base,
        multiplier,
        afterMultiplier,
        immune,
        weakness,
        resistance,
        blocked,
        toShield,
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
    if (b.weakness > 0 || b.resistance > 0) steps.push(`total ${b.final + b.blocked}`)
    if (b.blocked > 0) steps.push(`escudo segurou ${b.blocked} (escudo −${b.toShield})`)
    if (b.absorbedByTemp > 0) steps.push(`${b.absorbedByTemp} absorvido por PV temporários`)

    return steps.join(' → ')
}
