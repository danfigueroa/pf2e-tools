// As contas do diário da sessão, a partir das rolagens do dia (`TableRoll`).
//
// O app NÃO sabe a CA do alvo nem se o golpe acertou: o cartão mostra acerto e
// crítico juntos (decisão do usuário). Por isso "dano" aqui é o dano ROLADO no
// acerto — o que o jogador teria causado se acertasse —, nunca "dano causado".
// Persistente fica de fora (já fica de fora do `damage.total`).

import { rayTotal, type TableRoll } from '../../dice/tableRoll'

export interface PersonStats {
    /** O slug quando a rolagem veio de uma ficha; senão o nome livre do rolador do mapa. */
    key: string
    name: string
    slug: string | null
    color: string
    rolls: number
    /** Testes de d20 (cada raio de um Blazing Bolt conta como um). */
    checks: number
    d20Sum: number
    nat20: number
    nat1: number
    mythic: number
    /** O maior total de um teste, e qual foi. */
    best: { total: number; title: string } | null
    /** Dano rolado no acerto, somado, e a maior rolagem de dano. */
    damage: number
    biggestHit: { total: number; title: string } | null
}

export interface DiaryHighlights {
    mostNat20: PersonStats | null
    mostNat1: PersonStats | null
    biggestHit: { person: PersonStats; total: number; title: string } | null
    bestCheck: { person: PersonStats; total: number; title: string } | null
}

/** Os testes de d20 de uma rolagem: o do topo, ou um por raio. */
export function checksOf(roll: TableRoll): NonNullable<TableRoll['check']>[] {
    if (roll.rays) return roll.rays.map((r) => r.check)
    return roll.check ? [roll.check] : []
}

/** O dano rolado no acerto de uma rolagem (somados os raios). */
export function damageOf(roll: TableRoll): number {
    if (roll.rays) return rayTotal(roll.rays)
    return roll.damage?.total ?? 0
}

const keyOf = (roll: TableRoll) => roll.slug || `nome:${(roll.by || 'Alguém').trim().toLowerCase()}`

export function personStats(rolls: TableRoll[]): PersonStats[] {
    const people = new Map<string, PersonStats>()
    for (const roll of rolls) {
        const key = keyOf(roll)
        let p = people.get(key)
        if (!p) {
            p = {
                key, name: roll.by || 'Alguém', slug: roll.slug ?? null, color: roll.color,
                rolls: 0, checks: 0, d20Sum: 0, nat20: 0, nat1: 0, mythic: 0, best: null, damage: 0, biggestHit: null,
            }
            people.set(key, p)
        }
        p.rolls++
        for (const c of checksOf(roll)) {
            p.checks++
            p.d20Sum += c.d20
            if (c.d20 === 20) p.nat20++
            if (c.d20 === 1) p.nat1++
            if (!p.best || c.total > p.best.total) p.best = { total: c.total, title: roll.title }
        }
        // O ✦ é um gasto por rolagem, mesmo com vários raios.
        if (checksOf(roll).some((c) => c.mythic)) p.mythic++
        const dmg = damageOf(roll)
        if (dmg > 0) {
            p.damage += dmg
            if (!p.biggestHit || dmg > p.biggestHit.total) p.biggestHit = { total: dmg, title: roll.title }
        }
    }
    // Quem mais rolou primeiro.
    return [...people.values()].sort((a, b) => b.rolls - a.rolls || a.name.localeCompare(b.name))
}

/** Destaques do dia. Empate não elege ninguém: "o mais azarado" com 1 a 1 não é destaque. */
export function highlights(people: PersonStats[]): DiaryHighlights {
    const top = (pick: (p: PersonStats) => number): PersonStats | null => {
        const sorted = people.filter((p) => pick(p) > 0).sort((a, b) => pick(b) - pick(a))
        if (sorted.length === 0) return null
        if (sorted.length > 1 && pick(sorted[0]) === pick(sorted[1])) return null
        return sorted[0]
    }
    let biggestHit: DiaryHighlights['biggestHit'] = null
    let bestCheck: DiaryHighlights['bestCheck'] = null
    for (const p of people) {
        if (p.biggestHit && (!biggestHit || p.biggestHit.total > biggestHit.total)) biggestHit = { person: p, ...p.biggestHit }
        if (p.best && (!bestCheck || p.best.total > bestCheck.total)) bestCheck = { person: p, ...p.best }
    }
    return { mostNat20: top((p) => p.nat20), mostNat1: top((p) => p.nat1), biggestHit, bestCheck }
}

/** Média do d20, com uma casa: o número que a mesa usa para dizer que o dado está viciado. */
export const d20Average = (p: PersonStats) => (p.checks > 0 ? Math.round((p.d20Sum / p.checks) * 10) / 10 : null)
