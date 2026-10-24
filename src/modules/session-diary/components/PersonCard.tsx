import { memo } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import { useInView } from '../../../motion/useInView'
import { gold, green, MYTHIC_COLOR, parchment, rule, status } from '../../../theme'
import { d20Average, type PersonStats } from '../stats'
import { CountUp, PersonAvatar } from './ui'
import { grow, reveal } from './style'

const Stat = ({ label, value, tone, shown, decimals }: { label: string; value: number | null; tone?: string; shown: boolean; decimals?: number }) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{label}</Typography>
        <Typography sx={{ fontWeight: 700, color: tone, fontVariantNumeric: 'tabular-nums' }}>
            {value === null ? '—' : <CountUp value={value} decimals={decimals} shown={shown} duration={800} />}
        </Typography>
    </Box>
)

/** As 20 faces em miniatura: o 1 em vermelho, o 20 em ouro. */
const MiniHist = ({ hist, shown }: { hist: number[]; shown: boolean }) => {
    const max = Math.max(1, ...hist)
    return (
        <Box aria-hidden sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 28, mt: 1.25 }}>
            {hist.map((n, i) => (
                <Box
                    key={i}
                    sx={{
                        ...grow(shown, n / max, 'y', i),
                        flex: '1 1 0', height: '100%', borderRadius: '2px 2px 0 0',
                        backgroundColor: i === 19 ? gold.main : i === 0 ? status.error : n > 0 ? green.light : rule,
                        opacity: n > 0 ? 1 : 0.4,
                    }}
                />
            ))}
        </Box>
    )
}

/** O resumo de uma pessoa na sessão aberta. */
export const PersonCard = memo(({ person: p, index }: { person: PersonStats; index: number }) => {
    const [ref, shown] = useInView<HTMLDivElement>()
    return (
        <Paper ref={ref} variant="outlined" sx={{ ...reveal(shown, index), p: 1.5, backgroundColor: parchment.paper, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, minWidth: 0 }}>
                <PersonAvatar slug={p.slug} name={p.name} color={p.color} size={32} />
                <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>{p.name}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                <Stat label="Rolagens" value={p.rolls} shown={shown} />
                <Stat label="Testes" value={p.checks} shown={shown} />
                <Stat label="Média d20" value={d20Average(p)} decimals={1} shown={shown} />
                <Stat label="20 naturais" value={p.nat20} tone={p.nat20 ? gold.deep : undefined} shown={shown} />
                <Stat label="1 naturais" value={p.nat1} tone={p.nat1 ? status.error : undefined} shown={shown} />
                <Stat label="✦ míticos" value={p.mythic} tone={p.mythic ? MYTHIC_COLOR : undefined} shown={shown} />
            </Box>
            {(p.damage > 0 || p.best) && (
                <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                    {p.best && <Stat label="Maior teste" value={p.best.total} shown={shown} />}
                    {p.damage > 0 && <Stat label="Dano rolado" value={p.damage} shown={shown} />}
                    {p.biggestHit && <Stat label="Maior dano" value={p.biggestHit.total} shown={shown} />}
                </Box>
            )}
            {p.checks > 0 && <MiniHist hist={p.hist} shown={shown} />}
        </Paper>
    )
})
