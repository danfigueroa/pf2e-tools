// Diário da sessão: as rolagens de cada dia de jogo (api/_lib/roll-store.js,
// `diary_days` e `diary_rolls`). O dia de jogo vai das 6h às 6h no horário de
// Brasília — uma sessão que passa da meia-noite continua sendo uma só.

import { stateApi } from './mesa'
import { sanitizeTableRoll, type TableRoll } from '../dice/tableRoll'
import type { DaySummary, Mark } from '../modules/session-diary/stats'

export interface DiaryDay {
    /** `YYYY-MM-DD`. */
    day: string
    count: number
    first: number
    last: number
    /** Quantos rolaram (personagens ou nomes do rolador do mapa). */
    people: number
}

export async function fetchDiaryDays(): Promise<DiaryDay[] | null> {
    try {
        const r = await fetch(stateApi('?diary=days'))
        if (!r.ok) return null
        const body = await r.json() as { days?: DiaryDay[] }
        return Array.isArray(body.days) ? body.days : null
    } catch {
        return null
    }
}

/** As rolagens do dia, revalidadas como as do feed (o servidor guardou o que validou, mas é a mesma porta). */
export async function fetchDiaryRolls(day: string): Promise<TableRoll[] | null> {
    try {
        const r = await fetch(stateApi(`?diary=${encodeURIComponent(day)}`))
        if (!r.ok) return null
        const body = await r.json() as { rolls?: unknown[] }
        if (!Array.isArray(body.rolls)) return null
        return body.rolls.map(sanitizeTableRoll).filter((x): x is TableRoll => x !== null)
    } catch {
        return null
    }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function mark(v: unknown): Mark | null {
    if (!v || typeof v !== 'object') return null
    const m = v as Record<string, unknown>
    return typeof m.total === 'number' ? { total: m.total, title: typeof m.title === 'string' ? m.title.slice(0, 80) : '', at: num(m.at) } : null
}

function summaryRow(v: unknown): DaySummary | null {
    if (!v || typeof v !== 'object') return null
    const s = v as Record<string, unknown>
    if (typeof s.day !== 'string' || typeof s.key !== 'string' || !Array.isArray(s.hist) || s.hist.length !== 20) return null
    return {
        day: s.day, key: s.key,
        name: typeof s.name === 'string' ? s.name : 'Alguém',
        color: typeof s.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '#5A5044',
        rolls: num(s.rolls), checks: num(s.checks), d20Sum: num(s.d20Sum), nat20: num(s.nat20), nat1: num(s.nat1),
        mythic: num(s.mythic), damage: num(s.damage), hist: s.hist.map(num),
        best: mark(s.best), worst: mark(s.worst), biggestHit: mark(s.biggestHit),
    }
}

/** O histórico da mesa: o resumo de cada pessoa em cada dia de jogo (`diary_summary`), o mais antigo primeiro. */
export async function fetchDiarySummary(): Promise<DaySummary[] | null> {
    try {
        const r = await fetch(stateApi('?diary=summary'))
        if (!r.ok) return null
        const body = await r.json() as { summary?: unknown[] }
        if (!Array.isArray(body.summary)) return null
        return body.summary.map(summaryRow).filter((x): x is DaySummary => x !== null)
    } catch {
        return null
    }
}

const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia de jogo de um instante — o mesmo `diary_day` do banco. */
export const diaryDayOf = (at: number) => DAY_FMT.format(new Date(at - 6 * 60 * 60 * 1000))
