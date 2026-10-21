/**
 * O que o Patrulheiro liga e o que isso faz com os Golpes.
 *
 * - **Hunt Prey** (Player Core, 1 ação): uma presa por vez. O app guarda só "há
 *   presa marcada" — qual criatura é, é da mesa. Com o **Hunter's Edge:
 *   Precision**, o primeiro acerto de cada rodada na presa soma dano de
 *   precisão; o `1d8 precision` já vem na arma do Pathbuilder como chip
 *   desligado, e com a presa marcada ele passa a vir ligado.
 * - **Gravity Weapon** (APG pg. 234, magia de foco, 1 ação, 1 minuto): no
 *   PRIMEIRO Golpe com arma de cada rodada, bônus de STATUS no dano igual a
 *   **2 × o número de dados de dano da arma**. O app não conta rodadas, então o
 *   chip "primeiro Golpe da rodada" vem ligado e o jogador o desliga nos
 *   seguintes — como a precisão do Ataque Furtivo, é uma condição da mesa.
 * - **Hunter's Aim** (talento, 2 ações): Golpe à distância contra a presa com
 *   +2 de circunstância no ataque e ignorando escondido e cobertura leve. Só
 *   uma opção no diálogo do Golpe.
 *
 * Quem tem o quê vem da ficha (`specials`/`feats`/`focus`), sem catálogo por
 * nome de personagem. O estado é da MESA (campo `ranger`), como a Fúria.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { ConditionModifiers } from './conditions'

export interface RangerStored {
    /** Há uma presa marcada (Hunt Prey). */
    prey: boolean
    /** Gravity Weapon ativa (1 minuto, encerrada à mão). */
    gravity: boolean
}

export const NO_RANGER: RangerStored = { prey: false, gravity: false }

export function sanitizeRanger(raw: unknown): RangerStored {
    if (!raw || typeof raw !== 'object') return NO_RANGER
    const r = raw as Partial<RangerStored>
    return { prey: !!r.prey, gravity: !!r.gravity }
}

export const isRangerEmpty = (s: RangerStored) => !s.prey && !s.gravity

const norm = (s: string) => s.trim().toLowerCase()
const hasSpecial = (b: BuildInfo, name: string) => (b.specials ?? []).some((s) => norm(s) === norm(name))
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

export const hasHuntPrey = (b: BuildInfo) => hasSpecial(b, 'Hunt Prey')
/** O Hunter's Edge escolhido é o de Precision (os outros mexem em outra coisa). */
export const hasPrecisionEdge = (b: BuildInfo) => hasSpecial(b, "Hunter's Edge: Precision")
export const hasHuntersAim = (b: BuildInfo) => hasFeat(b, "Hunter's Aim")

/** Gravity Weapon entre as magias de foco da ficha. */
export function hasGravityWeapon(b: BuildInfo): boolean {
    return Object.values(b.focus ?? {}).some((tradition) =>
        Object.values(tradition ?? {}).some((group) => (group?.focusSpells ?? []).some((n) => norm(n) === 'gravity weapon')))
}

/** Quem tem ao menos uma coisa para a faixa do Patrulheiro mostrar. */
export const hasRangerFeatures = (b: BuildInfo) => hasHuntPrey(b) || hasGravityWeapon(b)

/** O que viaja nos modificadores. */
export interface RangerEffect {
    /** Presa marcada e Hunter's Edge: Precision — o dano de precisão da arma vem ligado. */
    precisionOnPrey: boolean
    /** Gravity Weapon ativa. */
    gravity: boolean
}

export function activeRanger(stored: RangerStored, build: BuildInfo): RangerEffect | null {
    const precisionOnPrey = stored.prey && hasHuntPrey(build) && hasPrecisionEdge(build)
    const gravity = stored.gravity && hasGravityWeapon(build)
    return precisionOnPrey || gravity ? { precisionOnPrey, gravity } : null
}

export function withRanger(mods: ConditionModifiers, effect: RangerEffect | null): ConditionModifiers {
    return effect ? { ...mods, ranger: effect } : mods
}

/** O bônus da Gravity Weapon: 2 × dados de dano da arma. */
export const gravityBonus = (weaponDice: number): number => 2 * Math.max(0, weaponDice)

/** Chaves das escolhas por Golpe, guardadas junto dos chips de dano extra. */
export const FIRST_STRIKE_KEY = 'first-strike'
export const HUNTERS_AIM_KEY = 'hunters-aim'
