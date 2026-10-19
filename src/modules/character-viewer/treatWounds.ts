// Tratar Ferimentos (Treat Wounds, Player Core): Medicina por 10 minutos em
// uma criatura. A CD escolhida decide o bônus de cura — quem tem proficiência
// para uma CD maior pode mirar nela e curar mais, ou ficar na mais baixa e
// arriscar menos. O app rola o teste E a cura e só soma o PV; o alvo ficar
// imune por 1 hora é do jogador.
//
// Duas ações compartilham a tabela de CD e cura (Player Core pg. 242 e 253):
// - **Tratar Ferimentos**: atividade de exploração de 10 minutos, SEM custo em
//   ações; tira Ferido; imunidade de 1 hora (10 min com Continual Recovery).
//   Tratar por 1 hora no total dobra a cura. Risky Surgery (talento): 1d8 cortante
//   no paciente antes, +2 de circunstância no teste e sucesso vira crítico.
// - **Battle Medicine** (talento, 1 AÇÃO, manipular): mesma CD e cura, mas NÃO
//   tira Ferido, não tem as variantes acima e deixa o alvo imune ao seu Battle
//   Medicine por 1 dia (sem afetar o Tratar Ferimentos).

import type { Check } from './checks'
import { parseFeatEntry, type BuildInfo } from '../character-sheet/types'

export interface TreatWoundsOption {
    dc: number
    /** Rank de proficiência mínimo em Medicina (2 = Treinado … 8 = Lendário). */
    minRank: number
    /** Bônus fixo na cura, somado aos dados. */
    bonus: number
    label: string
}

export type HealMode = 'treat' | 'battle'

const norm = (n: string) => n.trim().toLowerCase()
const hasFeat = (b: BuildInfo, name: string) =>
    (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === name)
export const hasBattleMedicine = (b: BuildInfo) => hasFeat(b, 'battle medicine')
export const hasRiskySurgery = (b: BuildInfo) => hasFeat(b, 'risky surgery')
export const hasContinualRecovery = (b: BuildInfo) => hasFeat(b, 'continual recovery')

/** Quantas ações o modo custa: Battle Medicine 1, Tratar Ferimentos nenhuma (são 10 minutos). */
export const healActionCost = (mode: HealMode): number => (mode === 'battle' ? 1 : 0)

/** Quantos pacientes o Tratar Ferimentos atende com Ward Medic (Especialista 2, Mestre 4, Lendário 8). */
export function wardMedicTargets(b: BuildInfo, rank: number): number {
    if (!hasFeat(b, 'ward medic') || rank < 4) return 1
    return rank >= 8 ? 8 : rank >= 6 ? 4 : 2
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

export interface TreatVariant {
    mode: HealMode
    /** Tratar Ferimentos por 1 hora no total: dobra os PV recuperados. */
    hour?: boolean
    /** Risky Surgery (só Tratar Ferimentos): sucesso vira crítico. */
    risky?: boolean
}

/** A conta inteira de um tratamento, a partir de um d20 já sorteado. */
export function treatWoundsOutcome(check: Pick<Check, 'total'>, d20: number, option: TreatWoundsOption, variant: TreatVariant = { mode: 'treat' }) {
    let degree = degreeOf(d20, d20 + check.total, option.dc)
    const treat = variant.mode === 'treat'
    if (treat && variant.risky && degree === 'success') degree = 'critSuccess'
    const dice = healingDice(degree)
    return {
        degree,
        dice,
        /** Bônus fixo só entra na cura; o dano da falha crítica é 1d8 puro. */
        flat: dice?.heals ? option.bonus : 0,
        /** Só o Tratar Ferimentos tira Ferido (sucesso e crítico); o Battle Medicine não. */
        removesWounded: treat && !!dice?.heals,
        /** A hora inteira dobra a cura, não o dano da falha crítica. */
        doubled: treat && !!variant.hour && !!dice?.heals,
    }
}
