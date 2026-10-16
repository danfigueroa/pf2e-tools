// Rolador de dados do mapa: o que se rola. A rolagem vai para o feed da mesa
// (`services/rolls.ts`) como qualquer outra — a da ficha inclusive —, e todo
// aparelho a vê pelo `RollFeedLayer` do layout, no mapa ou fora dele.

import { rollGroups } from '../../dice/roll'
import { newRollId, type TableRoll } from '../../dice/tableRoll'

export const DICE = [4, 6, 8, 10, 12, 20, 100] as const
export type DieFaces = (typeof DICE)[number]

/** Mesmo teto de `parseFormula`; também mantém a rolagem longe dos 8 KB do campo. */
export const MAX_DICE = 100
export const MAX_BONUS = 999

export const clampCount = (n: number): number => Math.min(MAX_DICE, Math.max(1, Math.round(n) || 1))
export const clampBonus = (n: number): number => Math.min(MAX_BONUS, Math.max(-MAX_BONUS, Math.round(n) || 0))

/** `3d6 + 4`, `1d20 − 2`, `8d10`. */
export function formulaText(count: number, faces: number, bonus: number): string {
    const sign = bonus > 0 ? ` + ${bonus}` : bonus < 0 ? ` − ${Math.abs(bonus)}` : ''
    return `${count}d${faces}${sign}`
}

export function rollDice(count: number, faces: DieFaces, bonus: number, by: string, color: string): TableRoll {
    const rolled = rollGroups([{ count, faces }], bonus)
    return {
        id: newRollId(),
        at: Date.now(),
        by,
        color,
        title: formulaText(count, faces, bonus),
        free: { label: '', dice: rolled.dice, flat: rolled.flat, total: rolled.total },
    }
}
