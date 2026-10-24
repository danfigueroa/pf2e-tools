// As contas do histórico de rolagens, a partir das rolagens (`TableRoll`).
//
// O app NÃO sabe a CA do alvo nem se o golpe acertou: o cartão mostra acerto e
// crítico juntos (decisão do usuário). Por isso "dano" aqui é o dano ROLADO no
// acerto — o que o jogador teria causado se acertasse —, nunca "dano causado".
// Persistente fica de fora (já fica de fora do `damage.total`).
//
// Duas camadas: `summarize` resume as rolagens por (dia de jogo, pessoa) —
// `DaySummary`, o mesmo formato que o banco devolve para o histórico inteiro
// (`diary_summary`, e `summarizeRolls` no fallback de `roll-store.js`) — e
// `mergePeople` soma os dias numa linha por pessoa. A sessão aberta e a mesa
// inteira passam pelas MESMAS contas; só muda de onde vêm os resumos.

import { rayTotal, type TableRoll } from '../../dice/tableRoll'
import { diaryDayOf } from '../../services/diary'

/** Uma rolagem marcante: o total, o título ("Golpe — Warhammer") e quando foi. */
export interface Mark {
    total: number
    title: string
    at: number
}

/** O que uma pessoa rolou num dia de jogo. */
export interface DaySummary {
    /** `YYYY-MM-DD`, o dia de jogo (6h às 6h em Brasília). */
    day: string
    /** O slug quando a rolagem veio de uma ficha; senão `nome:` + o nome livre do rolador do mapa. */
    key: string
    name: string
    color: string
    rolls: number
    /** Testes de d20 (cada raio de um Blazing Bolt conta como um). */
    checks: number
    d20Sum: number
    nat20: number
    nat1: number
    mythic: number
    /** Dano rolado no acerto, somado. */
    damage: number
    /** Quantas vezes cada face do d20 saiu (`hist[0]` é o 1). */
    hist: number[]
    best: Mark | null
    worst: Mark | null
    biggestHit: Mark | null
}

/** Uma noite de alguém, para os troféus de sessão ("a noite mais azarada"). */
export interface Night {
    day: string
    rolls: number
    checks: number
    d20Sum: number
    nat20: number
    nat1: number
}

