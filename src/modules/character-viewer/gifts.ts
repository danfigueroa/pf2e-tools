// Passar item de um personagem a outro. Sem login e com "última escrita vence" por
// fatia, dois remetentes gravando no mesmo destinatário se atropelariam — então cada
// jogador escreve só na PRÓPRIA fatia (`gave`) o que já passou a cada colega, e quem
// recebe soma o que aponta para ele (`incoming`, lido de todas as fatias `gave`).
//
// A quantidade que alguém tem é DERIVADA: ficha + recebido − passado − usado. Nada
// aqui edita o JSON do Pathbuilder.

import type { ItemRow } from './inventory'

/** Destinatário (slug) → item → quantidade passada, cumulativa. */
export type Gave = Record<string, Record<string, number>>
/** Remetente (slug) → item → quantidade que ele me passou, cumulativa. */
export type Incoming = Record<string, Record<string, number>>

export const MAX_GAVE_TARGETS = 12
export const MAX_GAVE_ITEMS = 40
const MAX_NAME = 80
const MAX_QTY = 99
const SLUG_RE = /^[a-z0-9-]{1,64}$/

const emptyItems = (): Record<string, number> => ({})

function sanitizeItems(raw: unknown): Record<string, number> {
    const out = emptyItems()
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        if (Object.keys(out).length >= MAX_GAVE_ITEMS) break
        const n = Math.min(MAX_QTY, Math.floor(Number(value) || 0))
        if (n > 0 && name.length > 0 && name.length <= MAX_NAME) out[name] = n
    }
    return out
}

/** Valida `{ slug: { item: n } }` — o que veio do servidor, do cache ou de outro aparelho. */
export function sanitizeGave(raw: unknown): Gave {
    const out: Gave = {}
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
    for (const [slug, items] of Object.entries(raw as Record<string, unknown>)) {
        if (Object.keys(out).length >= MAX_GAVE_TARGETS) break
        if (!SLUG_RE.test(slug)) continue
        const clean = sanitizeItems(items)
        if (Object.keys(clean).length > 0) out[slug] = clean
    }
    return out
}

export const isGaveEmpty = (g: Gave): boolean => Object.keys(g).length === 0

/** O que `incoming` guarda tem a mesma forma de `gave`, só que por remetente. */
export const sanitizeIncoming = (raw: unknown): Incoming => sanitizeGave(raw)

const sum = (book: Record<string, Record<string, number>>, name: string): number =>
    Object.values(book).reduce((acc, items) => acc + (items[name] ?? 0), 0)

/** Variação líquida de um item: o que chegou menos o que saiu. */
export const deltaOf = (name: string, gave: Gave, incoming: Incoming): number =>
    sum(incoming, name) - sum(gave, name)

/** Quanto este colega me passou, líquido do que já devolvi a ele (> 0 = tenho dele). */
export const heldFrom = (from: string, name: string, gave: Gave, incoming: Incoming): number =>
    (incoming[from]?.[name] ?? 0) - (gave[from]?.[name] ?? 0)

/** Os remetentes de quem ainda tenho o item, com quantos. */
export function holdersOf(name: string, gave: Gave, incoming: Incoming): { slug: string; n: number }[] {
    const slugs = new Set([...Object.keys(incoming), ...Object.keys(gave)])
    return [...slugs]
        .map((slug) => ({ slug, n: heldFrom(slug, name, gave, incoming) }))
        .filter((h) => h.n > 0)
}

/**
 * Soma `n` (negativo desfaz) ao que foi passado a `to`. Zera e remove o que chega a 0,
 * e respeita os tetos do sanitize — a fatia do servidor tem o mesmo limite.
 */
export function addGave(gave: Gave, to: string, name: string, n: number): Gave {
    const items = { ...(gave[to] ?? {}) }
    const next = Math.min(MAX_QTY, (items[name] ?? 0) + n)
    if (next > 0) items[name] = next
    else delete items[name]
    const out = { ...gave }
    if (Object.keys(items).length > 0) out[to] = items
    else delete out[to]
    return out
}

/** Dá para registrar esta passagem sem estourar os tetos da fatia? */
export function canGave(gave: Gave, to: string, name: string): boolean {
    if ((gave[to]?.[name] ?? 0) > 0) return true
    if (!gave[to] && Object.keys(gave).length >= MAX_GAVE_TARGETS) return false
    return Object.keys(gave[to] ?? {}).length < MAX_GAVE_ITEMS
}

/**
 * As linhas do inventário com o que foi passado: o item da ficha ganha/perde a
 * variação líquida (e some se não sobra nada); o que a pessoa só recebeu vira
 * uma linha nova, marcada "Recebido".
 */
export function withGifts(rows: ItemRow[], gave: Gave, incoming: Incoming): ItemRow[] {
    const names = new Set([...Object.values(incoming), ...Object.values(gave)].flatMap((items) => Object.keys(items)))
    if (names.size === 0) return rows
    const seen = new Set<string>()
    const out: ItemRow[] = []
    for (const row of rows) {
        if (!row.equipment || !names.has(row.name) || seen.has(row.name)) { out.push(row); continue }
        seen.add(row.name)
        const qty = row.sheetQty + deltaOf(row.name, gave, incoming)
        if (qty <= 0) continue
        out.push({ ...row, qty, tags: deltaOf(row.name, gave, incoming) > 0 ? [...row.tags, 'Recebido'] : row.tags })
    }
    for (const name of names) {
        if (seen.has(name)) continue
        const qty = deltaOf(name, gave, incoming)
        if (qty > 0) out.push({ label: name, name, qty, sheetQty: 0, tags: ['Recebido'], equipment: true })
    }
    return out
}

/** O que chegou a mais entre dois retratos de `incoming` — o que o aviso "te enviou" mostra. */
export function arrivals(prev: Incoming, next: Incoming): { from: string; name: string; n: number }[] {
    const out: { from: string; name: string; n: number }[] = []
    for (const [from, items] of Object.entries(next)) {
        for (const [name, n] of Object.entries(items)) {
            const grew = n - (prev[from]?.[name] ?? 0)
            if (grew > 0) out.push({ from, name, n: grew })
        }
    }
    return out
}
