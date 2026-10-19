/**
 * O que o Guerreiro (e quem pega talentos de Guerreiro, como o arquétipo
 * Bastion) liga ou precisa lembrar numa rolagem.
 *
 * - **Fearsome Brute** (Player Core pg. 147): bônus de CIRCUNSTÂNCIA no dano dos
 *   Golpes contra criatura amedrontada, igual ao DOBRO do valor do medo — o
 *   TRIPLO para quem é mestre em Intimidação. O valor do medo é do alvo, e a
 *   ficha não o conhece: o diálogo do Golpe pergunta.
 * - **Exacting Strike** (Player Core pg. 140, 1 ação, Pressionar): um Golpe que,
 *   se ERRAR, não conta para a penalidade de ataques múltiplos. O app não sabe se
 *   errou, então é uma anotação da rolagem.
 * - **Reflexive Shield** (Player Core pg. 145): ao Erguer o Escudo, o bônus de
 *   circunstância do escudo vale também nas salvaguardas de Reflexos. O estado
 *   do escudo é o da mesa (`useShield`), então o bônus entra sozinho enquanto
 *   ele estiver erguido (e inteiro).
 * - **Fiery Rebirth** (talento mítico, ação livre): ao escapar da morte, gasta 1
 *   Ponto Mítico, volta à consciência, levanta, recupera PV iguais ao nível e
 *   explode em fogo — 2 × nível de dano em quem está adjacente, Reflexos básico
 *   contra a CD de classe.
 *
 * Quem tem cada talento vem da ficha (`feats`).
 */
import { parseFeatEntry, type BuildInfo } from '../character-sheet/types'
import { abilityMod } from './helpers'
import type { ConditionModifiers } from './conditions'

const norm = (s: string) => s.trim().toLowerCase()
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

export const hasFearsomeBrute = (b: BuildInfo) => hasFeat(b, 'Fearsome Brute')
export const hasExactingStrike = (b: BuildInfo) => hasFeat(b, 'Exacting Strike')
export const hasReflexiveShield = (b: BuildInfo) => hasFeat(b, 'Reflexive Shield')
export const hasShieldBlock = (b: BuildInfo) => hasFeat(b, 'Shield Block')
export const hasQuickShieldBlock = (b: BuildInfo) => hasFeat(b, 'Quick Shield Block')
export const hasReactiveShield = (b: BuildInfo) => hasFeat(b, 'Reactive Shield')
export const hasFieryRebirth = (b: BuildInfo) => hasFeat(b, 'Fiery Rebirth')

/** Mestre em Intimidação (rank 6 no Pathbuilder, que guarda 2 × rank). */
const MASTER = 6

/** 2 × o medo do alvo; 3 × para o mestre em Intimidação. */
export function fearsomeBruteBonus(build: BuildInfo, frightened: number): number {
    if (frightened <= 0) return 0
    const mult = (build.proficiencies.intimidation ?? 0) >= MASTER ? 3 : 2
    return mult * Math.floor(frightened)
}

/** O bônus do escudo erguido, nas salvaguardas de Reflexos — só com Reflexive Shield. */
export function reflexShieldBonus(build: BuildInfo, raisedBonus: number): number {
    return hasReflexiveShield(build) ? Math.max(0, raisedBonus) : 0
}

export function withReflexShield(mods: ConditionModifiers, bonus: number): ConditionModifiers {
    return bonus > 0 ? { ...mods, reflexShield: bonus } : mods
}

/** PV que o Fiery Rebirth devolve: o nível. */
export const fieryRebirthHeal = (level: number): number => Math.max(0, level)
/** Dano de fogo da explosão: 2 × o nível. */
export const fieryRebirthDamage = (level: number): number => 2 * Math.max(0, level)

/** CD de classe: 10 + nível (se treinado) + bônus de proficiência + atributo-chave. */
export function classDc(build: BuildInfo): number {
    const prof = build.proficiencies.classDC ?? 0
    const key = (build.keyability || 'str').toLowerCase() as keyof BuildInfo['abilities']
    return 10 + (prof > 0 ? build.level + prof : 0) + abilityMod(build.abilities[key] as number)
}
