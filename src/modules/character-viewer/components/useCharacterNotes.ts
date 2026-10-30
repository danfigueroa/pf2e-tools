import { useCallback, useEffect, useRef, useState } from 'react'
import { mesaKey } from '../../../services/mesa'
import { fetchNotes, listenNotes, saveNotes } from '../../../services/notes'
import { emptyNotes, sanitizeNotes, wireNotes, type CharacterNotes } from '../notes'

// As anotações do personagem aberto: background e notas.
//
// Salva sozinho (1,5 s depois da última mudança, e na hora ao esconder a aba ou
// sair). Cada mudança fica também num RASCUNHO no `localStorage` até o servidor
// confirmar: sem rede o texto não se perde, e ao voltar ele é enviado. A escrita
// leva o `updatedAt` que este aparelho viu (`base`); se outro aparelho gravou
// antes, o servidor recusa (409) e a tela oferece as duas saídas.
// Ficha de outra pessoa: só lê (o setter não faz nada e nada sobe).

const SAVE_DELAY_MS = 1500

const draftKey = (slug: string) => mesaKey(`pf2e:notes:draft:${slug}`)
const cacheKey = (slug: string) => mesaKey(`pf2e:notes:cache:${slug}`)

interface Stored { data: unknown; base: number | null }

function read(key: string): Stored | null {
    try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) as Stored : null
    } catch {
        return null
    }
}

function write(key: string, value: Stored | null) {
    try {
        if (value) localStorage.setItem(key, JSON.stringify(value))
        else localStorage.removeItem(key)
    } catch { /* cota cheia ou modo privado: segue sem cache */ }
}

export type NotesStatus = 'loading' | 'saved' | 'pending' | 'saving' | 'offline' | 'conflict'

export interface NotesState {
    notes: CharacterNotes
    status: NotesStatus
    /** Muda quando o texto chega de FORA (servidor, outro aparelho): os editores remontam. */
    version: number
    theirs: CharacterNotes | null
    update: (fn: (n: CharacterNotes) => CharacterNotes) => void
    keepTheirs: () => void
    keepMine: () => void
    retry: () => void
}

export function useCharacterNotes(slug: string, readOnly: boolean): NotesState {
    const [notes, setNotes] = useState<CharacterNotes>(() => {
        const cached = sanitizeNotes(read(cacheKey(slug))?.data)
        return cached ?? emptyNotes()
    })
    const [status, setStatus] = useState<NotesStatus>('loading')
    const [version, setVersion] = useState(0)
    const [theirs, setTheirs] = useState<CharacterNotes | null>(null)
    const ref = useRef(notes)
    const baseRef = useRef<number | null>(read(cacheKey(slug))?.base ?? null)
    const dirty = useRef(false)
    const conflicted = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saving = useRef<Promise<void> | null>(null)
    const readOnlyRef = useRef(readOnly)
    readOnlyRef.current = readOnly

    const show = useCallback((next: CharacterNotes, fromOutside: boolean) => {
        ref.current = next
        setNotes(next)
        if (fromOutside) setVersion((v) => v + 1)
    }, [])

    const flush = useCallback(async (): Promise<void> => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null }
        if (saving.current) { await saving.current; if (!dirty.current) return }
        const current = ref.current
        if (!dirty.current || conflicted.current || readOnlyRef.current) return
        dirty.current = false
        setStatus('saving')
        const run = (async () => {
            const out = await saveNotes(slug, current, baseRef.current)
            if (out.ok) {
                baseRef.current = out.updatedAt
                write(cacheKey(slug), { data: current, base: out.updatedAt })
                if (dirty.current) setStatus('pending')
                else { write(draftKey(slug), null); setStatus('saved') }
                return
            }
            dirty.current = true
            if (out.conflict) {
                conflicted.current = true
                setTheirs(sanitizeNotes(out.current?.data) ?? emptyNotes())
                if (out.current) baseRef.current = out.current.updatedAt
                setStatus('conflict')
            } else setStatus('offline')
        })()
        saving.current = run
        await run
        saving.current = null
        if (dirty.current && !conflicted.current && timer.current === null && ref.current !== current) {
            timer.current = setTimeout(() => { timer.current = null; void flush() }, SAVE_DELAY_MS)
        }
    }, [slug])

    const load = useCallback(async (silent: boolean) => {
        if (!silent) setStatus('loading')
        const raw = await fetchNotes(slug)
        const stored = read(draftKey(slug))
        const draft = stored ? sanitizeNotes(stored.data) : null
        if (raw === undefined) {
            // Sem rede: o rascunho daqui, se houver, é o que dá para mostrar.
            if (draft && !silent && !readOnlyRef.current) {
                baseRef.current = stored!.base; dirty.current = true; show(draft, true)
            }
            if (!silent) setStatus('offline')
            return
        }
        const server = raw ? sanitizeNotes(raw.data) ?? emptyNotes() : emptyNotes()
        const serverBase = raw ? raw.updatedAt : null
        baseRef.current = serverBase
        write(cacheKey(slug), raw ? { data: server, base: serverBase } : null)
        if (draft && !readOnlyRef.current) {
            // A gravação chegou e a resposta se perdeu (aba recarregada no meio): não é conflito.
            if (wireNotes(draft) === wireNotes(server)) {
                write(draftKey(slug), null)
            } else {
                dirty.current = true
                show(draft, true)
                if (stored!.base === serverBase) { setStatus('pending'); void flush(); return }
                // O rascunho é de antes de uma versão que outro aparelho gravou.
                conflicted.current = true
                setTheirs(server)
                setStatus('conflict')
                return
            }
        }
        dirty.current = false
        show(server, true)
        setStatus('saved')
    }, [slug, flush, show])

    useEffect(() => {
        const cached = read(cacheKey(slug))
        show(sanitizeNotes(cached?.data) ?? emptyNotes(), true)
        baseRef.current = cached?.base ?? null
        setTheirs(null)
        dirty.current = false
        conflicted.current = false
        void load(false)
        const stop = listenNotes((notice) => {
            if (notice.slug !== slug) return
            // O eco da própria escrita (o aviso traz o `updatedAt` que a resposta já deu).
            if (notice.updatedAt !== null && notice.updatedAt === baseRef.current) return
            if (!dirty.current && !saving.current) void load(true)
        }, (live) => { if (live && !dirty.current) void load(true) })
        const onVisible = () => {
            if (document.visibilityState === 'hidden') void flush()
            else if (!dirty.current) void load(true)
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            stop()
            document.removeEventListener('visibilitychange', onVisible)
            void flush()
        }
    }, [slug, load, flush, show])

    const update = useCallback((fn: (n: CharacterNotes) => CharacterNotes) => {
        if (readOnlyRef.current) return
        const current = ref.current
        const next = fn(current)
        if (next === current) return
        dirty.current = true
        show(next, false)
        write(draftKey(slug), { data: next, base: baseRef.current })
        setStatus((s) => (s === 'conflict' ? s : 'pending'))
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { timer.current = null; void flush() }, SAVE_DELAY_MS)
    }, [slug, flush, show])

    const keepTheirs = useCallback(() => {
        const t = theirs
        if (!t) return
        dirty.current = false
        conflicted.current = false
        write(draftKey(slug), null)
        show(t, true)
        setTheirs(null)
        setStatus('saved')
    }, [theirs, slug, show])

    const keepMine = useCallback(() => {
        setTheirs(null)
        conflicted.current = false
        dirty.current = true
        void flush()
    }, [flush])

    const retry = useCallback(() => { dirty.current = true; void flush() }, [flush])

    return { notes, status, version, theirs, update, keepTheirs, keepMine, retry }
}
