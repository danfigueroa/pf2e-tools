import { memo } from 'react'
import { Box, Typography } from '@mui/material'
import { useInView } from '../../../motion/useInView'
import { gold, green, parchment } from '../../../theme'
import { d20Average, type TableTotals } from '../stats'
import { CountUp } from './ui'
import { reveal, TONE } from './style'
import type { AwardTone } from '../awards'

interface Props {
    totals: TableTotals
    /** Na mesa inteira entra "Sessões"; na sessão, "Quem rolou". */
    scope: 'session' | 'table'
}

interface Tile {
    label: string
    value: number
    decimals?: number
    tone?: AwardTone
}

/** A faixa de números grandes do topo: contam do zero quando aparecem. */
export const StatCounters = memo(({ totals: t, scope }: Props) => {
    const [ref, shown] = useInView<HTMLDivElement>()
    const avg = d20Average(t)
    const tiles: Tile[] = [
        scope === 'table' ? { label: 'Sessões', value: t.sessions } : { label: 'Pessoas que rolaram', value: t.people },
        { label: 'Rolagens', value: t.rolls },
        { label: 'Testes de d20', value: t.checks },
        { label: 'Vezes que saiu 20', value: t.nat20, tone: 'gold' },
        { label: 'Vezes que saiu 1', value: t.nat1, tone: 'bad' },
        ...(avg !== null ? [{ label: 'Média no d20', value: avg, decimals: 1 }] : []),
        { label: 'Dano rolado', value: t.damage, tone: 'green' },
        ...(t.mythic > 0 ? [{ label: 'Pontos Míticos gastos', value: t.mythic, tone: 'mythic' as const }] : []),
    ]
    return (
        <Box
            ref={ref}
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
                gap: 1,
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                background: `linear-gradient(135deg, ${green.deepest} 0%, ${green.main} 55%, ${green.mid} 100%)`,
                borderBottom: `2px solid ${gold.main}`,
            }}
        >
            {tiles.map((tile, i) => (
                <Box key={tile.label} sx={{ ...reveal(shown, i), minWidth: 0, py: 0.5 }}>
                    <Typography
                        component="div"
                        sx={{
                            fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem' }, lineHeight: 1.1,
                            fontVariantNumeric: 'tabular-nums',
                            color: tile.tone === 'gold' ? gold.bright : tile.tone ? lighten(TONE[tile.tone].accent) : parchment.paper,
                        }}
                    >
                        <CountUp value={tile.value} decimals={tile.decimals} shown={shown} />
                    </Typography>
                    <Typography variant="caption" sx={{ color: `${parchment.paper}CC`, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                        {tile.label}
                    </Typography>
                </Box>
            ))}
        </Box>
    )
})

// Sobre o verde escuro, o vermelho e o vinho do pergaminho somem: clareia misturando com branco (em hex, como todo o tema).
function lighten(hex: string): string {
    const n = parseInt(hex.slice(1), 16)
    const mix = (c: number) => Math.round(c + (255 - c) * 0.45).toString(16).padStart(2, '0')
    return `#${mix(n >> 16)}${mix((n >> 8) & 0xff)}${mix(n & 0xff)}`
}
