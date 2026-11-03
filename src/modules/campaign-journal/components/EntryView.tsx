import { memo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack,
    TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { AddPhotoAlternate as PhotoIcon, AutoStories as WikiIcon, Campaign as ShareIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { Markdown } from '../../../components/markdown/Markdown'
import { playersText } from '../../../components/markdown/blocks'
import { blankPage, saveWikiPage, useWikiIndex, type WikiSummary } from '../../../services/wiki'
import { imageErrorText, shrinkImage, uploadImage, useImageUrl } from '../../../services/images'
import { displayFont, parchment, rule, greenInk } from '../../../theme'
import {
    CATALOG_KINDS, KIND_LABEL, type CatalogDoc, type CatalogKind, type JournalSummary, type ThreadDoc, type ThreadStatus,
} from '../doc'
import { TEMPLATES } from '../templates'
import { useJournalTools } from '../../../components/markdown/tools'
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor'
import { THREAD_COLOR, THREAD_STATUS_LABEL } from '../threadStyle'
import { tr } from '../../../i18n'

// A ficha de um NPC, local, item, facção ou outro (o catálogo da campanha,
// reaproveitado entre sessões) e a de um gancho.

/** Retrato, mapa de região, item: grande o bastante para o cartão em tela cheia. */
const PORTRAIT_MAX_SIDE = 1600

const sessionLabel = (s: JournalSummary) => s.title
const NO_OPTIONS: string[] = []

/** As sessões em que esta ficha aparece (pelos `links` do resumo da lista). */
function Appearances({ id, docs, onOpen }: { id: string; docs: JournalSummary[]; onOpen: (id: string) => void }) {
    const sessions = docs.filter((d) => d.kind === 'session' && d.links.includes(id)).sort((a, b) => a.sort - b.sort)
    return (
        <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: greenInk.main, mb: 0.75 }}>{tr('Aparece nas sessões', 'Shows up in the sessions')}</Typography>
            {sessions.length === 0
                ? <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Em nenhuma ainda (ponha no Elenco da sessão).', 'In none yet (put it in a session\'s Cast).')}</Typography>
                : (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {sessions.map((s) => <Chip key={s.id} label={sessionLabel(s)} onClick={() => onOpen(s.id)} />)}
                    </Stack>
                )}
        </Box>
    )
}

interface CatalogProps {
    doc: CatalogDoc
    version: number
    update: (fn: (d: CatalogDoc) => CatalogDoc) => void
    docs: JournalSummary[]
    onOpen: (id: string) => void
}

