// Os troféus do histórico de rolagens: quem tirou mais 20, o mais azarado, o
// maior golpe… Valem para a sessão aberta e para a mesa inteira — a lista é a
// mesma, só muda o mínimo de testes das médias e as que só fazem sentido em
// várias noites.
//
// **Empate não elege ninguém** (decisão do usuário): "o mais azarado" com 1 a 1
// não é destaque. O vice só aparece quando há um vencedor.

import { d20Average, type Mark, type Night, type PersonStats } from './stats'

export type Scope = 'session' | 'table'

export type AwardTone = 'gold' | 'bad' | 'mythic' | 'green'

export interface AwardDef {
    id: string
    title: string
    /** A frase do cartão: o que o troféu mede, com graça. */
    blurb: string
    tone: AwardTone
    /** Só na mesa inteira (precisa de várias noites). */
    tableOnly?: boolean
}

export interface AwardEntry {
    person: PersonStats
    value: number
    /** "7×", "14,2", "48". */
    label: string
    /** A rolagem ou a noite: "Golpe — Warhammer", "sex., 17/10". */
    detail?: string
    /** O dia de jogo quando o troféu é de uma noite (o cartão abre a sessão). */
    day?: string
}

export interface Award extends AwardDef {
    winner: AwardEntry | null
    runnerUp: AwardEntry | null
    /** Empate no primeiro lugar: quem empatou (ninguém leva, mas o cartão diz quem dividiu). */
    tie: { names: string[]; label: string } | null
}

/** Mínimo de testes de d20 para uma média valer: com 3 testes, qualquer um é "o dado quente". */
export const MIN_CHECKS: Record<Scope, number> = { session: 8, table: 20 }
/** Mínimo de testes numa noite para ela concorrer a "noite de glória". */
export const MIN_NIGHT_CHECKS = 10

