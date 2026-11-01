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
    /** Traços de arma: o nome em português (sem o original entre parênteses), para o chip. */
    label?: string
    /** A tradução falhou e a regra veio em inglês: não se guarda, a próxima consulta tenta de novo. */
    translationPending?: boolean
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

// --- Traços das armas, em português ---------------------------------------------------------------
// O servidor traduz e guarda no banco (`?traitRules=`, ver `api/_lib/rule-core.js`). Aqui o cache é do
// que já veio TRADUZIDO — chave própria (`trait-pt`), para não misturar com o inglês do stat block do
// monstro — e `translationPending` nunca é guardado ("nada de cachear inglês").

const PT = 'trait-pt'
const ptKey = (term: string) => storageKey(PT, term)

/** A regra do traço se já estiver na memória ou no aparelho; não vai à rede. */
export function peekTraitRule(term: string): AonRule | null {
    const key = ptKey(term.trim())
    if (memory.has(key)) return memory.get(key) ?? null
    const stored = readStored(key)
    if (stored) { memory.set(key, stored); return stored }
    return null
}

/**
 * As regras dos traços (em português) de uma vez só. Cada uma entra no cache; o que o servidor não
 * achou, ou que veio em inglês por falha de tradução, fica de fora e é pedido de novo na próxima.
 */
export async function prefetchTraitRules(terms: string[]): Promise<void> {
    const missing = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].filter((t) => !peekTraitRule(t))
    if (missing.length === 0) return
    try {
        const r = await fetch(`/api/search?${new URLSearchParams({ traitRules: missing.join('|') }).toString()}`)
        if (!r.ok) return
        const { rules } = (await r.json()) as { rules?: Record<string, AonRule> }
        for (const [term, rule] of Object.entries(rules ?? {})) {
            if (rule.translationPending) continue
            const key = ptKey(term)
            memory.set(key, rule)
            try { localStorage.setItem(key, JSON.stringify(rule)) } catch { /* cota cheia */ }
        }
    } catch { /* sem rede: o toque no chip tenta sozinho */ }
}

/** A regra de UM traço, em português: do cache, senão do servidor. `null` = a AON não tem. */
export async function fetchTraitRule(term: string): Promise<AonRule | null> {
    const cached = peekTraitRule(term)
    if (cached) return cached
    await prefetchTraitRules([term])
    return peekTraitRule(term)
}
