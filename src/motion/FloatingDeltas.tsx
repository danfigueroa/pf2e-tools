import { Box } from '@mui/material'
import { status } from '../theme/palette'
import { DURATION, floatUp, type PulseKind } from './motion'
import type { Delta } from './useValueDeltas'

const COLOR: Record<PulseKind, string> = {
    heal: status.success,
    hurt: status.error,
    temp: status.info,
    turn: status.info,
}

/**
 * Os "+12"/"−8" que sobem e somem. Posicionado em absoluto: o pai precisa de
 * `position: relative`. `aria-hidden` porque o número real já está na tela —
 * o leitor de tela leria cada delta como texto solto.
 */
export const FloatingDeltas = ({ deltas, placement = 'right' }: { deltas: Delta[]; placement?: 'right' | 'above' }) => {
    if (deltas.length === 0) return null
    return (
        <Box
            aria-hidden
            sx={{
                position: 'absolute',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                ...(placement === 'right'
                    ? { top: 0, left: '100%', ml: 1 }
                    : { bottom: '100%', left: '50%' }),
            }}
        >
            {deltas.map((d) => (
                <Box
                    key={d.id}
                    component="span"
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        fontWeight: 800,
                        fontSize: '1.05em',
                        fontVariantNumeric: 'tabular-nums',
                        color: COLOR[d.kind],
                        textShadow: '0 1px 0 #FFFFFF',
                        animation: `${floatUp} ${DURATION.float}ms ease-out forwards`,
                        '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 1 },
                    }}
                >
                    {d.amount > 0 ? `+${d.amount}` : `−${Math.abs(d.amount)}`}
                </Box>
            ))}
        </Box>
    )
}
