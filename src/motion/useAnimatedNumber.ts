import { useEffect, useRef, useState } from 'react'
import { DURATION, useReducedMotion } from './motion'

interface Options {
    duration?: number
    /** Pula direto para o valor — primeira pintura, ou quando não se quer contar. */
    instant?: boolean
}

/**
 * O número exibido corre até `value` em vez de saltar. Só apresenta: quem lê o
 * estado continua lendo `value`, e uma mudança no meio da contagem parte de
 * onde a tela está, não de onde a conta anterior começou.
 */
export function useAnimatedNumber(value: number, { duration = DURATION.count, instant = false }: Options = {}): number {
    const reduced = useReducedMotion()
    const [shown, setShown] = useState(value)
    const shownRef = useRef(value)

    useEffect(() => {
        const from = shownRef.current
        if (from === value) return
        if (instant || reduced) {
            shownRef.current = value
            setShown(value)
            return
        }
        let raf = 0
        const start = performance.now()
        const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            const next = Math.round(from + (value - from) * eased)
            shownRef.current = next
            setShown(next)
            if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [value, duration, instant, reduced])

    return shown
}
