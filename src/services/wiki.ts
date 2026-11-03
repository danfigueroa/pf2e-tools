// Wiki da Mesa (api/_lib/wiki-handler.js): o transporte, o índice compartilhado e o aviso ao vivo.
//
// O servidor decide quem vê e edita o quê; o jogador nunca recebe os trechos `:::mestre` (o `body`
// que chega a ele já vem sem eles). O índice (`useWikiIndex`) é um só por aba, lido na primeira
// assinatura e relido a cada aviso do canal `mesa:<mesa>:wiki` — a página da Wiki e o Diário de
// Campanha (que resolve `[[Nome]]` também na Wiki) o dividem.

import { useSyncExternalStore } from 'react'
import { stateApi } from './mesa'
import { authHeaderNow, listenMesaChannel } from './supabase'
import { markOwnShare } from './rolls'
import { tr } from '../i18n'

export const WIKI_KINDS = ['npc', 'location', 'item', 'creature', 'faction', 'deity', 'event', 'lore', 'other'] as const
export type WikiKind = typeof WIKI_KINDS[number]

/** A criatura da AON ligada a uma página de criatura. */
export interface WikiAon { name: string; level: number | null; url: string | null; traits: string[] }

export interface WikiSummary {
    id: string
    kind: WikiKind
    title: string
    aliases: string[]
    tags: string[]
    summary: string
    image: string | null
    parent: string | null
    visibility: 'public' | 'gm'
    locked: boolean
    rev: number
    createdBy: string | null
    createdAt: number
    updatedBy: string | null
    updatedAt: number
    deletedAt: number | null
}

export interface WikiPage extends WikiSummary {
    /** A infobox: texto curto por campo (aceita `[[ ]]`). */
    fields: Record<string, string>
    aon: WikiAon | null
    /** Markdown. Para o jogador, já sem os trechos do mestre. */
    body: string
    /** Só o GM: o texto tem trechos `:::mestre`. */
    hasSecrets: boolean
}

export interface WikiBacklink { id: string; kind: WikiKind; title: string }

export interface WikiPageView {
    page: WikiPage
    backlinks: WikiBacklink[]
    authors: Record<string, string>
    canEdit: boolean
    canDelete: boolean
}

export interface WikiRevisionInfo { rev: number; by: string | null; at: number; title: string }
export interface WikiRevision { rev: number; meta: Record<string, unknown>; body: string; by: string | null; at: number }
export interface WikiChange { page: string; rev: number; by: string | null; at: number; title: string; kind: WikiKind }
export interface WikiSearchHit { id: string; title: string; kind: WikiKind; snippet: string }

