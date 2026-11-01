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

import type { BuildInfo, Weapon } from '../../pathbuilder/types'
import { strikingDice } from '../../pathbuilder/weapon'
import { nameStarts } from './customRunes'
import type { ActivityInfo } from './activities'
import type { HealActivity } from './healActivities'
import type { CastTime } from './spellCast'
import { tr } from '../../i18n'

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
    /** Dádiva com caminho próprio no app (rola ataque e dano, ou muda o Golpe): o botão genérico não cobra. */
    special?: 'scrap-shot' | 'dragon-strike' | 'healing-wave' | 'word-of-faith' | 'emotion-surge'
    /** Emotion Surge: a emoção da relíquia, que decide em que teste vale o +1. */
    emotion?: RelicEmotion
    /** Números que dependem do nível da relíquia (o do dono), mostrados no cartão: "7d4 PV", "rank de counteract 4". */
    facts?: (level: number) => string
}

/**
 * Emotion Surge (Treasure Vault Remastered pg. 199): +1 de status por 1 minuto nos testes da emoção da relíquia.
 * `skill` é o `check.en` da perícia; Dedication vale no Recall Knowledge de qualquer perícia.
 */
export const EMOTION_SURGE = {
    Anger: { skill: 'Athletics' },
    Awe: { skill: 'Performance' },
    Dedication: { recall: true },
    Fear: { skill: 'Stealth' },
    Hatred: { skill: 'Intimidation' },
    Joy: { skill: 'Diplomacy' },
    Love: { skill: 'Medicine' },
    Misery: { skill: 'Survival' },
    Pride: { skill: 'Society' },
    Remorse: { skill: 'Deception' },
} as const satisfies Record<string, { skill?: string; recall?: boolean }>

export type RelicEmotion = keyof typeof EMOTION_SURGE

export type RelicBase =
    | { kind: 'weapon'; weapon: string }
    | { kind: 'armor' }
    | { kind: 'item'; name: string }

export interface RelicEntry {
    id: string
    character: (b: BuildInfo) => boolean
    name: string
    /** O item da ficha em que a relíquia mora (pelo nome base ou pelo de exibição do Pathbuilder); ausente = item avulso, só do app. */
    on?: RelicBase
    aspects?: string[]
    description?: string
    gifts: RelicGift[]
}

/**
 * As relíquias do grupo. Cada uma entra quando o jogador informa o que ela é e que dádivas tem.
 *
 * **Miranda's Arm** é só o NOME que a Miranda deu à relíquia dela (informado pelo jogador, 2026-10-23): o
 * braço, que é também o "Braço Sônico" da ficha. As runas dele (+1 striking, Shock) já vêm no export do
 * Pathbuilder e ficam como estão. As duas dádivas SÃO da AON — a descrição vem de lá — e o custo também:
 * **Scrap Shot** (Rage of Elements pg. 148, aspecto Metal, dádiva menor) é de **2 ações**;
 * **Dragon Strike** (Secrets of Magic pg. 230, aspecto Dragon, dádiva menor) é de **1 ação**,
 * comando, uma vez por hora (uma vez a cada 10 minutos a partir do 11º nível).
 */
