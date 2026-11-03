import { useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputBase, Stack, TextField,
    Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { AutoStories as WikiIcon } from '@mui/icons-material'
import { Markdown } from '../../../components/markdown/Markdown'
import { blankPage, fetchWikiPage, saveWikiPage } from '../../../services/wiki'
import { locale, tr } from '../../../i18n'
import { parchment, rule } from '../../../theme'
import type { SessionDoc } from '../doc'

// "Publicar crônica na Wiki": o resumo da sessão vira uma página de evento da Wiki da Mesa — a
// história da campanha, em ordem, para todos. O resumo é do GM e pode ter segredo, então o diálogo
// mostra o texto que vai e deixa editar antes; nada sai sem confirmação. Publicar de novo atualiza
// a mesma página (o histórico da Wiki guarda a versão de antes).

const dayLabel = (day: string | null) => {
    if (!day) return ''
    const [y, m, d] = day.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
}

export function ChronicleButton({ session, onPublished }: { session: SessionDoc; onPublished: (id: string) => void }) {
    const [open, setOpen] = useState(false)
    const id = session.data.chronicle
    return (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Button variant="outlined" startIcon={<WikiIcon />} onClick={() => setOpen(true)} disabled={!session.data.recap.trim()}>
                {id ? tr('Atualizar a crônica na Wiki', 'Update the chronicle on the wiki') : tr('Publicar crônica na Wiki', 'Publish chronicle on the wiki')}</Button>
            {id && <Button component={RouterLink} to={`/wiki/${id}`}>{tr('Abrir na Wiki', 'Open on the wiki')}</Button>}
            {!session.data.recap.trim() && (
                <Typography variant="caption" color="text.secondary">{tr('Escreva o resumo para publicar a crônica.', 'Write the summary to publish the chronicle.')}</Typography>
            )}
            {open && <ChronicleDialog session={session} onClose={() => setOpen(false)} onPublished={onPublished} />}
        </Stack>
    )
}

function ChronicleDialog({ session, onClose, onPublished }: { session: SessionDoc; onClose: () => void; onPublished: (id: string) => void }) {
    const theme = useTheme()
    const full = useMediaQuery(theme.breakpoints.down('sm'))
    const [title, setTitle] = useState(session.title)
    const [body, setBody] = useState(session.data.recap)
    const ref = useRef<HTMLTextAreaElement | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState<string | null>(null)

    const publish = async () => {
        const name = title.trim().slice(0, 120)
        if (!name) { setError(tr('Dê um título à crônica', 'Give the chronicle a title')); return }
        setBusy(true)
        setError(null)
        const fields: Record<string, string> = { session: String(session.data.number) }
        const when = dayLabel(session.data.playedOn)
        if (when) fields.when = when
        let out
        let pageId = session.data.chronicle
        const existing = pageId ? await fetchWikiPage(pageId) : null
        if (existing === undefined) { setBusy(false); setError(tr('Sem conexão com a Wiki', 'No connection to the wiki')); return }
        if (existing) {
            out = await saveWikiPage({ ...existing.page, title: name, body, fields: { ...existing.page.fields, ...fields } }, existing.page.updatedAt)
        } else {
            const page = { ...blankPage('event', name, body), fields }
            pageId = page.id
            out = await saveWikiPage(page, null)
        }
        setBusy(false)
        if (!out.ok) {
            setError(out.conflict ? tr('A página da crônica mudou agora há pouco: tente de novo.', 'The chronicle page just changed: try again.') : out.error)
            return
        }
        onPublished(pageId!)
        setDone(pageId)
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={full}>
            <DialogTitle>{session.data.chronicle ? tr('Atualizar a crônica na Wiki', 'Update the chronicle on the wiki') : tr('Publicar crônica na Wiki', 'Publish chronicle on the wiki')}</DialogTitle>
            <DialogContent dividers>
                {done
                    ? (
                        <Alert severity="success" action={<Button component={RouterLink} to={`/wiki/${done}`} onClick={onClose}>{tr('Abrir', 'Open')}</Button>}>
                            {tr('Crônica publicada na Wiki da Mesa.', 'Chronicle published on the Table Wiki.')}</Alert>
                    )
                    : (
                        <Stack spacing={2}>
                            <Alert severity="warning">
                                {tr('Tudo o que está abaixo fica visível para a mesa. Tire os segredos, ou ponha-os entre :::mestre e ::: (só você vê).', 'Everything below becomes visible to the table. Remove secrets, or put them between :::gm and ::: (only you see them).')}</Alert>
                            <TextField size="small" label={tr('Título', 'Title')} value={title} onChange={(e) => setTitle(e.target.value.replace(/[\n\r\t]/g, ' ').slice(0, 120))} />
                            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                                <Box sx={{ border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.paper }}>
                                    <InputBase
                                        inputRef={ref}
                                        multiline
                                        minRows={12}
                                        fullWidth
                                        defaultValue={session.data.recap}
                                        onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
                                        inputProps={{ 'aria-label': tr('Texto da crônica', 'Chronicle text') }}
                                        sx={{ p: 1.5, alignItems: 'flex-start', fontFamily: 'monospace', fontSize: '0.9rem' }}
                                    />
                                </Box>
                                <Box sx={{ p: 1.5, border: `1px dashed ${rule}`, borderRadius: 1, minWidth: 0 }}>
                                    <Markdown source={body} dense />
                                </Box>
                            </Box>
                            {error && <Alert severity="error">{error}</Alert>}
                        </Stack>
                    )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{done ? tr('Fechar', 'Close') : tr('Cancelar', 'Cancel')}</Button>
                {!done && (
                    <Button variant="contained" onClick={() => void publish()} disabled={busy || !body.trim()} startIcon={busy ? <CircularProgress size={14} /> : undefined}>
                        {tr('Publicar', 'Publish')}</Button>
                )}
            </DialogActions>
        </Dialog>
    )
}
