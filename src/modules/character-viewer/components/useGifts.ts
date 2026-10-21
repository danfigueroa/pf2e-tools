import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { BuildInfo } from '../../character-sheet/types'
import { gaveKeyFor, charSlug } from '../charId'
import { addGave, canGave, holdersOf, isGaveEmpty, sanitizeGave, withGifts, type Gave } from '../gifts'
import { inventoryRows } from '../inventory'
import { getIncoming, subscribeIncoming, trackIncoming } from '../../../services/gifts'
import { useSharedState } from './useSharedState'

/**
 * O inventário com o que foi passado entre os personagens. `gave` é a fatia deste
 * personagem (o que ELE passou a cada colega); o que os outros lhe passaram vem do
 * `incoming` do serviço. Quem precisa das linhas de verdade (a aba, o veneno do
 * Ladino) lê `rows` daqui, nunca `inventoryRows` direto.
 */
export function useGifts(build: BuildInfo) {
    const me = charSlug(build)
    const [gave, setGave] = useSharedState<Gave>(gaveKeyFor(build), {
        empty: () => ({}),
        sanitize: sanitizeGave,
        isEmpty: isGaveEmpty,
    })
    useEffect(() => { trackIncoming(me) }, [me])
    const incoming = useSyncExternalStore(subscribeIncoming, getIncoming)

    const baseRows = useMemo(() => inventoryRows(build), [build])
    const rows = useMemo(() => withGifts(baseRows, gave, incoming), [baseRows, gave, incoming])

    /** Soma `n` (negativo desfaz) ao que foi passado a `to`. Devolve se coube na fatia. */
    const give = useCallback((to: string, name: string, n: number): boolean => {
        if (n > 0 && !canGave(gave, to, name)) return false
        setGave((g) => addGave(g, to, name, n))
        return true
    }, [gave, setGave])

    const holders = useCallback((name: string) => holdersOf(name, gave, incoming), [gave, incoming])

    return useMemo(() => ({ rows, give, holders }), [rows, give, holders])
}

export type GiftsApi = ReturnType<typeof useGifts>
