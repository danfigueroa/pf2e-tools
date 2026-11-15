import { memo, useDeferredValue, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
    Alert, Box, Button, CircularProgress, IconButton, InputBase, ListItemIcon, ListItemText, Menu, MenuItem, Popover,
    ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import {
    FormatBold, FormatItalic, StrikethroughS, FormatListBulleted, FormatListNumbered, FormatQuote, Link as LinkIcon,
    Image as ImageIcon, Campaign as PlayersIcon, AutoAwesome as TemplateIcon, Checklist, VisibilityOff as SecretIcon,
    FormatAlignLeft, FormatAlignRight, FormatAlignCenter, FormatAlignJustify, ArrowDropDown, TableChart, HorizontalRule,
    HelpOutline, AddBox,
} from '@mui/icons-material'
import { Markdown } from './Markdown'
import { imageErrorText, shrinkImage, uploadImage, type ImageFolder } from '../../services/images'
import { gold, ink, parchment, rule } from '../../theme'
import { useJournalTools } from './tools'
import { blockInRange, type TextAlign } from './blocks'
import {
    ALIGN_WORD, alignLines, insertBlock, quoteWithSignature, setHeading, tableSnippet, toggleLines, toggleWrap, wrapBlock,
    type LineKind, type TextEdit,
} from './edit'
import { isEn, tr } from '../../i18n'

// Editor de Markdown do diário (e da Wiki da Mesa, e das Anotações): barra de formatação, envio de imagem e prévia —
// lado a lado no desktop, alternada (Editar/Ver) no celular. Na prévia, os
// trechos `:::jogadores` e as imagens ganham o botão "Mostrar à mesa".
//
// A barra é para ninguém precisar lembrar de Markdown: cada marca tem botão (ou item de menu com o que
// faz), botão apertado de novo desfaz a marca, e o "?" mostra a cola. As transformações moram em
// `edit.ts` (puras, testadas); aqui elas só são aplicadas.
//
// O campo NÃO é controlado (`defaultValue` + ref, lido a cada `input`): com o
// valor no estado, digitar rápido fazia o textarea do MUI repintar e remedir em
// laço — a lição do `TranslationFix`. Quem troca o texto por fora (um documento
// relido do servidor) muda a `key` do editor.

/** Imagem do diário: retrato, mapa de região, item. Grande o bastante para a tela cheia do cartão. */
const JOURNAL_IMAGE_MAX_SIDE = 1600

/** Editar: no desktop, editor e prévia lado a lado; no celular, só o editor. Ver: só a prévia. */
type Mode = 'edit' | 'view'

type MenuKind = 'heading' | 'align' | 'insert'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

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
    /** Mostra o botão do trecho `:::mestre` (a Wiki para o GM, e o Diário). */
    gmBlock?: boolean
    /** Dica do botão de link `[[ ]]`. */
    linkTitle?: string
    /** Botões de alinhamento (`::centro` etc.); o texto sem marca segue o `justify`. */
    alignTools?: boolean
    /** O texto sem marca fica justificado (a Wiki). */
    justify?: boolean
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

/** Botão com texto (os blocos e os menus): o nome diz o que faz, sem precisar da dica. */
function LabelButton({ title, onClick, icon, children, disabled, menu }: {
    title: string; onClick: (el: HTMLElement) => void; icon?: ReactNode; children: ReactNode; disabled?: boolean; menu?: boolean
}) {
    return (
        <Tooltip title={title}>
            <span>
                <Button
                    size="small"
                    startIcon={icon}
                    endIcon={menu ? <ArrowDropDown /> : undefined}
                    onClick={(e) => onClick(e.currentTarget)}
                    disabled={disabled}
                    aria-haspopup={menu ? 'menu' : undefined}
                    sx={{
                        color: ink.secondary, textTransform: 'none', py: 0.25, px: 0.75, mx: 0.25, minHeight: 0, minWidth: 0,
                        '& .MuiButton-startIcon': { mr: 0.5 }, '& .MuiButton-endIcon': { ml: 0 },
                    }}
                >
                    {children}</Button>
            </span>
        </Tooltip>
    )
}

/** O filete entre os grupos da barra. */
const Sep = () => <Box aria-hidden sx={{ width: '1px', alignSelf: 'stretch', my: 0.75, mx: 0.25, bgcolor: rule }} />

/**
 * Item de menu que mexe no texto: fecha o menu e só então aplica, no quadro seguinte. Com o menu aberto, o
 * foco fica preso nele, e o texto não recebe a troca (nem o desfazer).
 */
function MenuOption({ icon, primary, secondary, onClick, close, disabled }: { icon: ReactNode; primary: string; secondary?: string; onClick: () => void; close: () => void; disabled?: boolean }) {
    return (
        <MenuItem onClick={() => { close(); requestAnimationFrame(onClick) }} disabled={disabled} sx={{ alignItems: 'flex-start', whiteSpace: 'normal', maxWidth: 360 }}>
            <ListItemIcon sx={{ mt: 0.25 }}>{icon}</ListItemIcon>
            <ListItemText primary={primary} secondary={secondary} sx={{ my: 0 }} />
        </MenuItem>
    )
}

export const MarkdownEditor = memo(function MarkdownEditor(props: Props) {
    const { value, onChange, imageName, template, placeholder, minRows = 8, preferView = true, plain = false } = props
    const { imageFolder = 'journal', playersBlock = !plain, gmBlock = false, alignTools = false } = props
    const theme = useTheme()
    const wide = useMediaQuery(theme.breakpoints.up('md'))
    const tools = useJournalTools()
    const ref = useRef<HTMLTextAreaElement | null>(null)
    const fileRef = useRef<HTMLInputElement | null>(null)
    const barRef = useRef<HTMLDivElement | null>(null)
    const [text, setText] = useState(value)
    const [mode, setMode] = useState<Mode>(() => (preferView && value.trim() ? 'view' : 'edit'))
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [menu, setMenu] = useState<{ kind: MenuKind; anchor: HTMLElement } | null>(null)
    const [help, setHelp] = useState<HTMLElement | null>(null)
    const preview = useDeferredValue(text)
    const words = isEn ? ALIGN_WORD.en : ALIGN_WORD.pt
    const rest: TextAlign = props.justify ? 'justify' : 'left'

    const changed = (next: string) => {
        setText(next)
        onChange(next)
    }

    /**
     * Aplica a troca no campo. Pelo `insertText`, o navegador a guarda no desfazer (⌘Z volta o botão)
     * e dispara o `input` (que chama o `changed`); sem ele, o `setRangeText` e o `changed` à mão.
     */
    const apply = (make: (v: string, s: number, e: number) => TextEdit | null) => {
        const el = ref.current
        if (!el) return
        const edit = make(el.value, el.selectionStart, el.selectionEnd)
        el.focus()
        if (!edit) return
        el.setSelectionRange(edit.from, edit.to)
        let done = false
        // Só com o foco no campo: se um menu ou diálogo o segurou, o `insertText` iria para outro lugar.
        if (document.activeElement === el) {
            try {
                done = document.execCommand('insertText', false, edit.insert)
            } catch { done = false }
        }
        if (!done) {
            el.setRangeText(edit.insert, edit.from, edit.to, 'end')
            changed(el.value)
        }
        el.setSelectionRange(edit.selStart, edit.selEnd)
    }

    /** Um bloco `:::`, menos dentro de outro (não aninha: o segredo de dentro vazaria pelo de fora). */
    const block = (open: string, fallback: string, title = '') => apply((v, s, e) => {
        if (blockInRange(v, s, e)) {
            setError(tr(
                'O cursor está dentro de um bloco (jogadores ou mestre). Saia dele para abrir outro: bloco dentro de bloco não funciona.',
                'The cursor is inside a block (players or GM). Move out of it to open another: blocks can\'t go inside blocks.',
            ))
            return null
        }
        setError(null)
        return wrapBlock(v, s, e, open, fallback, title)
    })

    const bold = () => apply((v, s, e) => toggleWrap(v, s, e, '**', tr('texto', 'text')))
    const italic = () => apply((v, s, e) => toggleWrap(v, s, e, '_', tr('texto', 'text')))
    const strike = () => apply((v, s, e) => toggleWrap(v, s, e, '~~', tr('texto', 'text')))
    const lines = (kind: LineKind) => apply((v, s, e) => toggleLines(v, s, e, kind))
    const insert = (snippet: string, select?: [number, number]) => apply((v, s, e) => insertBlock(v, s, e, snippet, select))

    /** O link `[[ ]]`: pelo seletor da página, quando há um; senão, as marcas em volta da seleção. */
    const link = async () => {
        const el = ref.current
        if (!el) return
        if (!tools.pickLink) {
            apply((v, s, e) => {
                const inner = v.slice(s, e) || tr('Nome', 'Name')
                return { from: s, to: e, insert: `[[${inner}]]`, selStart: s + 2, selEnd: s + 2 + inner.length }
            })
            return
        }
        const { selectionStart: s, selectionEnd: e } = el
        const picked = await tools.pickLink(el.value.slice(s, e))
        if (!picked) { el.focus(); return }
        apply(() => ({ from: s, to: e, insert: picked, selStart: s + picked.length, selEnd: s + picked.length }))
    }

    const onKeyDown = (ev: KeyboardEvent) => {
        if (!(ev.metaKey || ev.ctrlKey) || ev.altKey) return
        const key = ev.key.toLowerCase()
        const run = key === 'b' && !ev.shiftKey ? bold
            : key === 'i' && !ev.shiftKey ? italic
            : key === 'x' && ev.shiftKey ? strike
            : key === 'k' && !ev.shiftKey && !plain ? () => void link()
            : null
        if (!run) return
        ev.preventDefault()
        run()
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
    const off = !showEditor
    const closeMenu = () => setMenu(null)
    const openMenu = (kind: MenuKind) => (anchor: HTMLElement) => setMenu({ kind, anchor })
    const table = tableSnippet(tr('Coluna', 'Column'))

    const cheat: { mark: string; what: string; key?: string }[] = [
        { mark: tr('**negrito**', '**bold**'), what: tr('Negrito', 'Bold'), key: `${MOD}B` },
        { mark: tr('_itálico_', '_italic_'), what: tr('Itálico', 'Italic'), key: `${MOD}I` },
        { mark: tr('~~riscado~~', '~~strikethrough~~'), what: tr('Riscado', 'Strikethrough'), key: `${MOD}⇧X` },
        { mark: tr('## Título  /  ### Subtítulo', '## Heading  /  ### Subheading'), what: tr('Títulos (linha própria)', 'Headings (own line)') },
        { mark: tr('- item  /  1. item  /  - [ ] tarefa', '- item  /  1. item  /  - [ ] task'), what: tr('Listas', 'Lists') },
        { mark: tr('> citação', '> quote'), what: tr('Citação; "> — Nome" no fim assina', 'Quote; "> — Name" at the end signs it') },
        ...(!plain ? [{ mark: tr('[[Nome]]  /  [[Nome|texto]]', '[[Name]]  /  [[Name|text]]'), what: tr('Link para uma ficha ou página', 'Link to an entry or page'), key: `${MOD}K` }] : []),
        ...(!plain && playersBlock ? [{ mark: tr(':::jogadores Título\n…\n:::', ':::players Title\n…\n:::'), what: tr('Caixa para os jogadores: pode ser mostrada à mesa', 'Box for the players: can be shown to the table') }] : []),
        ...(!plain && gmBlock ? [{ mark: tr(':::mestre\n…\n:::', ':::gm\n…\n:::'), what: tr('Só o mestre: nunca vai para os jogadores', 'GM only: never goes to the players') }] : []),
        ...(alignTools ? [{ mark: `::${words.center}  ::${words.right}  ::${words.left}  ::${words.justify}`, what: tr('Alinhamento, em linha própria, até a próxima marca', 'Alignment, on its own line, until the next mark') }] : []),
        { mark: '---', what: tr('Divisória (com linha em branco antes)', 'Divider (with a blank line before)') },
        { mark: tr('| a | b |\n| --- | --- |', '| a | b |\n| --- | --- |'), what: tr('Tabela', 'Table') },
    ]

    return (
        <Box sx={{ border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.paper, overflow: 'hidden' }}>
            <Box
                ref={barRef}
                role="toolbar"
                aria-label={tr('Formatação', 'Formatting')}
                sx={{
                    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25, px: 0.5, py: 0.25,
                    borderBottom: `1px solid ${rule}`, bgcolor: parchment.page,
                }}
            >
                <ToolButton title={tr(`Negrito (${MOD}B)`, `Bold (${MOD}B)`)} onClick={bold} disabled={off}><FormatBold fontSize="small" /></ToolButton>
                <ToolButton title={tr(`Itálico (${MOD}I)`, `Italic (${MOD}I)`)} onClick={italic} disabled={off}><FormatItalic fontSize="small" /></ToolButton>
                <ToolButton title={tr(`Riscado (${MOD}⇧X)`, `Strikethrough (${MOD}⇧X)`)} onClick={strike} disabled={off}><StrikethroughS fontSize="small" /></ToolButton>
                <Sep />
                <LabelButton title={tr('Título, subtítulo ou texto normal', 'Heading, subheading or normal text')} onClick={openMenu('heading')} disabled={off} menu>
                    {tr('Título', 'Heading')}</LabelButton>
                <Sep />
                <ToolButton title={tr('Lista (de novo: tira)', 'List (again: removes)')} onClick={() => lines('bullet')} disabled={off}><FormatListBulleted fontSize="small" /></ToolButton>
                <ToolButton title={tr('Lista numerada', 'Numbered list')} onClick={() => lines('number')} disabled={off}><FormatListNumbered fontSize="small" /></ToolButton>
                <ToolButton title={tr('Lista de tarefas', 'Task list')} onClick={() => lines('task')} disabled={off}><Checklist fontSize="small" /></ToolButton>
                <ToolButton title={tr('Citação', 'Quote')} onClick={() => lines('quote')} disabled={off}><FormatQuote fontSize="small" /></ToolButton>
                {alignTools && (
                    <LabelButton title={tr('Alinhar as linhas selecionadas', 'Align the selected lines')} onClick={openMenu('align')} disabled={off} menu icon={<FormatAlignCenter fontSize="small" />}>
                        {tr('Alinhar', 'Align')}</LabelButton>
                )}
                <Sep />
                {!plain && (
                    <ToolButton title={`${props.linkTitle ?? tr('Link para o catálogo: [[Nome]]', 'Link to the catalog: [[Name]]')} (${MOD}K)`} onClick={() => void link()} disabled={off}><LinkIcon fontSize="small" /></ToolButton>
                )}
                {!plain && (
                    <ToolButton title={tr('Enviar imagem', 'Upload image')} onClick={() => fileRef.current?.click()} disabled={off || uploading}>
                        {uploading ? <CircularProgress size={16} /> : <ImageIcon fontSize="small" />}
                    </ToolButton>
                )}
                <LabelButton title={tr('Tabela, divisória, citação assinada, modelo', 'Table, divider, signed quote, template')} onClick={openMenu('insert')} disabled={off} menu icon={<AddBox fontSize="small" />}>
                    {tr('Inserir', 'Insert')}</LabelButton>
                {!plain && (playersBlock || gmBlock) && <Sep />}
                {!plain && playersBlock && (
                    <LabelButton
                        title={tr('Caixa para os jogadores: selecione o trecho e toque. Na prévia, ganha o botão "Mostrar à mesa"', 'Box for the players: select the text and tap. In the preview it gets the "Show the table" button')}
                        onClick={() => block(tr(':::jogadores', ':::players'), tr('O que os jogadores leem.', 'What the players read.'), tr('Título', 'Title'))}
                        disabled={off}
                        icon={<PlayersIcon fontSize="small" sx={{ color: gold.deep }} />}
                    >
                        {tr('Jogadores', 'Players')}</LabelButton>
                )}
                {!plain && gmBlock && (
                    <LabelButton
                        title={tr('Selecione o trecho e toque: os jogadores nunca o veem', 'Select the text and tap: players never see it')}
                        onClick={() => block(tr(':::mestre', ':::gm'), tr('O que só o mestre sabe.', 'What only the GM knows.'))}
                        disabled={off}
                        icon={<SecretIcon fontSize="small" />}
                    >
                        {tr('Só o mestre', 'GM only')}</LabelButton>
                )}
                <ToolButton title={tr('Cola: todas as marcas', 'Cheat sheet: every mark')} onClick={() => setHelp(barRef.current)}>
                    <HelpOutline fontSize="small" />
                </ToolButton>
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

            <Menu anchorEl={menu?.anchor} open={menu?.kind === 'heading'} onClose={closeMenu} disableRestoreFocus>
                <MenuOption close={closeMenu} icon={<Typography sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>T</Typography>} primary={tr('Título', 'Heading')} secondary="## …" onClick={() => apply((v, s, e) => setHeading(v, s, e, 2))} />
                <MenuOption close={closeMenu} icon={<Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1 }}>T</Typography>} primary={tr('Subtítulo', 'Subheading')} secondary="### …" onClick={() => apply((v, s, e) => setHeading(v, s, e, 3))} />
                <MenuOption close={closeMenu} icon={<Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>¶</Typography>} primary={tr('Texto normal', 'Normal text')} secondary={tr('Tira o título da linha', 'Removes the heading')} onClick={() => apply((v, s, e) => setHeading(v, s, e, 0))} />
            </Menu>

            <Menu anchorEl={menu?.anchor} open={menu?.kind === 'align'} onClose={closeMenu} disableRestoreFocus>
                {([
                    ['left', <FormatAlignLeft key="l" fontSize="small" />, tr('À esquerda', 'Left')],
                    ['center', <FormatAlignCenter key="c" fontSize="small" />, tr('Centralizar', 'Center')],
                    ['right', <FormatAlignRight key="r" fontSize="small" />, tr('À direita', 'Right')],
                    ['justify', <FormatAlignJustify key="j" fontSize="small" />, tr('Justificar (as duas margens)', 'Justify (both margins)')],
                ] as [TextAlign, ReactNode, string][]).map(([a, icon, label]) => (
                    <MenuOption close={closeMenu} key={a} icon={icon} primary={label} onClick={() => apply((v, s, e) => alignLines(v, s, e, a, rest, words))} />
                ))}
            </Menu>

            <Menu anchorEl={menu?.anchor} open={menu?.kind === 'insert'} onClose={closeMenu} disableRestoreFocus>
                <MenuOption close={closeMenu} icon={<TableChart fontSize="small" />} primary={tr('Tabela', 'Table')} secondary={tr('Duas colunas; acrescente linhas copiando a última', 'Two columns; add rows by copying the last one')} onClick={() => insert(table.snippet, table.select)} />
                <MenuOption close={closeMenu} icon={<HorizontalRule fontSize="small" />} primary={tr('Divisória', 'Divider')} secondary={tr('Uma linha separando as partes', 'A line between sections')} onClick={() => insert('---')} />
                <MenuOption
                    close={closeMenu}
                    icon={<FormatQuote fontSize="small" />}
                    primary={tr('Citação com assinatura', 'Signed quote')}
                    secondary={tr('A fala selecionada e quem a disse', 'The selected line and who said it')}
                    onClick={() => apply((v, s, e) => quoteWithSignature(v, s, e, tr('A fala.', 'The line.'), tr('Quem disse', 'Who said it')))}
                />
                {template && (
                    <MenuOption close={closeMenu} icon={<TemplateIcon fontSize="small" />} primary={tr('Modelo', 'Template')} secondary={tr('Um roteiro pronto desta parte, para preencher', 'A ready outline of this part, to fill in')} onClick={() => insert(template)} />
                )}
            </Menu>

            <Popover
                open={!!help}
                anchorEl={help}
                onClose={() => setHelp(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                slotProps={{ paper: { sx: { p: 2, maxWidth: 'min(480px, calc(100vw - 32px))', bgcolor: parchment.paper } } }}
            >
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{tr('Cola do editor', 'Editor cheat sheet')}</Typography>
                <Typography variant="body2" sx={{ color: ink.secondary, mb: 1.5 }}>
                    {tr('Os botões escrevem estas marcas por você. Apertar de novo tira a marca.', 'The buttons write these marks for you. Pressing again removes the mark.')}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 1, alignItems: 'start' }}>
                    {cheat.map((c) => (
                        <Box key={c.mark} sx={{ display: 'contents' }}>
                            <Box component="code" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', bgcolor: parchment.sunken, px: 0.75, py: 0.25, borderRadius: 0.5 }}>
                                {c.mark}</Box>
                            <Typography variant="body2">
                                {c.what}{c.key && <Box component="span" sx={{ color: ink.secondary }}> · {c.key}</Box>}</Typography>
                        </Box>
                    ))}
                </Box>
            </Popover>

            {error && <Alert severity="warning" onClose={() => setError(null)} sx={{ borderRadius: 0 }}>{error}</Alert>}
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
                        onKeyDown={onKeyDown}
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
                                    justify={props.justify}
                                />
                            )
                            : <Box sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{tr('Nada escrito ainda.', 'Nothing written yet.')}</Box>}
                    </Box>
                )}
            </Box>
        </Box>
    )
})
