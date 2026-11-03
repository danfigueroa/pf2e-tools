import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, Stack, TextField, Typography,
} from '@mui/material'
import { AddPhotoAlternate as PhotoIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor'
import { JournalToolsContext, type JournalTools } from '../../../components/markdown/tools'
import { foldName } from '../../../components/markdown/blocks'
import { imageErrorText, shrinkImage, uploadImage, useImageUrl } from '../../../services/images'
import { saveWikiPage, WIKI_KINDS, type WikiKind, type WikiPage, type WikiSummary } from '../../../services/wiki'
import { AonCreatureSearch } from '../../initiative-tracker/components/AonCreatureSearch'
import { parchment, rule, ink } from '../../../theme'
import { INFOBOX, KIND_LABEL, PARENT_LABEL, templateFor, type FieldDef } from '../kinds'
import { findPage, readDraft, useNameIndex, writeDraft } from '../useWiki'
import { tr } from '../../../i18n'

// Editar (ou criar) uma página da Wiki. Nada vai ao servidor até "Salvar": cada salvamento é uma
// versão do histórico. O que se digita fica num rascunho do aparelho, e quem volta a editar a mesma
// página na mesma versão o recupera.
//
// O jogador nunca recebe os trechos `:::mestre` e edita sem eles; o servidor os põe de volta ao salvar.

/** Capa: retrato, mapa, ilustração do item. */
const COVER_MAX_SIDE = 1600
const DRAFT_DELAY_MS = 500
const NO_OPTIONS: string[] = []

interface Props {
    /** A página como está (nova: `base` null). */
    initial: WikiPage
    base: number | null
    pages: WikiSummary[]
    isGm: boolean
    onSaved: (page: WikiPage) => void
    onCancel: () => void
    /** Alguém gravou outra versão desde que esta edição começou. */
    changedMeanwhile?: boolean
}

/** As páginas que não podem ser a "mãe" desta: ela e as que já estão dentro dela (viraria um ciclo). */
function descendantsOf(id: string, pages: WikiSummary[]): Set<string> {
    const out = new Set([id])
    let grew = true
    while (grew) {
        grew = false
        for (const p of pages) if (p.parent && out.has(p.parent) && !out.has(p.id)) { out.add(p.id); grew = true }
    }
    return out
}

export function WikiEditor({ initial, base: initialBase, pages, isGm, onSaved, onCancel, changedMeanwhile }: Props) {
    const fromDraft = useMemo(() => {
        const d = readDraft(initial.id)
        return d && d.base === initialBase ? d : null
    }, [initial.id, initialBase])
    const [page, setPage] = useState<WikiPage>(() => fromDraft?.page ?? initial)
    const [restored, setRestored] = useState(!!fromDraft)
    const [base, setBase] = useState(initialBase)
    const [version, setVersion] = useState(0)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [conflict, setConflict] = useState<WikiPage | null>(null)
    const [uploading, setUploading] = useState(false)
    const [picker, setPicker] = useState<{ selection: string; resolve: (v: string | null) => void } | null>(null)
    const file = useRef<HTMLInputElement | null>(null)
    const cover = useImageUrl(page.image)
    const names = useNameIndex(pages)

    // O rascunho do aparelho, a cada pausa na digitação.
    useEffect(() => {
        if (page === initial) return
        const timer = setTimeout(() => writeDraft(page.id, { page, base, at: Date.now() }), DRAFT_DELAY_MS)
        return () => clearTimeout(timer)
    }, [page, base, initial])

    const set = useCallback((patch: Partial<WikiPage>) => setPage((p) => ({ ...p, ...patch })), [])
    const setField = (key: string, value: string) => setPage((p) => {
        const fields = { ...p.fields }
        if (value.trim()) fields[key] = value
        else delete fields[key]
        return { ...p, fields }
    })

    const titles = useMemo(() => pages.filter((p) => p.id !== page.id).map((p) => p.title).sort((a, b) => a.localeCompare(b)), [pages, page.id])
    const tagOptions = useMemo(() => [...new Set(pages.flatMap((p) => p.tags))].sort(), [pages])
    const blocked = useMemo(() => descendantsOf(page.id, pages), [page.id, pages])
    const parentOptions = useMemo(() => pages.filter((p) => !blocked.has(p.id)).sort((a, b) => a.title.localeCompare(b.title)), [pages, blocked])
    const parent = parentOptions.find((p) => p.id === page.parent) ?? null

    const tools = useMemo<JournalTools>(() => ({
        shareBlock: () => {},
        shareImage: () => {},
        // Na prévia da edição, tocar num link não sai da página (o texto ainda não foi salvo).
        openWiki: () => {},
        knownNames: new Set(),
        resolveLink: (target) => (findPage(names, target) ? 'known' : 'missing'),
        pickLink: (selection) => new Promise((resolve) => setPicker({ selection, resolve })),
    }), [names])

    const onFile = async (f: File | undefined) => {
        if (!f) return
        setUploading(true)
        setError(null)
        try {
            const { blob } = await shrinkImage(f, COVER_MAX_SIDE)
            set({ image: await uploadImage(blob, 'wiki', page.title || 'capa') })
        } catch (err) {
            setError(imageErrorText(err))
        } finally {
            setUploading(false)
            if (file.current) file.current.value = ''
        }
    }

    const save = async (over: number | null = base) => {
        const title = page.title.trim()
        if (!title) { setError(tr('Dê um título à página', 'Give the page a title')); return }
        setSaving(true)
        setError(null)
        const toSave = { ...page, title }
        const out = await saveWikiPage(toSave, over)
        setSaving(false)
        if (out.ok) {
            writeDraft(page.id, null)
            onSaved({ ...toSave, updatedAt: out.updatedAt, rev: out.rev })
            return
        }
        if (out.conflict) { setConflict(out.current); return }
        setError(out.error)
    }

    const discardDraft = () => {
        writeDraft(page.id, null)
        setPage(initial)
        setRestored(false)
        setVersion((v) => v + 1)
    }

    const cancel = () => {
        writeDraft(page.id, null)
        onCancel()
    }

    const defs = INFOBOX[page.kind]

    return (
        <JournalToolsContext.Provider value={tools}>
            <Box sx={{ minWidth: 0 }}>
                {restored && (
                    <Alert severity="info" sx={{ mb: 2 }} action={<Button size="small" onClick={discardDraft}>{tr('Descartar', 'Discard')}</Button>}>
                        {tr('Rascunho recuperado deste aparelho (ainda não salvo).', 'Draft recovered from this device (not saved yet).')}</Alert>
                )}
                {changedMeanwhile && !conflict && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {tr('Alguém salvou esta página enquanto você editava. Ao salvar, você escolhe qual versão fica.', 'Someone saved this page while you were editing. When you save, you choose which version stays.')}</Alert>
                )}
                {conflict !== null && (
                    <Alert
                        severity="warning"
                        sx={{ mb: 2 }}
                        action={(
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                <Button size="small" onClick={() => { writeDraft(page.id, null); onCancel() }}>{tr('Ver a versão nova', 'See the new version')}</Button>
                                <Button size="small" variant="contained" onClick={() => {
                                    const next = conflict?.updatedAt ?? base
                                    setBase(next)
                                    setConflict(null)
                                    void save(next)
                                }}>{tr('Salvar a minha por cima', 'Save mine over it')}</Button>
                            </Stack>
                        )}
                    >
                        {tr('Outra pessoa salvou esta página depois que você começou a editar.', 'Someone else saved this page after you started editing.')}</Alert>
                )}

                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '200px minmax(0, 1fr)' }, alignItems: 'start', mb: 2 }}>
                    <Box>
                        <Box sx={{
                            aspectRatio: '1', borderRadius: 1, border: `1px dashed ${rule}`, bgcolor: parchment.page, overflow: 'hidden',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: { xs: 200, sm: 'none' },
                        }}>
                            {cover
                                ? <Box component="img" src={cover} alt={page.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <Typography variant="body2" color="text.secondary">{tr('Sem imagem', 'No image')}</Typography>}
                        </Box>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                            <Button size="small" startIcon={uploading ? <CircularProgress size={14} /> : <PhotoIcon />} disabled={uploading} onClick={() => file.current?.click()}>
                                {page.image ? tr('Trocar', 'Change') : tr('Enviar imagem', 'Upload image')}</Button>
                            {page.image && <Button size="small" color="inherit" aria-label={tr('Tirar a imagem', 'Remove the image')} onClick={() => set({ image: null })}><DeleteIcon fontSize="small" /></Button>}
                        </Stack>
                        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
                    </Box>

                    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
                        <TextField
                            size="small"
                            label={tr('Título', 'Title')}
                            value={page.title}
                            onChange={(e) => set({ title: e.target.value.replace(/[\n\r\t]/g, ' ').slice(0, 120) })}
                            required
                            autoFocus={!initial.title}
                        />
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                            <TextField
                                select
                                size="small"
                                label={tr('Tipo', 'Kind')}
                                value={page.kind}
                                onChange={(e) => set({ kind: e.target.value as WikiKind })}
                                slotProps={{ select: { native: true } }}
                            >
                                {WIKI_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k].one}</option>)}
                            </TextField>
                            <Autocomplete
                                size="small"
                                options={parentOptions}
                                value={parent}
                                getOptionLabel={(p) => p.title}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                onChange={(_, v) => set({ parent: v?.id ?? null })}
                                renderInput={(params) => <TextField {...params} label={PARENT_LABEL[page.kind]} placeholder={tr('nenhuma', 'none')} />}
                            />
                        </Box>
                        <TextField
                            size="small"
                            label={tr('Resumo (uma linha)', 'Summary (one line)')}
                            value={page.summary}
                            onChange={(e) => set({ summary: e.target.value.replace(/[\n\r\t]/g, ' ').slice(0, 300) })}
                        />
                        <Autocomplete
                            multiple
                            freeSolo
                            size="small"
                            options={NO_OPTIONS}
                            value={page.aliases}
                            onChange={(_, v) => set({ aliases: [...new Set(v.map((t) => t.trim().slice(0, 120)).filter(Boolean))].slice(0, 10) })}
                            renderInput={(params) => <TextField {...params} label={tr('Também chamado', 'Also known as')} placeholder={tr('apelidos, outros nomes… (Enter)', 'nicknames, other names… (Enter)')} />}
                        />
                        <Autocomplete
                            multiple
                            freeSolo
                            size="small"
                            options={tagOptions}
                            value={page.tags}
                            onChange={(_, v) => set({ tags: [...new Set(v.map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 12) })}
                            renderInput={(params) => <TextField {...params} label={tr('Etiquetas', 'Tags')} placeholder={tr('aliado, cidade, mágico… (Enter)', 'ally, city, magic… (Enter)')} />}
                        />
                        {isGm && initialBase === null && (
                            <FormControlLabel
                                control={<Checkbox checked={page.visibility === 'gm'} onChange={(e) => set({ visibility: e.target.checked ? 'gm' : 'public' })} />}
                                label={tr('Só o mestre vê (até revelar à mesa)', 'GM only (until revealed to the table)')}
                            />
                        )}
                    </Stack>
                </Box>

                {(defs.length > 0 || page.kind === 'creature') && (
                    <Box sx={{ mb: 2, p: 1.5, border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.page }}>
                        <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {tr('Ficha rápida', 'Quick facts')}</Typography>
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', mt: 1 }}>
                            {defs.map((f) => (
                                <FieldInput key={f.key} def={f} value={page.fields[f.key] ?? ''} titles={titles} onChange={(v) => setField(f.key, v)} />
                            ))}
                        </Box>
                        {page.kind === 'creature' && <AonPicker page={page} onChange={(aon) => set({ aon })} />}
                    </Box>
                )}

                <MarkdownEditor
                    key={`wiki-md-${version}`}
                    value={page.body}
                    onChange={(body) => set({ body })}
                    imageName={page.title || 'wiki'}
                    imageFolder="wiki"
                    playersBlock={false}
                    gmBlock={isGm}
                    linkTitle={tr('Link para outra página: [[Nome]]', 'Link to another page: [[Name]]')}
                    template={templateFor(page.kind)}
                    preferView={false}
                    minRows={14}
                    aria-label={tr(`Texto de ${page.title}`, `Text of ${page.title}`)}
                />
                {!isGm && (
                    <Typography variant="caption" component="p" sx={{ color: ink.secondary, mt: 0.75 }}>
                        {tr('Escreva [[Nome]] para ligar outra página da Wiki. Tudo o que você salva fica no histórico com o seu nome.', 'Write [[Name]] to link another wiki page. Everything you save stays in the history under your name.')}</Typography>
                )}
                {isGm && (
                    <Typography variant="caption" component="p" sx={{ color: ink.secondary, mt: 0.75 }}>
                        {tr('Trechos entre :::mestre e ::: os jogadores nunca recebem — nem no histórico, nem na busca.', 'Text between :::gm and ::: never reaches the players — not in the history, not in search.')}</Typography>
                )}

                {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}

                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2, position: 'sticky', bottom: { xs: 'calc(var(--tabbar-h, 0px) + 8px)', md: 8 }, zIndex: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, p: 1, borderRadius: 1, bgcolor: parchment.paper, border: `1px solid ${rule}` }}>
                        <Button onClick={cancel} disabled={saving}>{tr('Cancelar', 'Cancel')}</Button>
                        <Button variant="contained" onClick={() => void save()} disabled={saving || uploading} startIcon={saving ? <CircularProgress size={14} /> : undefined}>
                            {initialBase === null ? tr('Criar página', 'Create page') : tr('Salvar', 'Save')}</Button>
                    </Box>
                </Stack>
            </Box>

            {picker && (
                <LinkPicker
                    titles={titles}
                    selection={picker.selection}
                    onClose={(v) => { picker.resolve(v); setPicker(null) }}
                />
            )}
        </JournalToolsContext.Provider>
    )
}

