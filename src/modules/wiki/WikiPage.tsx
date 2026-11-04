import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List,
    ListItem, ListItemText, Snackbar, Stack, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { ArrowBack } from '@mui/icons-material'
import { useMesaInfo, useRole } from '../../services/auth'
import {
    blankPage, deleteWikiPage, fetchWikiList, fetchWikiMissing, purgeWikiPage, refreshWikiIndex, setWikiFlags, showWikiPage, undeleteWikiPage,
    useWikiIndex, WIKI_KINDS, type WikiKind, type WikiMissing, type WikiPage as WikiPageData, type WikiSummary,
} from '../../services/wiki'
import { linkName } from '../../components/markdown/blocks'
import { gold, parchment, rule } from '../../theme'
import { KIND_LABEL } from './kinds'
import { findPage, formatWhen, authorName, useNameIndex, useWikiFavorites, useWikiPageView, useWikiSort } from './useWiki'
import { WikiHome } from './components/WikiHome'
import { WikiNav, type WikiHomeView } from './components/WikiNav'
import { WikiSearch } from './components/WikiSearch'
import { WikiView } from './components/WikiView'
import { WikiEditor } from './components/WikiEditor'
import { HistoryDialog } from './components/HistoryDialog'
import { tr } from '../../i18n'

// Wiki da Mesa: o que GM e jogadores escrevem sobre o mundo (NPCs, locais, itens, criaturas…). Todos
// leem, criam e editam; o GM trava, esconde e revela. O servidor decide; aqui só se esconde botão.
//
// `/wiki/<id>` abre uma página; `/wiki?ver=<atalho|tipo>` o Início num atalho (recent, favorites, locked) ou
// num tipo; `?nova=<título>&tipo=<tipo>` abre o editor de uma página nova (é como o Diário de Campanha e
// os links vermelhos chegam aqui). ⌘K dentro da Wiki abre a busca dela.

const BASE = '/wiki'
/** A cor do GM no cartão da mesa: o ouro de texto, que lê sobre o verde do cabeçalho. */
const GM_COLOR = gold.deep

interface Notice { text: string; action?: { label: string; go: () => void } }

const VIEWS = new Set<string>(['home', 'recent', 'favorites', 'locked', ...WIKI_KINDS])
/** O `?ver=` da URL: o atalho ou o tipo que o Início mostra. */
const viewOf = (v: string | null): WikiHomeView => (v && VIEWS.has(v) ? v as WikiHomeView : 'home')

