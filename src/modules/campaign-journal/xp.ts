// Orçamento de XP de um encontro, pelo GM Core (pg. 75-76), conferido na AON:
//   Table 10-1: Encounter Budget        (Rules.aspx?ID=2717)
//   Table 10-2: Creature XP and Role    (Rules.aspx?ID=2718)
//   Different Party Sizes               (Rules.aspx?ID=2719)
//
// O orçamento é para QUATRO personagens; cada personagem a mais soma o "Character
// Adjustment" da ameaça, e cada um a menos o tira. Criatura fora de −4…+4 do
// nível do grupo não está na tabela: o planejador avisa e não chuta um número.

export type Threat = 'trivial' | 'low' | 'moderate' | 'severe' | 'extreme'

export const THREATS: readonly Threat[] = ['trivial', 'low', 'moderate', 'severe', 'extreme']

export const THREAT_LABEL: Record<Threat, string> = {
    trivial: 'Trivial', low: 'Baixa', moderate: 'Moderada', severe: 'Severa', extreme: 'Extrema',
}

/** Table 10-1: XP para 4 personagens e o ajuste por personagem a mais ou a menos. */
const BUDGET: Record<Threat, { xp: number; perCharacter: number }> = {
    trivial: { xp: 40, perCharacter: 10 },
    low: { xp: 60, perCharacter: 20 },
    moderate: { xp: 80, perCharacter: 20 },
    severe: { xp: 120, perCharacter: 30 },
    extreme: { xp: 160, perCharacter: 40 },
}

/** Table 10-2, do nível do grupo −4 ao +4. */
const CREATURE_XP: Record<number, number> = { [-4]: 10, [-3]: 15, [-2]: 20, [-1]: 30, 0: 40, 1: 60, 2: 80, 3: 120, 4: 160 }

/** XP de uma criatura para o grupo, ou `null` fora da tabela (mais de 4 níveis de diferença). */
export function creatureXp(creatureLevel: number, partyLevel: number): number | null {
    return CREATURE_XP[creatureLevel - partyLevel] ?? null
}

export function budgetFor(threat: Threat, partySize: number): number {
    const b = BUDGET[threat]
    return Math.max(0, b.xp + (partySize - 4) * b.perCharacter)
}

export interface EncounterXp {
    total: number
    /** A maior ameaça cujo orçamento o encontro alcança (abaixo do Baixo = Trivial). */
    threat: Threat
    /** Criaturas fora da tabela (nome e diferença de nível), que não entraram no total. */
    outOfRange: { name: string; diff: number }[]
    budgets: Record<Threat, number>
}

export function encounterXp(
    creatures: readonly { level: number; name: string; count: number }[],
    partyLevel: number,
    partySize: number,
): EncounterXp {
    let total = 0
    const outOfRange: EncounterXp['outOfRange'] = []
    for (const c of creatures) {
        const xp = creatureXp(c.level, partyLevel)
        if (xp === null) outOfRange.push({ name: c.name, diff: c.level - partyLevel })
        else total += xp * c.count
    }
    const budgets = Object.fromEntries(THREATS.map((t) => [t, budgetFor(t, partySize)])) as Record<Threat, number>
    let threat: Threat = 'trivial'
    for (const t of THREATS) if (t !== 'trivial' && total >= budgets[t]) threat = t
    return { total, threat, outOfRange, budgets }
}

/** O grupo das fichas publicadas: o nível mais comum (empate, o maior) e quantos são. */
export function partyFromLevels(levels: readonly number[]): { level: number; size: number } | null {
    if (levels.length === 0) return null
    const count = new Map<number, number>()
    for (const l of levels) count.set(l, (count.get(l) ?? 0) + 1)
    const [level] = [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]
    return { level, size: levels.length }
}
