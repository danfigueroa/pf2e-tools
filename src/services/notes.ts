// Anotações do personagem (api/_lib/notes-handler.js): o transporte. Ler é de
// qualquer membro da mesa; gravar, do dono da ficha e do GM.
//
// O documento volta CRU daqui — quem o valida é `sanitizeNotes`
// (`modules/character-viewer/notes.ts`), também para o rascunho do `localStorage`.

import { stateApi } from './mesa'
import { authHeaderNow, listenMesaChannel } from './supabase'

export interface RawNotes { data: unknown; updatedAt: number }

const asRaw = (v: unknown): RawNotes | null => {
    const r = v as { data?: unknown; updatedAt?: unknown } | null
    return r && typeof r.updatedAt === 'number' ? { data: r.data, updatedAt: r.updatedAt } : null
}

/** `null` quando o personagem ainda não tem anotações; `undefined` quando não deu para saber. */
export async function fetchNotes(slug: string): Promise<RawNotes | null | undefined> {
    try {
        const r = await fetch(stateApi(`?notes=${encodeURIComponent(slug)}`))
        if (!r.ok) return undefined
        return asRaw(((await r.json()) as { notes?: unknown }).notes)
    } catch {
        return undefined
    }
}

export type SaveResult =
    | { ok: true; updatedAt: number }
    | { ok: false; conflict: true; current: RawNotes | null }
    | { ok: false; conflict: false; error: string }

/** Grava se o documento ainda for o que este aparelho viu (`base`; `null` = primeiro salvamento). */
export async function saveNotes(slug: string, data: unknown, base: number | null): Promise<SaveResult> {
    try {
        const r = await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify({ action: 'notes-save', char: slug, data, base }),
        })
        const body = await r.json().catch(() => ({})) as { updatedAt?: number; error?: string; code?: string; notes?: unknown }
        if (r.status === 409 && body.code === 'conflict') return { ok: false, conflict: true, current: asRaw(body.notes) }
        if (!r.ok || typeof body.updatedAt !== 'number') return { ok: false, conflict: false, error: body.error ?? 'Não foi possível salvar' }
        return { ok: true, updatedAt: body.updatedAt }
    } catch {
        return { ok: false, conflict: false, error: 'Sem conexão' }
    }
}

/** O aviso do banco: as anotações daquele personagem mudaram. Sem texto — o canal é de toda a mesa. */
export interface NotesNotice { slug: string; updatedAt: number | null }

type NoticeListener = (notice: NotesNotice) => void
type LiveListener = (live: boolean) => void
const noticeListeners = new Set<NoticeListener>()
const liveListeners = new Set<LiveListener>()
let channelStarted = false
let live = false

// Um canal só, aberto na primeira assinatura e mantido (o StrictMode sai e entra
// no mesmo tópico em seguida) — mesmo desenho de `listenJournal`.
function startChannel() {
    if (channelStarted) return
    channelStarted = true
    void listenMesaChannel('notes', {
        notes: (payload) => {
            const p = payload as { slug?: unknown; updatedAt?: unknown } | null
            if (!p || typeof p.slug !== 'string') return
            const notice: NotesNotice = { slug: p.slug, updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : null }
            for (const listener of noticeListeners) listener(notice)
        },
    }, (next) => {
        live = next
        for (const listener of liveListeners) listener(next)
    }).then((stop) => {
        if (!stop) channelStarted = false
    })
}

/** Ouve os avisos das anotações. `onLive` a cada (re)conexão: hora de reler. */
export function listenNotes(onNotice: NoticeListener, onLive: LiveListener): () => void {
    noticeListeners.add(onNotice)
    liveListeners.add(onLive)
    startChannel()
    if (live) onLive(true)
    return () => {
        noticeListeners.delete(onNotice)
        liveListeners.delete(onLive)
    }
}