export const RELICS: RelicEntry[] = [
    {
        id: 'miranda-arm',
        character: nameStarts('miranda'),
        name: "Miranda's Arm",
        on: { kind: 'weapon', weapon: 'Braço Sônico' },
        aspects: ['Metal', 'Dragon'],
        description: tr("Miranda's Arm é o nome que ela deu à relíquia: o braço dela, que também é o Braço Sônico da ficha. As runas dele continuam: +1 de potência, striking e Shock (já no ataque da aba Combate). O nível da relíquia é o do personagem.", 'Miranda\'s Arm is the name she gave her relic: her arm, which is also the Braço Sônico on the sheet. Its runes remain: +1 potency, striking and shock (already in the Combat tab\'s attack). The relic\'s level is the character\'s level.'),
        gifts: [
            {
                id: 'scrap-shot',
                name: 'Scrap Shot',
                tier: 'minor',
                kind: 'power',
                special: 'scrap-shot',
                activation: { cost: 2 },
                facts: (level) => tr(`${scrapShotDice(level)}d6 perfurante, ataque de magia, até 9 m`, `${scrapShotDice(level)}d6 piercing, spell attack, up to 30 feet`),
            },
            {
                id: 'dragon-strike',
                name: 'Dragon Strike',
                tier: 'minor',
                kind: 'power',
                special: 'dragon-strike',
                activation: { cost: 1, frequency: tr('uma vez por hora (a cada 10 minutos a partir do 11º nível)', 'once per hour (every 10 minutes from 11th level)'), limited: true },
                facts: (level) => tr(`${level >= 11 ? 'uma vez a cada 10 minutos' : 'uma vez por hora'}; +1d6 cortante por 1 minuto`, `${level >= 11 ? 'once every 10 minutes' : 'once per hour'}; +1d6 slashing for 1 minute`),
            },
        ],
    },
    {
        id: 'loki-heart',
        character: nameStarts('loki'),
        name: "Loki's Heart",
        on: { kind: 'item', name: "Loki's Heart" },
        aspects: ['Time', 'Luck'],
        description: tr("A relíquia do Loki (Loki's Heart, item vestido na ficha). O nível dela é o dele. As dádivas são da AON: Sands of the Hourglass e Whammy.", 'Loki\'s relic (Loki\'s Heart, an item worn on the sheet). Its level is his level. The gifts come from AON: Sands of the Hourglass and Whammy.'),
        gifts: [
            // Treasure Vault (Remastered) pg. 200: 2 ações (concentrar, manipular), 1× por hora, aspecto Time;
            // pré-requisito: relíquia de 5º nível ou mais. O alvo faz Fortitude — a AON NÃO dá a CD, é do mestre.
            {
                id: 'sands-of-the-hourglass',
                name: 'Sands of the Hourglass',
                tier: 'minor',
                kind: 'power',
                minLevel: 5,
                activation: { cost: 2, frequency: tr('uma vez por hora', 'once per hour'), limited: true },
            },
            // Treasure Vault (Remastered) pg. 199: reação (concentrar), 1× por dia, aspecto Luck, traço Misfortune.
            {
                id: 'whammy',
                name: 'Whammy',
                tier: 'minor',
                kind: 'power',
                activation: {
                    cost: 'reaction',
                    frequency: tr('uma vez por dia', 'once per day'),
                    limited: true,
                    trigger: tr('um inimigo a até 9 m tira um sucesso em ataque, salvaguarda ou teste de perícia', 'an enemy within 30 feet succeeds at an attack, saving throw or skill check'),
                },
            },
        ],
    },
    {
        // Redenção Pelas Cinzas: luvas sem dedos de couro ressecado e cinza, que soltam cinzas sem parar (descrição da jogadora).
        // Dádivas projetadas: nível 1 (Life) Healing Wave e nível 5 (Celestial) Word of Faith — as duas da AON, GM Core pg. 315 e 311.
        id: 'redencao-pelas-cinzas',
        character: nameStarts('hearts'),
        name: 'Redenção Pelas Cinzas',
        aspects: ['Life', 'Celestial'],
        description: tr('Um par de luvas sem dedos (a direita ainda tem o anelar e o mindinho, estilo luva de artista), de couro ressecado por anos de uso e de um cinza sem cor, como se tivessem perdido toda a saturação. Flocos de cinza se soltam delas o tempo todo e somem no ar. O nível da relíquia é o do personagem.', 'A pair of fingerless gloves (the right one still has the ring and little fingers, artist-glove style), of leather dried out by years of use and of a colorless gray, as if they had lost all their saturation. Flakes of ash come off them all the time and vanish in the air. The relic\'s level is the character\'s level.'),
        gifts: [
            {
                id: 'healing-wave',
                name: 'Healing Wave',
                tier: 'minor',
                kind: 'power',
                special: 'healing-wave',
                activation: { cost: 2, frequency: tr('uma vez por hora', 'once per hour'), limited: true },
                facts: (level) => tr(`${level}d4 PV para você e cada criatura viva no cone de 4,5 m`, `${level}d4 HP for you and each living creature in the 15-foot cone`),
            },
            {
                id: 'word-of-faith',
                name: 'Word of Faith',
                tier: 'minor',
                kind: 'power',
                special: 'word-of-faith',
                activation: { cost: 2, frequency: tr('uma vez por hora', 'once per hour'), limited: true },
                facts: (level) => tr(`${level}d8 PV em você ou num aliado, e o Amedrontado dele cai 1`, `${level}d8 HP to you or an ally, and their frightened drops by 1`),
            },
        ],
    },
    {
        // Afinco do Artista, a relíquia da alma (relíquia de antecedente): sobretudo de couro marrom manchado de tinta colorida.
        // Dádivas projetadas: nível 1 (Emotion) Dominant Emotion e nível 5 (Life) Bestow Life — GM Core pg. 315 e Treasure Vault Remastered pg. 198.
        id: 'afinco-do-artista',
        character: nameStarts('hearts'),
        name: 'Afinco do Artista',
        aspects: ['Life', 'Emotion'],
        description: tr('A relíquia da alma do personagem: um sobretudo de couro marrom, simples e gasto pelo uso, igual a tantos outros — salvo pelas manchas de tinta multicoloridas nas lapelas e mangas, que exalam vida e, sob a luz certa, às vezes cintilam em cor. O nível da relíquia é o do personagem.', 'The character\'s soul relic: a brown leather overcoat, plain and worn from use, like so many others — except for the multicolored paint stains on the lapels and sleeves, which exude life and, in the right light, sometimes shimmer with color. The relic\'s level is the character\'s level.'),
        gifts: [
            {
                id: 'dominant-emotion',
                name: 'Dominant Emotion',
                tier: 'minor',
                kind: 'power',
                activation: {
                    cost: 'reaction',
                    frequency: tr('uma vez por hora', 'once per hour'),
                    limited: true,
                    trigger: tr('você seria afetado negativamente por um efeito de emoção', 'you would be negatively affected by an emotion effect'),
                },
                // O texto manda "tentar um teste de counteract"; sem modificador na relíquia, o número é do mestre.
                facts: (level) => tr(`counteract de rank ${Math.ceil(level / 2)} (metade do nível, arredondada para cima); o modificador a AON não dá`, `rank ${Math.ceil(level / 2)} counteract (half the level, rounded up); AON doesn't give the modifier`),
            },
            {
                id: 'bestow-life',
                name: 'Bestow Life',
                tier: 'minor',
                kind: 'power',
                activation: { cost: 2, frequency: tr('uma vez por dia', 'once per day'), limited: true },
                facts: (level) => tr(`objeto animado de nível ${Math.floor(level / 2)}, por 1 hora, numa tarefa simples sem combate`, `level ${Math.floor(level / 2)} animated object, for 1 hour, on a simple non-combat task`),
            },
        ],
    },
    {
        // Brasão da Família, a relíquia do Woyd (aspectos Soul e Emotion), item avulso — não está no export.
        id: 'brasao-da-familia',
        character: nameStarts('woyd'),
        name: 'Brasão da Família',
        aspects: ['Soul', 'Emotion'],
        description: tr('A relíquia do Woyd: o brasão da família dele. O nível da relíquia é o do personagem. As dádivas são da AON: Absorb Injury e Emotion Surge.', 'Woyd\'s relic: his family\'s coat of arms. The relic\'s level is the character\'s level. The gifts come from AON: Absorb Injury and Emotion Surge.'),
        gifts: [
            // Secrets of Magic pg. 231: reação (envision), 1× por dia, aspecto Soul. Você recebe o dano do aliado,
            // com os efeitos que vêm junto (veneno, condições, persistente) — quanto é, é do mestre.
            {
                id: 'absorb-injury',
                name: 'Absorb Injury',
                tier: 'minor',
                kind: 'power',
                activation: {
                    cost: 'reaction',
                    frequency: tr('uma vez por dia', 'once per day'),
                    limited: true,
                    trigger: tr('um aliado a até 9 m sofre dano', 'an ally within 30 feet takes damage'),
                },
                facts: () => tr('você recebe o dano no lugar do aliado, com os efeitos que vêm junto', 'you take the damage instead of the ally, with the effects that come with it'),
            },
            // Treasure Vault (Remastered) pg. 199: 1 ação (concentrar), 1× por hora, aspecto Emotion. +1 de status
            // por 1 minuto num tipo de teste que depende da EMOÇÃO da relíquia: Pride (informada pelo jogador) = Sociedade.
            // O botão cobra a ação; o +1 é o chip do diálogo de Sociedade (o app não conta o minuto).
            {
                id: 'emotion-surge',
                name: 'Emotion Surge',
                tier: 'minor',
                kind: 'power',
                special: 'emotion-surge',
                emotion: 'Pride',
                activation: { cost: 1, frequency: tr('uma vez por hora', 'once per hour'), limited: true },
                facts: () => tr('emoção Pride (orgulho): +1 de status em testes de Sociedade por 1 minuto', 'Pride emotion: +1 status bonus to Society checks for 1 minute'),
            },
        ],
    },
]