function FieldInput({ def, value, titles, onChange }: { def: FieldDef; value: string; titles: string[]; onChange: (v: string) => void }) {
    if (def.options) {
        return (
            <TextField
                select
                size="small"
                label={def.label}
                value={def.options.includes(value) || !value ? value : ''}
                onChange={(e) => onChange(e.target.value)}
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            >
                <option value="">—</option>
                {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </TextField>
        )
    }
    if (def.link) {
        const linkOptions = titles.map((t) => `[[${t}]]`)
        return (
            <Autocomplete
                freeSolo
                size="small"
                options={linkOptions}
                value={value}
                onChange={(_, v) => onChange((v ?? '').slice(0, 300))}
                onInputChange={(_, v, reason) => { if (reason === 'input') onChange(v.slice(0, 300)) }}
                filterOptions={(opts, { inputValue }) => {
                    const q = foldName(inputValue.replace(/[[\]]/g, ''))
                    return q ? opts.filter((o) => foldName(o).includes(q)).slice(0, 20) : opts.slice(0, 20)
                }}
                renderInput={(params) => <TextField {...params} label={def.label} placeholder={tr('[[Página]] ou texto', '[[Page]] or text')} />}
            />
        )
    }
    return (
        <TextField
            size="small"
            label={def.label}
            value={value}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value.replace(/[\n\r\t]/g, ' ').slice(0, 300))}
        />
    )
}

