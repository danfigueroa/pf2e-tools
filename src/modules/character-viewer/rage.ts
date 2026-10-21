/**
 * Fúria (Rage) do bárbaro, e o que ela faz com os números da ficha.
 *
 * Regra do Remaster (Player Core 2, pg. 72): ao entrar, PV temporários iguais
 * ao nível + modificador de CON; enquanto dura, +2 de dano nos Golpes corpo a
 * corpo (metade se a arma ou o ataque desarmado é ágil) e nenhuma ação com o
 * traço concentrar, a não ser as de Fúria. **Não há mais o −1 na CA** do Core
 * antigo — quem lembra dele está lendo a regra errada. Dura 1 minuto, até o
 * encontro acabar ou a queda à inconsciência, e não se encerra por vontade.
 * Depois dela, a Fúria seguinte não dá PV temporários por 1 minuto.
 *
 * Do instinto vêm o resto. O que o app sabe hoje é o **Giant** (Titan Mauler):
 * empunhando uma arma Grande, o dano da Fúria sobe de 2 para 6, depois 10 no
 * nível 7 e 18 com Greater Weapon Specialization — em troca de Desajeitado 1 que
 * não sai enquanto a arma está em mãos, com Fúria ou sem. A Raging Resistance
 * (nível 9) é 3 + CON em tipos do instinto: contundente e UMA energia à escolha
 * do jogador.
 *
 * O Pathbuilder não exporta nada disso — nem o tamanho da arma, nem a energia
 * escolhida —, então `GIANT_BARBARIANS` casa pelo NOME do personagem, como
 * `customRunes.ts` e `magicWeapons.ts`: o JSON não é editado e a escolha
 * sobrevive a export e publicação.
 *
 * O estado é da MESA (campo `rage`): o PV temporário já é da mesa, e a
 * Iniciativa lê a resistência e o Desajeitado daqui. Como o Enlarge, o
 * Desajeitado do Titan Mauler é DERIVADO, nunca gravado.
 */
import type { BuildInfo } from '../../pathbuilder/types'
import type { ConditionState } from './components/useConditions'
import type { AppliedMod, ConditionModifiers } from './conditions'
import { abilityMod } from './helpers'

/** Quanto dura a "ressaca": nova Fúria dentro disso não dá PV temporários. */
export const RAGE_COOLDOWN_MS = 60_000

/** O que fica gravado na mesa. */
export interface RageStored {
    active: boolean
    /** Quando começou (ms). */
    since?: number
    /** Quando terminou (ms) — decide se a próxima Fúria dá PV temporários. */
    endedAt?: number
    /** PV temporários que ESTA Fúria pôs (0 se não pôs nenhum): é só o que sai ao acabar. */
    granted?: number
    /** Arma Grande do Titan Mauler em mãos. Só vale para quem tem uma (`RageSpec.titan`). */
    titan: boolean
}

export const NO_RAGE: RageStored = { active: false, titan: true }

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function sanitizeRage(raw: unknown): RageStored {
    if (!raw || typeof raw !== 'object') return NO_RAGE
    const r = raw as Partial<RageStored>
    const active = !!r.active
    return {
        active,
        titan: r.titan !== false,
        ...(active && finite(r.since) ? { since: r.since } : {}),
        ...(finite(r.endedAt) && r.endedAt > 0 ? { endedAt: r.endedAt } : {}),
        ...(finite(r.granted) && r.granted > 0 ? { granted: Math.floor(r.granted) } : {}),
    }
}

export const isRageEmpty = (s: RageStored) => !s.active && !s.endedAt && s.titan

// ---------------------------------------------------------------------------
// O que a ficha permite
// ---------------------------------------------------------------------------

interface GiantEntry {
    character: (build: BuildInfo) => boolean
    /** Armas (pelo `name` do Pathbuilder) que são a Grande do Titan Mauler. */
    weapons: string[]
    /** A energia escolhida na Raging Resistance, além de contundente. */
    energy: string
}

const nameStarts = (prefix: string) => (b: BuildInfo) =>
    (b.name || '').trim().toLowerCase().startsWith(prefix)

const GIANT_BARBARIANS: GiantEntry[] = [
    // O Pathbuilder exporta "Brukuthur, The Barbarian Android".
    { character: nameStarts('brukuthur'), weapons: ['Greataxe'], energy: 'fire' },
]

/** O que a Fúria deste personagem dá, calculado da ficha. */
export interface RageSpec {
    /** PV temporários ao entrar: nível + CON. */
    tempHp: number
    /** Dano extra base nos Golpes corpo a corpo. */
    damage: number
    /** Titan Mauler: a arma Grande, o dano com ela e o Desajeitado que ela custa. */
    titan: { weapons: string[]; damage: number } | null
    /** Raging Resistance: tipo → valor. Vazio antes do nível 9 ou com instinto desconhecido. */
    resist: Record<string, number>
    /** Brutality: especialização crítica nos Golpes corpo a corpo durante a Fúria. */
    brutality: boolean
    /** Quick-Tempered: Fúria como ação livre ao rolar iniciativa. */
    quickTempered: boolean
}

