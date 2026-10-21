// Relíquias (GM Core, "Relics"): item que cresce com o dono. A relíquia começa como uma
// semente e ganha DÁDIVAS (gifts) — habilidades e ativações novas. O jogador pode ter
// trocado uma dádiva por uma RUNA ("Runes as Gifts", GM Core).
//
// Regras que o código segue (Advancing a Relic, GM Core pg. 309):
//  - o nível da relíquia É o do dono (`relicLevel`) — os "1d6 a cada 2 níveis da relíquia"
//    das dádivas usam o nível do personagem;
//  - a Tabela 2–22 diz quantas dádivas a relíquia costuma ter por nível: a 1ª no 1º, a 2ª
//    no 5º, a 3ª no 9º, a 4ª no 13º e a 5ª no 17º (`GIFT_LEVELS`). É "típico", não
//    obrigatório — a dádiva pode declarar o próprio `minLevel`.
//
// Como `customRunes.ts` e `signatureSpells.ts`, é um catálogo À MÃO por nome de personagem:
// o Pathbuilder não exporta relíquia nenhuma e o JSON da ficha não é editado. A descrição
// de uma dádiva vem da AON pelo nome (categoria `relic`, já traduzida pela cadeia de
// sempre) a menos que a entrada traga `description`; o que o app não sabe ler da AON —
// custo e frequência da ativação — é escrito aqui, conferido contra o texto dela.

import type { BuildInfo, Weapon } from '../character-sheet/types'
import { strikingDice } from '../character-sheet/weapon'
import { nameStarts } from './customRunes'
import type { ActivityInfo } from './activities'
import type { CastTime } from './spellCast'

export type RelicTier = 'minor' | 'major' | 'grand'
export type RelicCost = 1 | 2 | 3 | 'reaction' | 'free'

/** Nível mínimo típico de cada dádiva, pela ordem em que a relíquia as ganha (Tabela 2–22). */
export const GIFT_LEVELS = [1, 5, 9, 13, 17] as const

export interface RelicActivation {
    cost: RelicCost
    /** Como a AON escreve ("uma vez por dia", "uma vez por minuto"…), para mostrar. */
    frequency?: string
    /** O app não conta o tempo: com `limited`, o botão fica "Usada ↺" até o jogador devolver ou o Novo dia. */
    limited?: boolean
    trigger?: string
}

/** O que uma runa de dádiva faz na arma da relíquia. Potência e Striking valem pelo MAIOR. */
export interface RelicRune {
    potency?: 1 | 2 | 3
    striking?: 'striking' | 'greater striking' | 'major striking'
    /** Runas de propriedade (nomes da AON, "Flaming"). */
    property?: string[]
}

export interface RelicGift {
    /** Único na relíquia — vira parte da chave do "usada hoje" (`uses`). */
    id: string
    /** O nome da AON (dádiva) ou da runa; é também o que se busca ao abrir a descrição. */
    name: string
    tier: RelicTier
    kind: 'power' | 'rune'
    /** Sobrepõe o nível típico da posição. */
    minLevel?: number
    /** pt-BR à mão. Sem ela, o botão abre a descrição da AON pelo nome. */
    description?: string
    activation?: RelicActivation
    rune?: RelicRune
}

export type RelicBase =
    | { kind: 'weapon'; weapon: string }
    | { kind: 'armor' }
    | { kind: 'item'; name: string }

export interface RelicEntry {
    id: string
    character: (b: BuildInfo) => boolean
    name: string
    /** O item da ficha em que a relíquia mora; ausente = item avulso, só do app. */
    on?: RelicBase
    aspects?: string[]
    description?: string
    gifts: RelicGift[]
}

/** As relíquias do grupo. Cada uma entra quando o jogador informa o que ela é e que dádivas tem. */
export const RELICS: RelicEntry[] = []

export { nameStarts }

/** O nível da relíquia é sempre o do dono. */
export const relicLevel = (build: BuildInfo): number => build.level

export function relicsOf(build: BuildInfo, catalog: RelicEntry[] = RELICS): RelicEntry[] {
    return catalog.filter((r) => r.character(build))
}

/** Nível em que a dádiva da posição `index` libera. */
export const giftMinLevel = (gift: RelicGift, index: number): number =>
    gift.minLevel ?? GIFT_LEVELS[Math.min(index, GIFT_LEVELS.length - 1)]

export const giftUnlocked = (gift: RelicGift, index: number, level: number): boolean =>
    level >= giftMinLevel(gift, index)

/** A chave do contador de uso (`uses`): única por relíquia e dádiva. */
export const giftUseKey = (relic: RelicEntry, gift: RelicGift): string => `relic:${relic.id}:${gift.id}`

/**
 * O custo da ativação no formato da economia de atividades (`useActivity`). Ação livre sem
 * limite não cobra nada, então não há botão (mesma regra de `activityOf`).
 */
export function giftActivity(gift: RelicGift): ActivityInfo | null {
    const a = gift.activation
    if (!a) return null
    const time: CastTime = typeof a.cost === 'number'
        ? { kind: 'actions', n: a.cost }
        : { kind: a.cost }
    if (time.kind === 'free' && !a.limited) return null
    return { time, mythicPoint: false, daily: !!a.limited, includesStrike: false, trigger: a.trigger }
}

const STRIKING_RANK = (s: string | null | undefined): number => strikingDice(s) - 1
const STRIKING_NAME = ['', 'striking', 'greater striking', 'major striking']

const sameRune = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * A arma com as runas das dádivas liberadas. Pelo MAIOR, nunca somando: runa do mesmo tipo
 * não empilha (e, se o Pathbuilder já exportou a runa, nada muda de novo). O ataque sobe
 * pelo que a potência ganhou. Não toca a arma que a relíquia não nomeia.
 */
export function withRelicRunes(build: BuildInfo, catalog: RelicEntry[] = RELICS): BuildInfo {
    const relics = relicsOf(build, catalog).filter((r) => r.on?.kind === 'weapon')
    if (relics.length === 0 || !build.weapons?.length) return build
    const level = relicLevel(build)
    let changed = false
    const weapons = build.weapons.map((w): Weapon => {
        let next = w
        for (const relic of relics) {
            if (relic.on?.kind !== 'weapon' || !sameRune(relic.on.weapon, w.name)) continue
            relic.gifts.forEach((gift, idx) => {
                if (gift.kind !== 'rune' || !gift.rune || !giftUnlocked(gift, idx, level)) return
                const { potency, striking, property } = gift.rune
                if (potency && potency > next.pot) {
                    next = { ...next, attack: next.attack + (potency - next.pot), pot: potency }
                }
                if (striking && STRIKING_RANK(striking) > STRIKING_RANK(next.str)) {
                    next = { ...next, str: STRIKING_NAME[STRIKING_RANK(striking)] }
                }
                for (const rune of property ?? []) {
                    if (!next.runes.some((r) => sameRune(r, rune))) next = { ...next, runes: [...next.runes, rune] }
                }
            })
        }
        if (next !== w) changed = true
        return next
    })
    return changed ? { ...build, weapons } : build
}
