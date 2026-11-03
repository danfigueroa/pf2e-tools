import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    Snackbar, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { ArrowBack, Delete as DeleteIcon, CloudDone, CloudOff, CloudUpload } from '@mui/icons-material'
import { useRole } from '../../services/auth'
import { listPublished } from '../../services/sheets'
import { deleteJournalDoc, fetchJournalDoc, revealToTable, saveJournalDoc } from '../../services/journal'
import { useWikiIndex } from '../../services/wiki'
import { foldName, linkName } from '../../components/markdown/blocks'
import { displayFont, gold, green, parchment, rule, onFrame } from '../../theme'
import {
    CATALOG_KINDS, KIND_LABEL, newDoc, sanitizeDoc, wireDoc, type CatalogDoc, type CatalogKind, type DocKind,
    type JournalDoc, type JournalSummary, type SessionDoc, type ThreadDoc, type ThreadStatus,
} from './doc'
import { TEMPLATES } from './templates'
import { JournalToolsContext, type JournalTools } from '../../components/markdown/tools'
import { createJournalDoc, useJournalDoc, useJournalList, type SaveStatus } from './useJournal'
import { partyFromLevels } from './xp'
import { JournalList } from './components/JournalList'
import { SessionView } from './components/SessionView'
import { CatalogView, ThreadView } from './components/EntryView'
import { RevealDialog, type RevealDraft } from './components/RevealDialog'
import { tr } from '../../i18n'

// Diário de Campanha (só do GM): uma página por sessão, o catálogo da campanha
// (NPCs, locais, itens, facções) e os ganchos. O que for para os jogadores sai
// pelo "Mostrar à mesa" — um trecho `:::jogadores` ou uma imagem —, que aparece
// na tela de todos, em qualquer página (o cartão do `SharedRuleLayer`).
//
// O servidor recusa o diário a quem não é GM, mesmo com a cobrança de login
// desligada; aqui só se esconde.

const BASE = '/diario-campanha'

/** A cor do GM no cartão da mesa: o ouro de texto, que lê sobre o verde do cabeçalho. */
const GM_COLOR = gold.deep

const STATUS_CHIP: Record<SaveStatus, { label: string; icon?: React.ReactElement }> = {
    loading: { label: tr('Abrindo…', 'Opening…') },
    missing: { label: tr('Não encontrado', 'Not found') },
    saved: { label: tr('Salvo', 'Saved'), icon: <CloudDone fontSize="small" /> },
    pending: { label: tr('Alterado', 'Changed'), icon: <CloudUpload fontSize="small" /> },
    saving: { label: tr('Salvando…', 'Saving…'), icon: <CloudUpload fontSize="small" /> },
    offline: { label: tr('Sem conexão: guardado neste aparelho', 'No connection: kept on this device'), icon: <CloudOff fontSize="small" /> },
    conflict: { label: tr('Conflito', 'Conflict'), icon: <CloudOff fontSize="small" /> },
}

const isCatalog = (d: JournalDoc): d is CatalogDoc => (CATALOG_KINDS as readonly string[]).includes(d.kind)

export const CampaignJournalPage = () => {
    const { isGm } = useRole()
    if (!isGm) return <Alert severity="info">{tr('Só o GM da mesa vê o diário de campanha.', 'Only the table\'s GM sees the campaign journal.')}</Alert>
    return <Journal />
}

interface Reveal extends RevealDraft { source: string }