const hasSpecial = (build: BuildInfo, name: string) =>
    (build.specials ?? []).some((s) => String(s).trim().toLowerCase() === name.toLowerCase())

/** `null` = não é uma ficha com Fúria. */
export function rageSpec(build: BuildInfo): RageSpec | null {
    if (!hasSpecial(build, 'Rage')) return null
    const con = abilityMod(build.abilities.con)
    const giant = hasSpecial(build, 'Giant Instinct')
        ? GIANT_BARBARIANS.find((e) => e.character(build)) ?? null
        : null

    // Titan Mauler: 6, e 10 a partir do nível 7; 18 com Greater Weapon Specialization.
    const titanDamage = hasSpecial(build, 'Greater Weapon Specialization') ? 18 : build.level >= 7 ? 10 : 6

    const resist: Record<string, number> = {}
    if (giant && hasSpecial(build, 'Raging Resistance')) {
        const value = Math.max(0, 3 + con)
        resist.bludgeoning = value
        resist[giant.energy] = value
    }

    return {
        tempHp: Math.max(0, build.level + con),
        damage: 2,
        titan: giant ? { weapons: giant.weapons, damage: titanDamage } : null,
        resist,
        brutality: hasSpecial(build, 'Brutality'),
        quickTempered: hasSpecial(build, 'Quick-Tempered'),
    }
}

/** Desajeitado 1 do Titan Mauler: vale com a arma Grande em mãos, em Fúria ou não. */
export function titanConditions(stored: RageStored, spec: RageSpec | null): ConditionState {
    return spec?.titan && stored.titan ? { clumsy: 1 } : {}
}

/** Rótulo da origem do Desajeitado, para o tooltip da condição derivada. */
export const TITAN_SOURCE = 'Titan Mauler'

// ---------------------------------------------------------------------------
// Efeito ativo — o que viaja até as seções
// ---------------------------------------------------------------------------

/** A Fúria como as seções a leem: só existe com a Fúria ligada. */
export interface RageEffect {
    base: number
    /** Armas Grandes e o dano com elas; `null` sem Titan Mauler ou com a arma guardada. */
    titan: { weapons: string[]; damage: number } | null
    resist: Record<string, number>
    brutality: boolean
}

export function activeRage(stored: RageStored, spec: RageSpec | null): RageEffect | null {
    if (!stored.active || !spec) return null
    return {
        base: spec.damage,
        titan: spec.titan && stored.titan ? spec.titan : null,
        resist: spec.resist,
        brutality: spec.brutality,
    }
}

/** Os modificadores da ficha com a Fúria. A identidade se mantém sem ela — as seções são `memo`. */
export function withRage(mods: ConditionModifiers, effect: RageEffect | null): ConditionModifiers {
    return effect ? { ...mods, rage: effect } : mods
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Tudo que soma ao dano de um Golpe corpo a corpo FORA da fórmula do
 * Pathbuilder: o bônus de efeito (Enlarge) e a Fúria. A Fúria depende da arma —
 * ágil leva metade, a Grande leva o dano do Titan Mauler —, por isso viaja como
 * regra e é resolvida aqui, golpe a golpe.
 */
export function meleeBonusParts(mods: ConditionModifiers, weapon: { agile: boolean; name: string }): AppliedMod[] {
    const parts: AppliedMod[] = [...(mods.meleeDamage ?? [])]
    const rage = mods.rage
    if (!rage) return parts
    if (rage.titan?.weapons.some((w) => sameName(w, weapon.name))) {
        parts.push({ from: 'Fúria (arma Grande)', type: 'untyped', value: rage.titan.damage })
    } else if (weapon.agile) {
        parts.push({ from: 'Fúria (ágil, metade)', type: 'untyped', value: Math.floor(rage.base / 2) })
    } else {
        parts.push({ from: 'Fúria', type: 'untyped', value: rage.base })
    }
    return parts
}

/**
 * As resistências do combatente com a Raging Resistance somada. No mesmo tipo
 * vale a MAIOR, nunca a soma — toda resistência é assim. Sem Fúria, devolve a
 * mesma referência.
 */
export function withRageResistance(
    resistances: Record<string, number>,
    spec: Pick<RageSpec, 'resist'> | null | undefined,
    raging: boolean,
): Record<string, number> {
    if (!raging || !spec) return resistances
    const out = { ...resistances }
    for (const [type, value] of Object.entries(spec.resist)) out[type] = Math.max(out[type] ?? 0, value)
    return out
}

/** A Fúria nova ainda dá PV temporários? Não, se a anterior acabou há menos de 1 minuto. */
export const rageGivesTempHp = (stored: RageStored, now: number): boolean =>
    !stored.endedAt || now - stored.endedAt >= RAGE_COOLDOWN_MS

/** "contundente 7, fogo 7" — o que a Raging Resistance dá. */
export const RESIST_LABEL: Record<string, string> = {
    bludgeoning: 'contundente',
    piercing: 'perfurante',
    slashing: 'cortante',
    fire: 'fogo',
    cold: 'frio',
    electricity: 'eletricidade',
}
