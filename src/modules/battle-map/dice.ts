// Rolador de dados do mapa: o que se rola, o que viaja pela mesa e a validação
// do que chega. A rolagem em si é a do módulo de Iniciativa (`dice.ts`), o
// único ponto do app que sorteia número.

import { rollFormulaDetailed } from '../initiative-tracker/dice'

export const DICE = [4, 6, 8, 10, 12, 20, 100] as const
export type DieFaces = (typeof DICE)[number]

/** Mesmo teto de `parseFormula`; também mantém a rolagem longe dos 8 KB do campo. */
export const MAX_DICE = 100
export const MAX_BONUS = 999

/** Quanto tempo a rolagem fica no mapa — sobra para o poll dos outros (1,5 s) pegá-la. */
export const ROLL_LIFETIME_MS = 8000

export interface SharedRoll {
    /** Quem rolou (texto livre, sem login). */
    by: string
    faces: number
    rolls: number[]
    flat: number
    total: number
    /** Cor do corpo do dado (hex de `DRAW_COLORS`). */
    color: string
}

export const clampCount = (n: number): number => Math.min(MAX_DICE, Math.max(1, Math.round(n) || 1))
export const clampBonus = (n: number): number => Math.min(MAX_BONUS, Math.max(-MAX_BONUS, Math.round(n) || 0))

/** `3d6 + 4`, `1d20 − 2`, `8d10`. */
export function formulaText(count: number, faces: number, bonus: number): string {
    const sign = bonus > 0 ? ` + ${bonus}` : bonus < 0 ? ` − ${Math.abs(bonus)}` : ''
    return `${count}d${faces}${sign}`
}

export function rollDice(count: number, faces: DieFaces, bonus: number, by: string, color: string): SharedRoll {
    const detail = rollFormulaDetailed(`${count}d${faces}${bonus ? (bonus > 0 ? '+' : '') + bonus : ''}`)
    // `parseFormula` só recusa o que a UI já limita; o `?? ` é rede de segurança.
    const rolls = detail?.rolls ?? []
    return { by, faces, rolls, flat: bonus, total: detail?.total ?? 0, color }
}

/** Texto do resultado para leitor de tela e memorial: "3d6 + 4 = 17". */
export const rollSummary = (r: SharedRoll): string => `${formulaText(r.rolls.length, r.faces, r.flat)} = ${r.total}`

const HEX = /^#[0-9a-fA-F]{6}$/

/** O que vem da rede é dado, não código: valida tudo antes de desenhar. */
export function sanitizeRoll(raw: unknown): SharedRoll | null {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const faces = r.faces
    if (typeof faces !== 'number' || !(DICE as readonly number[]).includes(faces)) return null
    if (!Array.isArray(r.rolls) || r.rolls.length < 1 || r.rolls.length > MAX_DICE) return null
    if (!r.rolls.every((v) => Number.isInteger(v) && v >= 1 && v <= faces)) return null
    if (!Number.isInteger(r.flat) || !Number.isInteger(r.total)) return null
    if (typeof r.color !== 'string' || !HEX.test(r.color)) return null
    const by = typeof r.by === 'string' ? r.by.slice(0, 24) : ''
    return { by, faces, rolls: r.rolls as number[], flat: r.flat as number, total: r.total as number, color: r.color }
}

/** Cor do número sobre o corpo do dado: preto nos claros, branco nos escuros (YIQ). */
export function inkOn(hex: string): string {
    const n = parseInt(hex.slice(1), 16)
    const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000
    return yiq >= 150 ? '#1A1A1A' : '#FFFFFF'
}