export function WikiPage() {
    const { id = null } = useParams()
    const [params, setParams] = useSearchParams()
    const navigate = useNavigate()
    const theme = useTheme()
    const wide = useMediaQuery(theme.breakpoints.up('md'))
    const role = useRole()
    const mesaInfo = useMesaInfo()
    const index = useWikiIndex()
    const allPages = useMemo(() => index.list?.pages ?? [], [index.list])
    const authors = useMemo(() => index.list?.authors ?? {}, [index.list])
    const isGm = index.list?.gm ?? role.isGm
    const names = useNameIndex(allPages)
    const [creating, setCreating] = useState<WikiPageData | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [trash, setTrash] = useState(false)
    const [searching, setSearching] = useState(false)
    const [mine, setMine] = useState(false)
    const [sort, setSort] = useWikiSort()
    const { favorites, isFavorite, toggle: toggleFavorite } = useWikiFavorites()
    const [missing, setMissing] = useState<WikiMissing[] | null>(null)
    const view = viewOf(params.get('ver')) // i18n-ok: parâmetro da URL
    const pages = useMemo(() => (mine ? allPages.filter((p) => p.createdBy === role.userId) : allPages), [allPages, mine, role.userId])

    // Os nomes citados sem página: relidos quando o índice muda (alguém salvou).
    const stamp = useMemo(() => Math.max(0, ...allPages.map((p) => p.updatedAt)), [allPages])
    useEffect(() => {
        if (!index.list) return
        let live = true
        void fetchWikiMissing().then((m) => { if (live && m) setMissing(m) })
        return () => { live = false }
    }, [stamp, index.list])

    // ⌘K / Ctrl+K dentro da Wiki abre a busca da Wiki (a busca geral do app fica para as outras telas).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                e.stopImmediatePropagation()
                setSearching((v) => !v)
            }
        }
        window.addEventListener('keydown', onKey, { capture: true })
        return () => window.removeEventListener('keydown', onKey, { capture: true })
    }, [])

    const open = useCallback((pageId: string) => { setCreating(null); setSearching(false); navigate(`${BASE}/${pageId}`) }, [navigate])
    const startNew = useCallback((title = '', kind: WikiKind = 'npc') => {
        setSearching(false)
        setCreating(blankPage(kind, title.slice(0, 120)))
        if (id) navigate(BASE)
    }, [id, navigate])
    const showView = useCallback((v: WikiHomeView) => {
        setCreating(null)
        navigate(v === 'home' ? BASE : `${BASE}?ver=${v}`) // i18n-ok: parâmetro da URL
    }, [navigate])

    // `?nova=` (do Diário, de um link vermelho de outra página): abre o editor da página nova.
    const novo = params.get('nova') // i18n-ok: parâmetro da URL
    const novoTipo = params.get('tipo') // i18n-ok: parâmetro da URL
    useEffect(() => {
        if (novo === null) return
        const existing = findPage(names, novo)
        if (existing && index.list) open(existing)
        else if (index.list) {
            const kind = (WIKI_KINDS as readonly string[]).includes(novoTipo ?? '') ? novoTipo as WikiKind : 'npc'
            setCreating(blankPage(kind, novo.slice(0, 120)))
        } else return
        setParams((p) => { p.delete('nova'); p.delete('tipo'); return p }, { replace: true }) // i18n-ok: parâmetro da URL
    }, [novo, novoTipo, names, index.list, open, setParams])

    const resolveLink = useCallback((target: string) => (findPage(names, target) ? 'known' as const : 'missing' as const), [names])
    const onLink = useCallback((target: string) => {
        const found = findPage(names, target)
        if (found) open(found)
        else startNew(linkName(target))
    }, [names, open, startNew])

    const say = useCallback((text: string, action?: Notice['action']) => setNotice({ text, action }), [])

    if (index.failed && !index.list) {
        return (
            <Alert severity="error" action={<Button onClick={() => void refreshWikiIndex()}>{tr('Tentar de novo', 'Try again')}</Button>}>
                {tr('Não foi possível abrir a Wiki.', 'Couldn\'t open the wiki.')}</Alert>
        )
    }
    if (!index.list) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>

    const content = creating
        ? (
            <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    {!wide && <IconButton aria-label={tr('Voltar ao índice da Wiki', 'Back to the wiki index')} onClick={() => setCreating(null)}><ArrowBack /></IconButton>}
                    <Typography component="h1" variant="h5">{tr('Nova página', 'New page')}</Typography>
                </Stack>
                <WikiEditor
                    key={creating.id}
                    initial={creating}
                    base={null}
                    pages={allPages}
                    isGm={isGm}
                    onSaved={(p) => { setCreating(null); void refreshWikiIndex(); open(p.id) }}
                    onCancel={() => setCreating(null)}
                />
            </Box>
        )
        : id
            ? (
                <PagePanel
                    key={id}
                    id={id}
                    pages={allPages}
                    authors={authors}
                    isGm={isGm}
                    wide={wide}
                    displayName={role.displayName || role.username || 'GM'}
                    favorite={isFavorite(id)}
                    onFavorite={() => toggleFavorite(id)}
                    onOpen={open}
                    onLink={onLink}
                    resolveLink={resolveLink}
                    onBack={() => navigate(BASE)}
                    onKind={(k) => showView(k)}
                    onNotice={say}
                />
            )
            : (
                <WikiHome
                    pages={pages}
                    authors={authors}
                    mesaName={mesaInfo.name}
                    view={view}
                    wide={wide}
                    favorites={favorites}
                    mine={mine}
                    sort={sort}
                    missing={missing}
                    onSort={setSort}
                    onMine={setMine}
                    onView={showView}
                    onOpen={open}
                    onNew={(title, kind) => startNew(title, kind)}
                    onSearch={() => setSearching(true)}
                    onTrash={isGm ? () => setTrash(true) : undefined}
                />
            )

    return (
        <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
            {wide
                ? (
                    <Box sx={{ display: 'grid', gap: { md: 4, xl: 5 }, gridTemplateColumns: { md: '264px minmax(0, 1fr)', xl: '288px minmax(0, 1fr)' }, alignItems: 'start' }}>
                        <Box sx={{
                            position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', display: 'flex', flexDirection: 'column',
                            bgcolor: parchment.page, border: `1px solid ${rule}`, borderRadius: 3, px: 1.75, py: 2.75, boxSizing: 'border-box',
                        }}>
                            <WikiNav
                                pages={pages}
                                selected={id}
                                view={id || creating ? null : view}
                                mesaName={mesaInfo.name}
                                favorites={favorites}
                                mine={mine}
                                sort={sort}
                                onSort={setSort}
                                onMine={setMine}
                                onOpen={open}
                                onView={showView}
                                onNew={() => startNew()}
                                onSearch={() => setSearching(true)}
                                onTrash={isGm ? () => setTrash(true) : undefined}
                            />
                        </Box>
                        {content}
                    </Box>
                )
                : content}

            {searching && (
                <WikiSearch
                    pages={allPages}
                    missing={missing}
                    onClose={() => setSearching(false)}
                    onOpen={open}
                    onCreate={(title) => startNew(title)}
                />
            )}

            {trash && <TrashDialog onClose={() => setTrash(false)} onNotice={say} />}

            <Snackbar
                open={!!notice}
                autoHideDuration={5000}
                onClose={() => setNotice(null)}
                message={notice?.text}
                action={notice?.action && <Button size="small" sx={{ color: gold.bright }} onClick={() => { notice.action!.go(); setNotice(null) }}>{notice.action.label}</Button>}
                sx={{ bottom: { xs: 'calc(var(--tabbar-h, 0px) + 16px)', md: 24 } }}
            />
        </Box>
    )
}