/** A página de criatura ligada à ficha da AON: buscar, trocar, tirar. */
function AonPicker({ page, onChange }: { page: WikiPage; onChange: (aon: WikiPage['aon']) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <Box sx={{ mt: 1.5 }}>
            {page.aon
                ? (
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip label={`${page.aon.name}${page.aon.level !== null ? tr(` · nível ${page.aon.level}`, ` · level ${page.aon.level}`) : ''}`} onDelete={() => onChange(null)} />
                        <Button size="small" onClick={() => setOpen(true)}>{tr('Trocar criatura da AON', 'Change AON creature')}</Button>
                    </Stack>
                )
                : <Button size="small" onClick={() => setOpen(true)}>{tr('Ligar à ficha da AON', 'Link to the AON sheet')}</Button>}
            {open && (
                <Dialog open onClose={() => setOpen(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{tr('Criatura da AON', 'AON creature')}</DialogTitle>
                    <DialogContent>
                        <AonCreatureSearch onPick={(c) => {
                            onChange({ name: c.name, level: c.level, url: c.url || null, traits: c.traits.slice(0, 16) })
                            setOpen(false)
                        }} />
                    </DialogContent>
                    <DialogActions><Button onClick={() => setOpen(false)}>{tr('Fechar', 'Close')}</Button></DialogActions>
                </Dialog>
            )}
        </Box>
    )
}

/** "Inserir link": as páginas que existem (ou um nome novo, que vira link vermelho). */
function LinkPicker({ titles, selection, onClose }: { titles: string[]; selection: string; onClose: (v: string | null) => void }) {
    const [value, setValue] = useState(selection.trim())
    const done = () => {
        const name = value.replace(/[[\]|\n]/g, '').trim().slice(0, 120)
        if (!name) { onClose(null); return }
        const label = selection.trim()
        onClose(label && label !== name ? `[[${name}|${label.replace(/[[\]|\n]/g, '')}]]` : `[[${name}]]`)
    }
    return (
        <Dialog open onClose={() => onClose(null)} fullWidth maxWidth="xs">
            <DialogTitle>{tr('Link para outra página', 'Link to another page')}</DialogTitle>
            <DialogContent>
                <Autocomplete
                    freeSolo
                    options={titles}
                    inputValue={value}
                    onInputChange={(_, v) => setValue(v)}
                    filterOptions={(opts, { inputValue }) => {
                        const q = foldName(inputValue)
                        return (q ? opts.filter((o) => foldName(o).includes(q)) : opts).slice(0, 30)
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            autoFocus
                            label={tr('Página', 'Page')}
                            helperText={tr('Um nome que ainda não existe vira um link para criar a página.', 'A name that doesn\'t exist yet becomes a link to create the page.')}
                            sx={{ mt: 1 }}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.defaultPrevented) { e.preventDefault(); done() } }}
                        />
                    )}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(null)}>{tr('Cancelar', 'Cancel')}</Button>
                <Button variant="contained" onClick={done}>{tr('Inserir', 'Insert')}</Button>
            </DialogActions>
        </Dialog>
    )
}
