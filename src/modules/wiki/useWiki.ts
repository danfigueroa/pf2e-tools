import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mesaKey } from '../../services/mesa'
import { fetchWikiPage, listenWiki, type WikiPage, type WikiPageView, type WikiSummary } from '../../services/wiki'
import { foldName, linkName } from '../../components/markdown/blocks'
import { locale, tr } from '../../i18n'

// A página aberta da Wiki e o que a tela precisa do índice.
//
// Diferente do Diário (que salva sozinho), a Wiki tem "Editar" e "Salvar": muita gente edita as
// mesmas páginas, e cada salvamento vira uma versão do histórico com o nome de quem salvou. O que se
// digita fica num RASCUNHO no `localStorage` até salvar, para o texto não se perder sem rede ou
// com a aba fechada no meio.

export type PageStatus = 'loading' | 'ready' | 'missing' | 'offline'

/** A página aberta: relê sozinha quando alguém a muda (o aviso do banco), a não ser durante a edição. */
export function useWikiPageView(id: string | null, editing: boolean) {
    const [view, setView] = useState<WikiPageView | null>(null)
    const [status, setStatus] = useState<PageStatus>('loading')
    /** Alguém gravou outra versão enquanto esta pessoa editava. */
    const [changedMeanwhile, setChangedMeanwhile] = useState(false)
    const editingRef = useRef(editing)
    editingRef.current = editing

    const load = useCallback(async (pageId: string, silent: boolean) => {
        if (!silent) setStatus('loading')
        const out = await fetchWikiPage(pageId)
        if (out === undefined) { if (!silent) setStatus('offline'); return }
        if (out === null) { setView(null); setStatus('missing'); return }
        setView(out)
        setStatus('ready')
    }, [])

    useEffect(() => {
        setView(null)
        setChangedMeanwhile(false)
        if (!id) return
        void load(id, false)
        return listenWiki((notice) => {
            if (notice.page !== id) return
            if (editingRef.current) { setChangedMeanwhile(true); return }
            void load(id, true)
        }, (live) => { if (live && !editingRef.current) void load(id, true) })
    }, [id, load])

    const reload = useCallback(() => { if (id) { setChangedMeanwhile(false); void load(id, true) } }, [id, load])
    return { view, status, reload, changedMeanwhile }
}

// ── Rascunho da edição ───────────────────────────────────────────────────────

const draftKey = (id: string) => mesaKey(`pf2e:wiki:draft:${id}`)

export interface WikiDraft { page: WikiPage; base: number | null; at: number }

export function readDraft(id: string): WikiDraft | null {
    try {
        const raw = localStorage.getItem(draftKey(id))
        const d = raw ? JSON.parse(raw) as WikiDraft : null
        return d && d.page && typeof d.page.id === 'string' ? d : null
    } catch {
        return null
    }
}

export function writeDraft(id: string, draft: WikiDraft | null) {
    try {
        if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft))
        else localStorage.removeItem(draftKey(id))
    } catch { /* cota cheia ou modo privado: segue sem rascunho */ }
}

// ── O índice visto pela tela ─────────────────────────────────────────────────

/** Título e apelidos dobrados → id, para resolver `[[Nome]]`. */
export function useNameIndex(pages: WikiSummary[]) {
    return useMemo(() => {
        const map = new Map<string, string>()
        for (const p of pages) {
            for (const n of [p.title, ...p.aliases]) {
                const key = foldName(n)
                if (key && !map.has(key)) map.set(key, p.id)
            }
        }
        return map
    }, [pages])
}

/** O id da página de um `[[Nome]]` (aceita `wiki:` e rótulo), ou `null`. */
export const findPage = (names: Map<string, string>, target: string) => names.get(foldName(linkName(target))) ?? null

/** A trilha de "Fica em": do mais de fora até a página (sem ela). */
export function trailOf(id: string, byId: Map<string, WikiSummary>): WikiSummary[] {
    const out: WikiSummary[] = []
    const seen = new Set([id])
    let at = byId.get(id)?.parent ?? null
    while (at && !seen.has(at) && out.length < 12) {
        seen.add(at)
        const p = byId.get(at)
        if (!p) break
        out.unshift(p)
        at = p.parent
    }
    return out
}

export const formatWhen = (ms: number) => (ms
    ? new Date(ms).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '')

export const authorName = (authors: Record<string, string>, id: string | null) =>
    (id ? authors[id] ?? tr('alguém da mesa', 'someone at the table') : tr('alguém da mesa', 'someone at the table'))

// ── Favoritas (do aparelho) ──────────────────────────────────────────────────

const FAVORITES_EVENT = 'pf2e:wiki-favorites'
const favoritesKey = () => mesaKey('pf2e:wiki:favorites')

function readFavorites(): string[] {
    try {
        const raw = localStorage.getItem(favoritesKey())
        const list = raw ? JSON.parse(raw) as unknown : []
        return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
    } catch {
        return []
    }
}

/** As páginas favoritas deste aparelho, nesta mesa. Favoritar é atalho de quem lê, não dado da mesa. */
export function useWikiFavorites() {
    const [favorites, setFavorites] = useState<string[]>(readFavorites)
    useEffect(() => {
        const sync = () => setFavorites(readFavorites())
        window.addEventListener(FAVORITES_EVENT, sync)
        window.addEventListener('storage', sync)
        return () => { window.removeEventListener(FAVORITES_EVENT, sync); window.removeEventListener('storage', sync) }
    }, [])
    const toggle = useCallback((id: string) => {
        const now = readFavorites()
        const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id]
        try { localStorage.setItem(favoritesKey(), JSON.stringify(next)) } catch { /* sem armazenamento: fica só nesta tela */ }
        setFavorites(next)
        window.dispatchEvent(new Event(FAVORITES_EVENT))
    }, [])
    return { favorites, isFavorite: (id: string) => favorites.includes(id), toggle }
}

/** Ordem da lista: alfabética ou as editadas por último primeiro. Preferência do aparelho. */
export type WikiSort = 'title' | 'recent'
const SORT_KEY = 'pf2e:wiki:sort'

export function useWikiSort(): [WikiSort, (s: WikiSort) => void] {
    const [sort, setSort] = useState<WikiSort>(() => {
        try { return localStorage.getItem(SORT_KEY) === 'recent' ? 'recent' : 'title' } catch { return 'title' }
    })
    const set = useCallback((s: WikiSort) => {
        setSort(s)
        try { localStorage.setItem(SORT_KEY, s) } catch { /* sem armazenamento */ }
    }, [])
    return [sort, set]
}

export const sortPages = <T extends { title: string; updatedAt: number }>(pages: T[], sort: WikiSort): T[] =>
    [...pages].sort(sort === 'recent' ? (a, b) => b.updatedAt - a.updatedAt : (a, b) => a.title.localeCompare(b.title))

/** Onde o texto contém a busca, sem acento nem caixa: `[início, fim)` no texto ORIGINAL, ou `null`. */
export function findFolded(text: string, query: string): [number, number] | null {
    const q = foldName(query)
    if (!q) return null
    const chars = [...text]
    let folded = ''
    const at: number[] = []
    let offset = 0
    for (const c of chars) {
        const f = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        for (let i = 0; i < f.length; i++) at.push(offset)
        folded += f
        offset += c.length
    }
    at.push(offset)
    const i = folded.indexOf(q)
    if (i < 0) return null
    return [at[i], at[i + q.length] ?? offset]
}
