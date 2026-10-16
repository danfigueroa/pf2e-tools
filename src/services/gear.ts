// Traços das armas e números das armaduras, em inglês, direto do Archives of
// Nethys (`api/_lib/gear-core.js`) — o que a rolagem de Golpe e a penalidade de
// armadura nas perícias precisam e o Pathbuilder não exporta.
//
// **Cachear inglês aqui é correto**, como em `itemTraits.ts`: são palavras de
// regra, lidas por código, e uma arma publicada não muda de traço. Guarda também
// o "não achei" (`null`), senão uma arma caseira repetiria a busca a cada ficha.

import { useEffect, useMemo, useState } from 'react'

export interface WeaponGear {
    kind: 'weapon'
    name: string
    /** Arma base de que o item é feito ("Shortsword" para a Gloom Blade). */
    base: string
    /** Como o AON escreve: "Deadly d10", "Fatal 1d10", "Thrown 20 ft.". */
    traits: string[]
    weaponType: 'melee' | 'ranged' | null
    /** Grupo da arma ("Knife"): decide a especialização crítica. */
    group?: string | null
}

export interface ArmorGear {
    kind: 'armor'
    name: string
    base: string
    /** Negativa ou zero. */
    checkPenalty: number
    /** Modificador de FOR que zera a penalidade; `null` = sem exigência. */
    strength: number | null
    category: string | null
}

export type Gear = WeaponGear | ArmorGear

const CACHE_VERSION = 'v2'
const storageKey = (name: string) => `pf2e:gear:${CACHE_VERSION}:${name.toLowerCase()}`

const memory = new Map<string, Gear | null>()

function readStored(name: string): Gear | null | undefined {
    try {
        const raw = localStorage.getItem(storageKey(name))
        if (raw === null) return undefined
        return raw === 'null' ? null : (JSON.parse(raw) as Gear)
    } catch {
        return undefined
    }
}

function remember(name: string, value: Gear | null) {
    memory.set(name, value)
    try { localStorage.setItem(storageKey(name), JSON.stringify(value)) } catch { /* cota cheia */ }
}

const inflight = new Map<string, Promise<Record<string, Gear | null>>>()

/** Vários itens numa requisição só, por nome de ENTRADA; `null` = o AON não tem. */
export async function fetchGear(names: string[]): Promise<Record<string, Gear | null>> {
    const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    const out: Record<string, Gear | null> = {}
    const missing: string[] = []

    for (const name of wanted) {
        if (memory.has(name)) { out[name] = memory.get(name) ?? null; continue }
        const stored = readStored(name)
        if (stored !== undefined) { memory.set(name, stored); out[name] = stored; continue }
        missing.push(name)
    }
    if (missing.length === 0) return out

    const id = missing.slice().sort().join('|')
    let request = inflight.get(id)
    if (!request) {
        request = (async () => {
            const found: Record<string, Gear | null> = {}
            try {
                const params = new URLSearchParams({ gear: missing.join('|') })
                const r = await fetch(`/api/search?${params.toString()}`)
                if (!r.ok) return found
                const body = await r.json() as { gear?: Record<string, Gear> }
                // Só guarda o "não achei" depois de uma resposta de verdade.
                missing.forEach((name) => {
                    found[name] = body.gear?.[name] ?? null
                    remember(name, found[name])
                })
            } catch {
                /* rede fora: a próxima abertura tenta de novo */
            } finally {
                inflight.delete(id)
            }
            return found
        })()
        inflight.set(id, request)
    }
    return { ...out, ...(await request) }
}

/**
 * O equipamento pedido, carregado em segundo plano. `undefined` enquanto não
 * chegou; `null` quando o AON não tem o item.
 */
export function useGear(names: string[]): Record<string, Gear | null | undefined> {
    const key = useMemo(() => [...new Set(names.filter(Boolean))].sort().join('|'), [names])
    const [loaded, setLoaded] = useState<Record<string, Gear | null>>(() => {
        const out: Record<string, Gear | null> = {}
        for (const name of key ? key.split('|') : []) {
            if (memory.has(name)) out[name] = memory.get(name) ?? null
        }
        return out
    })
    useEffect(() => {
        if (!key) return
        let alive = true
        fetchGear(key.split('|')).then((found) => {
            if (alive) setLoaded((prev) => ({ ...prev, ...found }))
        })
        return () => { alive = false }
    }, [key])
    return loaded
}