const count = (n: number) => `${n}×`
const decimal = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const shortDay = (day: string) =>
    new Date(`${day}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

interface Candidate {
    person: PersonStats
    value: number
    detail?: string
    day?: string
}

/** O primeiro e o segundo; `null` se o primeiro empata. `better` é a direção boa do troféu. */
type Ranked = Pick<Award, 'winner' | 'runnerUp' | 'tie'>

function rank(list: Candidate[], better: 'max' | 'min', label: (n: number) => string): Ranked {
    const sorted = [...list].sort((a, b) => (better === 'max' ? b.value - a.value : a.value - b.value))
    const entry = (c: Candidate | undefined): AwardEntry | null =>
        (c ? { person: c.person, value: c.value, label: label(c.value), detail: c.detail, day: c.day } : null)
    if (sorted.length === 0) return { winner: null, runnerUp: null, tie: null }
    if (sorted.length > 1 && sorted[0].value === sorted[1].value) {
        const names = sorted.filter((c) => c.value === sorted[0].value).map((c) => c.person.name)
        return { winner: null, runnerUp: null, tie: { names, label: label(sorted[0].value) } }
    }
    return { winner: entry(sorted[0]), runnerUp: entry(sorted[1]), tie: null }
}

const byCount = (people: PersonStats[], pick: (p: PersonStats) => number) =>
    people.map((person) => ({ person, value: pick(person) })).filter((c) => c.value > 0)

const byMark = (people: PersonStats[], pick: (p: PersonStats) => Mark | null) =>
    people.flatMap((person) => {
        const m = pick(person)
        return m ? [{ person, value: m.total, detail: m.title }] : []
    })

const nightAverage = (n: Night) => n.d20Sum / n.checks

function byNight(people: PersonStats[], better: 'max' | 'min'): Candidate[] {
    // Cada pessoa concorre com a SUA melhor (ou pior) noite: senão o vice seria a outra noite do vencedor.
    return people.flatMap((person) => {
        const nights = person.nights.filter((n) => n.checks >= MIN_NIGHT_CHECKS)
        if (nights.length === 0) return []
        const pick = nights.reduce((a, b) => {
            const d = nightAverage(b) - nightAverage(a)
            return (better === 'max' ? d > 0 : d < 0) ? b : a
        })
        return [{ person, value: Math.round(nightAverage(pick) * 10) / 10, detail: `${shortDay(pick.day)}, em ${pick.checks} testes`, day: pick.day }]
    })
}

export const AWARDS: AwardDef[] = [
    { id: 'blessed', title: 'Abençoado pelos dados', blurb: 'Quem tirou 20 no d20 mais vezes', tone: 'gold' },
    { id: 'cursed', title: 'Amaldiçoado', blurb: 'Quem tirou 1 no d20 mais vezes', tone: 'bad' },
    { id: 'hot', title: 'Dado quente', blurb: 'Quem tira os números mais altos no d20, em média', tone: 'gold' },
    { id: 'cold', title: 'Nuvem negra', blurb: 'Quem tira os números mais baixos no d20, em média', tone: 'bad' },
    { id: 'legend', title: 'Teste lendário', blurb: 'O maior resultado de um teste (d20 + bônus)', tone: 'green' },
    { id: 'stumble', title: 'Tropeço épico', blurb: 'O menor resultado de um teste (d20 + bônus)', tone: 'bad' },
    { id: 'smash', title: 'Golpe do século', blurb: 'O maior dano rolado de uma vez só', tone: 'green' },
    { id: 'engine', title: 'Máquina de dano', blurb: 'Quem mais rolou dano, somando tudo', tone: 'green' },
    { id: 'gunner', title: 'Metralhadora', blurb: 'Quem mais rolou dados', tone: 'green' },
    { id: 'mythic', title: 'Toque do destino', blurb: 'Quem mais gastou Pontos Míticos (✦) para rolar', tone: 'mythic' },
    { id: 'glory', title: 'Noite de glória', blurb: 'A noite de alguém com a maior média no d20', tone: 'gold', tableOnly: true },
    { id: 'doom', title: 'Noite do apocalipse', blurb: 'A noite de alguém com a menor média no d20', tone: 'bad', tableOnly: true },
]

/** Os troféus do escopo, na ordem de `AWARDS`; os sem vencedor ficam (o cartão diz "ninguém ainda" ou quem empatou). */
export function computeAwards(people: PersonStats[], scope: Scope): Award[] {
    const min = MIN_CHECKS[scope]
    const avg = (better: 'max' | 'min') => rank(
        people.filter((p) => p.checks >= min).map((person) => ({ person, value: d20Average(person) ?? 0, detail: `em ${person.checks} testes` })),
        better, decimal,
    )
    const results: Record<string, Ranked> = {
        blessed: rank(byCount(people, (p) => p.nat20), 'max', count),
        cursed: rank(byCount(people, (p) => p.nat1), 'max', count),
        hot: avg('max'),
        cold: avg('min'),
        legend: rank(byMark(people, (p) => p.best), 'max', String),
        stumble: rank(byMark(people, (p) => p.worst), 'min', String),
        smash: rank(byMark(people, (p) => p.biggestHit), 'max', String),
        engine: rank(byCount(people, (p) => p.damage), 'max', (n) => n.toLocaleString('pt-BR')),
        gunner: rank(byCount(people, (p) => p.rolls), 'max', String),
        mythic: rank(byCount(people, (p) => p.mythic), 'max', count),
        glory: rank(byNight(people, 'max'), 'max', decimal),
        doom: rank(byNight(people, 'min'), 'min', decimal),
    }
    return AWARDS.filter((a) => scope === 'table' || !a.tableOnly).map((a) => ({ ...a, ...results[a.id] }))
}

/** As métricas do ranking (o seletor de chips). `value` null = fora do ranking (média sem testes suficientes). */
export interface Metric {
    id: string
    label: string
    value: (p: PersonStats, scope: Scope) => number | null
    format: (n: number) => string
    tone: AwardTone
}

export const METRICS: Metric[] = [
    { id: 'nat20', label: 'Vezes que tirou 20', value: (p) => p.nat20, format: String, tone: 'gold' },
    { id: 'nat1', label: 'Vezes que tirou 1', value: (p) => p.nat1, format: String, tone: 'bad' },
    { id: 'avg', label: 'Média no d20', value: (p, scope) => (p.checks >= MIN_CHECKS[scope] ? d20Average(p) : null), format: decimal, tone: 'gold' },
    { id: 'damage', label: 'Dano rolado', value: (p) => p.damage, format: (n) => n.toLocaleString('pt-BR'), tone: 'green' },
    { id: 'rolls', label: 'Rolagens feitas', value: (p) => p.rolls, format: String, tone: 'green' },
    { id: 'mythic', label: 'Pontos Míticos gastos', value: (p) => p.mythic, format: String, tone: 'mythic' },
]
