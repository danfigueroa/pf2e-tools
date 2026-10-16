/**
 * Companheiros de COMBATE do personagem: criaturas da AON que entram no encontro
 * junto com ele (a Animated Armor do Nathaniel, um familiar-criatura, um
 * invocado fixo). Não confundir com os `pets`/`familiars` que o Pathbuilder
 * exporta — esses viram a aba de Companheiros e têm ficha própria.
 *
 * É configuração do PERSONAGEM, da mesa (campo `companions`): quem monta o
 * encontro não precisa lembrar de adicionar a criatura toda vez, nem de enviar o
 * token de novo. O token é permanente (pasta `tokens/` do Blob), como o do
 * personagem — apagar um mapa nunca o leva junto.
 */

export interface Companion {
    /** Identidade estável (a mesma criatura não entra duas vezes no mesmo encontro). */
    id: string
    /** Nome EXATO da criatura na AON ("Animated Armor"): é por ele que a ficha é buscada. */
    name: string
    /** Token do mapa (Blob, ou `idb:` sem Blob). */
    token?: { url: string }
}

export const MAX_COMPANIONS = 6

export function sanitizeCompanions(raw: unknown): Companion[] {
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    const out: Companion[] = []
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const c = item as Partial<Companion> & { token?: { url?: unknown } }
        const id = typeof c.id === 'string' && /^[a-z0-9-]{1,40}$/.test(c.id) ? c.id : null
        const name = typeof c.name === 'string' ? c.name.trim().slice(0, 80) : ''
        if (!id || !name || seen.has(id)) continue
        seen.add(id)
        const url = c.token && typeof c.token.url === 'string' && c.token.url.length > 0 && c.token.url.length < 600 ? c.token.url : null
        out.push({ id, name, ...(url ? { token: { url } } : {}) })
        if (out.length >= MAX_COMPANIONS) break
    }
    return out
}

export const isCompanionsEmpty = (list: Companion[]) => list.length === 0

export const newCompanionId = (): string => crypto.randomUUID().slice(0, 8)
