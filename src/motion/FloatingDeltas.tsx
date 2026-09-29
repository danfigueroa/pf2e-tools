import { Box } from '@mui/material'
import { SHIELD_COLOR, status } from '../theme/palette'
import { DURATION, floatUp, type PulseKind } from './motion'
import type { Delta } from './useValueDeltas'

const COLOR: Record<PulseKind, string> = {
    heal: status.success,
    hurt: status.error,
    temp: status.info,
    turn: status.info,
    block: SHIELD_COLOR,
    break: status.error,
    repair: status.success,
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
                    : { bottom: '100%', left: '50%', mb: 0.25 }),
            }}
        >
            {deltas.map((d) => (
                <Box
                    key={d.id}
                    component="span"
                    sx={{
                        position: 'absolute',
                        // Acima do número, o delta cresce para cima a partir da
                        // base do contêiner; ao lado, desce a partir do topo.
                        ...(placement === 'above' ? { bottom: 0 } : { top: 0 }),
                        left: 0,
                        // `translate` é independente do `transform` que o keyframe anima.
                        translate: placement === 'above' ? '-50% 0' : undefined,
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
