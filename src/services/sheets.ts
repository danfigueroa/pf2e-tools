// Fichas publicadas pela mesa — cliente de `/api/state?sheet…` (ver
// `api/_lib/sheet-handler.js`).
//
// Um jogador que subiu de nível exporta o JSON do Pathbuilder e publica: a
// partir daí a Ficha Virtual, a Iniciativa e a Transformação carregam a versão
// publicada em vez do arquivo fixo de `public/characters/`. Sem cache local de
// propósito: a ficha publicada muda justamente quando alguém a atualiza, e o
// clique no personagem é o momento de buscar a versão da mesa.

import { stateApi } from './mesa'
import { authHeaders } from './supabase'
import { lang, type Lang, tr } from '../i18n'

export interface GuideText {
    markdown: string
    generatedAt: number
    /** O dono (ou o GM) editou este texto à mão; a próxima geração da IA parte dele. */
    editedAt?: number
}

/**
 * O guia gerado: o português no topo (como sempre foi) e o inglês em `en`, gerado junto
 * na publicação — da ficha, não traduzido. Ficha publicada antes do inglês não tem `en`.
 * O português pode faltar quando só o inglês deu certo.
 */
export interface PublishedGuide {
    markdown?: string
    generatedAt?: number
    editedAt?: number
    en?: GuideText
}

/** O guia no idioma `target` (o desta página, por padrão), ou `null`. */
export function guideIn(guide: PublishedGuide | null | undefined, target: Lang = lang): GuideText | null {
    if (!guide) return null
    if (target === 'en') return guide.en?.markdown ? guide.en : null
    return guide.markdown && guide.generatedAt
        ? { markdown: guide.markdown, generatedAt: guide.generatedAt, ...(guide.editedAt ? { editedAt: guide.editedAt } : {}) }
        : null
}

/** As bases curadas à mão de cada idioma (o servidor só as usa sem o guia da versão anterior). */
export interface GuideBases {
    pt: string | null
    en: string | null
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
    /** Quem é dono da ficha (só ele e o GM alteram); `null` = sem dono, só o GM. */
    ownerId: string | null
    previous: { publishedAt: number; level: number | null } | null
}

export interface PublishedSummary {
    slug: string
    name: string
    className: string
    level: number
    publishedAt: number
    hasGuide: boolean
    ownerId: string | null
}

/** Erro de um pedido ao servidor, com o status (0 = sem resposta: rede fora). */
export class SheetApiError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

async function call<T>(init: RequestInit | null, query = ''): Promise<T> {
    let r: Response
    try {
        r = await fetch(stateApi(query), init ?? undefined)
    } catch {
        throw new SheetApiError(tr('Sem conexão com o servidor', 'No connection to the server'), 0)
    }
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new SheetApiError((body as { error?: string }).error || tr(`Erro ${r.status}`, `Error ${r.status}`), r.status)
    return body as T
}

// A sessão anônima vai junto para o servidor registrar quem publicou ou restaurou.
const post = async <T>(payload: Record<string, unknown>) =>
    call<T>({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(payload),
    })

export async function listPublished(): Promise<PublishedSummary[]> {
    return (await listSheetsAndDrafts()).sheets
}

