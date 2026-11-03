import { useEffect, useState } from 'react'
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton,
    ListItemText, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { Markdown } from '../../../components/markdown/Markdown'
import {
    fetchWikiHistory, fetchWikiRevision, restoreWikiRevision, type WikiPage, type WikiRevision, type WikiRevisionInfo,
} from '../../../services/wiki'
import { rule } from '../../../theme'
import { authorName, formatWhen } from '../useWiki'
import { tr } from '../../../i18n'

// O histórico de uma página: cada versão com quem a salvou e quando, a prévia e "Restaurar". Restaurar
// é uma versão NOVA (o histórico não perde nada), e o jogador restaura só o que ele via: os trechos do
// mestre de agora continuam onde estão.

interface Props {
    page: WikiPage
    canEdit: boolean
    onClose: () => void
    onRestored: () => void
}

export function HistoryDialog({ page, canEdit, onClose, onRestored }: Props) {
    const theme = useTheme()
    const full = useMediaQuery(theme.breakpoints.down('sm'))
    const [revisions, setRevisions] = useState<WikiRevisionInfo[] | null>(null)
    const [authors, setAuthors] = useState<Record<string, string>>({})
    const [picked, setPicked] = useState<number | null>(null)
    const [revision, setRevision] = useState<WikiRevision | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        void fetchWikiHistory(page.id).then((out) => {
            setRevisions(out?.revisions ?? [])
            setAuthors(out?.authors ?? {})
            if (out?.revisions[0]) setPicked(out.revisions[0].rev)
        })
    }, [page.id])

    useEffect(() => {
        if (picked === null) return
        let live = true
        setRevision(null)
        void fetchWikiRevision(page.id, picked).then((r) => { if (live) setRevision(r) })
        return () => { live = false }
    }, [page.id, picked])

    const restore = async () => {
        if (picked === null) return
        setBusy(true)
        setError(null)
        const out = await restoreWikiRevision(page.id, picked, page.updatedAt)
        setBusy(false)
        if (out.ok) { onRestored(); onClose(); return }
        setError(out.conflict ? tr('A página mudou enquanto o histórico estava aberto. Feche e abra de novo.', 'The page changed while the history was open. Close it and open it again.') : out.error)
    }

    const current = picked === page.rev
    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={full}>
            <DialogTitle>{tr('Histórico de ', 'History of ')}{page.title}</DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {!revisions
                    ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '220px minmax(0, 1fr)' }, minHeight: 320 }}>
                            <List dense sx={{ borderRight: { sm: `1px solid ${rule}` }, borderBottom: { xs: `1px solid ${rule}`, sm: 0 }, maxHeight: { xs: 200, sm: 'none' }, overflowY: 'auto' }}>
                                {revisions.map((r) => (
                                    <ListItemButton key={r.rev} selected={r.rev === picked} onClick={() => setPicked(r.rev)}>
                                        <ListItemText
                                            primary={`${tr('Versão', 'Version')} ${r.rev}${r.rev === page.rev ? tr(' (atual)', ' (current)') : ''}`}
                                            secondary={`${authorName(authors, r.by)} · ${formatWhen(r.at)}`}
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                            <Box sx={{ p: 2, minWidth: 0 }}>
                                {!revision
                                    ? <CircularProgress size={20} />
                                    : (
                                        <>
                                            <Typography variant="h6" sx={{ mb: 1 }}>{String(revision.meta.title ?? page.title)}</Typography>
                                            {revision.body.trim()
                                                ? <Markdown source={revision.body} dense />
                                                : <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Sem texto nesta versão.', 'No text in this version.')}</Typography>}
                                        </>
                                    )}
                            </Box>
                        </Box>
                    )}
                {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{tr('Fechar', 'Close')}</Button>
                {canEdit && (
                    <Button variant="contained" onClick={() => void restore()} disabled={busy || picked === null || current || !revision}>
                        {tr('Restaurar esta versão', 'Restore this version')}</Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
