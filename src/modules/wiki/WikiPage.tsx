import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List,
    ListItem, ListItemText, Snackbar, Stack, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { ArrowBack, DeleteSweep as TrashIcon } from '@mui/icons-material'
import { useRole } from '../../services/auth'
import {
    blankPage, deleteWikiPage, fetchWikiList, purgeWikiPage, refreshWikiIndex, setWikiFlags, showWikiPage, undeleteWikiPage,
    useWikiIndex, WIKI_KINDS, type WikiKind, type WikiPage as WikiPageData, type WikiSummary,
} from '../../services/wiki'
import { linkName } from '../../components/markdown/blocks'
import { gold, parchment, rule } from '../../theme'
import { KIND_LABEL, templateFor } from './kinds'
import { findPage, formatWhen, authorName, useNameIndex, useWikiPageView } from './useWiki'
import { WikiList, RecentChanges } from './components/WikiList'
import { WikiView } from './components/WikiView'
import { WikiEditor } from './components/WikiEditor'
import { HistoryDialog } from './components/HistoryDialog'
import { tr } from '../../i18n'

// Wiki da Mesa: o que GM e jogadores escrevem sobre o mundo (NPCs, locais, itens, criaturas…). Todos
// leem, criam e editam; o GM trava, esconde e revela. O servidor decide; aqui só se esconde botão.
//
// `/wiki/<id>` abre uma página; `?nova=<título>&tipo=<tipo>` abre o editor de uma página nova (é
// como o Diário de Campanha e os links vermelhos chegam aqui).

const BASE = '/wiki'
/** A cor do GM no cartão da mesa: o ouro de texto, que lê sobre o verde do cabeçalho. */
const GM_COLOR = gold.deep

interface Notice { text: string; action?: { label: string; go: () => void } }

export function WikiPage() {
    const { id = null } = useParams()
    const [params, setParams] = useSearchParams()
    const navigate = useNavigate()
    const theme = useTheme()
    const wide = useMediaQuery(theme.breakpoints.up('md'))
    const role = useRole()
    const index = useWikiIndex()
    const pages = useMemo(() => index.list?.pages ?? [], [index.list])
    const authors = useMemo(() => index.list?.authors ?? {}, [index.list])
    const isGm = index.list?.gm ?? role.isGm
    const names = useNameIndex(pages)
    const [creating, setCreating] = useState<WikiPageData | null>(null)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [trash, setTrash] = useState(false)

    const open = useCallback((pageId: string) => { setCreating(null); navigate(`${BASE}/${pageId}`) }, [navigate])
    const startNew = useCallback((title = '', kind: WikiKind = 'npc') => {
        setCreating(blankPage(kind, title, templateFor(kind)))
        if (id) navigate(BASE)
    }, [id, navigate])

    // `?nova=` (do Diário, de um link vermelho de outra página): abre o editor da página nova.
    const novo = params.get('nova') // i18n-ok: parâmetro da URL
    const novoTipo = params.get('tipo') // i18n-ok: parâmetro da URL
    useEffect(() => {
        if (novo === null) return
        const existing = findPage(names, novo)
        if (existing && index.list) open(existing)
        else if (index.list) {
            const kind = (WIKI_KINDS as readonly string[]).includes(novoTipo ?? '') ? novoTipo as WikiKind : 'npc'
            setCreating(blankPage(kind, novo.slice(0, 120), templateFor(kind)))
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

    const showList = wide || (!id && !creating)
    return (
        <Box sx={{ maxWidth: 1500, mx: 'auto' }}>
            {showList && !id && !creating && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <Typography component="h1" variant="h4" sx={{ flex: 1 }}>{tr('Wiki da Mesa', 'Table Wiki')}</Typography>
                    {isGm && <IconButton aria-label={tr('Lixeira da Wiki', 'Wiki trash')} title={tr('Lixeira', 'Trash')} onClick={() => setTrash(true)}><TrashIcon /></IconButton>}
                </Stack>
            )}
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' }, alignItems: 'start' }}>
                {showList && (
                    <Box sx={{ position: { md: 'sticky' }, top: { md: 16 }, maxHeight: { md: 'calc(100vh - 32px)' }, overflowY: { md: 'auto' }, pr: { md: 0.5 } }}>
                        <WikiList pages={pages} authors={authors} selected={id} me={role.userId} onOpen={open} onNew={() => startNew()} />
                    </Box>
                )}
                {creating
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
                                pages={pages}
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
                                pages={pages}
                                authors={authors}
                                isGm={isGm}
                                wide={wide}
                                displayName={role.displayName || role.username || 'GM'}
                                onOpen={open}
                                onLink={onLink}
                                resolveLink={resolveLink}
                                onBack={() => navigate(BASE)}
                                onNotice={say}
                            />
                        )
                        : wide && <Home pages={pages} authors={authors} onOpen={open} onNew={() => startNew()} />}
            </Box>

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

function Home({ pages, authors, onOpen, onNew }: { pages: WikiSummary[]; authors: Record<string, string>; onOpen: (id: string) => void; onNew: () => void }) {
    return (
        <Box sx={{ p: { xs: 2, sm: 3 }, border: `1px solid ${rule}`, borderRadius: 2, bgcolor: parchment.paper, minWidth: 0 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>{tr('O mundo, escrito pela mesa', 'The world, written by the table')}</Typography>
            <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
                {tr('NPCs, lugares, itens, criaturas, facções e tudo o que o grupo descobriu. Todos escrevem e editam; cada salvamento fica no histórico com o nome de quem salvou. Use [[Nome]] para ligar uma página a outra.', 'NPCs, places, items, creatures, factions and everything the party found out. Everyone writes and edits; each save stays in the history with the name of whoever saved it. Use [[Name]] to link one page to another.')}</Typography>
            <Button variant="contained" onClick={onNew} sx={{ mb: 3 }}>{tr('Nova página', 'New page')}</Button>
            {pages.length > 0 && (
                <>
                    <Typography variant="h6" sx={{ mb: 1 }}>{tr('Mudanças recentes', 'Recent changes')}</Typography>
                    <RecentChanges pages={pages} authors={authors} onOpen={onOpen} limit={15} />
                </>
            )}
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
    onNotice: (text: string, action?: Notice['action']) => void
}

function PagePanel(props: PanelProps) {
    const { id, pages, authors, isGm, wide, displayName, onOpen, onLink, resolveLink, onBack, onNotice } = props
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

    const show = async () => {
        const err = await showWikiPage(id, displayName, GM_COLOR)
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
            {!wide && (
                <IconButton aria-label={tr('Voltar ao índice da Wiki', 'Back to the wiki index')} onClick={editing ? () => setEditing(false) : onBack} sx={{ mb: 1 }}><ArrowBack /></IconButton>
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
                        onEdit={() => setEditing(true)}
                        onHistory={() => setHistory(true)}
                        onDelete={() => setDeleting(true)}
                        onFlags={(f) => void flags(f)}
                        onShow={() => void show()}
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
