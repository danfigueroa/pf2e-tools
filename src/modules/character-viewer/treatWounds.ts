// Tratar Ferimentos (Treat Wounds, Player Core): Medicina por 10 minutos em
// uma criatura. A CD escolhida decide o bônus de cura — quem tem proficiência
// para uma CD maior pode mirar nela e curar mais, ou ficar na mais baixa e
// arriscar menos. O app rola o teste E a cura e só soma o PV; o alvo ficar
// imune por 1 hora é do jogador.

import type { Check } from './checks'

export interface TreatWoundsOption {
    dc: number
    /** Rank de proficiência mínimo em Medicina (2 = Treinado … 8 = Lendário). */
    minRank: number
    /** Bônus fixo na cura, somado aos dados. */
    bonus: number
    label: string
}

export const TREAT_WOUNDS_OPTIONS: ReadonlyArray<TreatWoundsOption> = [
    { dc: 15, minRank: 2, bonus: 0, label: 'Treinado' },
    { dc: 20, minRank: 4, bonus: 10, label: 'Especialista' },
    { dc: 30, minRank: 6, bonus: 30, label: 'Mestre' },
    { dc: 40, minRank: 8, bonus: 50, label: 'Lendário' },
]

/** As CDs que o rank de Medicina permite. Destreinado: nenhuma. */
export const availableOptions = (rank: number): TreatWoundsOption[] =>
    TREAT_WOUNDS_OPTIONS.filter((o) => rank >= o.minRank)

export type Degree = 'critSuccess' | 'success' | 'failure' | 'critFailure'

export const DEGREE_LABEL: Record<Degree, string> = {
    critSuccess: 'Sucesso crítico',
    success: 'Sucesso',
    failure: 'Falha',
    critFailure: 'Falha crítica',
}

/** Grau de sucesso: ±10 da CD, e o d20 natural 20/1 sobe/desce um grau. */
export function degreeOf(d20: number, total: number, dc: number): Degree {
    let step = total >= dc + 10 ? 3 : total >= dc ? 2 : total > dc - 10 ? 1 : 0
    if (d20 === 20) step = Math.min(3, step + 1)
    else if (d20 === 1) step = Math.max(0, step - 1)
    return (['critFailure', 'failure', 'success', 'critSuccess'] as const)[step]
}

/** Dados da cura: 2d8 no sucesso, 4d8 no crítico (mais o bônus da CD). Falha crítica: 1d8 de dano. */
export function healingDice(degree: Degree): { count: number; heals: boolean } | null {
    if (degree === 'critSuccess') return { count: 4, heals: true }
    if (degree === 'success') return { count: 2, heals: true }
    if (degree === 'critFailure') return { count: 1, heals: false }
    return null
}

/** A conta inteira de um Tratar Ferimentos, a partir de um d20 já sorteado. */
export function treatWoundsOutcome(check: Pick<Check, 'total'>, d20: number, option: TreatWoundsOption) {
    const degree = degreeOf(d20, d20 + check.total, option.dc)
    const dice = healingDice(degree)
    return {
        degree,
        dice,
        /** Bônus fixo só entra na cura; o dano da falha crítica é 1d8 puro. */
        flat: dice?.heals ? option.bonus : 0,
    }
}
