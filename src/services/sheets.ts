// Fichas publicadas pela mesa — cliente de `/api/state?sheet…` (ver
// `api/_lib/sheet-handler.js`).
//
// Um jogador que subiu de nível exporta o JSON do Pathbuilder e publica: a
// partir daí a Ficha Virtual, a Iniciativa e a Transformação carregam a versão
// publicada em vez do arquivo fixo de `public/characters/`. Sem cache local de
// propósito: a ficha publicada muda justamente quando alguém a atualiza, e o
// clique no personagem é o momento de buscar a versão da mesa.

export interface PublishedGuide {
    markdown: string
    generatedAt: number
}

export interface PublishedSheet {
    slug: string
    /** O JSON do Pathbuilder como foi publicado (com `build`). */
    json: unknown
    name: string
    className: string
    level: number
    publishedAt: number
    guide: PublishedGuide | null
    previous: { publishedAt: number; level: number | null } | null
}

export interface PublishedSummary {
    slug: string
    name: string
    className: string
    level: number
    publishedAt: number
    hasGuide: boolean
}

async function call<T>(init: RequestInit | null, query = ''): Promise<T> {
    const r = await fetch(`/api/state${query}`, init ?? undefined)
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error((body as { error?: string }).error || `Erro ${r.status}`)
    return body as T
}

const post = <T>(payload: Record<string, unknown>) =>
    call<T>({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

export async function listPublished(): Promise<PublishedSummary[]> {
    try {
        const { sheets } = await call<{ sheets: PublishedSummary[] }>(null, '?sheets=1')
        return sheets ?? []
    } catch {
        return []
    }
}

/** A ficha publicada deste personagem, ou `null` (nunca publicada, ou rede fora). */
export async function fetchPublished(slug: string): Promise<PublishedSheet | null> {
    try {
        const { sheet } = await call<{ sheet: PublishedSheet | null }>(null, `?sheet=${encodeURIComponent(slug)}`)
        return sheet
    } catch {
        return null
    }
}

export async function publishSheet(json: unknown): Promise<PublishedSheet> {
    const { sheet } = await post<{ sheet: PublishedSheet }>({ action: 'publish', sheet: json })
    return sheet
}

/**
 * Gera o guia da versão publicada. `baseGuide` é o guia que o app mostrava
 * (o curado à mão) — o servidor só o usa quando não tem o guia da versão
 * anterior. Demora: a cadeia de IA leva de 5 a 30 segundos.
 */
export async function requestGuide(slug: string, baseGuide: string | null): Promise<PublishedSheet> {
    const { sheet } = await post<{ sheet: PublishedSheet }>({ action: 'guide', char: slug, baseGuide })
    return sheet
}

export async function restoreSheet(slug: string): Promise<PublishedSheet> {
    const { sheet } = await post<{ sheet: PublishedSheet }>({ action: 'restore', char: slug })
    return sheet
}