export interface PersonStats {
    key: string
    name: string
    slug: string | null
    color: string
    rolls: number
    checks: number
    d20Sum: number
    nat20: number
    nat1: number
    mythic: number
    damage: number
    hist: number[]
    /** O maior e o menor total de um teste, e o maior dano numa rolagem. */
    best: Mark | null
    worst: Mark | null
    biggestHit: Mark | null
    /** As noites em que rolou, da mais antiga para a mais nova. */
    nights: Night[]
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

export const keyOf = (roll: TableRoll) => roll.slug || `nome:${(roll.by || 'Alguém').trim().toLowerCase()}`

const slugOf = (key: string) => (key.startsWith('nome:') ? null : key)

const emptyHist = () => new Array<number>(20).fill(0)

/** As rolagens (em ordem) resumidas por (dia, pessoa), ordenadas por dia e chave — como o banco. */
export function summarize(rolls: TableRoll[]): DaySummary[] {
    const rows = new Map<string, DaySummary>()
    for (const roll of rolls) {
        const day = diaryDayOf(roll.at)
        const key = keyOf(roll)
        const id = `${day}|${key}`
        let s = rows.get(id)
        if (!s) {
            s = {
                day, key, name: roll.by || 'Alguém', color: roll.color,
                rolls: 0, damage: 0, checks: 0, d20Sum: 0, nat20: 0, nat1: 0, mythic: 0,
                hist: emptyHist(), best: null, worst: null, biggestHit: null,
            }
            rows.set(id, s)
        }
        s.rolls++
        const checks = checksOf(roll)
        for (const c of checks) {
            s.checks++
            s.d20Sum += c.d20
            s.hist[c.d20 - 1]++
            if (c.d20 === 20) s.nat20++
            if (c.d20 === 1) s.nat1++
            if (!s.best || c.total > s.best.total) s.best = { total: c.total, title: roll.title, at: roll.at }
            if (!s.worst || c.total < s.worst.total) s.worst = { total: c.total, title: roll.title, at: roll.at }
        }
        // O ✦ é um gasto por rolagem, mesmo com vários raios.
        if (checks.some((c) => c.mythic)) s.mythic++
        const dmg = damageOf(roll)
        if (dmg > 0) {
            s.damage += dmg
            if (!s.biggestHit || dmg > s.biggestHit.total) s.biggestHit = { total: dmg, title: roll.title, at: roll.at }
        }
    }
    return [...rows.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

const higher = (a: Mark | null, b: Mark | null) => (b && (!a || b.total > a.total) ? b : a)
const lower = (a: Mark | null, b: Mark | null) => (b && (!a || b.total < a.total) ? b : a)

/**
 * Os dias somados numa linha por pessoa, quem mais rolou primeiro. Nome e cor
 * são os da noite mais recente; em empate, a rolagem marcante é a mais antiga.
 */
export function mergePeople(rows: DaySummary[]): PersonStats[] {
    const people = new Map<string, PersonStats>()
    const ordered = [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    for (const s of ordered) {
        let p = people.get(s.key)
        if (!p) {
            p = {
                key: s.key, name: s.name, slug: slugOf(s.key), color: s.color,
                rolls: 0, checks: 0, d20Sum: 0, nat20: 0, nat1: 0, mythic: 0, damage: 0,
                hist: emptyHist(), best: null, worst: null, biggestHit: null, nights: [],
            }
            people.set(s.key, p)
        }
        p.name = s.name
        p.color = s.color
        p.rolls += s.rolls
        p.checks += s.checks
        p.d20Sum += s.d20Sum
        p.nat20 += s.nat20
        p.nat1 += s.nat1
        p.mythic += s.mythic
        p.damage += s.damage
        s.hist.forEach((n, i) => { p.hist[i] += n })
        p.best = higher(p.best, s.best)
        p.worst = lower(p.worst, s.worst)
        p.biggestHit = higher(p.biggestHit, s.biggestHit)
        p.nights.push({ day: s.day, rolls: s.rolls, checks: s.checks, d20Sum: s.d20Sum, nat20: s.nat20, nat1: s.nat1 })
    }
    return [...people.values()].sort((a, b) => b.rolls - a.rolls || a.name.localeCompare(b.name))
}

/** O resumo de cada pessoa num conjunto de rolagens (a sessão aberta). */
export const personStats = (rolls: TableRoll[]): PersonStats[] => mergePeople(summarize(rolls))

/** Média do d20, com uma casa: o número que a mesa usa para dizer que o dado está viciado. */
export const d20Average = (p: { checks: number; d20Sum: number }) =>
    (p.checks > 0 ? Math.round((p.d20Sum / p.checks) * 10) / 10 : null)

export interface TableTotals {
    sessions: number
    people: number
    rolls: number
    checks: number
    d20Sum: number
    nat20: number
    nat1: number
    mythic: number
    damage: number
    hist: number[]
}

/** Os números da mesa inteira no conjunto de resumos. */
export function tableTotals(rows: DaySummary[]): TableTotals {
    const t: TableTotals = { sessions: 0, people: 0, rolls: 0, checks: 0, d20Sum: 0, nat20: 0, nat1: 0, mythic: 0, damage: 0, hist: emptyHist() }
    const days = new Set<string>()
    const keys = new Set<string>()
    for (const s of rows) {
        days.add(s.day)
        keys.add(s.key)
        t.rolls += s.rolls
        t.checks += s.checks
        t.d20Sum += s.d20Sum
        t.nat20 += s.nat20
        t.nat1 += s.nat1
        t.mythic += s.mythic
        t.damage += s.damage
        s.hist.forEach((n, i) => { t.hist[i] += n })
    }
    t.sessions = days.size
    t.people = keys.size
    return t
}

export interface SessionPoint {
    day: string
    rolls: number
    checks: number
    d20Sum: number
    nat20: number
    nat1: number
    people: number
}

/** Uma linha por sessão, da mais antiga para a mais nova (a linha do tempo). */
export function sessionSeries(rows: DaySummary[]): SessionPoint[] {
    const days = new Map<string, SessionPoint>()
    for (const s of rows) {
        let d = days.get(s.day)
        if (!d) {
            d = { day: s.day, rolls: 0, checks: 0, d20Sum: 0, nat20: 0, nat1: 0, people: 0 }
            days.set(s.day, d)
        }
        d.rolls += s.rolls
        d.checks += s.checks
        d.d20Sum += s.d20Sum
        d.nat20 += s.nat20
        d.nat1 += s.nat1
        d.people++
    }
    return [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1))
}
