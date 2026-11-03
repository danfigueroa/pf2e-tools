import { memo, useDeferredValue, useRef, useState, type ReactNode } from 'react'
import {
    Alert, Box, CircularProgress, IconButton, InputBase, ToggleButton, ToggleButtonGroup, Tooltip,
    useMediaQuery, useTheme,
} from '@mui/material'
import {
    FormatBold, FormatItalic, Title, FormatListBulleted, FormatQuote, Link as LinkIcon, Image as ImageIcon,
    Campaign as PlayersIcon, AutoAwesome as TemplateIcon, Checklist, VisibilityOff as SecretIcon,
} from '@mui/icons-material'
import { Markdown } from './Markdown'
import { imageErrorText, shrinkImage, uploadImage, type ImageFolder } from '../../services/images'
import { gold, ink, parchment, rule } from '../../theme'
import { useJournalTools } from './tools'
import { tr } from '../../i18n'

// Editor de Markdown do diário (e da Wiki da Mesa, e das Anotações): barra de formatação, envio de imagem e prévia —
// lado a lado no desktop, alternada (Editar/Ver) no celular. Na prévia, os
// trechos `:::jogadores` e as imagens ganham o botão "Mostrar à mesa".
//
// O campo NÃO é controlado (`defaultValue` + ref, lido a cada `input`): com o
// valor no estado, digitar rápido fazia o textarea do MUI repintar e remedir em
// laço — a lição do `TranslationFix`. Quem troca o texto por fora (um documento
// relido do servidor) muda a `key` do editor.

/** Imagem do diário: retrato, mapa de região, item. Grande o bastante para a tela cheia do cartão. */
const JOURNAL_IMAGE_MAX_SIDE = 1600

/** Editar: no desktop, editor e prévia lado a lado; no celular, só o editor. Ver: só a prévia. */
type Mode = 'edit' | 'view'

interface Props {
    value: string
    onChange: (text: string) => void
    /** Nome-base do arquivo das imagens enviadas por aqui. */
    imageName: string
    template?: string
    placeholder?: string
    minRows?: number
    /** Começa na prévia, quando já há texto (no celular). */
    preferView?: boolean
    'aria-label'?: string
    /** Fora do diário: sem `[[ ]]`, bloco para os jogadores nem envio de imagem. */
    plain?: boolean
    /** A pasta do bucket das imagens enviadas por aqui (o diário é `journal/`, só do GM). */
    imageFolder?: ImageFolder
    /** Mostra o botão do bloco `:::jogadores` (o padrão fora do `plain`). */
    playersBlock?: boolean
    /** Mostra o botão do trecho `:::mestre` (a Wiki, para o GM). */
    gmBlock?: boolean
    /** Dica do botão de link `[[ ]]`. */
    linkTitle?: string
}