export { nameStarts }

/** A dádiva liberada de uma relíquia do personagem, pelo `special` ou pelo id. */
export function relicGift(build: BuildInfo, special: NonNullable<RelicGift['special']>, catalog: RelicEntry[] = RELICS): RelicGift | null {
    const level = relicLevel(build)
    for (const relic of relicsOf(build, catalog)) {
        const idx = relic.gifts.findIndex((g) => g.special === special)
        if (idx >= 0 && giftUnlocked(relic.gifts[idx], idx, level)) return relic.gifts[idx]
    }
    return null
}

/**
 * As curas das relíquias, no formato de `healActivities.ts`: **Healing Wave** (GM Core pg. 315: 2 ações, 1×/hora,
 * cone de 15 pés, você e cada criatura viva recuperam 1d4 PV por nível da relíquia) e **Word of Faith** (pg. 311:
 * 2 ações, 1×/hora, você ou um aliado recupera 1d8 PV por nível do item e reduz o Amedrontado em 1).
 * O nível da relíquia é o do dono.
 */
export function relicHealActivity(build: BuildInfo, relic: RelicEntry, gift: RelicGift): HealActivity | null {
    const level = relicLevel(build)
    if (gift.special === 'healing-wave') {
        return {
            key: giftUseKey(relic, gift), name: gift.name, actions: 2, daily: true, unstable: false, frequency: tr('uma vez por hora', 'once per hour'),
            count: level, faces: 4, flat: 0, formula: `${level}d4`,
            note: tr('Cone de 4,5 m: você e cada criatura viva na área recuperam o mesmo valor (uma rolagem só). Efeito de vitalidade.', '15-foot cone: you and each living creature in the area regain the same amount (a single roll). Vitality effect.'),
        }
    }
    if (gift.special === 'word-of-faith') {
        return {
            key: giftUseKey(relic, gift), name: gift.name, actions: 2, daily: true, unstable: false, frequency: tr('uma vez por hora', 'once per hour'),
            count: level, faces: 8, flat: 0, formula: `${level}d8`,
            note: tr('Mão sobre você ou um aliado: ele recupera esse PV e reduz o Amedrontado em 1. Efeito de vitalidade, sagrado.', 'Hand on you or an ally: they regain that HP and reduce frightened by 1. Vitality effect, holy.'),
            reducesFrightened: true,
        }
    }
    return null
}

