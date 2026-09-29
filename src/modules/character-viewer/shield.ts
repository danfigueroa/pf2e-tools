// Escudo: números, estado e as regras do Remaster que a Ficha Virtual e a
// Iniciativa aplicam do mesmo jeito.
//
// - Raise a Shield (◆): o bônus de circunstância do escudo entra na CA até o
//   início do próximo turno de quem ergueu.
// - Shield Block (reação, exige o talento): contra dano físico com o escudo
//   erguido, a Dureza absorve; o que sobra vai INTEIRO para a criatura e para o
//   escudo — não se divide entre os dois.
// - Destructive Block (Bastion 10, Player Core 2 p. 187): no Shield Block, a
//   criatura reduz o dano pelo DOBRO da Dureza, e o escudo toma o dobro do dano
//   que tomaria ANTES da Dureza — o dano cru dobrado, e aí a Dureza normal.
//   É escolha de quem bloqueia, golpe a golpe, depois de saber o dano.
// - Quebrado (PV ≤ BT): objeto quebrado não cumpre a função nem dá bônus (Player
//   Core, condição Broken). Não ergue, não soma CA, não bloqueia. Destruído em 0.
// - Repair (Crafting): sucesso devolve 5 + 5×rank, crítico 10 + 10×rank.
//
// O Pathbuilder exporta o escudo sem Dureza nem PV; esses vêm da AON
// (`services/shields.ts`) e as runas de reforço são somadas aqui.

import { parseFeatEntry, type BuildInfo } from '../character-sheet/types'

/** O escudo como a ficha descreve — serializável, viaja no combatente da Iniciativa. */
export interface ShieldItem {
    name: string
    runes: string[]
    /** `acTotal.shieldBonus` do Pathbuilder; `null` = usar o da AON. */
    bonus: number | null
    /** Tem o talento Shield Block. */
    canBlock: boolean
    /** Tem o talento Destructive Block. Opcional: encontro salvo antes não traz. */
    destructive?: boolean
}

/** Números finais do escudo, já com runa de reforço. */
export interface ShieldStats {
    name: string
    bonus: number
    hardness: number
    maxHp: number
    bt: number
    canBlock: boolean
    /** Pode escolher o Destructive Block ao bloquear. */
    destructive: boolean
}

/** O que a mesa guarda. `hp: null` = ninguém mexeu, escudo inteiro. */
export interface ShieldStored {
    hp: number | null
    raised: boolean
}

/** O que a AON devolve (`search?shields=`). */
export interface AonShield {
    name: string
    bonus: number
    hardness: number
    hp: number
    bt: number
    specific: boolean
}

const hasFeat = (build: BuildInfo, re: RegExp) =>
    (build.feats ?? []).some((f) => re.test(parseFeatEntry(f).name.trim()))

/** O escudo vestido da ficha, ou `null`. */
export function shieldItemOf(build: BuildInfo): ShieldItem | null {
    const worn = (build.armor ?? []).find((a) => a.prof === 'shield' && a.worn)
        ?? (build.armor ?? []).find((a) => a.prof === 'shield')
    if (!worn) return null
    const raw = build.acTotal?.shieldBonus
    const bonus = raw == null ? null : parseInt(String(raw), 10)
    return {
        name: worn.name,
        runes: worn.runes ?? [],
        bonus: Number.isFinite(bonus) ? bonus : null,
        canBlock: hasFeat(build, /^shield block$/i),
        destructive: hasFeat(build, /^destructive block$/i),
    }
}

/**
 * Runa de reforço (GM Core p. 232), transcrita da AON: soma Dureza, PV e BT,
 * com teto por grau. Específico não recebe runa — os números dele são fixos.
 */
const REINFORCING: Record<string, { hardness: number; hp: number; bt: number; max: [number, number, number] }> = {
    minor: { hardness: 3, hp: 44, bt: 22, max: [8, 64, 32] },
    lesser: { hardness: 3, hp: 52, bt: 26, max: [10, 80, 40] },
    moderate: { hardness: 3, hp: 64, bt: 32, max: [13, 104, 52] },
    greater: { hardness: 5, hp: 80, bt: 40, max: [15, 120, 60] },
    major: { hardness: 5, hp: 84, bt: 42, max: [17, 136, 68] },
    supreme: { hardness: 7, hp: 108, bt: 54, max: [20, 160, 80] },
}

