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
            const { token: _drop, ...rest } = c
            void _drop
            return url ? { ...rest, token: { url } } : rest
        }))
    }, [setList])

    return useMemo(() => ({ list, add, remove, setToken }), [list, add, remove, setToken])
}

export type CompanionsApi = ReturnType<typeof useCompanions>
