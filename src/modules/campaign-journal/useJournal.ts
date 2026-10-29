import { useCallback, useEffect, useRef, useState } from 'react'
import { mesaKey } from '../../services/mesa'
import { fetchJournalDoc, fetchJournalList, listenJournal, saveJournalDoc } from '../../services/journal'
import { sanitizeDoc, sanitizeSummary, wireDoc, type JournalDoc, type JournalSummary } from './doc'

// A lista do diário e o documento aberto.
//
// O documento salva sozinho (1,5 s depois da última mudança, e na hora ao
// esconder a aba ou sair dele). Cada mudança fica também num RASCUNHO no
// `localStorage` até o servidor confirmar: sem rede, o texto não se perde, e ao
// voltar ele é enviado.
//
// A escrita leva o `updatedAt` que este aparelho viu (`base`). Se o GM mexeu no
// mesmo documento em outro aparelho, o servidor recusa (409) e a página oferece
// as duas saídas: ficar com o do outro aparelho ou gravar o daqui por cima.

const SAVE_DELAY_MS = 1500
const LIST_DELAY_MS = 400

const draftKey = (id: string) => mesaKey(`pf2e:journal:draft:${id}`)

/** Os dois passaram pelo `sanitizeDoc`, que monta as chaves sempre na mesma ordem (o `jsonb` não). */
const sameContent = (a: JournalDoc, b: JournalDoc) => JSON.stringify(wireDoc(a)) === JSON.stringify(wireDoc(b))

interface Draft { doc: unknown; base: number | null }

function readDraft(id: string): Draft | null {
    try {
        const raw = localStorage.getItem(draftKey(id))
        return raw ? JSON.parse(raw) as Draft : null
    } catch {
        return null
    }
}

function writeDraft(id: string, draft: Draft | null) {
    try {
        if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft))
        else localStorage.removeItem(draftKey(id))
    } catch { /* cota cheia ou modo privado: segue sem rascunho */ }
}

export function useJournalList() {
    const [docs, setDocs] = useState<JournalSummary[] | null>(null)
    const [failed, setFailed] = useState(false)

    const reload = useCallback(async () => {
        const raw = await fetchJournalList()
        if (!raw) { setFailed(true); return }
        setDocs(raw.map(sanitizeSummary).filter((d): d is JournalSummary => !!d))
        setFailed(false)
    }, [])

    useEffect(() => {
        void reload()
        let timer: ReturnType<typeof setTimeout> | null = null
        const later = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => void reload(), LIST_DELAY_MS)
        }
        const stop = listenJournal(later, (live) => { if (live) later() })
        return () => { stop(); if (timer) clearTimeout(timer) }
    }, [reload])

    /** Mostra já na lista o que este aparelho acabou de mudar (título, imagem, estado). */
    const patch = useCallback((doc: JournalDoc) => {
        setDocs((list) => {
            if (!list) return list
            const summary: JournalSummary = {
                id: doc.id, kind: doc.kind, title: doc.title, sort: doc.sort, updatedAt: doc.updatedAt ?? Date.now(),
                image: 'image' in doc.data ? doc.data.image : null,
                status: 'status' in doc.data ? doc.data.status : null,
                links: doc.kind === 'session' ? doc.data.links : [],
            }
            const i = list.findIndex((d) => d.id === doc.id)
            return i < 0 ? [...list, summary] : list.map((d, j) => (j === i ? summary : d))
        })
    }, [])

    const drop = useCallback((id: string) => setDocs((list) => list?.filter((d) => d.id !== id) ?? list), [])

    return { docs, failed, reload, patch, drop }
}

export type SaveStatus = 'loading' | 'missing' | 'saved' | 'pending' | 'saving' | 'offline' | 'conflict'

export interface JournalDocState {
    doc: JournalDoc | null
    status: SaveStatus
    /** Muda quando o texto chega de FORA (servidor, outro aparelho): os editores remontam. */
    version: number
    /** O que o outro aparelho gravou, quando há conflito. */
    theirs: JournalDoc | null
    update: (fn: (doc: JournalDoc) => JournalDoc) => void
    keepTheirs: () => void
    keepMine: () => void
    retry: () => void
}

/** Cria o documento no servidor. `null` gravou; senão, o motivo. */
export async function createJournalDoc(doc: JournalDoc): Promise<string | null> {
    const out = await saveJournalDoc(wireDoc(doc), null)
    if (out.ok) return null
    return out.conflict ? 'Já existe um documento com esse id' : out.error
}

