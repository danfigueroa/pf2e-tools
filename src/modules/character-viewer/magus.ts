/**
 * O que o Magus liga, gasta e recarrega — e o que isso faz com a ficha.
 *
 * - **Arcane Cascade** (Secrets of Magic pg. 38): postura de 1 ação. Entra-se
 *   depois de conjurar ou de um Spellstrike, e basta isso para ENTRAR (não para
 *   ficar). Nela, os Golpes corpo a corpo causam dano extra de força: 1, 2 com
 *   Weapon Specialization e 3 com Greater. Se a última magia antes da postura
 *   causava dano, o dano da postura é do tipo dela (ou de um tipo à escolha,
 *   se a magia causava vários) — por isso o tipo é uma ESCOLHA do jogador aqui:
 *   a ficha não sabe qual foi a última magia. O Golpe ganha o traço arcane.
 * - **Spellstrike** (Impossible Magic pg. 11): depois de usar, só se usa de novo
 *   recarregando com 1 ação. Aqui é só o indicador "carregado / gasto".
 * - **Summon Mythic Power** (War of Immortals pg. 83): 1 ação, 1× por dia,
 *   devolve 1 Ponto Mítico.
 * - **Divert Destiny** (pg. 82): reação grátis, gasta 1 Ponto Mítico quando algo
 *   levaria o personagem a 0 PV: sobrevive com 10 + nível de PV, sem ferido nem
 *   morrendo, sem aumentar condenado.
 *
 * O Pathbuilder lista os quatro (`specials`/`feats`), então quem os tem é
 * descoberto pela ficha, sem catálogo por nome de personagem. O estado é da MESA
 * (campo `magus`), como a Fúria e a psique.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { ConditionModifiers } from './conditions'
import { mythicFeatsOf } from './mythicFeats'

/** O que fica gravado na mesa. */
export interface MagusStored {
    /** Na postura Arcane Cascade. */
    cascade: boolean
    /** Tipo do dano da postura (inglês, minúsculo). */
    cascadeType: string
    /** Spellstrike gasto, esperando o "Recarregar". */
    spent: boolean
    /** Summon Mythic Power já usada hoje. */
    summoned: boolean
    /** Godspeed ativo (1 minuto — o app não conta o tempo, o jogador encerra). */
    godspeed: boolean
}

export const DEFAULT_CASCADE_TYPE = 'force'

export const NO_MAGUS: MagusStored = { cascade: false, cascadeType: DEFAULT_CASCADE_TYPE, spent: false, summoned: false, godspeed: false }

/** Tipos que o jogador pode escolher para a postura (os da última magia). */
export const CASCADE_TYPES = [
    'force', 'fire', 'cold', 'electricity', 'acid', 'sonic', 'mental', 'poison', 'vitality', 'void', 'spirit',
] as const

export function sanitizeMagus(raw: unknown): MagusStored {
    if (!raw || typeof raw !== 'object') return NO_MAGUS
    const r = raw as Partial<MagusStored>
    const type = typeof r.cascadeType === 'string' && (CASCADE_TYPES as readonly string[]).includes(r.cascadeType)
        ? r.cascadeType
        : DEFAULT_CASCADE_TYPE
    return { cascade: !!r.cascade, cascadeType: type, spent: !!r.spent, summoned: !!r.summoned, godspeed: !!r.godspeed }
}

export const isMagusEmpty = (s: MagusStored) => !s.cascade && !s.spent && !s.summoned && !s.godspeed && s.cascadeType === DEFAULT_CASCADE_TYPE

const norm = (s: string) => s.trim().toLowerCase()

const hasSpecial = (build: BuildInfo, name: string) => (build.specials ?? []).some((s) => norm(s) === norm(name))
const hasFeat = (build: BuildInfo, name: string) =>
    (build.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

export const hasArcaneCascade = (build: BuildInfo) => hasSpecial(build, 'Arcane Cascade')
export const hasSpellstrike = (build: BuildInfo) => hasSpecial(build, 'Spellstrike')
export const hasSummonMythicPower = (build: BuildInfo) => hasFeat(build, 'Summon Mythic Power')
export const hasDivertDestiny = (build: BuildInfo) => hasFeat(build, 'Divert Destiny')
export const hasFieryRebirthFeat = (build: BuildInfo) => hasFeat(build, 'Fiery Rebirth')

/** Quem tem ao menos uma das características: é quando a faixa (Magus ou poder mítico) aparece. */
export const hasMagusFeatures = (build: BuildInfo) =>
    hasArcaneCascade(build) || hasSpellstrike(build) || hasSummonMythicPower(build) || hasDivertDestiny(build) || hasFieryRebirthFeat(build)
    || mythicFeatsOf(build).length > 0

/** O dano extra da postura: 1; 2 com Weapon Specialization; 3 com a Greater. */
export function cascadeDamage(build: BuildInfo): number {
    if (hasSpecial(build, 'Greater Weapon Specialization')) return 3
    if (hasSpecial(build, 'Weapon Specialization')) return 2
    return 1
}

/**
 * Laughing Shadow (Impossible Magic pg. 13): em Arcane Cascade, com a outra mão COMPLETAMENTE livre, o Golpe
 * contra criatura desprevenida tem o dano da postura em 3 — 5 com Weapon Specialization, 7 com a Greater.
 * O app não sabe do alvo nem da mão: é um chip do diálogo do Golpe.
 */
export const hasLaughingShadow = (build: BuildInfo) => hasSpecial(build, 'Laughing Shadow')

export function laughingShadowDamage(build: BuildInfo): number {
    if (hasSpecial(build, 'Greater Weapon Specialization')) return 7
    if (hasSpecial(build, 'Weapon Specialization')) return 5
    return 3
}

/** A postura com o dano do Laughing Shadow, quando o chip vale; senão os modificadores como estão. */
export function withLaughingShadow(mods: ConditionModifiers, build: BuildInfo, on: boolean): ConditionModifiers {
    if (!on || !mods.cascade || !hasLaughingShadow(build)) return mods
    return { ...mods, cascade: { ...mods.cascade, damage: laughingShadowDamage(build) } }
}

/**
 * Magia estudiosa (Studious Spell, nível 7): ao conjurá-la, a Arcane Cascade pode ser a PRÓXIMA ação, como
 * ação livre. O Pathbuilder lista cada uma em `specials` ("Studious Spell: Blur").
 */
export function isStudiousSpell(build: BuildInfo, spellName: string): boolean {
    const target = norm(spellName)
    return (build.specials ?? []).some((s) => {
        const m = String(s).match(/^studious spell:\s*(.+)$/i)
        return !!m && norm(m[1]) === target
    })
}

/** O que viaja nos modificadores: a postura está ligada. */
export interface CascadeEffect {
    damage: number
    type: string
}

export const activeCascade = (stored: MagusStored, build: BuildInfo): CascadeEffect | null =>
    stored.cascade && hasArcaneCascade(build) ? { damage: cascadeDamage(build), type: stored.cascadeType } : null

export function withCascade(mods: ConditionModifiers, effect: CascadeEffect | null): ConditionModifiers {
    return effect ? { ...mods, cascade: effect } : mods
}

/** PV com que o Divert Destiny deixa o personagem: 10 + nível, até o máximo. */
export const divertDestinyHp = (level: number, maxHp: number): number => Math.min(maxHp, 10 + Math.max(0, level))