/** As fichas publicadas e os rascunhos em preparo (uma consulta só). */
export async function listSheetsAndDrafts(): Promise<{ sheets: PublishedSummary[]; drafts: SheetDraft[] }> {
    try {
        const { sheets, drafts } = await call<{ sheets?: PublishedSummary[]; drafts?: SheetDraft[] }>(null, '?sheets=1')
        return { sheets: sheets ?? [], drafts: drafts ?? [] }
    } catch {
        return { sheets: [], drafts: [] }
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
 * Gera o guia da versão publicada. `base` é o guia que o app mostrava (o curado à
 * mão, em cada idioma) — o servidor só o usa quando não tem o guia da versão
 * anterior. `only` pede um idioma só (ausente = os dois, que é o da publicação).
 * Demora: a cadeia de IA leva de 5 a 30 segundos.
 */
export async function requestGuide(slug: string, base: GuideBases, only?: Lang): Promise<PublishedSheet> {
    const { sheet } = await post<{ sheet: PublishedSheet }>({
        action: 'guide', char: slug, baseGuide: base.pt, baseGuideEn: base.en, ...(only ? { lang: only } : {}),
    })
    return sheet
}

/**
 * Grava o guia editado à mão, no idioma desta página. `publishedAt` é o da versão que estava na tela: se alguém
 * publicou outra no meio, o servidor recusa (409) em vez de pôr o texto antigo na ficha nova.
 */
export async function saveEditedGuide(slug: string, publishedAt: number, markdown: string): Promise<PublishedSheet> {
    const { sheet } = await post<{ sheet: PublishedSheet }>({ action: 'guide-edit', char: slug, publishedAt, markdown, lang })
    return sheet
}

export async function restoreSheet(slug: string): Promise<PublishedSheet> {
    const { sheet } = await post<{ sheet: PublishedSheet }>({ action: 'restore', char: slug })
    return sheet
}

// --- Publicação preparada (ver `api/_lib/sheet-draft.js`) -----------------------------
//
// O JSON enviado vira um RASCUNHO, e a ficha só entra na mesa quando tudo o que ela precisa
// está no banco: consultas da AON, companheiros, descrições em português e em inglês, o guia
// nas duas línguas. Quem publicou conduz o preparo (`draft-step` em laço, `sheetPreparation.ts`).

/** Os passos do preparo, na ordem em que o servidor os faz. */
export const DRAFT_STEPS = ['lookups', 'companions', 'desc-pt', 'desc-en', 'guide-pt', 'guide-en', 'finish'] as const
export type DraftStep = (typeof DRAFT_STEPS)[number]

/** Por que o preparo está esperando: a tradução, o guia, a AON, outro aparelho, a rede. */
export type DraftWaitReason = 'translation' | 'guide' | 'aon' | 'busy' | 'network'

export interface DraftProgress {
    step: DraftStep
    steps: Record<DraftStep, 'pending' | 'done'>
    /** Quantas descrições faltam, por idioma. */
    remaining: Partial<Record<DraftStep, number>>
    done: number
    total: number
    waiting: DraftWaitReason | null
    retryAt: number | null
    attempts: number
}

export interface SheetDraft {
    slug: string
    name: string
    className: string
    level: number
    /** Quem enviou (conduz o preparo, com o GM). */
    createdBy: string | null
    updatedAt: number
    progress: DraftProgress
}

export type DraftStepResult =
    | { state: 'working' | 'waiting' | 'busy'; retryIn?: number; draft?: SheetDraft }
    | { state: 'ready'; sheet: PublishedSheet }
    | { state: 'error'; error: string; draft?: SheetDraft }
    | { state: 'gone' }

export interface DraftInput {
    json: unknown
    names: Record<'spell' | 'feat' | 'special' | 'item', string[]>
    /** A `CACHE_VERSION` das descrições. */
    version: string
    companions: string[]
    base: GuideBases
}

export async function createDraft(input: DraftInput): Promise<SheetDraft> {
    const { draft } = await post<{ draft: SheetDraft }>({
        action: 'draft-create',
        sheet: input.json,
        names: input.names,
        version: input.version,
        companions: input.companions,
        baseGuide: input.base.pt,
        baseGuideEn: input.base.en,
    })
    return draft
}

export const stepDraft = (slug: string) => post<DraftStepResult>({ action: 'draft-step', char: slug })

export async function discardDraft(slug: string): Promise<void> {
    await post({ action: 'draft-discard', char: slug })
}

/** O andamento de um rascunho, ou `null` (não há, ou rede fora). */
export async function fetchDraft(slug: string): Promise<SheetDraft | null> {
    try {
        const { draft } = await call<{ draft: SheetDraft | null }>(null, `?sheetDraft=${encodeURIComponent(slug)}`)
        return draft
    } catch {
        return null
    }
}