function Journal() {
    const { id = null } = useParams()
    const navigate = useNavigate()
    const theme = useTheme()
    const wide = useMediaQuery(theme.breakpoints.up('md'))
    const { displayName } = useRole()
    const list = useJournalList()
    const [publishedParty, setPublishedParty] = useState<{ level: number; size: number } | null>(null)
    const [reveal, setReveal] = useState<Reveal | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [wikiNew, setWikiNew] = useState<{ name: string; kind: CatalogKind } | null>(null)

    useEffect(() => {
        void listPublished().then((sheets) => setPublishedParty(partyFromLevels(sheets.map((s) => s.level))))
    }, [])

    const docs = useMemo(() => list.docs ?? [], [list.docs])
    const open = useCallback((docId: string) => navigate(`${BASE}/${docId}`), [navigate])

    /** Cria sem sair da página; devolve o id. `from` = sessão de origem (gancho nasce "introduzido" nela). */
    const create = useCallback(async (kind: DocKind, title: string, from?: string): Promise<string | null> => {
        const number = kind === 'session' ? Math.max(0, ...docs.filter((d) => d.kind === 'session').map((d) => d.sort)) + 1 : 0
        const doc = newDoc(kind, title || (kind === 'session' ? tr(`Sessão ${number}`, `Session ${number}`) : tr(`${KIND_LABEL[kind].one} novo`, `New ${KIND_LABEL[kind].one}`)), {
            number,
            md: kind === 'session' ? TEMPLATES.prep : TEMPLATES[kind],
        })
        if (doc.kind === 'thread' && from) doc.data.introducedIn = from
        const err = await createJournalDoc(doc)
        if (err) { setNotice(err); return null }
        list.patch(doc)
        return doc.id
    }, [docs, list])

    const createAndOpen = useCallback(async (kind: DocKind) => {
        const docId = await create(kind, '')
        if (docId) open(docId)
    }, [create, open])

    const threadStatus = useCallback(async (docId: string, status: ThreadStatus) => {
        const current = sanitizeDoc(await fetchJournalDoc(docId))
        if (!current || current.kind !== 'thread') { setNotice(tr('Não foi possível abrir o gancho', 'Couldn\'t open the hook')); return }
        const next: ThreadDoc = { ...current, data: { ...current.data, status } }
        const out = await saveJournalDoc(wireDoc(next), current.updatedAt)
        if (!out.ok) { setNotice(out.conflict ? tr('O gancho mudou em outro aparelho: tente de novo', 'The hook changed on another device: try again') : out.error); return }
        list.patch({ ...next, updatedAt: out.updatedAt })
    }, [list])

    // `[[Nome]]`: primeiro o catálogo do diário, depois a Wiki da Mesa; `[[wiki:Nome]]` vai direto à Wiki.
    const wiki = useWikiIndex()
    const wikiNames = useMemo(() => {
        const map = new Map<string, string>()
        for (const p of wiki.list?.pages ?? []) {
            for (const n of [p.title, ...p.aliases]) if (!map.has(foldName(n))) map.set(foldName(n), p.id)
        }
        return map
    }, [wiki.list])
    const knownNames = useMemo(() => new Set(docs.filter((d) => d.kind !== 'session').map((d) => d.title.toLowerCase())), [docs])
    const catalogOf = useCallback((name: string) =>
        docs.find((d) => d.kind !== 'session' && d.title.toLowerCase() === name.toLowerCase()) ?? null, [docs])
    const resolveLink = useCallback((target: string) => {
        const forced = /^wiki:/i.test(target)
        const name = linkName(target)
        if (!forced && catalogOf(name)) return 'known' as const
        return wikiNames.has(foldName(name)) ? 'wiki' as const : 'missing' as const
    }, [catalogOf, wikiNames])
    const openWiki = useCallback((target: string) => {
        const forced = /^wiki:/i.test(target)
        const name = linkName(target)
        const found = forced ? null : catalogOf(name)
        if (found) { open(found.id); return }
        const page = wikiNames.get(foldName(name))
        if (page) navigate(`/wiki/${page}`)
        else if (forced) navigate(`/wiki?nova=${encodeURIComponent(name)}`)
        else setWikiNew({ name, kind: 'npc' })
    }, [catalogOf, wikiNames, open, navigate])

    const confirmReveal = useCallback(async (draft: RevealDraft) => {
        if (!reveal) return tr('Nada para mostrar', 'Nothing to show')
        const err = await revealToTable(
            { title: draft.title, markdown: draft.markdown, image: draft.image, source: reveal.source },
            displayName || 'GM', GM_COLOR,
        )
        if (!err) setNotice(tr(`"${draft.title}" na tela da mesa`, `"${draft.title}" on the table's screen`))
        return err
    }, [reveal, displayName])

    if (list.failed && !list.docs) {
        return <Alert severity="error" action={<Button onClick={() => void list.reload()}>{tr('Tentar de novo', 'Try again')}</Button>}>{tr('Não foi possível abrir o diário.', 'Couldn\'t open the journal.')}</Alert>
    }
    if (!list.docs) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>

    const showList = wide || !id
    return (
        <Box sx={{ maxWidth: 1500, mx: 'auto' }}>
            {showList && !id && <Typography component="h1" variant="h4" sx={{ mb: 2 }}>{tr('Diário de Campanha', 'Campaign Journal')}</Typography>}
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, alignItems: 'start' }}>
                {showList && (
                    <Box sx={{ position: { md: 'sticky' }, top: { md: 16 }, maxHeight: { md: 'calc(100vh - 32px)' }, overflowY: { md: 'auto' }, pr: { md: 0.5 } }}>
                        <JournalList docs={docs} selected={id} onOpen={open} onNew={(k) => void createAndOpen(k)} />
                    </Box>
                )}
                {id
                    ? (
                        <DocPanel
                            key={id}
                            id={id}
                            docs={docs}
                            wide={wide}
                            publishedParty={publishedParty}
                            onSaved={list.patch}
                            onOpen={open}
                            onBack={() => navigate(BASE)}
                            onDeleted={(docId) => { list.drop(docId); navigate(BASE) }}
                            onCreate={create}
                            onThreadStatus={(docId, s) => void threadStatus(docId, s)}
                            tools={{ knownNames, openWiki, resolveLink }}
                            onReveal={(draft) => setReveal({ ...draft, source: id })}
                        />
                    )
                    : wide && <EmptyState docs={docs} onNew={(k) => void createAndOpen(k)} onOpen={open} />}
            </Box>

            {reveal && <RevealDialog draft={reveal} onClose={() => setReveal(null)} onConfirm={confirmReveal} />}

            {wikiNew && (
                <Dialog open onClose={() => setWikiNew(null)} fullWidth maxWidth="xs">
                    <DialogTitle>{tr('Criar "', 'Create "')}{wikiNew.name}"</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{tr('Ainda não há ficha com esse nome no catálogo nem página na Wiki da Mesa.', 'There\'s no entry with that name in the catalog nor a page on the Table Wiki yet.')}</Typography>
                        <TextField
                            select
                            size="small"
                            fullWidth
                            label={tr("Tipo", 'Kind')}
                            value={wikiNew.kind}
                            onChange={(e) => setWikiNew({ ...wikiNew, kind: e.target.value as CatalogKind })}
                            slotProps={{ select: { native: true } }}
                        >
                            {CATALOG_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k].one}</option>)}
                        </TextField>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setWikiNew(null)}>{tr('Cancelar', 'Cancel')}</Button>
                        <Button onClick={() => {
                            const { name, kind } = wikiNew
                            setWikiNew(null)
                            navigate(`/wiki?nova=${encodeURIComponent(name)}&tipo=${kind}`)
                        }}>
                            {tr('Criar na Wiki', 'Create on the wiki')}</Button>
                        <Button variant="contained" onClick={() => {
                            const { name, kind } = wikiNew
                            setWikiNew(null)
                            void create(kind, name).then((docId) => { if (docId) open(docId) })
                        }}>
                            {tr('Criar no catálogo', 'Create in the catalog')}</Button>
                    </DialogActions>
                </Dialog>
            )}

            <Snackbar
                open={!!notice}
                autoHideDuration={4000}
                onClose={() => setNotice(null)}
                message={notice}
                sx={{ bottom: { xs: 'calc(var(--tabbar-h, 0px) + 16px)', md: 24 } }}
            />
        </Box>
    )
}