interface PanelProps {
    id: string
    pages: WikiSummary[]
    authors: Record<string, string>
    isGm: boolean
    wide: boolean
    displayName: string
    onOpen: (id: string) => void
    onLink: (target: string) => void
    resolveLink: (target: string) => 'known' | 'wiki' | 'missing'
    onBack: () => void
    onKind: (kind: WikiKind) => void
    favorite: boolean
    onFavorite: () => void
    onNotice: (text: string, action?: Notice['action']) => void
}

function PagePanel(props: PanelProps) {
    const { id, pages, authors, isGm, wide, displayName, onOpen, onLink, resolveLink, onBack, onKind, favorite, onFavorite, onNotice } = props
    const [editing, setEditing] = useState(false)
    const { view, status, reload, changedMeanwhile } = useWikiPageView(id, editing)
    const [history, setHistory] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const flags = async (f: { locked?: boolean; visibility?: 'public' | 'gm' }) => {
        const err = await setWikiFlags(id, f)
        if (err) { onNotice(err); return }
        reload()
        onNotice(f.locked !== undefined
            ? (f.locked ? tr('Página travada: só o GM a edita', 'Page locked: only the GM edits it') : tr('Página destravada', 'Page unlocked'))
            : (f.visibility === 'public' ? tr('Página revelada à mesa', 'Page revealed to the table') : tr('Página escondida da mesa', 'Page hidden from the table')))
    }

    const show = async (image?: string) => {
        const err = await showWikiPage(id, displayName, GM_COLOR, image)
        onNotice(err ?? tr(`"${view?.page.title ?? ''}" na tela da mesa`, `"${view?.page.title ?? ''}" on the table's screen`))
    }

    const remove = async () => {
        setDeleting(false)
        const err = await deleteWikiPage(id)
        if (err) { onNotice(err); return }
        onNotice(isGm ? tr('Página na lixeira (o GM pode restaurar)', 'Page in the trash (the GM can restore it)') : tr('Página apagada', 'Page deleted'))
        onBack()
    }

    if (status === 'missing') {
        return (
            <Alert severity="warning" action={<Button onClick={onBack}>{tr('Voltar', 'Back')}</Button>}>
                {tr('Esta página não existe (ou foi apagada).', 'This page doesn\'t exist (or was deleted).')}</Alert>
        )
    }
    if (status === 'offline' && !view) {
        return <Alert severity="error" action={<Button onClick={reload}>{tr('Tentar de novo', 'Try again')}</Button>}>{tr('Sem conexão com a Wiki.', 'No connection to the wiki.')}</Alert>
    }
    if (!view) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>

    return (
        <Box sx={{ minWidth: 0 }}>
            {!wide && editing && (
                <IconButton aria-label={tr('Voltar à página', 'Back to the page')} onClick={() => setEditing(false)} sx={{ mb: 1 }}><ArrowBack /></IconButton>
            )}
            {editing
                ? (
                    <>
                        <Typography component="h1" variant="h5" sx={{ mb: 2 }}>{tr('Editando ', 'Editing ')}{view.page.title}</Typography>
                        <WikiEditor
                            key={`${view.page.id}:${view.page.updatedAt}`}
                            initial={view.page}
                            base={view.page.updatedAt}
                            pages={pages}
                            isGm={isGm}
                            changedMeanwhile={changedMeanwhile}
                            onSaved={() => { setEditing(false); reload(); void refreshWikiIndex() }}
                            onCancel={() => { setEditing(false); reload() }}
                        />
                    </>
                )
                : (
                    <WikiView
                        view={view}
                        pages={pages}
                        authors={authors}
                        isGm={isGm}
                        onOpen={onOpen}
                        onLink={onLink}
                        resolveLink={resolveLink}
                        onHome={onBack}
                        onKind={onKind}
                        favorite={favorite}
                        onFavorite={onFavorite}
                        onEdit={() => setEditing(true)}
                        onHistory={() => setHistory(true)}
                        onDelete={() => setDeleting(true)}
                        onFlags={(f) => void flags(f)}
                        onShow={(image) => void show(image)}
                        onNotice={onNotice}
                    />
                )}

            {history && <HistoryDialog page={view.page} canEdit={view.canEdit} onClose={() => setHistory(false)} onRestored={() => { reload(); void refreshWikiIndex(); onNotice(tr('Versão restaurada', 'Version restored')) }} />}

            {deleting && (
                <Dialog open onClose={() => setDeleting(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>{tr('Apagar "', 'Delete "')}{view.page.title}"?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2">{tr('A página sai da Wiki e vai para a lixeira do GM, que pode restaurá-la. Os links para ela ficam vermelhos.', 'The page leaves the wiki and goes to the GM\'s trash, who can restore it. Links to it turn red.')}</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleting(false)}>{tr('Cancelar', 'Cancel')}</Button>
                        <Button color="error" variant="contained" onClick={() => void remove()}>{tr('Apagar', 'Delete')}</Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    )
}

/** Só o GM: as páginas apagadas, para restaurar ou apagar de vez. */
function TrashDialog({ onClose, onNotice }: { onClose: () => void; onNotice: (text: string) => void }) {
    const [pages, setPages] = useState<WikiSummary[] | null>(null)
    const [authors, setAuthors] = useState<Record<string, string>>({})
    const load = useCallback(() => {
        void fetchWikiList(true).then((out) => { setPages(out?.pages ?? []); setAuthors(out?.authors ?? {}) })
    }, [])
    useEffect(load, [load])

    const act = async (fn: () => Promise<string | null>, ok: string) => {
        const err = await fn()
        onNotice(err ?? ok)
        load()
        void refreshWikiIndex()
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{tr('Lixeira da Wiki', 'Wiki trash')}</DialogTitle>
            <DialogContent dividers>
                {!pages
                    ? <CircularProgress size={20} />
                    : pages.length === 0
                        ? <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('A lixeira está vazia.', 'The trash is empty.')}</Typography>
                        : (
                            <List dense>
                                {[...pages].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)).map((p) => (
                                    <ListItem key={p.id} disableGutters sx={{ display: 'block', borderBottom: `1px solid ${rule}` }}>
                                        <ListItemText
                                            primary={`${p.title} · ${KIND_LABEL[p.kind].one}`}
                                            secondary={`${tr('criada por ', 'created by ')}${authorName(authors, p.createdBy)} · ${tr('apagada ', 'deleted ')}${formatWhen(p.deletedAt ?? 0)}`}
                                        />
                                        <Stack direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
                                            <Button size="small" onClick={() => void act(() => undeleteWikiPage(p.id), tr('Página restaurada', 'Page restored'))}>{tr('Restaurar', 'Restore')}</Button>
                                            <Button size="small" color="error" onClick={() => void act(() => purgeWikiPage(p.id), tr('Apagada de vez', 'Deleted for good'))}>{tr('Apagar de vez', 'Delete for good')}</Button>
                                        </Stack>
                                    </ListItem>
                                ))}
                            </List>
                        )}
            </DialogContent>
            <DialogActions><Button onClick={onClose}>{tr('Fechar', 'Close')}</Button></DialogActions>
        </Dialog>
    )
}

export default WikiPage
