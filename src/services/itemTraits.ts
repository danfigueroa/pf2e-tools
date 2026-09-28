// Traços dos itens do inventário, em inglês, direto do Archives of Nethys —
// para o Inventário saber o que é consumível e qual cura rolar.
//
// **Cachear inglês aqui é correto**, pelo mesmo motivo de `rules.ts`: o inglês é
// o resultado pretendido (ver `api/_lib/item-traits-core.js`), não tradução que
// falhou. Um item publicado não deixa de ser consumível, então vale guardar
// entre sessões — inclusive o "não achei" (`null`), senão todo inventário com
// um item caseiro repetiria a busca.

export interface ItemTraits {
    name: string
    level: number | null
    traits: string[]
    subcategory: string | null
    consumable: boolean
    /** Fórmula de cura ("3d6+6") dos itens com o traço Healing, lida do AON. */
    healing: string | null
}

const CACHE_VERSION = 'v1'
const storageKey = (name: string) => `pf2e:item:${CACHE_VERSION}:${name.toLowerCase()}`

const memory = new Map<string, ItemTraits | null>()

function readStored(name: string): ItemTraits | null | undefined {
    try {
        const raw = localStorage.getItem(storageKey(name))
        if (raw === null) return undefined
        return raw === 'null' ? null : (JSON.parse(raw) as ItemTraits)
    } catch {
        return undefined
    }
}

function remember(name: string, value: ItemTraits | null) {
    memory.set(name, value)
    try { localStorage.setItem(storageKey(name), JSON.stringify(value)) } catch { /* cota cheia */ }
}

const inflight = new Map<string, Promise<Record<string, ItemTraits | null>>>()

/**
 * Os traços de vários itens numa requisição só. Devolve por nome de ENTRADA;
 * `null` é item que o AON não tem com esse nome exato.
 */
export async function fetchItemTraits(names: string[]): Promise<Record<string, ItemTraits | null>> {
    const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    const out: Record<string, ItemTraits | null> = {}
    const missing: string[] = []

    for (const name of wanted) {
        if (memory.has(name)) { out[name] = memory.get(name) ?? null; continue }
        const stored = readStored(name)
        if (stored !== undefined) { memory.set(name, stored); out[name] = stored; continue }
        missing.push(name)
    }
    if (missing.length === 0) return out

    // A ficha monta as seções de uma vez; mesma lista, mesma requisição.
    const id = missing.slice().sort().join('|')
    let request = inflight.get(id)
    if (!request) {
        request = (async () => {
            const found: Record<string, ItemTraits | null> = {}
            try {
                const params = new URLSearchParams({ items: missing.join('|') })
                const r = await fetch(`/api/search?${params.toString()}`)
                if (!r.ok) return found
                const body = await r.json() as { items?: Record<string, ItemTraits> }
                // Só guarda o "não achei" depois de uma resposta de verdade:
                // rede fora não pode virar "não é consumível" para sempre.
                missing.forEach((name) => {
                    found[name] = body.items?.[name] ?? null
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

// Rede de segurança para o que o AON não casa pelo nome exato — o Pathbuilder
// escreve pergaminho como "Scroll of Heal (Rank 1)", e o AON tem um "Scroll"
// genérico. Esses viram consumíveis sem cura automática.
const CONSUMABLE_NAME_RE = /^scroll\b|\bscroll of\b|^talisman\b|\bpotion\b|\belixir\b|\bpoison\b|\bmutagen\b|\bbomb\b/i

/** Consumível pelo AON; sem entrada no AON, pelo nome. */
export function isConsumable(name: string, traits: ItemTraits | null | undefined): boolean {
    if (traits) return traits.consumable
    return CONSUMABLE_NAME_RE.test(name)
}