export function useJournalDoc(id: string | null, onSaved?: (doc: JournalDoc) => void): JournalDocState {
    const [doc, setDoc] = useState<JournalDoc | null>(null)
    const [status, setStatus] = useState<SaveStatus>('loading')
    const [version, setVersion] = useState(0)
    const [theirs, setTheirs] = useState<JournalDoc | null>(null)
    const docRef = useRef<JournalDoc | null>(null)
    const baseRef = useRef<number | null>(null)
    /** Há mudança daqui ainda não gravada. */
    const dirty = useRef(false)
    /** Em conflito, nada sobe até o GM escolher. */
    const conflicted = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saving = useRef<Promise<void> | null>(null)
    const savedRef = useRef(onSaved)
    savedRef.current = onSaved

    const show = useCallback((next: JournalDoc, fromOutside: boolean) => {
        docRef.current = next
        setDoc(next)
        if (fromOutside) setVersion((v) => v + 1)
    }, [])

    const flush = useCallback(async (): Promise<void> => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null }
        if (saving.current) { await saving.current; if (!dirty.current) return }
        const current = docRef.current
        if (!current || !dirty.current || conflicted.current) return
        dirty.current = false
        setStatus('saving')
        const run = (async () => {
            const out = await saveJournalDoc(wireDoc(current), baseRef.current)
            if (out.ok) {
                baseRef.current = out.updatedAt
                const saved = { ...current, updatedAt: out.updatedAt }
                if (docRef.current === current) docRef.current = saved
                savedRef.current?.(saved)
                if (dirty.current) setStatus('pending')
                else { writeDraft(current.id, null); setStatus('saved') }
                return
            }
            dirty.current = true
            if (out.conflict) {
                conflicted.current = true
                setTheirs(sanitizeDoc(out.current))
                setStatus('conflict')
            } else setStatus('offline')
        })()
        saving.current = run
        await run
        saving.current = null
        if (dirty.current && !conflicted.current && timer.current === null && docRef.current !== current) {
            // Mudou enquanto gravava: grava de novo.
            timer.current = setTimeout(() => { timer.current = null; void flush() }, SAVE_DELAY_MS)
        }
    }, [])

    const load = useCallback(async (docId: string, silent: boolean) => {
        if (!silent) setStatus('loading')
        const raw = await fetchJournalDoc(docId)
        const draft = readDraft(docId)
        const draftDoc = draft ? sanitizeDoc(draft.doc) : null
        if (raw === undefined) {
            // Sem rede: o rascunho daqui, se houver, é o que dá para mostrar.
            if (draftDoc && !silent) { baseRef.current = draft!.base; dirty.current = true; show(draftDoc, true); setStatus('offline') }
            else if (!silent) setStatus('offline')
            return
        }
        const server = raw ? sanitizeDoc(raw) : null
        if (!server) { if (!draftDoc) setStatus('missing'); return }
        baseRef.current = server.updatedAt
        // A gravação chegou ao servidor, mas a resposta não voltou (aba recarregada no meio):
        // o rascunho é igual ao que está lá, e não há conflito nenhum.
        if (draftDoc && sameContent(draftDoc, server)) {
            writeDraft(docId, null)
            dirty.current = false
            show(server, true)
            setStatus('saved')
            return
        }
        if (draftDoc && draft!.base === server.updatedAt) {
            // Mudança daqui que não chegou ao servidor (aba fechada sem rede): manda agora.
            dirty.current = true
            show(draftDoc, true)
            setStatus('pending')
            void flush()
            return
        }
        if (draftDoc) {
            // O rascunho é de antes de uma versão que outro aparelho gravou.
            dirty.current = true
            conflicted.current = true
            show(draftDoc, true)
            setTheirs(server)
            setStatus('conflict')
            return
        }
        dirty.current = false
        show(server, true)
        setStatus('saved')
    }, [flush, show])

    useEffect(() => {
        docRef.current = null
        setDoc(null)
        setTheirs(null)
        dirty.current = false
        conflicted.current = false
        if (!id) return
        void load(id, false)
        const stop = listenJournal((notice) => {
            if (notice.doc !== id) return
            if (notice.deleted) { setStatus('missing'); return }
            // O eco da própria escrita (o aviso traz o `updatedAt` que a resposta já deu).
            if (notice.updatedAt !== null && notice.updatedAt === baseRef.current) return
            // Com mudança daqui na fila, quem decide é o 409 da próxima escrita.
            if (!dirty.current && !saving.current) void load(id, true)
        }, (live) => { if (live && !dirty.current) void load(id, true) })
        const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
        document.addEventListener('visibilitychange', onHide)
        return () => {
            stop()
            document.removeEventListener('visibilitychange', onHide)
            void flush()
        }
    }, [id, load, flush])

    const update = useCallback((fn: (d: JournalDoc) => JournalDoc) => {
        const current = docRef.current
        if (!current) return
        const next = fn(current)
        if (next === current) return
        dirty.current = true
        show(next, false)
        writeDraft(next.id, { doc: next, base: baseRef.current })
        setStatus((s) => (s === 'conflict' ? s : 'pending'))
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { timer.current = null; void flush() }, SAVE_DELAY_MS)
    }, [flush, show])

    const keepTheirs = useCallback(() => {
        const t = theirs
        if (!t) return
        dirty.current = false
        conflicted.current = false
        baseRef.current = t.updatedAt
        writeDraft(t.id, null)
        show(t, true)
        setTheirs(null)
        setStatus('saved')
    }, [theirs, show])

    const keepMine = useCallback(() => {
        const t = theirs
        if (!t) return
        baseRef.current = t.updatedAt
        setTheirs(null)
        conflicted.current = false
        dirty.current = true
        void flush()
    }, [theirs, flush])

    const retry = useCallback(() => { dirty.current = true; void flush() }, [flush])

    return { doc, status, version, theirs, update, keepTheirs, keepMine, retry }
}