export const CatalogView = memo(function CatalogView({ doc, version, update, docs, onOpen }: CatalogProps) {
    const tools = useJournalTools()
    const file = useRef<HTMLInputElement | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const image = useImageUrl(doc.data.image)

    const setData = (patch: Partial<CatalogDoc['data']>) => update((d) => ({ ...d, data: { ...d.data, ...patch } }))

    const onFile = async (f: File | undefined) => {
        if (!f) return
        setUploading(true)
        setError(null)
        try {
            const { blob } = await shrinkImage(f, PORTRAIT_MAX_SIDE)
            setData({ image: await uploadImage(blob, 'journal', doc.title) })
        } catch (err) {
            setError(imageErrorText(err))
        } finally {
            setUploading(false)
            if (file.current) file.current.value = ''
        }
    }

    return (
        <Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '220px minmax(0, 1fr)' }, alignItems: 'start', mb: 2 }}>
                <Box>
                    <Box sx={{
                        aspectRatio: '1', borderRadius: 1, border: `1px dashed ${rule}`, bgcolor: parchment.page, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: { xs: 220, sm: 'none' },
                    }}>
                        {image
                            ? <Box component="img" src={image} alt={doc.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <Typography variant="body2" color="text.secondary">{tr('Sem imagem', 'No image')}</Typography>}
                    </Box>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        <Button size="small" startIcon={uploading ? <CircularProgress size={14} /> : <PhotoIcon />} disabled={uploading} onClick={() => file.current?.click()}>
                            {doc.data.image ? tr('Trocar', 'Change') : tr('Enviar imagem', 'Upload image')}
                        </Button>
                        {doc.data.image && (
                            <>
                                <Button size="small" startIcon={<ShareIcon />} onClick={() => tools.shareImage(doc.data.image!, doc.title)}>{tr('Mostrar', 'Show')}</Button>
                                <Button size="small" color="inherit" aria-label={tr("Tirar a imagem", 'Remove the image')} onClick={() => setData({ image: null })}><DeleteIcon fontSize="small" /></Button>
                            </>
                        )}
                    </Stack>
                    <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
                </Box>
                <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                    <TextField
                        select
                        size="small"
                        label={tr("Tipo", 'Kind')}
                        value={doc.kind}
                        onChange={(e) => update((d) => ({ ...d, kind: e.target.value as CatalogKind }))}
                        slotProps={{ select: { native: true } }}
                        sx={{ maxWidth: 200 }}
                    >
                        {CATALOG_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k].one}</option>)}
                    </TextField>
                    <Autocomplete
                        multiple
                        freeSolo
                        size="small"
                        options={NO_OPTIONS}
                        value={doc.data.tags}
                        onChange={(_, v) => setData({ tags: [...new Set(v.map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 12) })}
                        renderInput={(params) => <TextField {...params} label={tr("Etiquetas", 'Tags')} placeholder={tr("aliado, cidade, mágico… (Enter)", 'ally, city, magic… (Enter)')} />}
                    />
                    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
                </Stack>
            </Box>
            <MarkdownEditor
                key={`md-${version}`}
                value={doc.data.md}
                onChange={(md) => setData({ md })}
                imageName={doc.title}
                template={TEMPLATES[doc.kind]}
                minRows={14}
                aria-label={tr(`Texto de ${doc.title}`, `Text of ${doc.title}`)}
            />
            <WikiLink doc={doc} onLink={(wiki) => setData({ wiki })} />
            <Appearances id={doc.id} docs={docs} onOpen={onOpen} />
        </Box>
    )
})

/**
 * A ficha do catálogo (secreta) e a página da Wiki da Mesa (o que a mesa conhece) ligadas: abrir a
 * página, ligar a uma que já existe, ou criar uma a partir desta — que leva título, imagem, etiquetas
 * e SÓ os trechos `:::jogadores`, depois de o GM ver o que vai.
 */
