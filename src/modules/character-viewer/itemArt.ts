/**
 * A imagem que o jogador escolheu para cada arma, armadura ou item do Inventário. Como o apelido das armas
 * (`attackNames.ts`), é APRESENTAÇÃO e mora num campo à parte da mesa (`art`, por personagem), nunca no JSON da
 * ficha — o próximo export do Pathbuilder desfaria.
 *
 * A chave é o NOME do item (minúsculo), sem a ocorrência: duas Daggers dividem a imagem, e ela sobrevive a mudar a
 * quantidade, a passar o item para um colega (a linha "Recebido" tem o mesmo nome) e ao reexport. A imagem fica na
 * pasta `items/` do bucket, permanente como `tokens/`.
 */

export type ItemArtStored = Record<string, string>

// O campo da mesa tem teto de 8 KB: 25 × (chave de 80 + URL de 220) ainda cabe, com folga para o JSON.
// Uma URL do Storage tem ~170 caracteres.
export const MAX_ITEM_ART = 25
export const MAX_ART_URL = 220
export const MAX_ART_KEY = 80

export const NO_ITEM_ART: ItemArtStored = {}

/** A chave do item: o nome canônico (o que se busca na AON), minúsculo. */
export const itemArtKey = (name: string): string => name.trim().toLowerCase().slice(0, MAX_ART_KEY)

/** Só URL de imagem nossa (https do Storage) ou a local (`idb:`, sem Supabase). */
const isArtUrl = (v: string) => /^(https:\/\/|idb:)/.test(v) && v.length <= MAX_ART_URL

export function sanitizeItemArt(raw: unknown): ItemArtStored {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NO_ITEM_ART
    const out: ItemArtStored = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (Object.keys(out).length >= MAX_ITEM_ART) break
        if (typeof value !== 'string' || !key || key.length > MAX_ART_KEY || !isArtUrl(value)) continue
        out[key] = value
    }
    return out
}

export const isItemArtEmpty = (s: ItemArtStored) => Object.keys(s).length === 0
