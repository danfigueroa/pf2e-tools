import { useEffect, useRef, useState } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import type { RollDetail } from '../modules/initiative-tracker/dice'
import { ink } from '../theme/palette'
import { pop, tumble, useReducedMotion } from './motion'

/** Silhueta de cada dado, em `clip-path`. O d6 é um quadrado arredondado. */
const SHAPE: Record<number, string | undefined> = {
    4: 'polygon(50% 2%, 100% 96%, 0% 96%)',
    8: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    10: 'polygon(50% 0%, 100% 42%, 50% 100%, 0% 42%)',
    12: 'polygon(50% 0%, 100% 36%, 82% 100%, 18% 100%, 0% 36%)',
    20: 'polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0% 50%)',
}

/** Troca de face enquanto rola. */
const FACE_MS = 70
/** Quando o primeiro dado assenta, e o intervalo entre um e o próximo. */
const FIRST_SETTLE = 550
const MAX_STAGGER = 160
/** Janela inteira do escalonamento — dez dados não podem levar dez vezes mais. */
const STAGGER_BUDGET = 700

/**
 * Face "aleatória" de um dado ainda rolando, derivada do tempo — o render fica
 * puro e o resultado verdadeiro, que já veio pronto, nunca é tocado.
 */
function tumblingFace(tick: number, i: number, faces: number): number {
    const h = Math.imul(tick + 1, 2654435761) ^ Math.imul(i + 7, 40503)
    return 1 + ((h >>> 0) % faces)
}

interface Props {
    /** A rolagem já feita (`rollFormulaDetailed`). Aqui só se mostra. */
    roll: RollDetail
    /** Faces dos dados da fórmula (6 em `3d6+6`). */
    faces: number
    /** Cor do corpo do dado. */
    color: string
    /** Pula direto para o resultado. */
    skip?: boolean
    /** Todos os dados assentaram e o total apareceu. */
    onDone?: () => void
}

/**
 * Os dados de uma rolagem girando e assentando um a um no valor sorteado,
 * depois o modificador fixo e o total. É o memorial da rolagem em forma de
 * animação — os números são exatamente os do texto do "Desfazer".
 */
export const DiceRoll = ({ roll, faces, color, skip = false, onDone }: Props) => {
    const reduced = useReducedMotion()
    const instant = skip || reduced
    const count = roll.rolls.length
    const stagger = count > 1 ? Math.min(MAX_STAGGER, STAGGER_BUDGET / (count - 1)) : 0
    const settleAt = (i: number) => FIRST_SETTLE + i * stagger
    const end = count ? settleAt(count - 1) : 0

    const [elapsed, setElapsed] = useState(0)
    useEffect(() => {
        if (instant) return
        const start = performance.now()
        const id = window.setInterval(() => {
            const t = performance.now() - start
            setElapsed(t)
            if (t >= end) window.clearInterval(id)
        }, FACE_MS)
        return () => window.clearInterval(id)
    }, [instant, end])

    const done = instant || elapsed >= end
    const onDoneRef = useRef(onDone)
    onDoneRef.current = onDone
    useEffect(() => {
        if (!done) return
        // Um respiro para o total aparecer antes da próxima fase.
        const t = window.setTimeout(() => onDoneRef.current?.(), instant ? 0 : 350)
        return () => window.clearTimeout(t)
    }, [done, instant])

    const tick = Math.floor(elapsed / FACE_MS)
    const shape = SHAPE[faces]
    const size = count > 6 ? 34 : 42

    return (
        <Stack alignItems="center" spacing={1.25}>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                sx={{ flexWrap: 'wrap', gap: 1, maxWidth: 300 }}
                aria-hidden
            >
                {roll.rolls.map((value, i) => {
                    const settled = instant || elapsed >= settleAt(i)
                    return (
                        <Box
                            key={i}
                            sx={{
                                width: size,
                                height: size,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pt: faces === 4 ? 1.25 : 0,
                                backgroundColor: color,
                                color: '#FFFFFF',
                                fontWeight: 800,
                                fontSize: size > 36 ? '1.05rem' : '0.9rem',
                                fontVariantNumeric: 'tabular-nums',
                                borderRadius: shape ? 0 : 1.5,
                                clipPath: shape,
                                opacity: settled ? 1 : 0.8,
                                animation: settled
                                    ? (instant ? 'none' : `${pop} 260ms ease-out`)
                                    : `${tumble} 420ms linear infinite`,
                            }}
                        >
                            {settled ? value : tumblingFace(tick, i, faces)}
                        </Box>
                    )
                })}
                {roll.flat !== 0 && (
                    <Typography
                        sx={{
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            color: ink.secondary,
                            opacity: done ? 1 : 0,
                            transition: 'opacity 200ms',
                        }}
                    >
                        {roll.flat > 0 ? '+' : '−'} {Math.abs(roll.flat)}
                    </Typography>
                )}
            </Stack>
            <Typography
                aria-live="polite"
                sx={{
                    fontFamily: '"Cinzel", Georgia, serif',
                    fontWeight: 700,
                    fontSize: '2rem',
                    lineHeight: 1,
                    color,
                    visibility: done ? 'visible' : 'hidden',
                    animation: done && !instant ? `${pop} 320ms ease-out` : 'none',
                }}
            >
                {done ? roll.total : 0}
            </Typography>
        </Stack>
    )
}