function WikiLink({ doc, onLink }: { doc: CatalogDoc; onLink: (id: string | null) => void }) {
    const navigate = useNavigate()
    const pages = useWikiIndex().list?.pages ?? null
    const [confirm, setConfirm] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const linked = doc.data.wiki ? pages?.find((p) => p.id === doc.data.wiki) ?? null : null
    const text = playersText(doc.data.md)

    const create = async () => {
        setBusy(true)
        setError(null)
        const page = { ...blankPage(doc.kind, doc.title, text), image: doc.data.image, tags: doc.data.tags }
        const out = await saveWikiPage(page, null)
        setBusy(false)
        if (!out.ok) { setError(out.conflict ? tr('Tente de novo', 'Try again') : out.error); return }
        setConfirm(false)
        onLink(page.id)
    }

    return (
        <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: greenInk.main, mb: 0.75 }}>{tr('Na Wiki da Mesa', 'On the Table Wiki')}</Typography>
            {doc.data.wiki
                ? (
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        {linked
                            ? <Chip icon={<WikiIcon />} label={linked.title} onClick={() => navigate(`/wiki/${linked.id}`)} />
                            : <Typography variant="body2" color="text.secondary">{pages ? tr('A página ligada foi apagada.', 'The linked page was deleted.') : tr('Carregando…', 'Loading…')}</Typography>}
                        <Button size="small" color="inherit" onClick={() => onLink(null)}>{tr('Desligar', 'Unlink')}</Button>
                    </Stack>
                )
                : (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                        <Autocomplete<WikiSummary>
                            size="small"
                            options={pages ?? []}
                            getOptionLabel={(p) => p.title}
                            value={null}
                            onChange={(_, v) => { if (v) onLink(v.id) }}
                            renderInput={(params) => <TextField {...params} placeholder={tr('Ligar a uma página da Wiki…', 'Link to a wiki page…')} />}
                            sx={{ flex: 1, minWidth: 0 }}
                            blurOnSelect
                        />
                        <Button size="small" startIcon={<WikiIcon />} onClick={() => setConfirm(true)}>{tr('Criar na Wiki a partir desta', 'Create on the wiki from this')}</Button>
                    </Stack>
                )}
            {confirm && (
                <Dialog open onClose={() => setConfirm(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{tr('Criar "', 'Create "')}{doc.title}{tr('" na Wiki', '" on the wiki')}</DialogTitle>
                    <DialogContent dividers>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                            {tr('A página nasce pública, com o título, a imagem, as etiquetas e só os trechos :::jogadores desta ficha. O resto continua secreto no Diário.', 'The page starts public, with this entry\'s title, image, tags and only its :::players blocks. The rest stays secret in the Journal.')}</Typography>
                        <Box sx={{ p: 1.5, border: `1px dashed ${rule}`, borderRadius: 1, bgcolor: parchment.paper }}>
                            {text
                                ? <Markdown source={text} dense />
                                : <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Nenhum trecho :::jogadores: a página nasce sem texto.', 'No :::players block: the page starts with no text.')}</Typography>}
                        </Box>
                        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirm(false)}>{tr('Cancelar', 'Cancel')}</Button>
                        <Button variant="contained" disabled={busy} onClick={() => void create()}>{tr('Criar', 'Create')}</Button>
                    </DialogActions>
                </Dialog>
            )}
        </Box>
    )
}

interface ThreadProps {
    doc: ThreadDoc
    version: number
    update: (fn: (d: ThreadDoc) => ThreadDoc) => void
    docs: JournalSummary[]
    onOpen: (id: string) => void
}

export const ThreadView = memo(function ThreadView({ doc, version, update, docs, onOpen }: ThreadProps) {
    const sessions = docs.filter((d) => d.kind === 'session').sort((a, b) => a.sort - b.sort)
    const setData = (patch: Partial<ThreadDoc['data']>) => update((d) => ({ ...d, data: { ...d.data, ...patch } }))
    const sessionSelect = (label: string, value: string | null, onChange: (v: string | null) => void) => (
        <TextField
            select
            size="small"
            label={label}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            sx={{ minWidth: 200, flex: '1 1 200px' }}
        >
            <option value="">—</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </TextField>
    )

    return (
        <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={doc.data.status}
                    onChange={(_, v: ThreadStatus | null) => { if (v) setData({ status: v }) }}
                    sx={{ '& .MuiToggleButton-root': { textTransform: 'none', gap: 0.75 } }}
                >
                    {(Object.keys(THREAD_STATUS_LABEL) as ThreadStatus[]).map((s) => (
                        <ToggleButton key={s} value={s}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: THREAD_COLOR[s] }} />
                            {THREAD_STATUS_LABEL[s]}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
                {sessionSelect(tr('Aparece em', 'Appears in'), doc.data.introducedIn, (v) => setData({ introducedIn: v }))}
                {sessionSelect(tr('Resolvido em', 'Resolved in'), doc.data.resolvedIn, (v) => setData({ resolvedIn: v }))}
            </Stack>
            <MarkdownEditor
                key={`md-${version}`}
                value={doc.data.md}
                onChange={(md) => setData({ md })}
                imageName={doc.title}
                template={TEMPLATES.thread}
                minRows={10}
                aria-label={tr(`Texto do gancho ${doc.title}`, `Text of the hook ${doc.title}`)}
            />
            <Appearances id={doc.id} docs={docs} onOpen={onOpen} />
        </Box>
    )
})
