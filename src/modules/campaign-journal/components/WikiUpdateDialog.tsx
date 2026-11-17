import { useEffect, useMemo, useState } from 'react'
import {
    Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup,
    Stack, Typography,
} from '@mui/material'
import { fetchWikiPage, saveWikiPage, setWikiFlags, useWikiIndex, type WikiKind, type WikiPageView, type WikiSummary } from '../../../services/wiki'
import { INFOBOX, KIND_LABEL, PARENT_LABEL } from '../../wiki/kinds'
import { splitSegments } from '../../../components/markdown/blocks'
import { ink, parchment, rule, status } from '../../../theme'
import { entryOf, lineDiff, metaChanges, updatedPage, type DiffLine, type MetaChange, type WikiShare } from '../toWiki'
import type { CatalogDoc, JournalSummary } from '../doc'
import { locale, tr } from '../../../i18n'

// "Atualizar a Wiki com esta ficha": a página ligada passa a ser a ficha — texto, ficha rápida, apelidos,
// resumo, AON e página-mãe (`updatedPage`). Substitui o que houver lá, inclusive o que outra pessoa
// escreveu — por isso o GM vê antes a diferença (do texto e de cada campo) e quem mexeu por último. Grava com o `updatedAt` lido: se alguém salvar no meio, é conflito, não perda.

/** Linhas iguais mostradas em volta de cada mudança; o resto das iguais vira "… N linhas iguais". */
const CONTEXT = 2

type Row = DiffLine | { kind: 'skip'; count: number }

function collapse(diff: DiffLine[]): Row[] {
    const near = diff.map((_, i) => diff.slice(Math.max(0, i - CONTEXT), i + CONTEXT + 1).some((d) => d.kind !== 'same'))
    const out: Row[] = []
    diff.forEach((d, i) => {
        if (d.kind !== 'same' || near[i]) { out.push(d); return }
        const last = out[out.length - 1]
        if (last?.kind === 'skip') last.count++
        else out.push({ kind: 'skip', count: 1 })
    })
    return out
}

/** O nome de cada linha da tabela de campos. */
function changeLabel(key: string, kind: WikiKind): string {
    if (key.startsWith('field:')) {
        const k = key.slice(6)
        return INFOBOX[kind].find((f) => f.key === k)?.label ?? k
    }
    const LABELS: Record<string, string> = {
        kind: tr('Tipo', 'Kind'), title: tr('Título', 'Title'), summary: tr('Resumo', 'Summary'), aliases: tr('Também chamado', 'Also known as'),
        aon: tr('Ficha da AON', 'AON sheet'), parent: PARENT_LABEL[kind], image: tr('Imagem', 'Image'), tags: tr('Etiquetas', 'Tags'),
    }
    return LABELS[key] ?? key
}

/** O valor como se lê: tipo pelo nome, página-mãe pelo título, imagem como "trocada". */
function shown(c: MetaChange, side: 'before' | 'after', pages: WikiSummary[] | undefined): string {
    const v = c[side]
    if (!v) return ''
    if (c.key === 'kind') return KIND_LABEL[v as WikiKind]?.one ?? v
    if (c.key === 'parent') return pages?.find((p) => p.id === v)?.title ?? tr('outra página', 'another page')
    if (c.key === 'image') return side === 'before' ? tr('a de agora', 'the current one') : tr('a da ficha', 'the entry\'s')
    return v.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
}

interface Props {
    doc: CatalogDoc
    docs: JournalSummary[]
    pageId: string
    onClose: () => void
    onDone: () => void
}

