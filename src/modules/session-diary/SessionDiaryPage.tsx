import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Box,
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
    Typography,
} from '@mui/material'
import { HistoryRow } from '../../components/RollFeed'
import { TokenBadge } from '../battle-map/components/TokenBadge'
import { diaryDayOf, fetchDiaryDays, fetchDiaryRolls, type DiaryDay } from '../../services/diary'
import { onFeedActivity } from '../../services/rolls'
import type { TableRoll } from '../../dice/tableRoll'
import { gold, MYTHIC_COLOR, status as statusColor } from '../../theme'
import { d20Average, highlights, personStats, type PersonStats } from './stats'

const dayLabel = (day: string) =>
    new Date(`${day}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })

const timeLabel = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/**
 * Diário da sessão (`/diario`): as rolagens de um dia de jogo, com o resumo de cada
 * personagem e os destaques — para o fim da sessão e para conferir o que rolou.
 * O banco guarda toda rolagem; o dia de jogo vai das 6h às 6h (`services/diary`).
 * Aberto durante a sessão, o dia de hoje acompanha as rolagens novas.
 */
export const SessionDiaryPage = () => {
    const [days, setDays] = useState<DiaryDay[] | null>(null)
    const [day, setDay] = useState<string | null>(null)
    const [rolls, setRolls] = useState<TableRoll[] | null>(null)
    const [failed, setFailed] = useState(false)
    const [who, setWho] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        void fetchDiaryDays().then((list) => {
            if (cancelled) return
            if (!list) { setFailed(true); setDays([]); return }
            setDays(list)
            setDay((current) => current ?? list[0]?.day ?? null)
        })
        return () => { cancelled = true }
    }, [])

    const dayRef = useRef(day)
    dayRef.current = day
    useEffect(() => {
        if (!day) return
        let cancelled = false
        setRolls(null)
        setWho(null)
        void fetchDiaryRolls(day).then((list) => {
            if (cancelled) return
            if (!list) setFailed(true)
            setRolls(list ?? [])
        })
        return () => { cancelled = true }
    }, [day])

    // Rolagem nova na mesa: se é a sessão de hoje que está aberta, relê (com junção — uma rodada rola muito).
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null
        const stop = onFeedActivity(() => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                const today = diaryDayOf(Date.now())
                void fetchDiaryDays().then((list) => { if (list) setDays(list) })
                if (dayRef.current === today) {
                    void fetchDiaryRolls(today).then((list) => { if (list && dayRef.current === today) setRolls(list) })
                } else if (dayRef.current === null) {
                    setDay(today)
                }
            }, 1200)
        })
        return () => { stop(); if (timer) clearTimeout(timer) }
    }, [])

    const people = useMemo(() => personStats(rolls ?? []), [rolls])
    const best = useMemo(() => highlights(people), [people])
    const shown = useMemo(() => {
        const list = rolls ?? []
        const filtered = who ? list.filter((r) => (r.slug || `nome:${(r.by || 'Alguém').trim().toLowerCase()}`) === who) : list
        // A mais recente primeiro: no meio da sessão, é a que se quer conferir.
        return [...filtered].reverse()
    }, [rolls, who])
    const info = days?.find((d) => d.day === day) ?? null

    return (
        <Container maxWidth="lg" disableGutters sx={{ pb: 4 }}>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
                Diário da sessão
            </Typography>
            <Box sx={{ height: 2, width: { xs: 120, sm: 180 }, backgroundColor: gold.main, mb: 2 }} />

            {days === null ? (
                <Skeleton variant="rounded" height={40} sx={{ maxWidth: 420 }} />
            ) : days.length === 0 ? (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {failed ? 'Não deu para ler o diário. Confira a conexão e recarregue.' : 'Nenhuma rolagem na mesa ainda. As da próxima sessão aparecem aqui.'}
                </Typography>
            ) : (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2.5 }}>
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
                </Box>
            )}

            {day && rolls === null && <Skeleton variant="rounded" height={160} />}

            {rolls && rolls.length > 0 && (
                <>
                    <Highlights best={best} />

                    <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mt: 3, mb: 1.5 }}>Por personagem</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1.5 }}>
                        {people.map((p) => <PersonCard key={p.key} person={p} />)}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Dano rolado no acerto: o app não sabe se o golpe acertou nem se foi crítico. Persistente fica de fora.
                    </Typography>

                    <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>Rolagens</Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                        <Chip label={`Todos · ${rolls.length}`} onClick={() => setWho(null)} color={who === null ? 'primary' : 'default'} variant={who === null ? 'filled' : 'outlined'} />
                        {people.map((p) => (
                            <Chip key={p.key} label={`${p.name} · ${p.rolls}`} onClick={() => setWho(p.key)}
                                color={who === p.key ? 'primary' : 'default'} variant={who === p.key ? 'filled' : 'outlined'} />
                        ))}
                    </Stack>
                    <Paper variant="outlined" sx={{ px: 2 }}>
                        <Stack divider={<Divider flexItem />}>
                            {shown.map((r) => <HistoryRow key={r.id} roll={r} />)}
                        </Stack>
                    </Paper>
                </>
            )}
        </Container>
    )
}

const Highlights = ({ best }: { best: ReturnType<typeof highlights> }) => {
    const items = [
        best.mostNat20 && { label: 'Mais 20 naturais', who: best.mostNat20.name, value: `${best.mostNat20.nat20}×`, tone: gold.deep },
        best.mostNat1 && { label: 'Mais 1 naturais', who: best.mostNat1.name, value: `${best.mostNat1.nat1}×`, tone: statusColor.error },
        best.biggestHit && { label: 'Maior dano rolado', who: best.biggestHit.person.name, value: String(best.biggestHit.total), detail: best.biggestHit.title },
        best.bestCheck && { label: 'Maior teste', who: best.bestCheck.person.name, value: String(best.bestCheck.total), detail: best.bestCheck.title },
    ].filter(Boolean) as { label: string; who: string; value: string; detail?: string; tone?: string }[]
    if (items.length === 0) return null
    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5 }}>
            {items.map((h) => (
                <Paper key={h.label} variant="outlined" sx={{ p: 1.5, borderTop: `3px solid ${h.tone ?? gold.main}` }}>
                    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, display: 'block' }}>{h.label}</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.1, color: h.tone }}>{h.value}</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{h.who}</Typography>
                    {h.detail && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>{h.detail}</Typography>}
                </Paper>
            ))}
        </Box>
    )
}

const Stat = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, color: tone }}>{value}</Typography>
    </Box>
)

const PersonCard = ({ person: p }: { person: PersonStats }) => {
    const avg = d20Average(p)
    return (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, minWidth: 0 }}>
                {p.slug
                    ? <TokenBadge slug={p.slug} name={p.name} size={32} />
                    : <Box sx={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />}
                <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>{p.name}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                <Stat label="Rolagens" value={p.rolls} />
                <Stat label="Testes" value={p.checks} />
                <Stat label="Média d20" value={avg ?? '—'} />
                <Stat label="20 naturais" value={p.nat20} tone={p.nat20 ? gold.deep : undefined} />
                <Stat label="1 naturais" value={p.nat1} tone={p.nat1 ? statusColor.error : undefined} />
                <Stat label="✦ míticos" value={p.mythic} tone={p.mythic ? MYTHIC_COLOR : undefined} />
            </Box>
            {(p.damage > 0 || p.best) && (
                <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                    {p.damage > 0 && <Stat label="Dano rolado" value={p.damage} />}
                    {p.biggestHit && <Stat label="Maior dano" value={p.biggestHit.total} />}
                </Box>
            )}
        </Paper>
    )
}
