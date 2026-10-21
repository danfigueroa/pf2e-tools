/**
 * Unleash Psyche do Psíquico (Dark Archive) e o que ela faz com a ficha.
 *
 * Liberada, a psique dura 2 rodadas (ou até cair inconsciente) e não se
 * encerra por vontade. Enquanto dura, toda magia de dano conjurada pela
 * conjuração de Psíquico, e que não tem duração, ganha um bônus de STATUS no
 * dano igual ao DOBRO do rank da magia (truque conta pelo rank em que foi
 * elevada). Ao acabar, vem a ressaca: 2 rodadas estupefato 1 e sem poder
 * liberar de novo.
 *
 * O app não conta rodadas da ficha, então as duas fases são trocadas à mão — como
 * a Fúria, "Encerrar" existe porque a mesa é quem sabe que acabou. O estado é
 * da MESA (campo `psyche`) e o Estupefato da ressaca é DERIVADO, nunca gravado
 * (mesma política do Desajeitado do Enlarge e do Titan Mauler).
 */
import type { BuildInfo } from '../../pathbuilder/types'
import type { ConditionState } from './components/useConditions'
import type { ConditionModifiers } from './conditions'

export type PsychePhase = 'idle' | 'unleashed' | 'strain'

export interface PsycheStored {
    phase: PsychePhase
    /** Quando a fase atual começou (ms). */
    since?: number
}

export const NO_PSYCHE: PsycheStored = { phase: 'idle' }

export function sanitizePsyche(raw: unknown): PsycheStored {
    if (!raw || typeof raw !== 'object') return NO_PSYCHE
    const r = raw as Partial<PsycheStored>
    const phase: PsychePhase = r.phase === 'unleashed' || r.phase === 'strain' ? r.phase : 'idle'
    if (phase === 'idle') return NO_PSYCHE
    return { phase, ...(typeof r.since === 'number' && Number.isFinite(r.since) ? { since: r.since } : {}) }
}

export const isPsycheEmpty = (s: PsycheStored) => s.phase === 'idle'

/** Quem tem Unleash Psyche entre as características de classe. */
export const hasUnleashPsyche = (build: BuildInfo): boolean =>
    (build.specials ?? []).some((s) => s.toLowerCase() === 'unleash psyche')

/** O que viaja nos modificadores: a psique está liberada. */
export interface PsycheEffect {
    unleashed: true
}

export const activePsyche = (stored: PsycheStored, has: boolean): PsycheEffect | null =>
    has && stored.phase === 'unleashed' ? { unleashed: true } : null

export function withPsyche(mods: ConditionModifiers, effect: PsycheEffect | null): ConditionModifiers {
    return effect ? { ...mods, psyche: effect } : mods
}

export const STRAIN_SOURCE = 'Psique esgotada'

/** A ressaca derivada: Estupefato 1. */
export function strainConditions(stored: PsycheStored, has: boolean): ConditionState {
    return has && stored.phase === 'strain' ? { stupefied: 1 } : {}
}

/** Bônus de status no dano: o dobro do rank. */
export const psycheDamageBonus = (rank: number): number => 2 * Math.max(0, rank)

/**
 * O bônus vale nesta magia? Só no dano, só da conjuração de Psíquico e só em
 * magia SEM duração (ou seja, instantânea). Persistente não recebe: o bônus
 * entra no dano inicial.
 */
export function psycheApplies(mods: ConditionModifiers, spell: { duration?: string } | null | undefined, psychic: boolean | undefined): boolean {
    return !!mods.psyche && !!psychic && !!spell && !(spell.duration ?? '').trim()
}
