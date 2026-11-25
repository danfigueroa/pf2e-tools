// Carrega e salva um build: o estado muda na hora, o servidor recebe 1,5 s depois da última mudança (`build-save`
// com o `rev` visto). Toda mudança ainda não confirmada fica num rascunho local por mesa (`mesaKey`), que sobrevive a
// fechar a aba e a ficar sem rede. 409 = outro aparelho gravou antes: quem decide é a pessoa (`conflict`).
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBuild, saveBuild } from '../../../services/builds'
import { mesaKey } from '../../../services/mesa'
import { sanitizeBuildState } from '../sanitize'
import { currentUserId, listenMesaChannel } from '../../../services/supabase'
import type { BuildRecord, BuildState } from '../types'

const SAVE_DELAY_MS = 1500
const RETRY_MS = 15_000

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error'

interface Draft { rev: number; state: BuildState; at: number }

const draftKey = (id: string) => mesaKey(`pf2e:builder:draft:${id}`)

function readDraft(id: string): Draft | null {
    try {
        const raw = localStorage.getItem(draftKey(id))
        if (!raw) return null
        const v = JSON.parse(raw) as Partial<Draft>
        const state = sanitizeBuildState(v.state)
        return state && typeof v.rev === 'number' ? { rev: v.rev, state, at: typeof v.at === 'number' ? v.at : 0 } : null
    } catch {
        return null
    }
}
function writeDraft(id: string, draft: Draft | null) {
    try {
        if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft))
        else localStorage.removeItem(draftKey(id))
    } catch {
        // Armazenamento cheio ou bloqueado: segue só com o servidor.
    }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export interface BuildConflict {
    /** O que está no servidor agora (gravado por outro aparelho). */
    theirs: BuildRecord
}

export interface UseBuild {
    build: BuildRecord | null
    state: BuildState | null
    canEdit: boolean
    loading: boolean
    error: string | null
    status: SaveStatus
    conflict: BuildConflict | null
    /** Muda o estado (na hora) e agenda a gravação. */
    update: (change: (state: BuildState) => BuildState) => void
    /** Conflito: grava o meu por cima do outro. */
    keepMine: () => void
    /** Conflito: descarta o meu e fica com o do servidor. */
    takeTheirs: () => void
    reload: () => void
    /** Grava o pendente e devolve o `rev` salvo, ou `null`. */
    saveNow: () => Promise<number | null>
}

