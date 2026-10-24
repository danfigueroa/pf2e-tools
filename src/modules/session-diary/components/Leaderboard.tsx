import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { useInView } from '../../../motion/useInView'
import { useReducedMotion } from '../../../motion/motion'
import { parchment, rule } from '../../../theme'
import { METRICS, MIN_CHECKS, type Scope } from '../awards'
import type { PersonStats } from '../stats'
import { CountUp, PersonAvatar } from './ui'
import { grow, reveal, TONE } from './style'

interface Props {
    people: PersonStats[]
    scope: Scope
}

/**
 * O ranking por métrica: as barras crescem e, ao trocar de métrica, as linhas
 * deslizam até a posição nova (FLIP — mede antes e depois e anima só o
 * `transform`, sem refazer o layout a cada quadro).
 */
export const Leaderboard = memo(({ people, scope }: Props) => {
    const [metricId, setMetricId] = useState(METRICS[0].id)
    const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0]
    const [ref, shown] = useInView<HTMLDivElement>()
    const reduced = useReducedMotion()

    const rows = useMemo(() => {
        const list = people
            .map((p) => ({ p, value: metric.value(p, scope) }))
            .filter((r): r is { p: PersonStats; value: number } => r.value !== null)
            .sort((a, b) => b.value - a.value || a.p.name.localeCompare(b.p.name))
        const max = Math.max(1, ...list.map((r) => Math.abs(r.value)))
        return list.map((r) => ({ ...r, fraction: Math.abs(r.value) / max }))
    }, [people, metric, scope])

    const nodes = useRef(new Map<string, HTMLElement>())
    const tops = useRef(new Map<string, number>())
    useLayoutEffect(() => {
        const moved: HTMLElement[] = []
        for (const [key, el] of nodes.current) {
            const before = tops.current.get(key)
            const now = el.offsetTop
            tops.current.set(key, now)
            if (reduced || before === undefined || before === now) continue
            el.style.transition = 'none'
            el.style.transform = `translateY(${before - now}px)`
            moved.push(el)
        }
        if (moved.length === 0) return
        const raf = requestAnimationFrame(() => {
            for (const el of moved) {
                el.style.transition = 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)'
                el.style.transform = ''
            }
        })
        return () => cancelAnimationFrame(raf)
    }, [rows, reduced])

    const tone = TONE[metric.tone]
    const decimals = metric.id === 'avg' ? 1 : 0
    return (
        <Box ref={ref}>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                {METRICS.map((m) => (
                    <Chip
                        key={m.id}
                        label={m.label}
                        onClick={() => setMetricId(m.id)}
                        color={m.id === metricId ? 'primary' : 'default'}
                        variant={m.id === metricId ? 'filled' : 'outlined'}
                    />
                ))}
            </Stack>
            {rows.length === 0 ? (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {metric.id === 'avg' ? `Ninguém fez ${MIN_CHECKS[scope]} testes ainda.` : 'Ninguém ainda.'}
                </Typography>
            ) : (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {rows.map((r, i) => (
                        <Box
                            key={r.p.key}
                            ref={(el: HTMLElement | null) => { if (el) nodes.current.set(r.p.key, el); else nodes.current.delete(r.p.key) }}
                            sx={{
                                ...reveal(shown, i),
                                display: 'grid', gridTemplateColumns: '28px 32px minmax(0, 1fr) auto', alignItems: 'center', gap: 1,
                                p: 0.75, pr: 1.25, borderRadius: 1.5, backgroundColor: parchment.paper, border: `1px solid ${rule}`,
                            }}
                        >
                            <Typography sx={{ fontWeight: 800, textAlign: 'center', color: i === 0 ? tone.text : 'text.secondary' }}>
                                {i + 1}º
                            </Typography>
                            <PersonAvatar slug={r.p.slug} name={r.p.name} color={r.p.color} size={32} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>{r.p.name}</Typography>
                                <Box sx={{ height: 6, mt: 0.5, borderRadius: 3, backgroundColor: parchment.sunken, overflow: 'hidden' }}>
                                    <Box
                                        sx={{
                                            ...grow(shown, r.fraction, 'x', i),
                                            height: '100%', borderRadius: 3,
                                            backgroundColor: r.value < 0 ? TONE.bad.accent : tone.accent,
                                        }}
                                    />
                                </Box>
                            </Box>
                            <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: r.value < 0 ? TONE.bad.text : tone.text }}>
                                <CountUp value={r.value} decimals={decimals} shown={shown} duration={700} format={(n) => metric.format(n)} />
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
            {metric.id === 'avg' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Só aparece quem fez pelo menos {MIN_CHECKS[scope]} testes de d20: com poucos testes, a média não diz nada.
                </Typography>
            )}
        </Box>
    )
})
