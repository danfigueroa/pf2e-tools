// Os dados extras de dano que o jogador digita no diálogo de rolagem: "2d6", "1d8+1d4".
//
// O fixo continua no ajuste numérico do lado; aqui só dados. As faces são as que a mesa aceita
// (`DICE_FACES`): um "1d7" passaria pelo `parseDiceExpr`, mas os dois validadores do feed recusariam a
// rolagem INTEIRA — melhor dizer na hora, no campo.

import { DICE_FACES } from './tableRoll'
import { parseDiceExpr, type DiceExpr } from './roll'
import { tr } from '../i18n'

/** Teto de dados num campo: acima disso é digitação errada, e o feed tem um teto de dados por rolagem. */
export const MAX_EXTRA_DICE = 20

export type ExtraDiceResult =
    | { ok: true; expr: DiceExpr | null }
    | { ok: false; error: string }

/** Lê o campo. Vazio = sem dados extras (`expr: null`). */
export function parseExtraDice(text: string): ExtraDiceResult {
    const src = String(text ?? '').trim().toLowerCase().replace(/\s+/g, '')
    if (!src) return { ok: true, expr: null }
    const expr = parseDiceExpr(src)
    if (!expr || expr.groups.length === 0) return { ok: false, error: tr('Escreva dados, como 2d6 ou 1d8+1d4.', 'Type dice, like 2d6 or 1d8+1d4.') }
    if (expr.flat !== 0) return { ok: false, error: tr('Só dados aqui; o número fixo vai no ajuste.', 'Dice only here; the flat number goes in the adjustment.') }
    const bad = expr.groups.find((g) => !(DICE_FACES as readonly number[]).includes(g.faces))
    if (bad) return { ok: false, error: tr(`d${bad.faces} não existe na mesa (d4, d6, d8, d10, d12, d20, d100).`, `d${bad.faces} isn't a table die (d4, d6, d8, d10, d12, d20, d100).`) }
    const count = expr.groups.reduce((n, g) => n + g.count, 0)
    if (count > MAX_EXTRA_DICE) return { ok: false, error: tr(`No máximo ${MAX_EXTRA_DICE} dados.`, `At most ${MAX_EXTRA_DICE} dice.`) }
    // Mesmo tamanho junto: "1d6+1d6" vira 2d6.
    const merged = new Map<number, number>()
    for (const g of expr.groups) merged.set(g.faces, (merged.get(g.faces) ?? 0) + g.count)
    return { ok: true, expr: { groups: [...merged].map(([faces, n]) => ({ count: n, faces })), flat: 0 } }
}

/** "2d6+1d4" — para rótulo e memorial. */
export const extraDiceText = (expr: DiceExpr): string => expr.groups.map((g) => `${g.count}d${g.faces}`).join('+')
