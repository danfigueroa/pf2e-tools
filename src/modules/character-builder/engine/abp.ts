// Automatic Bonus Progression (GM Core pg. 83, Table 4-11): os bônus de item das runas e itens (menos o da armadura)
// saem; entra a potência pelo nível.
import type { SkillKey } from './types'

const step = (level: number, levels: number[]) => levels.filter((l) => level >= l).length

export interface AbpBonuses {
    attack: number
    /** Dados dos ataques devastadores (substitui o striking); 1 = sem. */
    dice: number
    defense: number
    perception: number
    save: number
    /** Potências de perícia do nível, da maior para a menor (o jogador escolhe a ordem das perícias). */
    skillSlots: number[]
    apex: boolean
}

/** Potência de perícia por nível (Table 4-11): a distribuição vale inteira, não acumula com a anterior. */
const SKILL_POTENCY: [number, number[]][] = [
    [20, [3, 3, 2, 2, 1, 1]], [17, [3, 2, 2, 1, 1]], [15, [2, 2, 2, 1]], [13, [2, 2, 1]], [9, [2, 1]], [6, [1, 1]], [3, [1]],
]

export function abpAt(level: number): AbpBonuses {
    return {
        attack: step(level, [2, 10, 16]),
        dice: 1 + step(level, [4, 12, 19]),
        defense: step(level, [5, 11, 18]),
        perception: step(level, [7, 13, 19]),
        save: step(level, [8, 14, 20]),
        skillSlots: SKILL_POTENCY.find(([l]) => level >= l)?.[1] ?? [],
        apex: level >= 17,
    }
}

/** Bônus de perícia pela ordem escolhida (a primeira recebe a maior potência). */
export function abpSkillBonus(order: string[], slots: number[]): Partial<Record<SkillKey, number>> {
    const out: Partial<Record<SkillKey, number>> = {}
    order.slice(0, slots.length).forEach((ref, i) => {
        if (ref.startsWith('skill:')) out[ref.slice(6) as SkillKey] = slots[i]
    })
    return out
}
