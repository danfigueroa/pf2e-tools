import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { keyframes } from '@emotion/react'
import type { SharedRoll } from '../modules/battle-map/dice'
import { inkOn } from '../modules/battle-map/dice'
import { gold } from '../theme/palette'
import { DICE_SHAPE } from './diceShapes'
import { pop, tumble, useReducedMotion } from './motion'
import { useAnimatedNumber } from './useAnimatedNumber'

// Bandeja de dados do mapa. Pensada para até 100 dados a 60 fps:
//
// - o giro e o estouro final são CSS (`transform`/`opacity`, só compositor),
//   com o assentamento de cada dado escrito como `animation-delay` — nenhum
//   JS roda no momento em que um dado assenta;
// - a troca do número que passa durante o giro é UM `requestAnimationFrame`
//   para a bandeja inteira, escrevendo `textContent` pelo ref: nenhum render
//   React por quadro (mesma regra do `MapCanvas`);
// - o resultado já vem sorteado. A animação só apresenta.

/** Troca de face enquanto rola. */
const FACE_MS = 80
const FIRST_SETTLE = 550
const MAX_STAGGER = 160
/** Janela inteira do escalonamento — cem dados não podem levar cem vezes mais. */
const STAGGER_BUDGET = 700
/** Acima disso, só os primeiros dados trocam de número enquanto giram. */
const FACE_LIMIT = 24

const vanish = keyframes`to { opacity: 0; }`
const appear = keyframes`to { opacity: 1; }`
const nudge = keyframes`
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-4px); }
    40% { transform: translateX(4px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(2px); }
`
const shine = keyframes`
    0% { text-shadow: 0 0 0 ${gold.bright}00; }
    40% { text-shadow: 0 0 18px ${gold.bright}, 0 0 4px ${gold.bright}; }
    100% { text-shadow: 0 0 8px ${gold.bright}88; }
`

const dieSize = (count: number) => (count > 36 ? 26 : count > 12 ? 34 : 46)

interface Props {
    roll: SharedRoll
    /** Os dados assentaram e o total apareceu. */
    onDone?: () => void
}

export const DiceTray = ({ roll, onDone }: Props) => {
    const reduced = useReducedMotion()
    const { rolls, faces, color, flat, total } = roll
    const count = rolls.length
    const stagger = count > 1 ? Math.min(MAX_STAGGER, STAGGER_BUDGET / (count - 1)) : 0
    const settleAt = (i: number) => FIRST_SETTLE + i * stagger
    const end = settleAt(count - 1)

    const faceRefs = useRef<(HTMLSpanElement | null)[]>([])
    const [done, setDone] = useState(reduced)

    useEffect(() => {
        if (reduced) { setDone(true); return }
        let raf = 0
        let last = -FACE_MS
        const start = performance.now()
        const frame = (now: number) => {
            const t = now - start
            if (t >= end) { setDone(true); return }
            if (t - last >= FACE_MS) {
                last = t
                const n = Math.min(count, FACE_LIMIT)
                for (let i = 0; i < n; i++) {
                    const el = faceRefs.current[i]
                    if (el && t < settleAt(i)) el.textContent = String(1 + Math.floor(Math.random() * faces))
                }
            }
            raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
        // Zera o handle além de cancelar: o StrictMode desmonta e remonta o efeito.
        return () => { cancelAnimationFrame(raf); raf = 0 }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduced, end, count, faces])

    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone
    useEffect(() => { if (done) onDoneRef.current?.() }, [done])

    const shownTotal = useAnimatedNumber(done ? total : 0, { duration: 450, instant: reduced })
    const size = dieSize(count)
    const shape = DICE_SHAPE[faces]
    const ink = inkOn(color)
    const single20 = faces === 20 && count === 1
    const nat = single20 ? rolls[0] : 0

    const dice = useMemo(() => rolls.map((value, i) => {
        const at = settleAt(i)
        const iterations = Math.max(1, Math.round(at / 420))
        return { value, at, iterations, dur: at / iterations }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [rolls, stagger])

    return (
        <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: size > 30 ? 1 : 0.5, maxWidth: 340, mx: 'auto' }} aria-hidden>
                {dice.map((d, i) => (
                    <Box
                        key={i}
                        sx={{
                            width: size,
                            height: size,
                            animation: reduced ? 'none' : `${tumble} ${d.dur}ms linear ${d.iterations}`,
                        }}
                    >
                        <Box
                            sx={{
                                position: 'relative',
                                width: '100%',
                                height: '100%',
                                backgroundColor: color,
                                color: ink,
                                fontWeight: 800,
                                fontSize: size > 40 ? '1.05rem' : size > 30 ? '0.85rem' : '0.7rem',
                                fontVariantNumeric: 'tabular-nums',
                                borderRadius: shape ? 0 : 1.5,
                                clipPath: shape,
                                animation: reduced ? 'none' : `${pop} 260ms ease-out ${d.at}ms`,
                                // O número final fica fixo, sem girar junto: contra-rotação só durante o giro seria
                                // custo à toa; o giro é curto e o número que passa já é aleatório.
                                '& > span': {
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingTop: faces === 4 ? '25%' : 0,
                                },
                            }}
                        >
                            {!reduced && (
                                <Box
                                    component="span"
                                    ref={(el: HTMLSpanElement | null) => { faceRefs.current[i] = el }}
                                    sx={{ animation: `${vanish} 1ms linear ${d.at}ms forwards` }}
                                >
                                    {i < FACE_LIMIT ? '?' : '·'}
                                </Box>
                            )}
                            <Box
                                component="span"
                                sx={reduced ? undefined : { opacity: 0, animation: `${appear} 1ms linear ${d.at}ms forwards` }}
                            >
                                {d.value}
                            </Box>
                        </Box>
                    </Box>
                ))}
                {flat !== 0 && (
                    <Typography
                        sx={{ fontWeight: 700, fontSize: '1.1rem', opacity: done ? 1 : 0, transition: 'opacity 200ms' }}
                    >
                        {flat > 0 ? '+' : '−'} {Math.abs(flat)}
                    </Typography>
                )}
            </Box>
            <Typography
                sx={{
                    mt: 0.75,
                    fontFamily: '"Cinzel", Georgia, serif',
                    fontWeight: 700,
                    fontSize: '2.2rem',
                    lineHeight: 1,
                    visibility: done ? 'visible' : 'hidden',
                    color: nat === 20 ? gold.bright : nat === 1 ? '#FF6B6B' : 'inherit',
                    animation: !done || reduced
                        ? 'none'
                        : nat === 20 ? `${shine} 900ms ease-out forwards`
                        : nat === 1 ? `${nudge} 450ms ease-in-out`
                        : `${pop} 320ms ease-out`,
                }}
            >
                {shownTotal}
            </Typography>
            {done && nat === 20 && <Typography variant="caption" sx={{ color: gold.bright, fontWeight: 700 }}>Natural 20!</Typography>}
            {done && nat === 1 && <Typography variant="caption" sx={{ color: '#FF6B6B', fontWeight: 700 }}>Natural 1</Typography>}
        </Box>
    )
}