function ToolButton({ title, onClick, children, disabled }: { title: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
    return (
        <Tooltip title={title}>
            <span>
                <IconButton size="small" aria-label={title} onClick={onClick} disabled={disabled}>{children}</IconButton>
            </span>
        </Tooltip>
    )
}

export const MarkdownEditor = memo(function MarkdownEditor(props: Props) {
    const { value, onChange, imageName, template, placeholder, minRows = 8, preferView = true, plain = false } = props
    const { imageFolder = 'journal', playersBlock = !plain, gmBlock = false } = props
    const theme = useTheme()
    const wide = useMediaQuery(theme.breakpoints.up('md'))
    const tools = useJournalTools()
    const ref = useRef<HTMLTextAreaElement | null>(null)
    const fileRef = useRef<HTMLInputElement | null>(null)
    const [text, setText] = useState(value)
    const [mode, setMode] = useState<Mode>(() => (preferView && value.trim() ? 'view' : 'edit'))
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const preview = useDeferredValue(text)

    const changed = (next: string) => {
        setText(next)
        onChange(next)
    }

    /** Troca a seleção por `before + seleção (ou `fallback`) + after` e devolve o foco. */
    const wrap = (before: string, after = '', fallback = '') => {
        const el = ref.current
        if (!el) return
        const { selectionStart: s, selectionEnd: e } = el
        const inner = el.value.slice(s, e) || fallback
        el.setRangeText(before + inner + after, s, e, 'end')
        el.focus()
        el.setSelectionRange(s + before.length, s + before.length + inner.length)
        changed(el.value)
    }

    /** Prefixo em cada linha da seleção (lista, citação, título). */
    const prefixLines = (prefix: string) => {
        const el = ref.current
        if (!el) return
        const v = el.value
        const start = v.lastIndexOf('\n', el.selectionStart - 1) + 1
        const end = el.selectionEnd
        const block = v.slice(start, end).split('\n').map((l) => prefix + l).join('\n')
        el.setRangeText(block, start, end, 'end')
        el.focus()
        changed(el.value)
    }

    /** O link `[[ ]]`: pelo seletor da página, quando há um; senão, as marcas em volta da seleção. */
    const link = async () => {
        const el = ref.current
        if (!el) return
        if (!tools.pickLink) { wrap('[[', ']]', tr('Nome', 'Name')); return }
        const { selectionStart: s, selectionEnd: e } = el
        const picked = await tools.pickLink(el.value.slice(s, e))
        if (!picked) { el.focus(); return }
        el.setRangeText(picked, s, e, 'end')
        el.focus()
        changed(el.value)
    }

    const insert = (snippet: string) => {
        const el = ref.current
        if (!el) return
        const at = el.selectionStart
        const before = el.value.slice(0, at)
        const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
        el.setRangeText(pad + snippet + '\n', at, el.selectionEnd, 'end')
        el.focus()
        changed(el.value)
    }

    const onFile = async (file: File | undefined) => {
        if (!file) return
        setUploading(true)
        setError(null)
        try {
            const { blob } = await shrinkImage(file, JOURNAL_IMAGE_MAX_SIDE)
            const url = await uploadImage(blob, imageFolder, imageName)
            const alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[[\]]/g, '')
            insert(`![${alt}](${url})`)
        } catch (err) {
            setError(imageErrorText(err))
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    const showEditor = mode === 'edit'
    const showPreview = mode === 'view' || wide

    return (
        <Box sx={{ border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.paper, overflow: 'hidden' }}>
            <Box sx={{
                display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, px: 0.5, py: 0.25,
                borderBottom: `1px solid ${rule}`, bgcolor: parchment.page,
            }}>
                <ToolButton title={tr('Negrito', 'Bold')} onClick={() => wrap('**', '**', tr('texto', 'text'))} disabled={!showEditor}><FormatBold fontSize="small" /></ToolButton>
                <ToolButton title={tr("Itálico", 'Italic')} onClick={() => wrap('_', '_', tr('texto', 'text'))} disabled={!showEditor}><FormatItalic fontSize="small" /></ToolButton>
                <ToolButton title={tr("Título", 'Heading')} onClick={() => prefixLines('## ')} disabled={!showEditor}><Title fontSize="small" /></ToolButton>
                <ToolButton title={tr("Lista", 'List')} onClick={() => prefixLines('- ')} disabled={!showEditor}><FormatListBulleted fontSize="small" /></ToolButton>
                <ToolButton title={tr("Lista de tarefas", 'Task list')} onClick={() => prefixLines('- [ ] ')} disabled={!showEditor}><Checklist fontSize="small" /></ToolButton>
                <ToolButton title={tr("Citação", 'Quote')} onClick={() => prefixLines('> ')} disabled={!showEditor}><FormatQuote fontSize="small" /></ToolButton>
                {!plain && (
                    <>
                    <ToolButton title={props.linkTitle ?? tr("Link para o catálogo: [[Nome]]", 'Link to the catalog: [[Name]]')} onClick={() => void link()} disabled={!showEditor}><LinkIcon fontSize="small" /></ToolButton>
                    {playersBlock && (
                    <ToolButton title={tr("Bloco para os jogadores", 'Block for the players')} onClick={() => wrap(tr(':::jogadores Título\n', ':::players Title\n'), '\n:::', tr('O que os jogadores leem.', 'What the players read.'))} disabled={!showEditor}>
                        <PlayersIcon fontSize="small" sx={{ color: gold.deep }} />
                    </ToolButton>
                    )}
                    {gmBlock && (
                    <ToolButton title={tr("Trecho do mestre (os jogadores não veem)", 'GM-only block (players don\'t see it)')} onClick={() => wrap(tr(':::mestre\n', ':::gm\n'), '\n:::', tr('O que só o mestre sabe.', 'What only the GM knows.'))} disabled={!showEditor}>
                        <SecretIcon fontSize="small" sx={{ color: ink.secondary }} />
                    </ToolButton>
                    )}
                    <ToolButton title={tr("Enviar imagem", 'Upload image')} onClick={() => fileRef.current?.click()} disabled={!showEditor || uploading}>
                    {uploading ? <CircularProgress size={16} /> : <ImageIcon fontSize="small" />}
                    </ToolButton>
                    </>
                )}
                {template && (
                    <ToolButton title={tr('Inserir modelo', 'Insert template')} onClick={() => insert(template)} disabled={!showEditor}><TemplateIcon fontSize="small" /></ToolButton>
                )}
                <Box sx={{ flex: 1 }} />
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={mode}
                    onChange={(_, v: Mode | null) => { if (v) setMode(v) }}
                    sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, textTransform: 'none' } }}
                >
                    <ToggleButton value="edit">{tr('Editar', 'Edit')}</ToggleButton>
                    <ToggleButton value="view">{tr('Ver', 'View')}</ToggleButton>
                </ToggleButtonGroup>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
            </Box>
            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 0 }}>{error}</Alert>}
            <Box sx={{ display: 'grid', gridTemplateColumns: showEditor && showPreview ? '1fr 1fr' : '1fr' }}>
                {/* Escondido, mas montado: a barra continua inserindo no texto certo. */}
                <Box sx={{ display: showEditor ? 'block' : 'none', minWidth: 0 }}>
                    <InputBase
                        inputRef={ref}
                        multiline
                        minRows={minRows}
                        fullWidth
                        defaultValue={value}
                        placeholder={placeholder}
                        onInput={(e) => changed((e.target as HTMLTextAreaElement).value)}
                        inputProps={{ 'aria-label': props['aria-label'], spellCheck: true }}
                        sx={{ p: 1.5, alignItems: 'flex-start', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.55 }}
                    />
                </Box>
                {showPreview && (
                    <Box sx={{ p: 2, minWidth: 0, borderLeft: showEditor ? `1px solid ${rule}` : 'none', minHeight: 120 }}>
                        {preview.trim()
                            ? (
                                <Markdown
                                    source={preview}
                                    onShareBlock={tools.shareBlock}
                                    onShareImage={tools.shareImage}
                                    onWikiLink={tools.openWiki}
                                    knownNames={tools.knownNames}
                                    resolveLink={tools.resolveLink}
                                />
                            )
                            : <Box sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{tr('Nada escrito ainda.', 'Nothing written yet.')}</Box>}
                    </Box>
                )}
            </Box>
        </Box>
    )
})
