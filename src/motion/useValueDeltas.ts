import { useEffect, useRef, useState } from 'react'
import { DURATION, useArmed, useReducedMotion, type Pulse, type PulseKind } from './motion'

export interface Delta {
    id: number
    amount: number
    kind: PulseKind
}

let seq = 0

/**
 * Cada mudança de `value` vira um delta flutuante ("+12", "−8") que some
 * sozinho, e um `pulse` para o brilho/tremor do contêiner. Mudanças antes de o
 * componente estar armado (ver `useArmed`) são acomodação de carga, não
 * evento — não animam.
 *
 * `classify` decide o tipo; sem ele, subir é cura e descer é dano.
 */
export function useValueDeltas(value: number, classify?: (diff: number) => PulseKind) {
    const armed = useArmed()
    const reduced = useReducedMotion()
    const prev = useRef(value)
    const classifyRef = useRef(classify)
    classifyRef.current = classify

    const [deltas, setDeltas] = useState<Delta[]>([])
    const [pulse, setPulse] = useState<Pulse | null>(null)
    const timers = useRef(new Set<number>())

    useEffect(() => {
        const diff = value - prev.current
        prev.current = value
        if (!diff || !armed) return

        const kind = classifyRef.current?.(diff) ?? (diff > 0 ? 'heal' : 'hurt')
        const id = ++seq
        // Movimento reduzido: o número ainda aparece (é informação), sem pulso.
        setDeltas((d) => [...d.slice(-3), { id, amount: diff, kind }])
        if (!reduced) setPulse({ kind, id })

        const t1 = window.setTimeout(() => {
            setDeltas((d) => d.filter((x) => x.id !== id))
            timers.current.delete(t1)
        }, DURATION.float)
        const t2 = window.setTimeout(() => {
            setPulse((p) => (p?.id === id ? null : p))
            timers.current.delete(t2)
        }, DURATION.pulse + 400)
        timers.current.add(t1)
        timers.current.add(t2)
    }, [value, armed, reduced])

    useEffect(() => {
        const set = timers.current
        return () => set.forEach((t) => window.clearTimeout(t))
    }, [])

    return { deltas, pulse, armed }
}
