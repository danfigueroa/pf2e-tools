// Motor de rolagem com vários tipos de dado: "2d8+1d6+4", "1d20+15".
//
// O `initiative-tracker/dice.ts` continua sendo o de UMA fórmula (dano de
// aflição e persistente, cura de poção). Este existe porque um Golpe mistura
// dados — a arma em d8, a runa de choque em d6 — e porque um TESTE não tem piso:
// `rollFormulaDetailed` corta o total em 0, o que é certo para dano e errado
// para um d20 com penalidade. Aqui ninguém corta nada; quem chama decide.

/** `2d8` → `{ count: 2, faces: 8 }`. */
export interface DiceGroup {
    count: number
    faces: number
}

/** Uma expressão lida: os grupos de dados e o fixo, já somado. */
export interface DiceExpr {
    groups: DiceGroup[]
    flat: number
}

/** O resultado com cada dado à mostra, na ordem dos grupos. */
export interface RolledExpr {
    /** Um item por dado, na ordem em que os grupos foram escritos. */
    dice: { faces: number; value: number }[]
    flat: number
    total: number
}

/** Mesmos tetos de `parseFormula`: acima disso é digitação errada, não rolagem. */
export const MAX_DICE_PER_GROUP = 100
export const MAX_FACES = 1000

const TERM_RE = /([+-])?\s*(?:(\d+)\s*d\s*(\d+)|(\d+))/giy

/**
 * Lê "2d8+1d6+4", "1d20 - 2", "3d6", "5". Devolve `null` para qualquer coisa
 * que sobre sem casar — melhor recusar do que rolar metade da fórmula.
 */
export function parseDiceExpr(text: string): DiceExpr | null {
    const src = String(text ?? '').trim()
    if (!src) return null
    const groups: DiceGroup[] = []
    let flat = 0
    let pos = 0
    let first = true
    while (pos < src.length) {
        while (src[pos] === ' ') pos++
        if (pos >= src.length) break
        TERM_RE.lastIndex = pos
        const m = TERM_RE.exec(src)
        if (!m || m.index !== pos) return null
        // Só o primeiro termo pode vir sem sinal; "2d6 3" não é fórmula.
        if (!first && !m[1]) return null
        const sign = m[1] === '-' ? -1 : 1
        if (m[2] !== undefined) {
            const count = parseInt(m[2], 10)
            const faces = parseInt(m[3], 10)
            if (count > MAX_DICE_PER_GROUP || faces > MAX_FACES || faces < 1) return null
            // Dado subtraído não existe em PF2e; recusar evita um total que ninguém confere.
            if (sign < 0) return null
            if (count > 0) groups.push({ count, faces })
        } else {
            flat += sign * parseInt(m[4], 10)
        }
        pos = TERM_RE.lastIndex
        first = false
    }
    if (first) return null
    return { groups, flat }
}

/** Um dado de N faces: 1..N, uniforme. */
export const rollDie = (faces: number): number => 1 + Math.floor(Math.random() * faces)

/** Rola os grupos e soma o fixo. Sem piso — ver o cabeçalho. */
export function rollGroups(groups: DiceGroup[], flat = 0): RolledExpr {
    const dice: RolledExpr['dice'] = []
    for (const g of groups) {
        for (let i = 0; i < g.count; i++) dice.push({ faces: g.faces, value: rollDie(g.faces) })
    }
    return { dice, flat, total: dice.reduce((sum, d) => sum + d.value, flat) }
}

/** Rola uma expressão escrita; `null` se ela não for legível. */
export function rollExpr(text: string): RolledExpr | null {
    const expr = parseDiceExpr(text)
    return expr ? rollGroups(expr.groups, expr.flat) : null
}

/** "2d8+1d6+4", com o fixo omitido quando é zero. */
export function exprText(expr: DiceExpr): string {
    const dice = expr.groups.map((g) => `${g.count}d${g.faces}`).join('+')
    if (!expr.flat) return dice || '0'
    const flat = `${expr.flat > 0 && dice ? '+' : ''}${expr.flat}`
    return `${dice}${flat}`
}

/** Média exata de uma expressão — para conferência e prévia. */
export function exprAverage(expr: DiceExpr): number {
    return expr.groups.reduce((sum, g) => sum + g.count * (g.faces + 1) / 2, expr.flat)
}
