// Números dos escudos (bônus, Dureza, PV, BT), em inglês, direto do Archives
// of Nethys (`search?shields=`). O Pathbuilder não exporta nada disso.
//
// Cachear aqui é correto pelo mesmo motivo de `itemTraits.ts`: é dado
// publicado, não tradução — inclusive o "não achei" (`null`) de um escudo
// caseiro, senão toda abertura da ficha repetiria a busca.

import type { AonShield } from '../modules/character-viewer/shield'

const CACHE_VERSION = 'v1'
const storageKey = (name: string) => `pf2e:shield:${CACHE_VERSION}:${name.toLowerCase()}`

const memory = new Map<string, AonShield | null>()
const inflight = new Map<string, Promise<AonShield | null>>()

function readStored(name: string): AonShield | null | undefined {
    try {
        const raw = localStorage.getItem(storageKey(name))
        if (raw === null) return undefined
        return raw === 'null' ? null : (JSON.parse(raw) as AonShield)
    } catch {
        return undefined
    }
}

/** Já em memória ou no `localStorage` — para pintar sem esperar a rede. */
export function cachedShield(name: string): AonShield | null | undefined {
    if (memory.has(name)) return memory.get(name) ?? null
    const stored = readStored(name)
    if (stored !== undefined) memory.set(name, stored)
    return stored
}

export async function fetchShield(name: string): Promise<AonShield | null> {
    const cached = cachedShield(name)
    if (cached !== undefined) return cached

    let request = inflight.get(name)
    if (!request) {
        request = (async () => {
            try {
                const r = await fetch(`/api/search?${new URLSearchParams({ shields: name }).toString()}`)
                // Rede fora não pode virar "escudo sem números" para sempre.
                if (!r.ok) return null
                const body = await r.json() as { shields?: Record<string, AonShield> }
                const found = body.shields?.[name] ?? null
                memory.set(name, found)
                try { localStorage.setItem(storageKey(name), JSON.stringify(found)) } catch { /* cota cheia */ }
                return found
            } catch {
                return null
            } finally {
                inflight.delete(name)
            }
        })()
        inflight.set(name, request)
    }
    return request
}
