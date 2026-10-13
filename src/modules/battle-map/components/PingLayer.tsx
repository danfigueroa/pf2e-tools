import { memo, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { CELL_PX } from '../geometry'
import { pingRing, useReducedMotion } from '../../../motion/motion'
import { gold, mapChrome } from '../../../theme'

interface Props {
    pings: Record<string, unknown>
}

interface Shown { id: string; x: number; y: number }

/** Quanto tempo um ping fica na tela de quem o recebe. */
const SHOW_MS = 4000
/** Diâmetro do anel em px de TELA (o `--inv-zoom` do mundo desfaz o zoom). */
const RING_PX = 90

const point = (raw: unknown): { x: number; y: number } | null => {
    if (!raw || typeof raw !== 'object') return null
    const { x, y } = raw as { x?: unknown; y?: unknown }
    return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

/**
 * Pings (Alt+clique): um anel dourado que se abre no ponto, para todos.
 *
 * Mostra cada ping UMA vez por aparelho, decidindo pelo id e não pelo
 * relógio: os pings que já existiam quando o mapa abriu contam como vistos.
 * Sem isso, quem chega depois veria piscar o ping de alguém que fechou a aba
 * antes de ele sumir — e comparar horários entre aparelhos não é confiável.
 */
export const PingLayer = memo(function PingLayer({ pings }: Props) {
    const seen = useRef<Set<string> | null>(null)
    if (seen.current === null) seen.current = new Set(Object.keys(pings))
    const [shown, setShown] = useState<Shown[]>([])
    const reduced = useReducedMotion()
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

    useEffect(() => {
        const fresh: Shown[] = []
        for (const [id, raw] of Object.entries(pings)) {
            if (seen.current!.has(id)) continue
            seen.current!.add(id)
            const p = point(raw)
            if (p) fresh.push({ id, ...p })
        }
        if (fresh.length === 0) return
        setShown((prev) => [...prev, ...fresh])
        // Um timer por ping, fora da limpeza do efeito: outro ping chegando
        // antes dos 4 s não pode cancelar a saída deste.
        for (const f of fresh) {
            timers.current.add(setTimeout(() => setShown((prev) => prev.filter((s) => s.id !== f.id)), SHOW_MS))
        }
    }, [pings])

    useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

    return (
        <>
            {shown.map((s) => (
                <Box
                    key={s.id}
                    data-ping={s.id}
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        left: s.x * CELL_PX,
                        top: s.y * CELL_PX,
                        width: `calc(${RING_PX}px * var(--inv-zoom, 1))`,
                        height: `calc(${RING_PX}px * var(--inv-zoom, 1))`,
                        borderRadius: '50%',
                        border: `calc(4px * var(--inv-zoom, 1)) solid ${gold.bright}`,
                        boxShadow: `0 0 calc(12px * var(--inv-zoom, 1)) ${gold.bright}, inset 0 0 calc(8px * var(--inv-zoom, 1)) ${mapChrome.outline}`,
                        pointerEvents: 'none',
                        zIndex: 6,
                        // Movimento reduzido: um anel parado no lugar do pulso.
                        transform: 'translate(-50%, -50%)',
                        animation: reduced ? 'none' : `${pingRing} 1.1s ease-out 3`,
                        opacity: reduced ? 0.9 : undefined,
                    }}
                />
            ))}
        </>
    )
})
