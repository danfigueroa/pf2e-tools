// Cliente de `/api/creature?name=`: a ficha completa de uma criatura da AON.
//
// Mesma forma de `services/creatures.ts` — cache em memória e dedupe de
// requisições em voo, sem `localStorage`. Aqui não há tradução envolvida, então
// não existe o problema de cachear inglês que `descriptions.ts` precisa evitar:
// o que volta é determinístico e pode ser guardado à vontade.

import type { MonsterDetail } from '../modules/monster-scaler/types'

const cache = new Map<string, MonsterDetail>()
const inflight = new Map<string, Promise<MonsterDetail | null>>()

/**
 * @param name nome da criatura em inglês — é a chave de busca no AON.
 * @returns a ficha, ou `null` quando não existe ou a rede falhou. Nunca rejeita:
 *   a página trata "não achei" e "deu erro" do mesmo jeito, mostrando aviso.
 */
export async function fetchMonster(name: string): Promise<MonsterDetail | null> {
    const key = name.trim().toLowerCase()
    if (!key) return null

    const cached = cache.get(key)
    if (cached) return cached

    const pending = inflight.get(key)
    if (pending) return pending

    const request = (async (): Promise<MonsterDetail | null> => {
        try {
            const res = await fetch(`/api/creature?name=${encodeURIComponent(name.trim())}`)
            if (!res.ok) return null
            const data = (await res.json()) as MonsterDetail
            if (!data?.name) return null
            cache.set(key, data)
            return data
        } catch {
            return null
        } finally {
            inflight.delete(key)
        }
    })()

    inflight.set(key, request)
    return request
}
