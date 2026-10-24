import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
    Box,
    Button,
    Chip,
    Container,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Skeleton,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import { HistoryRow } from '../../components/RollFeed'
import { diaryDayOf, fetchDiaryDays, fetchDiaryRolls, fetchDiarySummary, type DiaryDay } from '../../services/diary'
import { onFeedActivity } from '../../services/rolls'
import type { TableRoll } from '../../dice/tableRoll'
import { gold } from '../../theme'
import { computeAwards, type Scope } from './awards'
import { keyOf, mergePeople, sessionSeries, summarize, tableTotals, type DaySummary } from './stats'
import { AwardGrid } from './components/AwardGrid'
import { D20Histogram } from './components/D20Histogram'
import { Leaderboard } from './components/Leaderboard'
import { PersonCard } from './components/PersonCard'
import { SessionTimeline } from './components/SessionTimeline'
import { StatCounters } from './components/StatCounters'

const dayLabel = (day: string) =>
    new Date(`${day}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })

const timeLabel = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Quantas rolagens a lista desenha de cada vez: uma noite longa passa de mil. */
const PAGE = 50

/**
 * Histórico de rolagens (`/historico`; era o "Diário da sessão", em `/diario`). Duas visões:
 * - **Todas as sessões**: os troféus, o ranking, o d20 e a linha do tempo de TODAS as sessões, a partir do
 *   resumo por (dia, pessoa) que o banco monta (`diary_summary`) — as rolagens em si não descem.
 * - **Uma sessão**: um dia de jogo (6h às 6h, `services/diary`), com os troféus da noite, cada personagem e
 *   a lista de rolagens.
 * Aberta durante a sessão, a página acompanha as rolagens novas.
 */
export const SessionDiaryPage = () => {
    const [days, setDays] = useState<DiaryDay[] | null>(null)
    const [summary, setSummary] = useState<DaySummary[] | null>(null)
    const [scope, setScope] = useState<Scope | null>(null)
    const [day, setDay] = useState<string | null>(null)
    const [rolls, setRolls] = useState<TableRoll[] | null>(null)
    const [failed, setFailed] = useState(false)
    const [who, setWho] = useState<string | null>(null)
    const [visible, setVisible] = useState(PAGE)

    useEffect(() => {
        let cancelled = false
        void fetchDiaryDays().then((list) => {
            if (cancelled) return
            if (!list) { setFailed(true); setDays([]); return }
            setDays(list)
            setDay((current) => current ?? list[0]?.day ?? null)
            // Com rolagem hoje, a mesa está jogando: abre na sessão. Senão, no histórico da mesa.
            setScope((current) => current ?? (list[0]?.day === diaryDayOf(Date.now()) ? 'session' : 'table'))
        })
        void fetchDiarySummary().then((rows) => { if (!cancelled) setSummary(rows ?? []) })
        return () => { cancelled = true }
    }, [])

    const dayRef = useRef(day)
    dayRef.current = day
    const sessionOpen = scope === 'session'
    useEffect(() => {
        if (!day || !sessionOpen) return
        let cancelled = false
        setRolls(null)
        setWho(null)
        setVisible(PAGE)
        void fetchDiaryRolls(day).then((list) => {
            if (cancelled) return
            if (!list) setFailed(true)
            setRolls(list ?? [])
        })
        return () => { cancelled = true }
    }, [day, sessionOpen])

    // Rolagem nova na mesa: relê os dias e o resumo e, se é a sessão de hoje que está aberta, as rolagens
    // (com junção — uma rodada rola muito).
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null
        const stop = onFeedActivity(() => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                const today = diaryDayOf(Date.now())
                void fetchDiaryDays().then((list) => { if (list) setDays(list) })
                void fetchDiarySummary().then((rows) => { if (rows) setSummary(rows) })
                if (dayRef.current === today) {
                    void fetchDiaryRolls(today).then((list) => { if (list && dayRef.current === today) setRolls(list) })
                } else if (dayRef.current === null) {
                    setDay(today)
                }
            }, 1200)
        })
        return () => { stop(); if (timer) clearTimeout(timer) }
    }, [])

    // Todas as sessões.
    const tablePeople = useMemo(() => mergePeople(summary ?? []), [summary])
    const tableAwards = useMemo(() => computeAwards(tablePeople, 'table'), [tablePeople])
    const tableSum = useMemo(() => tableTotals(summary ?? []), [summary])
    const series = useMemo(() => sessionSeries(summary ?? []), [summary])

    // A sessão aberta.
    const sessionRows = useMemo(() => summarize(rolls ?? []), [rolls])
    const people = useMemo(() => mergePeople(sessionRows), [sessionRows])
    const sessionAwards = useMemo(() => computeAwards(people, 'session'), [people])
    const sessionSum = useMemo(() => tableTotals(sessionRows), [sessionRows])
    const filtered = useMemo(() => {
        const list = rolls ?? []
        const mine = who ? list.filter((r) => keyOf(r) === who) : list
        // A mais recente primeiro: no meio da sessão, é a que se quer conferir.
        return [...mine].reverse()
    }, [rolls, who])
    const info = days?.find((d) => d.day === day) ?? null

    const openDay = useCallback((d: string) => {
        setDay(d)
        setScope('session')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    return (
        <Container maxWidth="lg" disableGutters sx={{ pb: 4 }}>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Histórico de rolagens
            </Typography>
            <Box sx={{ height: 2, width: { xs: 120, sm: 180 }, backgroundColor: gold.main, mb: 2 }} />

            {days === null ? (
                <Skeleton variant="rounded" height={40} sx={{ maxWidth: 420 }} />
            ) : days.length === 0 ? (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {failed ? 'Não deu para ler o histórico. Confira a conexão e recarregue.' : 'Nenhuma rolagem na mesa ainda. As da próxima sessão aparecem aqui.'}
                </Typography>
            ) : (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2.5 }}>
                    <ToggleButtonGroup
                        exclusive size="small" color="primary" value={scope}
                        onChange={(_, v: Scope | null) => { if (v) setScope(v) }}
                        aria-label="O que ver"
                    >
                        <ToggleButton value="table" sx={{ px: 2 }}>Todas as sessões</ToggleButton>
                        <ToggleButton value="session" sx={{ px: 2 }}>Uma sessão</ToggleButton>
                    </ToggleButtonGroup>
                    {scope === 'session' && (
                        <>
                            <FormControl size="small" sx={{ flex: '1 1 240px', maxWidth: 420 }}>
                                <InputLabel id="diary-day">Sessão</InputLabel>
                                <Select labelId="diary-day" label="Sessão" value={day ?? ''} onChange={(e) => setDay(String(e.target.value))}>
                                    {days.map((d) => (
                                        <MenuItem key={d.day} value={d.day}>
                                            {dayLabel(d.day)} · {d.count} {d.count === 1 ? 'rolagem' : 'rolagens'}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {info && (
                                <Typography variant="body2" color="text.secondary">
                                    {timeLabel(info.first)}–{timeLabel(info.last)} · {info.people} {info.people === 1 ? 'pessoa rolou' : 'pessoas rolaram'}
                                </Typography>
                            )}
                        </>
                    )}
                </Box>
            )}

            {scope === 'table' && (summary === null ? <Skeleton variant="rounded" height={220} /> : summary.length > 0 && (
                <Stack spacing={3.5}>
                    <StatCounters totals={tableSum} scope="table" />
                    <Section title="Hall da fama" hint="Somando todas as sessões da mesa.">
                        <AwardGrid awards={tableAwards} onOpenDay={openDay} />
                    </Section>
                    <Section title="Ranking" hint="Escolha o que comparar.">
                        <Leaderboard people={tablePeople} scope="table" />
                    </Section>
                    <Section title="O d20 é justo?">
                        <D20Histogram people={tablePeople} tableHist={tableSum.hist} />
                    </Section>
                    <Section title="Sessão a sessão">
                        <SessionTimeline series={series} onOpenDay={openDay} />
                    </Section>
                    <DamageNote />
                </Stack>
            ))}

            {scope === 'session' && day && rolls === null && <Skeleton variant="rounded" height={220} />}

            {scope === 'session' && rolls && rolls.length > 0 && (
                <Stack spacing={3.5}>
                    <StatCounters totals={sessionSum} scope="session" />
                    <Section title="Destaques da noite">
                        <AwardGrid awards={sessionAwards} />
                    </Section>
                    <Section title="Por personagem">
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1.5 }}>
                            {people.map((p, i) => <PersonCard key={p.key} person={p} index={i} />)}
                        </Box>
                    </Section>
                    <Section title="O d20 da noite">
                        <D20Histogram people={people} tableHist={sessionSum.hist} />
                    </Section>
                    <Section title="Rolagens">
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                            <Chip label={`Todos · ${rolls.length}`} onClick={() => { setWho(null); setVisible(PAGE) }} color={who === null ? 'primary' : 'default'} variant={who === null ? 'filled' : 'outlined'} />
                            {people.map((p) => (
                                <Chip key={p.key} label={`${p.name} · ${p.rolls}`} onClick={() => { setWho(p.key); setVisible(PAGE) }}
                                    color={who === p.key ? 'primary' : 'default'} variant={who === p.key ? 'filled' : 'outlined'} />
                            ))}
                        </Stack>
                        <Paper variant="outlined" sx={{ px: 2 }}>
                            <Stack divider={<Divider flexItem />}>
                                {filtered.slice(0, visible).map((r) => <HistoryRow key={r.id} roll={r} />)}
                            </Stack>
                        </Paper>
                        {filtered.length > visible && (
                            <Button onClick={() => setVisible((v) => v + PAGE)} sx={{ mt: 1 }}>
                                Mostrar mais ({filtered.length - visible} restantes)
                            </Button>
                        )}
                    </Section>
                    <DamageNote />
                </Stack>
            )}
        </Container>
    )
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
    <Box component="section">
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>{title}</Typography>
            {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
        </Box>
        {children}
    </Box>
)

const DamageNote = () => (
    <Typography variant="caption" color="text.secondary">
        O dano soma tudo o que foi rolado, mesmo quando o golpe errou: o app não sabe se acertou. Dano persistente não entra.
    </Typography>
)