export const newWikiId = () => `w-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

const post = (payload: Record<string, unknown>) => fetch(stateApi(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
    body: JSON.stringify(payload),
})

async function getJson<T>(query: string): Promise<T | null> {
    try {
        const r = await fetch(stateApi(query))
        if (!r.ok) return null
        return await r.json() as T
    } catch {
        return null
    }
}

const isKind = (v: unknown): v is WikiKind => (WIKI_KINDS as readonly string[]).includes(v as string)
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const numOr = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const strOr = (v: unknown) => (typeof v === 'string' ? v : null)

function toSummary(raw: unknown): WikiSummary | null {
    const r = raw as Record<string, unknown> | null
    if (!r || typeof r.id !== 'string' || typeof r.title !== 'string' || !isKind(r.kind)) return null
    return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        aliases: strs(r.aliases),
        tags: strs(r.tags),
        summary: typeof r.summary === 'string' ? r.summary : '',
        image: strOr(r.image),
        parent: strOr(r.parent),
        visibility: r.visibility === 'gm' ? 'gm' : 'public',
        locked: r.locked === true,
        rev: numOr(r.rev, 1),
        createdBy: strOr(r.createdBy),
        createdAt: numOr(r.createdAt, 0),
        updatedBy: strOr(r.updatedBy),
        updatedAt: numOr(r.updatedAt, 0),
        deletedAt: typeof r.deletedAt === 'number' ? r.deletedAt : null,
    }
}

function toAon(raw: unknown): WikiAon | null {
    const r = raw as Record<string, unknown> | null
    if (!r || typeof r.name !== 'string') return null
    return {
        name: r.name,
        level: typeof r.level === 'number' ? r.level : null,
        url: strOr(r.url),
        traits: strs(r.traits),
    }
}

function toPage(raw: unknown): WikiPage | null {
    const base = toSummary(raw)
    if (!base) return null
    const r = raw as Record<string, unknown>
    const rawFields = (r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, unknown>
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawFields)) if (k !== 'aon' && typeof v === 'string') fields[k] = v
    return {
        ...base,
        fields,
        aon: toAon(rawFields.aon),
        body: typeof r.body === 'string' ? r.body : '',
        hasSecrets: r.hasSecrets === true,
    }
}

/** O que vai ao servidor: a infobox com a criatura dentro, sem autoria nem versão. */
export function wirePage(page: WikiPage) {
    return {
        id: page.id,
        kind: page.kind,
        title: page.title,
        aliases: page.aliases,
        tags: page.tags,
        summary: page.summary,
        image: page.image,
        parent: page.parent,
        fields: page.aon ? { ...page.fields, aon: page.aon } : page.fields,
        body: page.body,
        visibility: page.visibility,
    }
}

export function blankPage(kind: WikiKind, title: string, body = ''): WikiPage {
    return {
        id: newWikiId(), kind, title, aliases: [], tags: [], summary: '', image: null, parent: null,
        visibility: 'public', locked: false, rev: 0, createdBy: null, createdAt: 0, updatedBy: null, updatedAt: 0,
        deletedAt: null, fields: {}, aon: null, body, hasSecrets: false,
    }
}

// ── Leituras ─────────────────────────────────────────────────────────────────

export interface WikiList { pages: WikiSummary[]; authors: Record<string, string>; gm: boolean }

export async function fetchWikiList(trash = false): Promise<WikiList | null> {
    const body = await getJson<{ pages?: unknown[]; authors?: Record<string, string>; gm?: boolean }>(`?wiki=${trash ? 'trash' : 'list'}`)
    if (!body || !Array.isArray(body.pages)) return null
    return {
        pages: body.pages.map(toSummary).filter((p): p is WikiSummary => !!p),
        authors: body.authors ?? {},
        gm: body.gm === true,
    }
}

/** A página como esta pessoa a vê; `null` quando não existe (ou não é para ela); `undefined` sem rede. */
export async function fetchWikiPage(id: string): Promise<WikiPageView | null | undefined> {
    try {
        const r = await fetch(stateApi(`?wiki=${encodeURIComponent(id)}`))
        if (r.status === 404) return null
        if (!r.ok) return undefined
        const body = await r.json() as Record<string, unknown>
        const page = toPage(body.page)
        if (!page) return null
        return {
            page,
            backlinks: Array.isArray(body.backlinks)
                ? (body.backlinks as unknown[]).map((b) => b as WikiBacklink).filter((b) => b && typeof b.id === 'string' && isKind(b.kind))
                : [],
            authors: (body.authors as Record<string, string>) ?? {},
            canEdit: body.canEdit === true,
            canDelete: body.canDelete === true,
        }
    } catch {
        return undefined
    }
}

export async function fetchWikiHistory(id: string): Promise<{ revisions: WikiRevisionInfo[]; authors: Record<string, string> } | null> {
    const body = await getJson<{ revisions?: WikiRevisionInfo[]; authors?: Record<string, string> }>(`?wikiHistory=${encodeURIComponent(id)}`)
    return body && Array.isArray(body.revisions) ? { revisions: body.revisions, authors: body.authors ?? {} } : null
}

export async function fetchWikiRevision(id: string, rev: number): Promise<WikiRevision | null> {
    const body = await getJson<{ revision?: WikiRevision }>(`?wikiRev=${encodeURIComponent(id)}&rev=${rev}`)
    return body?.revision ?? null
}

export async function fetchWikiRecent(): Promise<{ changes: WikiChange[]; authors: Record<string, string> } | null> {
    const body = await getJson<{ changes?: WikiChange[]; authors?: Record<string, string> }>('?wiki=recent')
    return body && Array.isArray(body.changes) ? { changes: body.changes.filter((c) => isKind(c.kind)), authors: body.authors ?? {} } : null
}

export async function searchWiki(q: string): Promise<WikiSearchHit[] | null> {
    const body = await getJson<{ results?: WikiSearchHit[] }>(`?wiki=search&q=${encodeURIComponent(q)}`)
    return body && Array.isArray(body.results) ? body.results.filter((h) => isKind(h.kind)) : null
}

// ── Escritas ─────────────────────────────────────────────────────────────────

export type WikiSaveResult =
    | { ok: true; updatedAt: number; rev: number }
    | { ok: false; conflict: true; current: WikiPage | null }
    | { ok: false; conflict: false; error: string }

async function saveCall(payload: Record<string, unknown>): Promise<WikiSaveResult> {
    try {
        const r = await post(payload)
        const body = await r.json().catch(() => ({})) as { updatedAt?: number; rev?: number; error?: string; code?: string; page?: unknown }
        if (r.status === 409 && body.code === 'conflict') return { ok: false, conflict: true, current: toPage(body.page) }
        if (!r.ok || typeof body.updatedAt !== 'number') {
            return { ok: false, conflict: false, error: body.error ?? tr('Não foi possível salvar', 'Could not save') }
        }
        notifyLocalChange()
        return { ok: true, updatedAt: body.updatedAt, rev: numOr(body.rev, 1) }
    } catch {
        return { ok: false, conflict: false, error: tr('Sem conexão', 'No connection') }
    }
}

/** Grava se a página ainda for a que este aparelho viu (`base`; `null` = nova). */
export const saveWikiPage = (page: WikiPage, base: number | null) => saveCall({ action: 'wiki-save', page: wirePage(page), base })

export const restoreWikiRevision = (id: string, rev: number, base: number) => saveCall({ action: 'wiki-restore', id, rev, base })

/** `null` deu certo; senão, o motivo. */
async function simple(payload: Record<string, unknown>): Promise<string | null> {
    try {
        const r = await post(payload)
        if (r.ok) { notifyLocalChange(); return null }
        const body = await r.json().catch(() => ({})) as { error?: string }
        return body.error ?? tr('Não foi possível concluir', 'Could not finish')
    } catch {
        return tr('Sem conexão', 'No connection')
    }
}

export const deleteWikiPage = (id: string) => simple({ action: 'wiki-delete', id })
export const undeleteWikiPage = (id: string) => simple({ action: 'wiki-undelete', id })
export const purgeWikiPage = (id: string) => simple({ action: 'wiki-purge', id })
export const setWikiFlags = (id: string, flags: { locked?: boolean; visibility?: 'public' | 'gm' }) =>
    simple({ action: 'wiki-flags', id, ...flags })

/** Mostra a parte pública da página no cartão de toda a mesa (o mesmo handout do Diário). */
export function showWikiPage(id: string, by: string, color: string): Promise<string | null> {
    const reveal = `h-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    // O cartão não aparece no aparelho de quem mostrou.
    markOwnShare(reveal)
    return simple({ action: 'wiki-show', id, reveal, by, color })
}

