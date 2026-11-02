import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { NO_ITEM_ART, isItemArtEmpty, itemArtKey, sanitizeItemArt, type ItemArtStored } from '../itemArt'

/** As imagens dos itens do personagem, compartilhadas com a mesa (campo `art`). */
export function useItemArt(syncKey: string) {
    const [stored, setStored] = useSharedState<ItemArtStored>(syncKey, {
        empty: () => NO_ITEM_ART,
        sanitize: sanitizeItemArt,
        isEmpty: isItemArtEmpty,
    })

    const artOf = useCallback((name: string): string | null => stored[itemArtKey(name)] ?? null, [stored])

    /** `null` tira a imagem. */
    const setArt = useCallback((name: string, url: string | null) => {
        const key = itemArtKey(name)
        setStored((s) => {
            if ((s[key] ?? null) === url) return s
            const next = { ...s }
            if (url) next[key] = url
            else delete next[key]
            return next
        })
    }, [setStored])

    return useMemo(() => ({ artOf, setArt, count: Object.keys(stored).length }), [artOf, setArt, stored])
}

export type ItemArtApi = ReturnType<typeof useItemArt>
