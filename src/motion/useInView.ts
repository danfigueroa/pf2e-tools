import { useCallback, useEffect, useState } from 'react'
import { useReducedMotion } from './motion'

// UM `IntersectionObserver` para a página inteira: com um por elemento, uma
// grade de quinze troféus seriam quinze observers. Cada elemento é avisado uma
// vez, quando entra na tela, e sai da observação.
const callbacks = new WeakMap<Element, () => void>()
let observer: IntersectionObserver | null = null

function shared(): IntersectionObserver | null {
    if (observer || typeof IntersectionObserver === 'undefined') return observer
    observer = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (!e.isIntersecting) continue
            callbacks.get(e.target)?.()
            callbacks.delete(e.target)
            observer?.unobserve(e.target)
        }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 })
    return observer
}

/**
 * `true` a partir da primeira vez que o elemento aparece na tela — a animação
 * de entrada só começa quando alguém pode vê-la. Com movimento reduzido (ou sem
 * `IntersectionObserver`), já nasce `true`.
 */
export function useInView<T extends Element>(): [(el: T | null) => void, boolean] {
    const reduced = useReducedMotion()
    const [seen, setSeen] = useState(false)
    const [el, setEl] = useState<T | null>(null)
    useEffect(() => {
        if (seen || !el) return
        const io = shared()
        if (!io) { setSeen(true); return }
        callbacks.set(el, () => setSeen(true))
        io.observe(el)
        return () => { callbacks.delete(el); io.unobserve(el) }
    }, [el, seen])
    const ref = useCallback((node: T | null) => setEl(node), [])
    return [ref, seen || reduced]
}