/** O Emotion Surge que vale neste teste (perícia em inglês, e se é Recall Knowledge), se a ficha tem um. */
export function emotionSurgeFor(build: BuildInfo, checkEn: string, recall: boolean): { gift: RelicGift; emotion: RelicEmotion } | null {
    const gift = relicGift(build, 'emotion-surge')
    if (!gift?.emotion) return null
    const rule: { skill?: string; recall?: boolean } = EMOTION_SURGE[gift.emotion]
    return (rule.skill === checkEn || (rule.recall && recall)) ? { gift, emotion: gift.emotion } : null
}

/** O nome da arma da ficha em que a relíquia mora (o braço), se ela mora numa arma. */
export function relicWeaponName(build: BuildInfo, catalog: RelicEntry[] = RELICS): string | null {
    const on = relicsOf(build, catalog).map((r) => r.on).find((o) => o?.kind === 'weapon')
    return on?.kind === 'weapon' ? on.weapon : null
}

/** Scrap Shot: 1d6 para cada 2 níveis da relíquia (o do dono), no mínimo 1d6. */
export const scrapShotDice = (level: number): number => Math.max(1, Math.floor(level / 2))

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
            // O Pathbuilder guarda o item base em `name` e o nome da arma específica em `display`.
            if (relic.on?.kind !== 'weapon' || !(sameRune(relic.on.weapon, w.name) || sameRune(relic.on.weapon, w.display ?? ''))) continue
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
