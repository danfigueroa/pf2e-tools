import { memo, useRef, useState } from 'react'
import {
    Alert, Autocomplete, Box, Button, Chip, CircularProgress, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { AddPhotoAlternate as PhotoIcon, Campaign as ShareIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { imageErrorText, shrinkImage, uploadImage, useImageUrl } from '../../../services/images'
import { displayFont, green, parchment, rule } from '../../../theme'
import {
    CATALOG_KINDS, KIND_LABEL, type CatalogDoc, type CatalogKind, type JournalSummary, type ThreadDoc, type ThreadStatus,
} from '../doc'
import { TEMPLATES } from '../templates'
import { useJournalTools } from '../tools'
import { MarkdownEditor } from './MarkdownEditor'
import { THREAD_COLOR, THREAD_STATUS_LABEL } from '../threadStyle'

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
            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: green.main, mb: 0.75 }}>Aparece nas sessões</Typography>
            {sessions.length === 0
                ? <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Em nenhuma ainda (ponha no Elenco da sessão).</Typography>
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
                            : <Typography variant="body2" color="text.secondary">Sem imagem</Typography>}
                    </Box>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        <Button size="small" startIcon={uploading ? <CircularProgress size={14} /> : <PhotoIcon />} disabled={uploading} onClick={() => file.current?.click()}>
                            {doc.data.image ? 'Trocar' : 'Enviar imagem'}
                        </Button>
                        {doc.data.image && (
                            <>
                                <Button size="small" startIcon={<ShareIcon />} onClick={() => tools.shareImage(doc.data.image!, doc.title)}>Mostrar</Button>
                                <Button size="small" color="inherit" aria-label="Tirar a imagem" onClick={() => setData({ image: null })}><DeleteIcon fontSize="small" /></Button>
                            </>
                        )}
                    </Stack>
                    <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
                </Box>
                <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                    <TextField
                        select
                        size="small"
                        label="Tipo"
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
                        renderInput={(params) => <TextField {...params} label="Etiquetas" placeholder="aliado, cidade, mágico… (Enter)" />}
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
                aria-label={`Texto de ${doc.title}`}
            />
            <Appearances id={doc.id} docs={docs} onOpen={onOpen} />
        </Box>
    )
})

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
                {sessionSelect('Aparece em', doc.data.introducedIn, (v) => setData({ introducedIn: v }))}
                {sessionSelect('Resolvido em', doc.data.resolvedIn, (v) => setData({ resolvedIn: v }))}
            </Stack>
            <MarkdownEditor
                key={`md-${version}`}
                value={doc.data.md}
                onChange={(md) => setData({ md })}
                imageName={doc.title}
                template={TEMPLATES.thread}
                minRows={10}
                aria-label={`Texto do gancho ${doc.title}`}
            />
            <Appearances id={doc.id} docs={docs} onOpen={onOpen} />
        </Box>
    )
})
