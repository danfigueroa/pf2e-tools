// Diário de Campanha (api/_lib/journal-handler.js): o transporte. Só o GM lê e
// escreve o diário; o que ele mostra à mesa (`journal-reveal`) vira um
// compartilhamento `handout` no feed, e o cartão dos jogadores lê o conteúdo por
// `?reveal=`.
//
// Os documentos voltam CRUS daqui — quem os valida é `sanitizeDoc`
// (`modules/campaign-journal/doc.ts`), também para o rascunho do `localStorage`.

import { stateApi } from './mesa'
import { authHeaderNow, listenMesaChannel } from './supabase'
import { markOwnShare } from './rolls'

const post = (payload: Record<string, unknown>) => fetch(stateApi(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
    body: JSON.stringify(payload),
})

/** O resumo de todos os documentos, ou `null` sem rede / sem permissão. */
export async function fetchJournalList(): Promise<unknown[] | null> {
    try {
        const r = await fetch(stateApi('?journal=list'))
        if (!r.ok) return null
        const body = await r.json() as { docs?: unknown }
        return Array.isArray(body.docs) ? body.docs : null
    } catch {
        return null
    }
}

/** O documento cru; `null` quando não existe; `undefined` quando não deu para saber. */
export async function fetchJournalDoc(id: string): Promise<unknown | null | undefined> {
    try {
        const r = await fetch(stateApi(`?journal=${encodeURIComponent(id)}`))
        if (!r.ok) return undefined
        const body = await r.json() as { doc?: unknown }
        return body.doc ?? null
    } catch {
        return undefined
    }
}

export type SaveResult =
    | { ok: true; updatedAt: number }
    | { ok: false; conflict: true; current: unknown }
    | { ok: false; conflict: false; error: string }

/** Grava se o documento ainda for o que este aparelho viu (`base`; `null` = novo). */
export async function saveJournalDoc(doc: unknown, base: number | null): Promise<SaveResult> {
    try {
        const r = await post({ action: 'journal-save', doc, base })
        const body = await r.json().catch(() => ({})) as { updatedAt?: number; error?: string; code?: string; doc?: unknown }
        if (r.status === 409 && body.code === 'conflict') return { ok: false, conflict: true, current: body.doc ?? null }
        if (!r.ok || typeof body.updatedAt !== 'number') return { ok: false, conflict: false, error: body.error ?? 'Não foi possível salvar' }
        return { ok: true, updatedAt: body.updatedAt }
    } catch {
        return { ok: false, conflict: false, error: 'Sem conexão' }
    }
}

export async function deleteJournalDoc(id: string): Promise<boolean> {
    try {
        return (await post({ action: 'journal-delete', id })).ok
    } catch {
        return false
    }
}

export interface RevealInput {
    title: string
    markdown?: string
    image?: string | null
    /** O documento de onde saiu. */
    source?: string
}

/** O que o GM mostrou, lido pelo cartão dos jogadores. */
export interface Reveal {
    id: string
    at: number
    title: string
    markdown: string
    image: string | null
}

const revealId = () => `h-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

/** Mostra à mesa. `by` e `color` vão no cartão ("O GM mostrou…"). */
export async function revealToTable(input: RevealInput, by: string, color: string): Promise<string | null> {
    const id = revealId()
    // O cartão não aparece no aparelho de quem mostrou.
    markOwnShare(id)
    try {
        const r = await post({ action: 'journal-reveal', reveal: { id, ...input }, by, color })
        if (r.ok) return null
        const body = await r.json().catch(() => ({})) as { error?: string }
        return body.error ?? 'Não foi possível mostrar à mesa'
    } catch {
        return 'Sem conexão'
    }
}

const reveals = new Map<string, Promise<Reveal | null>>()

/** O conteúdo de um handout (memorizado na sessão: o que foi mostrado não muda). */
export function fetchReveal(id: string): Promise<Reveal | null> {
    let p = reveals.get(id)
    if (!p) {
        p = fetch(stateApi(`?reveal=${encodeURIComponent(id)}`))
            .then(async (r) => (r.ok ? ((await r.json()) as { reveal?: Reveal | null }).reveal ?? null : null))
            .catch(() => null)
        // Falha não fica guardada: reabrir o cartão tenta de novo.
        void p.then((v) => { if (!v) reveals.delete(id) })
        reveals.set(id, p)
    }
    return p
}

/** O aviso do banco: aquele documento mudou (ou saiu). Sem título — o canal é de toda a mesa. */
export interface JournalNotice { doc: string; updatedAt: number | null; deleted: boolean }

type NoticeListener = (notice: JournalNotice) => void
type LiveListener = (live: boolean) => void
const noticeListeners = new Set<NoticeListener>()
const liveListeners = new Set<LiveListener>()
let channelStarted = false
let live = false

// Um canal só, aberto na primeira assinatura e mantido — mesmo desenho de
// `listenEncounters` (o StrictMode sai e entra no mesmo tópico em seguida).
function startChannel() {
    if (channelStarted) return
    channelStarted = true
    void listenMesaChannel('journal', {
        journal: (payload) => {
            const p = payload as { doc?: unknown; updatedAt?: unknown; deleted?: unknown } | null
            if (!p || typeof p.doc !== 'string') return
            const notice: JournalNotice = {
                doc: p.doc,
                updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : null,
                deleted: p.deleted === true,
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

/** Ouve os avisos do diário. `onLive` a cada (re)conexão: hora de reler. */
export function listenJournal(onNotice: NoticeListener, onLive: LiveListener): () => void {
    noticeListeners.add(onNotice)
    liveListeners.add(onLive)
    startChannel()
    if (live) onLive(true)
    return () => {
        noticeListeners.delete(onNotice)
        liveListeners.delete(onLive)
    }
}