export function WikiUpdateDialog({ doc, docs, pageId, onClose, onDone }: Props) {
    const [view, setView] = useState<WikiPageView | null | undefined | 'loading'>('loading')
    const hasPlayers = splitSegments(doc.data.md).some((x) => x.kind === 'players')
    const [share, setShare] = useState<WikiShare>(hasPlayers ? 'players' : 'all')
    const [hidden, setHidden] = useState<boolean | null>(null)
    const [facts, setFacts] = useState(true)
    const [aliases, setAliases] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let live = true
        void fetchWikiPage(pageId).then((v) => {
            if (!live) return
            setView(v)
            if (v) setHidden(v.page.visibility === 'gm')
        })
        return () => { live = false }
    }, [pageId])

    const page = view && view !== 'loading' ? view.page : null
    const next = useMemo(
        () => (page ? updatedPage(page, entryOf(doc, docs), { share, open: tr(':::mestre', ':::gm'), facts, aliases }) : null),
        [page, doc, docs, share, facts, aliases],
    )
    const changes = useMemo(() => (page && next ? metaChanges(page, next) : []), [page, next])
    const pages = useWikiIndex().list?.pages
    const diff = useMemo(() => (page && next ? lineDiff(page.body, next.body) : []), [page, next])
    const rows = useMemo(() => collapse(diff), [diff])
    const removed = diff.filter((d) => d.kind === 'del').length
    const added = diff.filter((d) => d.kind === 'add').length
    const visibilityChanged = !!page && hidden !== null && hidden !== (page.visibility === 'gm')
    const pageChanged = removed + added > 0 || changes.length > 0
    const nothing = !pageChanged && !visibilityChanged

    const save = async () => {
        if (!page || !next) return
        setBusy(true)
        setError(null)
        if (pageChanged) {
            const out = await saveWikiPage(next, page.updatedAt)
            if (!out.ok) {
                setBusy(false)
                setError(out.conflict
                    ? tr('Alguém salvou esta página agora mesmo. Feche e abra de novo para ver a versão nova.', 'Someone saved this page just now. Close and open again to see the new version.')
                    : out.error)
                return
            }
        }
        if (visibilityChanged) {
            const err = await setWikiFlags(page.id, { visibility: hidden ? 'gm' : 'public' })
            if (err) { setBusy(false); setError(err); return }
        }
        setBusy(false)
        onDone()
    }

    const lastBy = page?.updatedBy ? (view && view !== 'loading' ? view.authors[page.updatedBy] : null) : null

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>{tr('Atualizar a Wiki com esta ficha', 'Update the wiki from this entry')}</DialogTitle>
            <DialogContent dividers>
                {view === 'loading' && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>}
                {view === null && <Alert severity="warning">{tr('A página ligada não existe mais na Wiki.', 'The linked page no longer exists on the wiki.')}</Alert>}
                {view === undefined && <Alert severity="error">{tr('Não foi possível abrir a página da Wiki. Tente de novo.', 'Could not open the wiki page. Try again.')}</Alert>}
                {page && next && (
                    <>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {tr('A página passa a ser esta ficha. O que estiver só na Wiki (em vermelho abaixo) sai — ',
                                'The page becomes this entry. Whatever is only on the wiki (in red below) goes away — ')}
                            {tr('a versão de antes fica no histórico da página, de onde dá para restaurar (menos uma edição sua feita na Wiki nos últimos 10 minutos: essa é substituída).',
                                'the previous version stays in the page history, where it can be restored (except an edit of yours made on the wiki in the last 10 minutes: that one is replaced).')}
                            {' '}
                            {tr('Última edição na Wiki: ', 'Last edit on the wiki: ')}
                            <strong>{lastBy ?? tr('alguém', 'someone')}</strong>
                            {page.updatedAt ? `, ${new Date(page.updatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}` : ''}.
                        </Alert>
                        <Stack sx={{ mb: 1.5 }}>
                            <FormControlLabel control={<Checkbox size="small" checked={facts} onChange={(e) => setFacts(e.target.checked)} />} label={tr('Levar a ficha rápida, o resumo e a ficha da AON', 'Bring the quick facts, the summary and the AON sheet')} />
                            <FormControlLabel control={<Checkbox size="small" checked={aliases} onChange={(e) => setAliases(e.target.checked)} />} label={tr('Levar os apelidos', 'Bring the aliases')} />
                            <Typography variant="body2" color="text.secondary">
                                {tr('O que não for fica como está na Wiki. Na Wiki não há segredo por campo: os jogadores leem a ficha rápida e os apelidos.', 'What you leave out stays as it is on the wiki. The wiki has no per-field secrets: the players read the quick facts and aliases.')}</Typography>
                        </Stack>

                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2, mb: 2 }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{tr('Quem vê a página', 'Who sees the page')}</Typography>
                                <RadioGroup value={hidden ? 'gm' : 'public'} onChange={(e) => setHidden(e.target.value === 'gm')}>
                                    <FormControlLabel value="public" control={<Radio size="small" />} label={tr('Pública', 'Public')} />
                                    <FormControlLabel value="gm" control={<Radio size="small" />} label={tr('Oculta (só você)', 'Hidden (only you)')} />
                                </RadioGroup>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{tr('O que os jogadores leem', 'What the players read')}</Typography>
                                <RadioGroup value={share} onChange={(e) => setShare(e.target.value as WikiShare)}>
                                    <FormControlLabel value="all" control={<Radio size="small" />} label={tr('Todo o texto, menos "Só o mestre"', 'All the text, except "GM only"')} />
                                    <FormControlLabel value="players" control={<Radio size="small" />} label={tr('Só as caixas "Para os jogadores"', 'Only the "For the players" boxes')} />
                                </RadioGroup>
                            </Box>
                        </Box>

                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            {nothing
                                ? tr('A Wiki já está igual a esta ficha.', 'The wiki already matches this entry.')
                                : tr(`O que muda no texto: ${added} linha(s) entra(m), ${removed} sai(em)`, `What changes in the text: ${added} line(s) in, ${removed} out`)}</Typography>
                        {changes.length > 0 && (
                            <Box component="table" sx={{ width: 1, borderCollapse: 'collapse', mb: 1.5, fontSize: '0.875rem', '& td, & th': { borderBottom: `1px solid ${rule}`, p: 0.75, textAlign: 'left', verticalAlign: 'top', overflowWrap: 'anywhere' } }}>
                                <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{tr('Campos que mudam', 'Fields that change')}</caption>
                                <thead>
                                    <tr><th scope="col">{tr('Campo', 'Field')}</th><th scope="col">{tr('Na Wiki', 'On the wiki')}</th><th scope="col">{tr('Fica', 'Becomes')}</th></tr>
                                </thead>
                                <tbody>
                                    {changes.map((c) => (
                                        <tr key={c.key}>
                                            <th scope="row" style={{ fontWeight: 600 }}>{changeLabel(c.key, next.kind)}</th>
                                            <Box component="td" sx={{ color: status.error, textDecoration: c.before ? 'line-through' : 'none' }}>{shown(c, 'before', pages) || '—'}</Box>
                                            <Box component="td" sx={{ color: ink.primary }}>{shown(c, 'after', pages) || '—'}</Box>
                                        </tr>
                                    ))}
                                </tbody>
                            </Box>
                        )}
                        {removed + added > 0 && (
                            <Box
                                role="region"
                                aria-label={tr('Diferença do texto', 'Text difference')}
                                sx={{
                                    mt: 1, border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.paper, maxHeight: 360, overflow: 'auto',
                                    fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5,
                                }}
                            >
                                {rows.map((r, i) => (r.kind === 'skip'
                                    ? <Box key={i} sx={{ px: 1, py: 0.25, color: ink.secondary, fontStyle: 'italic', bgcolor: parchment.sunken }}>
                                        {tr(`… ${r.count} linha(s) igual(is)`, `… ${r.count} unchanged line(s)`)}</Box>
                                    : (
                                        <Box
                                            key={i}
                                            sx={{
                                                display: 'flex', gap: 1, px: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                                                bgcolor: r.kind === 'add' ? status.success + '1F' : r.kind === 'del' ? status.error + '1F' : 'transparent',
                                                color: r.kind === 'del' ? status.error : ink.primary,
                                                textDecoration: r.kind === 'del' ? 'line-through' : 'none',
                                            }}
                                        >
                                            <Box component="span" aria-hidden sx={{ flex: 'none', width: '1ch', color: r.kind === 'add' ? status.success : 'inherit' }}>
                                                {r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' '}</Box>
                                            <Box component="span" sx={{ minWidth: 0 }}>
                                                {r.kind !== 'same' && <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                                                    {r.kind === 'add' ? tr('Entra: ', 'Added: ') : tr('Sai: ', 'Removed: ')}</Box>}
                                                {r.text || ' '}</Box>
                                        </Box>
                                    )))}
                            </Box>
                        )}
                    </>
                )}
                {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{tr('Cancelar', 'Cancel')}</Button>
                <Button variant="contained" disabled={!page || busy || nothing} onClick={() => void save()} startIcon={busy ? <CircularProgress size={14} /> : undefined}>
                    {tr('Atualizar a Wiki', 'Update the wiki')}</Button>
            </DialogActions>
        </Dialog>
    )
}
