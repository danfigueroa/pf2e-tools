// Diário da sessão: as rolagens de cada dia de jogo (api/_lib/roll-store.js,
// `diary_days` e `diary_rolls`). O dia de jogo vai das 6h às 6h no horário de
// Brasília — uma sessão que passa da meia-noite continua sendo uma só.

import { stateApi } from './mesa'
import { sanitizeTableRoll, type TableRoll } from '../dice/tableRoll'

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

const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia de jogo de um instante — o mesmo `diary_day` do banco. */
export const diaryDayOf = (at: number) => DAY_FMT.format(new Date(at - 6 * 60 * 60 * 1000))