function EmptyState({ docs, onNew, onOpen }: { docs: JournalSummary[]; onNew: (k: DocKind) => void; onOpen: (id: string) => void }) {
    const latest = docs.filter((d) => d.kind === 'session').sort((a, b) => b.sort - a.sort)[0]
    return (
        <Box sx={{ p: { xs: 2, sm: 4 }, border: `1px dashed ${rule}`, borderRadius: 2, bgcolor: parchment.paper, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ mb: 1 }}>{latest ? tr('Continue a preparação', 'Continue the prep') : tr('Comece pela primeira sessão', 'Start with the first session')}</Typography>
            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 520, mx: 'auto' }}>
                {tr('Uma página por sessão (preparação, cenas, encontros, elenco, registro e resumo) e um catálogo de NPCs, locais e itens que servem à campanha inteira. Marque com ', 'One page per session (prep, scenes, encounters, cast, log and summary) and a catalog of NPCs, places and items that serve the whole campaign. Mark with ')}<code>{tr(':::jogadores', ':::players')}</code> {tr('o que pode ir para a tela da mesa.', 'what can go to the table\'s screen.')}</Typography>
            {latest
                ? <Button variant="contained" onClick={() => onOpen(latest.id)}>{tr('Abrir ', 'Open ')}{latest.title}</Button>
                : <Button variant="contained" onClick={() => onNew('session')}>{tr('Nova sessão', 'New session')}</Button>}
        </Box>
    )
}

interface DocPanelProps {
    id: string
    docs: JournalSummary[]
    wide: boolean
    publishedParty: { level: number; size: number } | null
    onSaved: (doc: JournalDoc) => void
    onOpen: (id: string) => void
    onBack: () => void
    onDeleted: (id: string) => void
    onCreate: (kind: DocKind, title: string, from?: string) => Promise<string | null>
    onThreadStatus: (id: string, status: ThreadStatus) => void
    tools: Pick<JournalTools, 'knownNames' | 'openWiki' | 'resolveLink'>
    onReveal: (draft: RevealDraft) => void
}