// ── O aviso ao vivo ──────────────────────────────────────────────────────────

/** Aquela página mudou (ou saiu de vez). Sem título: a página pode ser só do GM. */
export interface WikiNotice { page: string; updatedAt: number | null; removed: boolean }

type NoticeListener = (notice: WikiNotice) => void
type LiveListener = (live: boolean) => void
const noticeListeners = new Set<NoticeListener>()
const liveListeners = new Set<LiveListener>()
let channelStarted = false
let live = false

// Um canal só, aberto na primeira assinatura e mantido — o desenho de `listenJournal`.
function startChannel() {
    if (channelStarted) return
    channelStarted = true
    void listenMesaChannel('wiki', {
        wiki: (payload) => {
            const p = payload as { page?: unknown; updatedAt?: unknown; removed?: unknown } | null
            if (!p || typeof p.page !== 'string') return
            const notice: WikiNotice = {
                page: p.page,
                updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : null,
                removed: p.removed === true,
            }
            for (const listener of noticeListeners) listener(notice)
        },
    }, (next) => {
        live = next
        for (const listener of liveListeners) listener(next)
    }).then((stop) => {
        if (!stop) channelStarted = false
    })
}

/** Ouve os avisos da Wiki. `onLive` a cada (re)conexão: hora de reler. */
export function listenWiki(onNotice: NoticeListener, onLive: LiveListener = () => {}): () => void {
    noticeListeners.add(onNotice)
    liveListeners.add(onLive)
    startChannel()
    if (live) onLive(true)
    return () => {
        noticeListeners.delete(onNotice)
        liveListeners.delete(onLive)
    }
}

// ── O índice compartilhado ───────────────────────────────────────────────────

export interface WikiIndex { list: WikiList | null; failed: boolean }

let index: WikiIndex = { list: null, failed: false }
const indexListeners = new Set<() => void>()
let indexStarted = false
let reloadTimer: ReturnType<typeof setTimeout> | null = null

async function reloadIndex() {
    const list = await fetchWikiList()
    index = list ? { list, failed: false } : { list: index.list, failed: true }
    indexListeners.forEach((l) => l())
}

function reloadSoon() {
    if (reloadTimer) clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => { reloadTimer = null; void reloadIndex() }, 400)
}

/** Este aparelho escreveu: o índice relê (sem esperar o aviso do banco, que pode nem vir sem Supabase). */
function notifyLocalChange() {
    if (indexStarted) reloadSoon()
}

function startIndex() {
    if (indexStarted) return
    indexStarted = true
    void reloadIndex()
    listenWiki(reloadSoon, (on) => { if (on) reloadSoon() })
}

const subscribe = (l: () => void) => {
    indexListeners.add(l)
    startIndex()
    return () => { indexListeners.delete(l) }
}

/** O índice da Wiki (resumos das páginas que esta pessoa vê, os nomes dos autores e se ela é GM). */
export const useWikiIndex = (): WikiIndex => useSyncExternalStore(subscribe, () => index)

/** Relê o índice agora (o botão "Tentar de novo"). */
export const refreshWikiIndex = () => reloadIndex()