export function useBuild(id: string | undefined, className?: string | null): UseBuild {
    const [build, setBuild] = useState<BuildRecord | null>(null)
    const [state, setState] = useState<BuildState | null>(null)
    const [canEdit, setCanEdit] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<SaveStatus>('idle')
    const [conflict, setConflict] = useState<BuildConflict | null>(null)
    const [nonce, setNonce] = useState(0)

    // O que o servidor confirmou por último (`rev` e `state`) e o que está por enviar.
    const rev = useRef(0)
    const saved = useRef<BuildState | null>(null)
    const latest = useRef<BuildState | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inFlight = useRef(false)
    const blocked = useRef(false) // conflito aberto: nada grava até a pessoa decidir
    const classRef = useRef(className)
    useEffect(() => {
        classRef.current = className
    }, [className])

    const flush = useCallback(async () => {
        if (!id || inFlight.current || blocked.current) return
        const next = latest.current
        // Nome vazio o servidor recusa: espera a pessoa terminar de digitar (o rascunho local guarda o resto).
        if (next && !next.name.trim()) return
        if (!next || same(next, saved.current)) {
            setStatus((s) => (s === 'pending' ? 'saved' : s))
            return
        }
        inFlight.current = true
        setStatus('saving')
        const out = await saveBuild(id, rev.current, next, classRef.current)
        inFlight.current = false
        if (out.ok) {
            rev.current = out.value.rev
            saved.current = next
            setBuild((b) => (b ? { ...b, ...out.value, state: next } : b))
            if (same(latest.current, next)) {
                writeDraft(id, null)
                setStatus('saved')
            } else {
                // Mudou enquanto gravava: manda o resto.
                writeDraft(id, { rev: rev.current, state: latest.current as BuildState, at: Date.now() })
                void flush()
            }
            return
        }
        if (out.status === 409 && out.code === 'conflict') {
            const theirs = (out.body as { build?: BuildRecord } | undefined)?.build
            if (theirs) {
                blocked.current = true
                setConflict({ theirs })
                setStatus('error')
                return
            }
        }
        setStatus(out.status === 0 ? 'offline' : 'error')
        if (out.status !== 0) setError(out.error)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), RETRY_MS)
    }, [id])

    const schedule = useCallback(() => {
        if (timer.current) clearTimeout(timer.current)
        setStatus('pending')
        timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    }, [flush])

    useEffect(() => {
        if (!id) return
        let alive = true
        setLoading(true)
        setError(null)
        setConflict(null)
        blocked.current = false
        void fetchBuild(id).then((out) => {
            if (!alive) return
            setLoading(false)
            if (!out.ok) {
                setError(out.error)
                return
            }
            const { build: record, canEdit: editable } = out.value
            const serverState = sanitizeBuildState(record.state) ?? record.state
            rev.current = record.rev
            saved.current = serverState
            setBuild(record)
            setCanEdit(editable)
            const draft = editable ? readDraft(id) : null
            if (draft && !same(draft.state, serverState)) {
                latest.current = draft.state
                setState(draft.state)
                if (draft.rev === record.rev) schedule()
                else {
                    // O rascunho local partiu de uma versão que outro aparelho já substituiu.
                    rev.current = draft.rev
                    blocked.current = true
                    setConflict({ theirs: { ...record, state: serverState } })
                }
            } else {
                if (draft) writeDraft(id, null)
                latest.current = serverState
                setState(serverState)
                setStatus('idle')
            }
        })
        return () => {
            alive = false
        }
    }, [id, nonce, schedule])

    // Tempo real (F8.8, canal `mesa:<mesa>:builds`): outro aparelho gravou este build. Sem mudança local pendente,
    // relê; com mudança pendente, o próximo salvamento cai no conflito (a pessoa decide). Relê a cada SUBSCRIBED
    // (aviso perdido não volta — regra global 9).
    useEffect(() => {
        if (!id) return
        let stop: (() => void) | null = null
        let alive = true
        const onChange = (payload: unknown) => {
            const p = payload as { buildId?: string; rev?: number; by?: string | null }
            if (p.buildId !== id || typeof p.rev !== 'number' || p.rev <= rev.current) return
            if (p.by && p.by === currentUserId() && inFlight.current) return
            if (same(latest.current, saved.current) && !blocked.current) setNonce((n) => n + 1)
        }
        void listenMesaChannel('builds', { builds: onChange }, (live) => {
            if (live && alive && same(latest.current, saved.current) && !blocked.current) {
                void fetchBuild(id).then((out) => { if (alive && out.ok && out.value.build.rev > rev.current) setNonce((n) => n + 1) })
            }
        }).then((fn) => { if (alive) stop = fn; else fn?.() })
        return () => { alive = false; stop?.() }
    }, [id])

    // Volta a rede: manda o que ficou.
    useEffect(() => {
        const online = () => void flush()
        window.addEventListener('online', online)
        return () => window.removeEventListener('online', online)
    }, [flush])

    // Saiu da tela com mudança pendente: manda já (o rascunho local fica como rede).
    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
        void flush()
    }, [flush])

    const update = useCallback((change: (s: BuildState) => BuildState) => {
        if (!id || !canEdit) return
        setState((current) => {
            if (!current) return current
            const next = change(current)
            latest.current = next
            writeDraft(id, { rev: rev.current, state: next, at: Date.now() })
            return next
        })
        schedule()
    }, [id, canEdit, schedule])

    const keepMine = useCallback(() => {
        if (!conflict || !id) return
        rev.current = conflict.theirs.rev
        saved.current = sanitizeBuildState(conflict.theirs.state)
        blocked.current = false
        setConflict(null)
        writeDraft(id, latest.current ? { rev: rev.current, state: latest.current, at: Date.now() } : null)
        void flush()
    }, [conflict, id, flush])

    const takeTheirs = useCallback(() => {
        if (!conflict || !id) return
        const theirs = sanitizeBuildState(conflict.theirs.state) ?? conflict.theirs.state
        rev.current = conflict.theirs.rev
        saved.current = theirs
        latest.current = theirs
        blocked.current = false
        writeDraft(id, null)
        setBuild(conflict.theirs)
        setState(theirs)
        setConflict(null)
        setStatus('saved')
    }, [conflict, id])

    const reload = useCallback(() => setNonce((n) => n + 1), [])

    /**
     * Grava já o que estiver pendente e devolve o `rev` do que ficou salvo, ou `null` se não salvou (conflito, sem
     * rede). O "Aplicar na mesa" usa: o servidor compila o estado SALVO daquele `rev` (F10.1).
     */
    const saveNow = useCallback(async (): Promise<number | null> => {
        if (timer.current) clearTimeout(timer.current)
        for (let attempt = 0; attempt < 4; attempt += 1) {
            for (let i = 0; i < 40 && inFlight.current; i += 1) await new Promise((r) => setTimeout(r, 150))
            if (blocked.current) return null
            if (latest.current && same(latest.current, saved.current)) return rev.current
            await flush()
        }
        return latest.current && same(latest.current, saved.current) && !inFlight.current ? rev.current : null
    }, [flush])

    return { build, state, canEdit, loading, error, status, conflict, update, keepMine, takeTheirs, reload, saveNow }
}
