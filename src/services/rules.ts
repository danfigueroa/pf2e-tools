// A regra de um termo, em inglês, direto do Archives of Nethys.
//
// **Cachear inglês aqui é correto**, ao contrário do que vale em
// `descriptions.ts`. Lá a regra "nada de cachear inglês" existe porque inglês
// significa TRADUÇÃO QUE FALHOU e precisa ser tentada de novo; aqui o inglês é
// o resultado pretendido (ver `api/_lib/rule-core.js`), e regra publicada não
// muda — então vale guardar entre sessões.

export interface AonRule {
    name: string
    category: string | null
    /** Em magia é o rank; nas outras categorias, `null`. */
    level: number | null
    actions: string | null
    traits: string[]
    text: string
    url: string
}

const CACHE_VERSION = 'v1'
const storageKey = (kind: string | null, name: string) =>
    `pf2e:rule:${CACHE_VERSION}:${kind ?? 'any'}:${name.toLowerCase()}`

const memory = new Map<string, AonRule | null>()
const inflight = new Map<string, Promise<AonRule | null>>()

function readStored(key: string): AonRule | null | undefined {
    try {
        const raw = localStorage.getItem(key)
        if (raw === null) return undefined
        return raw === 'null' ? null : (JSON.parse(raw) as AonRule)
    } catch {
        return undefined
    }
}

/**
 * @returns a regra, ou `null` quando o AON não tem o termo — o `null` também é
 *   guardado, senão todo hover num termo sem entrada repetiria a busca.
 */
export function fetchRule(name: string, kind: string | null = null): Promise<AonRule | null> {
    const term = name.trim()
    if (!term) return Promise.resolve(null)
    const key = storageKey(kind, term)

    if (memory.has(key)) return Promise.resolve(memory.get(key) ?? null)
    const stored = readStored(key)
    if (stored !== undefined) {
        memory.set(key, stored)
        return Promise.resolve(stored)
    }
    const pending = inflight.get(key)
    if (pending) return pending

    const params = new URLSearchParams({ rule: term })
    if (kind) params.set('kind', kind)

    const request = (async () => {
        let result: AonRule | null = null
        try {
            const r = await fetch(`/api/search?${params.toString()}`)
            if (r.ok) result = (await r.json()) as AonRule
        } catch {
            // Rede fora: não guarda nada, para a próxima tentativa valer.
            inflight.delete(key)
            return null
        }
        memory.set(key, result)
        try { localStorage.setItem(key, JSON.stringify(result)) } catch { /* cota cheia */ }
        inflight.delete(key)
        return result
    })()

    inflight.set(key, request)
    return request
}
