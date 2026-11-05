/**
 * O dinheiro que o jogador acerta na mesa. O JSON do Pathbuilder nunca é editado: a bolsa editada mora num campo à
 * parte (`money`, por personagem), junto com o dinheiro DA FICHA sobre o qual foi editada (`of`) — como o `of` dos
 * consumíveis. Ficha nova com outro dinheiro (o jogador acertou no Pathbuilder e publicou) vence: a edição antiga é
 * ignorada, senão o gasto contaria duas vezes.
 */

export interface Purse {
    pp: number
    gp: number
    sp: number
    cp: number
}

export interface MoneyStored {
    purse: Purse
    of: Purse
}

export const COINS = ['pp', 'gp', 'sp', 'cp'] as const // i18n-ok

/** Teto por moeda: ninguém carrega mais que isso, e o número cabe na linha do celular. */
export const MAX_COIN = 9_999_999

export const NO_PURSE: Purse = { pp: 0, gp: 0, sp: 0, cp: 0 }

const coin = (v: unknown): number | null =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_COIN ? v : null

/** Uma bolsa válida, ou `null`. */
export function sanitizePurse(raw: unknown): Purse | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const r = raw as Record<string, unknown>
    const out = { ...NO_PURSE }
    for (const c of COINS) {
        const v = coin(r[c] ?? 0)
        if (v === null) return null
        out[c] = v
    }
    return out
}

export function sanitizeMoney(raw: unknown): MoneyStored | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const r = raw as Record<string, unknown>
    const purse = sanitizePurse(r.purse)
    const of = sanitizePurse(r.of)
    return purse && of ? { purse, of } : null
}

export const samePurse = (a: Purse, b: Purse) => COINS.every((c) => a[c] === b[c])

/** O dinheiro da ficha, com moeda faltando ou estranha como zero. */
export const sheetPurse = (money: Partial<Purse> | null | undefined): Purse =>
    sanitizePurse({ ...NO_PURSE, ...money }) ?? { ...NO_PURSE }

/** O que vale agora: a edição da mesa, se foi feita sobre este mesmo dinheiro da ficha. */
export function effectivePurse(sheet: Purse, stored: MoneyStored | null): { purse: Purse; edited: boolean } {
    if (stored && samePurse(stored.of, sheet) && !samePurse(stored.purse, sheet)) return { purse: stored.purse, edited: true }
    return { purse: sheet, edited: false }
}

export const purseTotal = (p: Purse) => p.pp + p.gp + p.sp + p.cp
