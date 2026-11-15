import { useEffect, useMemo, useState } from 'react'
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup,
    Typography,
} from '@mui/material'
import { fetchWikiPage, saveWikiPage, setWikiFlags, type WikiPageView } from '../../../services/wiki'
import { splitSegments } from '../../../components/markdown/blocks'
import { ink, parchment, rule, status } from '../../../theme'
import { lineDiff, updatedPage, type DiffLine, type WikiShare } from '../toWiki'
import type { CatalogDoc } from '../doc'
import { locale, tr } from '../../../i18n'

// "Atualizar a Wiki com esta ficha": o texto da página ligada passa a ser o da ficha (`updatedPage`).
// Substitui o que houver lá, inclusive o que outra pessoa escreveu — por isso o GM vê antes a diferença
// e quem mexeu por último. Grava com o `updatedAt` lido: se alguém salvar no meio, é conflito, não perda.

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

interface Props {
    doc: CatalogDoc
    pageId: string
    onClose: () => void
    onDone: () => void
}

export function WikiUpdateDialog({ doc, pageId, onClose, onDone }: Props) {
    const [view, setView] = useState<WikiPageView | null | undefined | 'loading'>('loading')
    const hasPlayers = splitSegments(doc.data.md).some((x) => x.kind === 'players')
    const [share, setShare] = useState<WikiShare>(hasPlayers ? 'players' : 'all')
    const [hidden, setHidden] = useState<boolean | null>(null)
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
        () => (page ? updatedPage(page, doc.data.md, doc.data.image, doc.data.tags, share, tr(':::mestre', ':::gm')) : null),
        [page, doc.data.md, doc.data.image, doc.data.tags, share],
    )
    const diff = useMemo(() => (page && next ? lineDiff(page.body, next.body) : []), [page, next])
    const rows = useMemo(() => collapse(diff), [diff])
    const removed = diff.filter((d) => d.kind === 'del').length
    const added = diff.filter((d) => d.kind === 'add').length
    const imageChanged = !!page && !!next && next.image !== page.image
    const tagsChanged = !!page && !!next && next.tags.length !== page.tags.length
    const visibilityChanged = !!page && hidden !== null && hidden !== (page.visibility === 'gm')
    const nothing = removed + added === 0 && !imageChanged && !tagsChanged && !visibilityChanged

    const save = async () => {
        if (!page || !next) return
        setBusy(true)
        setError(null)
        if (removed + added > 0 || imageChanged || tagsChanged) {
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
                            {tr('O texto da página passa a ser o desta ficha. O que estiver só na Wiki (em vermelho abaixo) sai — ',
                                'The page text becomes this entry\'s. Whatever is only on the wiki (in red below) goes away — ')}
                            {tr('a versão de antes fica no histórico da página, de onde dá para restaurar (menos uma edição sua feita na Wiki nos últimos 10 minutos: essa é substituída).',
                                'the previous version stays in the page history, where it can be restored (except an edit of yours made on the wiki in the last 10 minutes: that one is replaced).')}
                            {' '}
                            {tr('Última edição na Wiki: ', 'Last edit on the wiki: ')}
                            <strong>{lastBy ?? tr('alguém', 'someone')}</strong>
                            {page.updatedAt ? `, ${new Date(page.updatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}` : ''}.
                        </Alert>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {tr('Título, apelidos e ficha rápida da página ficam como estão na Wiki.', 'The page\'s title, aliases and infobox stay as they are on the wiki.')}</Typography>

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
                        {imageChanged && <Typography variant="body2" sx={{ mb: 0.5 }}>{tr('A imagem da página é trocada pela da ficha.', 'The page image is replaced by the entry\'s.')}</Typography>}
                        {tagsChanged && <Typography variant="body2" sx={{ mb: 0.5 }}>{tr('As etiquetas da ficha são somadas às da página.', 'The entry\'s tags are added to the page\'s.')}</Typography>}
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
