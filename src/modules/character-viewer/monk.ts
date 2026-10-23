/**
 * O que o Monge liga nos Golpes (Player Core 2 pg. 114-121, texto conferido na AON).
 *
 * - **Flurry of Blows** (1 ação, flourish): dois Golpes desarmados; o 2º já leva a penalidade de ataques
 *   múltiplos do 1º (MAP aplicado normalmente), e, se os dois acertam a mesma criatura, o dano se
 *   combina para resistência e fraqueza. Só uma vez por turno. Na **Monastic Archer Stance** vale também
 *   com arcos (longbow, shortbow e arcos com o traço monk).
 * - **Ki Strike** / **Inner Upheaval** (magias de foco, 1 ação, verbal): um Golpe desarmado ou um Flurry
 *   com **+1 de status no ataque** e **+1d6 de dano extra** (força, espírito, vitalidade ou vazio, à escolha
 *   a cada Golpe); +1d6 a cada +4 ranks. Gasta 1 Ponto de Foco; a ação é a do próprio Golpe ou Flurry.
 * - **Stunning Blows**: no Flurry em UMA criatura, se um Golpe acerta e causa dano, Fortitude contra a CD
 *   de classe ou atordoado 1 (3 na falha crítica); incapacitação.
 * - **Perfect Strike** (Student of Perfection, magia de foco, reação, fortuna): errou um Golpe desarmado,
 *   rerrola o ataque e fica com o novo resultado. Gasta a reação e 1 Ponto de Foco.
 *
 * O estado é só a postura (campo `uses`, marcada à mão: o app não vê o fim do encontro).
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { Strike } from './strikes'

const norm = (s: string) => s.trim().toLowerCase()
const hasSpecial = (b: BuildInfo, name: string) => (b.specials ?? []).some((s) => norm(s) === norm(name))
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

/** Todas as magias de foco da ficha, de qualquer tradição e atributo. */
export function focusSpellNames(build: BuildInfo): string[] {
    const out: string[] = []
    for (const byAbility of Object.values(build.focus ?? {})) {
        for (const group of Object.values(byAbility ?? {})) {
            out.push(...(group?.focusSpells ?? []), ...(group?.focusCantrips ?? []))
        }
    }
    return out
}

export const hasFlurryOfBlows = (b: BuildInfo) => hasSpecial(b, 'Flurry of Blows')
export const hasStunningBlows = (b: BuildInfo) => hasFeat(b, 'Stunning Blows')
export const hasMonasticArcherStance = (b: BuildInfo) => hasFeat(b, 'Monastic Archer Stance')

/** As duas magias com o mesmo efeito: Ki Strike (Student of Perfection) e Inner Upheaval (Qi Spells). */
export const KI_STRIKE_SPELLS = ['ki strike', 'inner upheaval'] as const
export const hasKiStrike = (b: BuildInfo) => focusSpellNames(b).some((n) => (KI_STRIKE_SPELLS as readonly string[]).includes(norm(n)))
export const hasPerfectStrike = (b: BuildInfo) => focusSpellNames(b).some((n) => norm(n) === 'perfect strike')

/** Magias cujo efeito vive no diálogo do Golpe (o botão "Conjurar" da gaveta não as cobra). */
export const isStrikeFocusSpell = (name: string): boolean =>
    (KI_STRIKE_SPELLS as readonly string[]).includes(norm(name)) || norm(name) === 'perfect strike'

/** O rank de uma magia de foco é metade do nível, arredondada para cima. */
export const focusRank = (level: number): number => Math.ceil(Math.max(1, level) / 2)
/** Ki Strike: 1d6 de dano extra, +1d6 a cada +4 ranks acima do 1º. */
export const kiStrikeDice = (level: number): number => 1 + Math.floor((focusRank(level) - 1) / 4)

export const KI_TYPES = ['force', 'spirit', 'vitality', 'void'] as const
export type KiType = (typeof KI_TYPES)[number]
export const KI_TYPE_LABEL: Record<KiType, string> = { force: 'força', spirit: 'espírito', vitality: 'vitalidade', void: 'vazio' }

/** Chaves das escolhas por Golpe, guardadas junto dos chips de dano extra (não ficam lembradas). */
export const FLURRY_KEY = 'flurry'
export const KI_KEY = 'ki-strike'
export const STUNNING_KEY = 'stunning-blows'
const KI_TYPE_PREFIX = 'ki-type:'
export const kiTypeKey = (t: KiType) => `${KI_TYPE_PREFIX}${t}`
export const kiTypeOf = (on: Record<string, boolean>): KiType => KI_TYPES.find((t) => on[kiTypeKey(t)] === true) ?? 'force'

/** A postura mora em `uses` (nome → vezes): ligada = marcada. */
export const STANCE_USE_KEY = 'stance:monastic-archer'

const isBow = (s: Pick<Strike, 'group' | 'traits'>) => (s.group || '').toLowerCase() === 'bow' && s.traits.ranged

export interface FlurryCheck {
    ok: boolean
    /** Por que não dá (só quando a arma é de arco e falta a postura). */
    reason: string | null
}

/** O Golpe aceita Flurry of Blows: desarmado sempre; arco só na Monastic Archer Stance. */
export function flurryCheck(build: BuildInfo, s: Strike, stanceOn: boolean): FlurryCheck {
    if (!hasFlurryOfBlows(build)) return { ok: false, reason: null }
    if (s.unarmed) return { ok: true, reason: null }
    if (hasMonasticArcherStance(build) && isBow(s)) {
        return stanceOn
            ? { ok: true, reason: null }
            : { ok: false, reason: 'Flurry com arco exige a Monastic Archer Stance (1 ação): ligue a postura na faixa do Monge.' }
    }
    return { ok: false, reason: null }
}

/** Ki Strike vale no Golpe desarmado, e no arco dentro da postura (dentro de metade do incremento de distância). */
export const kiStrikeApplies = (build: BuildInfo, s: Strike): boolean =>
    hasKiStrike(build) && (!!s.unarmed || (hasMonasticArcherStance(build) && isBow(s)))

/** Perfect Strike: só em ataque desarmado. */
export const perfectStrikeApplies = (build: BuildInfo, s: Strike): boolean => hasPerfectStrike(build) && !!s.unarmed

/** O aviso do Stunning Blows na rolagem; a CD de classe é do personagem. */
export const stunningBlowsNote = (dc: number): string =>
    `Stunning Blows: se um Golpe acertar e causar dano, Fortitude contra CD ${dc} ou atordoado 1 (atordoado 3 na falha crítica); incapacitação`