function DocPanel(props: DocPanelProps) {
    const { id, docs, wide, publishedParty, onSaved, onOpen, onBack, onDeleted, onCreate, onThreadStatus, onReveal } = props
    const state = useJournalDoc(id, onSaved)
    const { doc, status, version, update } = state
    const [deleting, setDeleting] = useState(false)

    const updateSession = useCallback((fn: (d: SessionDoc) => SessionDoc) => update((d) => (d.kind === 'session' ? fn(d) : d)), [update])
    const updateCatalog = useCallback((fn: (d: CatalogDoc) => CatalogDoc) => update((d) => (isCatalog(d) ? fn(d) : d)), [update])
    const updateThread = useCallback((fn: (d: ThreadDoc) => ThreadDoc) => update((d) => (d.kind === 'thread' ? fn(d) : d)), [update])

    const title = doc?.title ?? ''
    const tools = useMemo<JournalTools>(() => ({
        ...props.tools,
        shareBlock: (blockTitle, text) => onReveal({ title: blockTitle || title, markdown: text, image: null }),
        shareImage: (url, alt) => onReveal({ title: alt || title, markdown: '', image: url }),
    }), [props.tools, onReveal, title])

    const remove = async () => {
        setDeleting(true)
        const ok = await deleteJournalDoc(id)
        setDeleting(false)
        if (ok) onDeleted(id)
    }

    if (status === 'missing') {
        return (
            <Alert severity="warning" action={<Button onClick={onBack}>{tr('Voltar', 'Back')}</Button>}>
                {tr('Este documento não existe mais (foi apagado em outro aparelho?).', 'This document doesn\'t exist anymore (deleted on another device?).')}</Alert>
        )
    }
    if (!doc) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>

    const chip = STATUS_CHIP[status]
    return (
        <JournalToolsContext.Provider value={tools}>
            <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    {!wide && <IconButton aria-label={tr("Voltar ao índice do diário", 'Back to the journal index')} onClick={onBack}><ArrowBack /></IconButton>}
                    <Chip size="small" label={KIND_LABEL[doc.kind].one} sx={{ bgcolor: green.main, color: onFrame.paper }} />
                    <TextField
                        variant="standard"
                        value={doc.title}
                        onChange={(e) => {
                            const t = e.target.value.replace(/[\n\r\t]/g, ' ').slice(0, 200)
                            update((d) => ({ ...d, title: t }))
                        }}
                        onBlur={() => { if (!doc.title.trim()) update((d) => ({ ...d, title: tr('Sem título', 'Untitled') })) }}
                        slotProps={{ htmlInput: { 'aria-label': tr('Título', 'Title'), style: { fontSize: '1.6rem', fontFamily: displayFont, fontWeight: 700 } } }}
                        sx={{ flex: '1 1 240px', minWidth: 0 }}
                    />
                    <Chip
                        size="small"
                        variant="outlined"
                        icon={chip.icon}
                        label={chip.label}
                        onClick={status === 'offline' ? state.retry : undefined}
                        color={status === 'offline' || status === 'conflict' ? 'warning' : 'default'}
                    />
                    <IconButton aria-label={tr(`Apagar ${doc.title}`, `Delete ${doc.title}`)} onClick={() => setDeleting(true)}><DeleteIcon /></IconButton>
                </Box>

                {status === 'conflict' && state.theirs && (
                    <Alert
                        severity="warning"
                        sx={{ mb: 2 }}
                        action={(
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Button size="small" onClick={state.keepTheirs}>{tr('Usar a do outro aparelho', 'Use the other device\'s version')}</Button>
                                <Button size="small" variant="contained" onClick={state.keepMine}>{tr('Manter a minha', 'Keep mine')}</Button>
                            </Box>
                        )}
                    >
                        {tr('Este documento foi editado em outro aparelho enquanto você mexia aqui.', 'This document was edited on another device while you were working here.')}</Alert>
                )}

                {doc.kind === 'session' && (
                    <SessionView
                        doc={doc}
                        version={version}
                        update={updateSession}
                        docs={docs}
                        publishedParty={publishedParty}
                        onOpen={onOpen}
                        onCreate={onCreate}
                        onThreadStatus={onThreadStatus}
                    />
                )}
                {isCatalog(doc) && <CatalogView doc={doc} version={version} update={updateCatalog} docs={docs} onOpen={onOpen} />}
                {doc.kind === 'thread' && <ThreadView doc={doc} version={version} update={updateThread} docs={docs} onOpen={onOpen} />}
            </Box>

            {deleting && (
                <Dialog open onClose={() => setDeleting(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>{tr('Apagar "', 'Delete "')}{doc.title}"?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2">{tr('Não tem volta. As sessões que o citam ficam sem ele.', 'There\'s no undo. The sessions that cite it lose it.')}</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleting(false)}>{tr('Cancelar', 'Cancel')}</Button>
                        <Button color="error" variant="contained" onClick={() => void remove()}>{tr('Apagar', 'Delete')}</Button>
                    </DialogActions>
                </Dialog>
            )}
        </JournalToolsContext.Provider>
    )
}
