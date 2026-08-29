// Busca de criaturas na AON: debounce, filtro de faixa de nível e paginação.
//
// Vive fora dos módulos porque dois deles precisam exatamente disto — o
// gerenciador de iniciativa (para montar o encontro) e o escalador de monstro
// (para escolher a ficha). A parte cara de acertar é a paginação, e ela não
// deveria existir em duas cópias que envelhecem separadas.

import { useCallback, useEffect, useState } from 'react'
import { searchCreatures, type AonCreature } from '../services/creatures'

const PAGE_SIZE = 20

/** Campos de nível aceitam o sinal de menos: existe criatura de nível -1. */
export const levelInput = (value: string) =>
    value.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '')

export const parseLevel = (value: string): number | null => {
    const trimmed = value.trim()
    if (trimmed === '' || trimmed === '-') return null
    const n = parseInt(trimmed, 10)
    return Number.isFinite(n) ? n : null
}

/**
 * Concatena páginas sem repetir nome: a deduplicação do backend é POR PÁGINA,
 * então o mesmo nome pode cair em duas páginas diferentes.
 *
 * Devolve o array original quando nada foi acrescentado, para não repintar à toa.
 */
const appendUnique = (current: AonCreature[], incoming: AonCreature[]): AonCreature[] => {
    const seen = new Set(current.map((c) => c.name.toLowerCase()))
    const added = incoming.filter((c) => !seen.has(c.name.toLowerCase()))
    return added.length > 0 ? [...current, ...added] : current
}

export interface CreatureSearch {
    query: string
    setQuery: (value: string) => void
    minLevel: string
    setMinLevel: (value: string) => void
    maxLevel: string
    setMaxLevel: (value: string) => void
    results: AonCreature[]
    /** Anterior à deduplicação de legacy/reimpressões: é aproximado de propósito. */
    total: number
    hasMore: boolean
    loading: boolean
    loadingMore: boolean
    searched: boolean
    loadMore: () => void
}

export function useCreatureSearch(): CreatureSearch {
    const [query, setQuery] = useState('')
    const [minLevel, setMinLevel] = useState('')
    const [maxLevel, setMaxLevel] = useState('')
    const [results, setResults] = useState<AonCreature[]>([])
    const [total, setTotal] = useState(0)
    // Cursor em acertos do índice (ver `nextOffset` em services/creatures.ts).
    const [nextOffset, setNextOffset] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [searched, setSearched] = useState(false)

    // Debounce: a busca dispara a cada tecla, e o Elasticsearch da AON não
    // precisa ver "g", "go", "gob".
    useEffect(() => {
        const term = query.trim()
        const min = parseLevel(minLevel)
        const max = parseLevel(maxLevel)

        // Só nome curto e sem faixa não é busca — é o campo ainda vazio.
        if (term.length < 2 && min === null && max === null) {
            setResults([])
            setTotal(0)
            setNextOffset(0)
            setHasMore(false)
            setSearched(false)
            return
        }
        let cancelled = false
        setLoading(true)
        const timer = setTimeout(() => {
            void searchCreatures(term, PAGE_SIZE, { minLevel: min, maxLevel: max }).then((found) => {
                if (cancelled) return
                setResults(found.results)
                setTotal(found.total)
                setNextOffset(found.nextOffset)
                setHasMore(found.hasMore)
                setSearched(true)
                setLoading(false)
            })
        }, 350)
        return () => { cancelled = true; clearTimeout(timer); setLoading(false) }
    }, [query, minLevel, maxLevel])

    // "Carregar mais" continua do CURSOR da última página, nunca de
    // `página × tamanho`: a deduplicação faz os dois números divergirem.
    const loadMore = useCallback(() => {
        if (loadingMore || !hasMore) return
        setLoadingMore(true)
        void searchCreatures(query.trim(), PAGE_SIZE, {
            minLevel: parseLevel(minLevel),
            maxLevel: parseLevel(maxLevel),
            offset: nextOffset,
        }).then((found) => {
            setResults((prev) => appendUnique(prev, found.results))
            if (found.total > 0) setTotal(found.total)
            setNextOffset(found.nextOffset)
            setHasMore(found.hasMore)
            setLoadingMore(false)
        })
    }, [loadingMore, hasMore, query, minLevel, maxLevel, nextOffset])

    return {
        query, setQuery,
        minLevel, setMinLevel,
        maxLevel, setMaxLevel,
        results, total, hasMore, loading, loadingMore, searched, loadMore,
    }
}