/** "Reinforcing (Moderate)" → o degrau, ou `null`. */
function reinforcingOf(runes: string[]) {
    for (const rune of runes) {
        const m = /reinforcing\s*\(?\s*(minor|lesser|moderate|greater|major|supreme)/i.exec(rune)
        if (m) return REINFORCING[m[1].toLowerCase()]
    }
    return null
}

export function shieldStats(item: ShieldItem, aon: AonShield | null): ShieldStats | null {
    if (!aon) return null
    let { hardness, hp, bt } = aon
    const rune = aon.specific ? null : reinforcingOf(item.runes)
    if (rune) {
        hardness = Math.min(rune.max[0], hardness + rune.hardness)
        hp = Math.min(rune.max[1], hp + rune.hp)
        bt = Math.min(rune.max[2], bt + rune.bt)
    }
    return {
        name: item.name,
        bonus: item.bonus ?? aon.bonus,
        hardness,
        maxHp: hp,
        bt,
        canBlock: item.canBlock,
        destructive: item.canBlock && !!item.destructive,
    }
}

export const isBroken = (hp: number, stats: Pick<ShieldStats, 'bt'>) => hp <= stats.bt
export const isDestroyed = (hp: number) => hp <= 0

/** O bônus que o escudo põe na CA agora: só erguido e inteiro. */
export function raisedBonus(stats: ShieldStats | null, hp: number, raised: boolean): number {
    if (!stats || !raised || isBroken(hp, stats)) return 0
    return stats.bonus
}

export interface BlockResult {
    /** Quanto a Dureza segurou. */
    absorbed: number
    /** O que sobra — vai inteiro para a criatura E para o escudo. */
    toCreature: number
    toShield: number
    hpBefore: number
    hpAfter: number
    /** Passou do BT neste bloqueio. */
    broke: boolean
    destroyed: boolean
    /** Foi um Destructive Block. */
    destructive: boolean
}

/**
 * Quanto o bloqueio segura e quanto cada lado toma. No comum, o que passa da
 * Dureza vai inteiro para os dois. No Destructive Block, a criatura desconta o
 * dobro da Dureza e o escudo toma o dano cru dobrado menos a Dureza — 30 de
 * dano num escudo de Dureza 9 são 12 na criatura e 51 no escudo.
 */
export function blockSplit(damage: number, hardness: number, destructive: boolean) {
    const dmg = Math.max(0, Math.floor(damage))
    const h = Math.max(0, hardness)
    const absorbed = Math.min(dmg, destructive ? 2 * h : h)
    return {
        absorbed,
        toCreature: dmg - absorbed,
        toShield: Math.max(0, (destructive ? 2 * dmg : dmg) - h),
    }
}

export function shieldBlock(damage: number, stats: ShieldStats, hp: number, destructive = false): BlockResult {
    const useDestructive = destructive && stats.destructive
    const { absorbed, toCreature, toShield } = blockSplit(damage, stats.hardness, useDestructive)
    const hpAfter = Math.max(0, hp - toShield)
    return {
        absorbed,
        toCreature,
        toShield,
        hpBefore: hp,
        hpAfter,
        broke: !isBroken(hp, stats) && isBroken(hpAfter, stats),
        destroyed: hp > 0 && hpAfter === 0,
        destructive: useDestructive,
    }
}

/** Pode bloquear agora: tem o talento, está erguido e não está quebrado. */
export const canBlockNow = (stats: ShieldStats | null, hp: number, raised: boolean): stats is ShieldStats =>
    !!stats && stats.canBlock && raised && !isBroken(hp, stats)

/** Tipos que o Shield Block aceita: dano físico — e o "sem tipo" do botão rápido. */
export const BLOCKABLE_TYPES = new Set(['bludgeoning', 'piercing', 'slashing', 'physical', 'untyped'])

/** PV que o Repair devolve pelo rank de Crafting (0–4). */
export const repairAmount = (rank: number, crit: boolean) =>
    crit ? 10 + 10 * rank : 5 + 5 * rank

/** Rank de Crafting da ficha (o Pathbuilder guarda o bônus 2×rank). */
export const craftingRank = (build: BuildInfo) =>
    Math.max(0, Math.min(4, Math.floor((build.proficiencies?.crafting ?? 0) / 2)))

export function sanitizeShield(raw: unknown): ShieldStored | null {
    if (!raw || typeof raw !== 'object') return null
    const s = raw as Partial<ShieldStored>
    const hp = typeof s.hp === 'number' && Number.isFinite(s.hp) ? Math.max(0, Math.floor(s.hp)) : null
    return { hp, raised: !!s.raised }
}
