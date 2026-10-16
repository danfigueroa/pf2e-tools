import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { MAX_COMPANIONS, isCompanionsEmpty, newCompanionId, sanitizeCompanions, type Companion } from '../companions'

/** Os companheiros de combate do personagem, compartilhados com a mesa (campo `companions`). */
export function useCompanions(syncKey: string) {
    const [list, setList] = useSharedState<Companion[]>(syncKey, {
        empty: () => [],
        sanitize: sanitizeCompanions,
        isEmpty: isCompanionsEmpty,
    })

    const add = useCallback((name: string) => {
        const clean = name.trim()
        if (!clean) return
        setList((l) => (l.length >= MAX_COMPANIONS || l.some((c) => c.name.toLowerCase() === clean.toLowerCase())
            ? l
            : [...l, { id: newCompanionId(), name: clean }]))
    }, [setList])

    const remove = useCallback((id: string) => setList((l) => l.filter((c) => c.id !== id)), [setList])

    const setToken = useCallback((id: string, url: string | null) => {
        setList((l) => l.map((c) => {
            if (c.id !== id) return c
            // Imagem nova: o enquadramento de antes era para a outra.
            const { token: _drop, fit: _fit, ...rest } = c
            void _drop
            void _fit
            return url ? { ...rest, token: { url } } : rest
        }))
    }, [setList])

    /** Enquadramento do token; o padrão (centro, 1×) apaga o campo. */
    const setFit = useCallback((id: string, fit: { x: number; y: number; z: number } | null) => {
        setList((l) => l.map((c) => {
            if (c.id !== id) return c
            const { fit: _drop, ...rest } = c
            void _drop
            return fit ? { ...rest, fit } : rest
        }))
    }, [setList])

    return useMemo(() => ({ list, add, remove, setToken, setFit }), [list, add, remove, setToken, setFit])
}

export type CompanionsApi = ReturnType<typeof useCompanions>
