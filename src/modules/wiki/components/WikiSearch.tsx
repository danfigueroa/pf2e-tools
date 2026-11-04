import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Box, Button, Dialog, IconButton, useMediaQuery, useTheme } from '@mui/material'
import { Add as AddIcon, Close as CloseIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material'
import { foldName } from '../../../components/markdown/blocks'
import { searchWiki, WIKI_KINDS, type WikiKind, type WikiMissing, type WikiSearchHit, type WikiSummary } from '../../../services/wiki'
import { bodySerif, chrome, core, gold, green, greenInk, ink, parchment, rule, status } from '../../../theme'
import { KIND_LABEL } from '../kinds'
import { findFolded } from '../useWiki'
import { PageThumb } from './KindIcon'
import { tr } from '../../../i18n'

// A busca da Wiki (⌘K dentro da Wiki, o campo "Buscar na wiki…"): páginas pelo título, apelido, etiqueta e
// resumo na hora; pelo TEXTO no servidor (com o trecho); os nomes citados que ainda não têm página; e
// "Criar nova página". Setas navegam, Enter abre, Esc fecha. No celular, tela cheia.

interface Props {
    pages: WikiSummary[]
    missing: WikiMissing[] | null
    onClose: () => void
    onOpen: (id: string) => void
    onCreate: (title: string) => void
}

type Item =
    | { type: 'page'; page: WikiSummary }
    | { type: 'hit'; hit: WikiSearchHit; page: WikiSummary | undefined }
    | { type: 'missing'; missing: WikiMissing }
    | { type: 'create' }

const matches = (p: WikiSummary, q: string, titleOnly: boolean) =>
    (titleOnly ? [p.title, ...p.aliases] : [p.title, ...p.aliases, ...p.tags, p.summary]).some((t) => foldName(t).includes(q))

/** O texto com o trecho buscado marcado. */
function Marked({ text, query }: { text: string; query: string }) {
    const at = findFolded(text, query)
    if (!at) return <>{text}</>
    return (
        <>
            {text.slice(0, at[0])}
            <Box component="mark" sx={{ bgcolor: `${gold.bright}66`, color: 'inherit', borderRadius: '3px', px: '1px', fontStyle: 'normal' }}>{text.slice(at[0], at[1])}</Box>
            {text.slice(at[1])}
        </>
    )
}

/** O trecho do texto em volta do achado, numa linha, sem as marcas do Markdown. */
function cleanSnippet(snippet: string): string {
    return snippet
        .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/[#*_>`]|:::\S*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

export function WikiSearch({ pages, missing, onClose, onOpen, onCreate }: Props) {
    const theme = useTheme()
    const wide = useMediaQuery(theme.breakpoints.up('md'))
    const [query, setQuery] = useState('')
    const [kind, setKind] = useState<WikiKind | null>(null)
    const [titleOnly, setTitleOnly] = useState(false)
    const [active, setActive] = useState(0)
    const [hits, setHits] = useState<WikiSearchHit[]>([])
    const inputRef = useRef<HTMLInputElement | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)
    const deferred = useDeferredValue(query)
    const q = foldName(deferred)
    const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
    const kinds = useMemo(() => WIKI_KINDS.filter((k) => pages.some((p) => p.kind === k)), [pages])

    // O texto das páginas: no servidor, a partir de 3 letras, com uma pausa para digitar.
    useEffect(() => {
        if (q.length < 3 || titleOnly) { setHits([]); return }
        let live = true
        const timer = setTimeout(() => { void searchWiki(q).then((out) => { if (live && out) setHits(out) }) }, 300)
        return () => { live = false; clearTimeout(timer) }
    }, [q, titleOnly])

    const sections = useMemo(() => {
        const inKind = (k: WikiKind) => !kind || k === kind
        const found = q
            ? pages.filter((p) => inKind(p.kind) && matches(p, q, titleOnly)).sort((a, b) => {
                const ta = foldName(a.title).startsWith(q) ? 0 : 1
                const tb = foldName(b.title).startsWith(q) ? 0 : 1
                return ta - tb || a.title.localeCompare(b.title)
            })
            : [...pages].filter((p) => inKind(p.kind)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
        const shown = new Set(found.map((p) => p.id))
        const text = hits.filter((h) => !shown.has(h.id) && inKind(h.kind)).map((h) => ({ type: 'hit' as const, hit: h, page: byId.get(h.id) }))
        const pageItems: Item[] = [...found.slice(0, 12).map((page) => ({ type: 'page' as const, page })), ...text]
        const missingItems: Item[] = q && !kind
            ? (missing ?? []).filter((m) => foldName(m.name).includes(q)).slice(0, 5).map((m) => ({ type: 'missing' as const, missing: m }))
            : []
        const exact = pages.some((p) => foldName(p.title) === q)
        const createItems: Item[] = q && !exact ? [{ type: 'create' }] : []
        return { pageItems, missingItems, createItems }
    }, [pages, byId, q, kind, titleOnly, hits, missing])
    const items = useMemo(() => [...sections.pageItems, ...sections.missingItems, ...sections.createItems], [sections])

    useEffect(() => { setActive(0) }, [q, kind, titleOnly])
    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
    }, [active])

    const choose = (item: Item | undefined) => {
        if (!item) return
        if (item.type === 'page') onOpen(item.page.id)
        else if (item.type === 'hit') onOpen(item.hit.id)
        else if (item.type === 'missing') onCreate(item.missing.name)
        else onCreate(query.trim())
    }

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
        else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]) }
    }

    const label = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ink.secondary, px: 1.5, pt: 1.75, pb: 0.75 } as const
    const row = (index: number, content: ReactNode, onClick: () => void, extra?: ReactNode) => {
        const on = wide && index === active
        return (
            <Box
                key={index}
                data-index={index}
                role="option"
                aria-selected={on}
                onMouseEnter={() => setActive(index)}
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1.75, px: 1.5, py: 1.25, minHeight: { xs: 64, md: 52 }, borderRadius: 1.75, cursor: 'pointer',
                    bgcolor: on ? parchment.page : 'transparent', boxShadow: on ? `inset 0 0 0 1.5px ${gold.bright}` : 'none',
                }}
                onClick={onClick}
            >
                {content}
                {extra}
            </Box>
        )
    }
    const filterPill = (key: string, text: string, on: boolean, click: () => void) => (
        <Box key={key} component="button" type="button" aria-pressed={on} onClick={click} sx={{
            flex: 'none', height: { xs: 38, md: 32 }, px: 1.5, borderRadius: 999, font: 'inherit', fontSize: { xs: '0.875rem', md: '0.8125rem' }, fontWeight: 600, cursor: 'pointer',
            border: on ? 0 : `1px solid ${rule}`, bgcolor: on ? green.main : 'transparent', color: on ? chrome.text : ink.primary,
        }}>{text}</Box>
    )

    let n = -1
    const body = (
        <>
            <Box role="group" aria-label={tr('Filtrar resultados', 'Filter results')} sx={{
                display: 'flex', gap: 0.75, px: { xs: 2, md: 2.5 }, py: 1.5, borderBottom: `1px solid ${rule}`,
                overflowX: 'auto', flexWrap: { md: 'wrap' },
            }}>
                {filterPill('all', tr('Tudo', 'All'), !kind && !titleOnly, () => { setKind(null); setTitleOnly(false) })}
                {kinds.map((k) => filterPill(k, KIND_LABEL[k].many, kind === k, () => setKind(kind === k ? null : k)))}
                {filterPill('title', tr('Só no título', 'Title only'), titleOnly, () => setTitleOnly(!titleOnly))}
            </Box>
            <Box ref={listRef} role="listbox" aria-label={tr('Resultados', 'Results')} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.25, pt: 0.5, pb: 1.5 }}>
                {sections.pageItems.length > 0 && (
                    <Box sx={label}>{q ? tr('Páginas', 'Pages') : tr('Editadas por último', 'Recently edited')}{!wide && ` · ${sections.pageItems.length}`}</Box>
                )}
                {sections.pageItems.map((item) => {
                    n++
                    if (item.type === 'page') {
                        const p = item.page
                        return row(n, (
                            <>
                                <PageThumb page={p} size={wide ? 42 : 46} />
                                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <Box sx={{ fontWeight: 700, fontSize: '1rem', color: greenInk.main, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Marked text={p.title} query={deferred} /></Box>
                                    <Box sx={{ fontSize: '0.8125rem', color: ink.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {KIND_LABEL[p.kind].one}{p.summary ? <> · <Marked text={p.summary} query={deferred} /></> : null}</Box>
                                </Box>
                            </>
                        ), () => choose(item), wide && n === active ? <Kbd solid>{tr('↵ abrir', '↵ open')}</Kbd> : null)
                    }
                    if (item.type !== 'hit') return null
                    const h = item.hit
                    const snippet = cleanSnippet(h.snippet)
                    return row(n, (
                        <>
                            <PageThumb page={item.page ?? { kind: h.kind, image: null }} size={wide ? 42 : 46} />
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '1rem', color: greenInk.main, minWidth: 0 }}>
                                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</Box>
                                    <Box component="span" sx={{ flex: 'none', fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.5, px: 0.9, borderRadius: 999, bgcolor: parchment.sunken, color: ink.primary }}>{KIND_LABEL[h.kind].one}</Box>
                                </Box>
                                <Box sx={{
                                    fontFamily: bodySerif, fontStyle: 'italic', fontSize: '1rem', lineHeight: 1.35, color: ink.secondary,
                                    ...(wide ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
                                }}>“…<Marked text={snippet} query={deferred} />…”</Box>
                                {!wide && <Box sx={{ fontSize: '0.75rem', color: ink.secondary }}>{tr('achado no texto', 'found in the text')}</Box>}
                            </Box>
                        </>
                    ), () => choose(item), wide ? <Box sx={{ flex: 'none', fontSize: '0.75rem', color: ink.secondary }}>{tr('no texto', 'in the text')}</Box> : null)
                })}

                {sections.missingItems.length > 0 && <Box sx={label}>{tr('Citado, mas sem página', 'Mentioned, but no page')}</Box>}
                {sections.missingItems.map((item) => {
                    n++
                    if (item.type !== 'missing') return null
                    const m = item.missing
                    return row(n, (
                        <>
                            <Box aria-hidden="true" sx={{ width: wide ? 42 : 46, height: wide ? 42 : 46, flex: 'none', borderRadius: 1.5, border: `1.5px dashed ${status.error}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: status.error }}>
                                <AddIcon fontSize="small" /></Box>
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <Box sx={{ fontWeight: 700, fontSize: '1rem', color: greenInk.main }}><Marked text={m.name} query={deferred} /></Box>
                                <Box sx={{ fontSize: '0.8125rem', color: ink.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {tr('Citado em ', 'Mentioned in ')}{m.from.map((f) => f.title).join(', ')}</Box>
                            </Box>
                        </>
                    ), () => choose(item), (
                        <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); choose(item) }} sx={{ flex: 'none', color: ink.primary, borderColor: rule }}>
                            {wide ? tr('Criar página', 'Create page') : tr('Criar', 'Create')}</Button>
                    ))
                })}

                {sections.createItems.length > 0 && <Box sx={label}>{tr('Ações', 'Actions')}</Box>}
                {sections.createItems.map(() => {
                    n++
                    return row(n, (
                        <>
                            <Box aria-hidden="true" sx={{ width: wide ? 42 : 46, height: wide ? 42 : 46, flex: 'none', borderRadius: 1.5, bgcolor: parchment.sunken, display: 'flex', alignItems: 'center', justifyContent: 'center', color: greenInk.main }}>
                                <EditIcon fontSize="small" /></Box>
                            <Box sx={{ fontSize: '1rem', fontWeight: 600 }}>{tr(`Criar nova página “${query.trim()}”`, `Create new page “${query.trim()}”`)}</Box>
                        </>
                    ), () => choose({ type: 'create' }))
                })}

                {q && items.length === 0 && (
                    <Box sx={{ px: 1.5, py: 3, color: ink.secondary, fontStyle: 'italic' }}>{tr('Nada encontrado.', 'Nothing found.')}</Box>
                )}
            </Box>
        </>
    )

    if (!wide) {
        return (
            <Dialog open fullScreen onClose={onClose} aria-label={tr('Buscar na Wiki', 'Search the wiki')} slotProps={{ paper: { sx: { bgcolor: parchment.paper, backgroundImage: 'none' } } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.5, bgcolor: green.deepest, pt: 'calc(12px + env(safe-area-inset-top))' }}>
                    <Box component="label" sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.25, height: 48, px: 1.75, borderRadius: 1.75, bgcolor: parchment.paper, boxShadow: `0 0 0 2px ${gold.bright}` }}>
                        <SearchIcon sx={{ fontSize: 18, color: gold.deep }} />
                        <Box component="input" ref={inputRef} type="search" autoFocus value={query} onKeyDown={onKey}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                            placeholder={tr('Buscar NPC, local, item ou trecho…', 'Search NPC, place, item or passage…')}
                            aria-label={tr('Buscar na Wiki', 'Search the wiki')}
                            sx={{ flex: 1, minWidth: 0, border: 0, bgcolor: 'transparent', font: 'inherit', fontSize: 18, outline: 'none', color: ink.primary, '&::-webkit-search-cancel-button': { display: 'none' } }} />
                        {query && (
                            <IconButton size="small" aria-label={tr('Limpar busca', 'Clear search')} onClick={() => { setQuery(''); inputRef.current?.focus() }} sx={{ width: 28, height: 28, minHeight: 0, bgcolor: parchment.sunken }}>
                                <CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                        )}
                    </Box>
                    <Button onClick={onClose} sx={{ color: chrome.text, fontWeight: 600, flex: 'none', px: 0.5 }}>{tr('Cancelar', 'Cancel')}</Button>
                </Box>
                {body}
            </Dialog>
        )
    }

    return (
        <Dialog
            open
            onClose={onClose}
            aria-label={tr('Buscar na Wiki', 'Search the wiki')}
            maxWidth={false}
            sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
            slotProps={{
                paper: { sx: { '&:not(.MuiDialog-paperFullScreen)': { mt: 11, mx: 2, mb: 2, width: 700, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 120px)' }, borderRadius: 2.75, bgcolor: parchment.paper, backgroundImage: 'none', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: `0 30px 80px ${core.fx.shadowHover}, 0 0 0 1px ${gold.bright}59` } },
            }}
        >
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1.75, height: 70, px: 2.5, borderBottom: `1px solid ${rule}`, flex: 'none' }}>
                <SearchIcon sx={{ fontSize: 22, color: gold.deep }} />
                <Box component="input" ref={inputRef} type="search" autoFocus value={query} onKeyDown={onKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                    placeholder={tr('Buscar NPC, local, item ou trecho…', 'Search NPC, place, item or passage…')}
                    aria-label={tr('Buscar na Wiki', 'Search the wiki')}
                    sx={{ flex: 1, minWidth: 0, border: 0, bgcolor: 'transparent', font: 'inherit', fontSize: 22, outline: 'none', color: greenInk.main, '&::placeholder': { color: ink.secondary, opacity: 1 }, '&::-webkit-search-cancel-button': { display: 'none' } }} />
                <Box component="button" type="button" onClick={onClose} aria-label={tr('Fechar busca', 'Close search')} sx={{ font: 'inherit', cursor: 'pointer', bgcolor: 'transparent' }}><Kbd>Esc</Kbd></Box>
            </Box>
            {body}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: 2.5, py: 1.5, bgcolor: parchment.page, borderTop: `1px solid ${rule}`, fontSize: '0.8125rem', color: ink.secondary, flex: 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Kbd>↑</Kbd><Kbd>↓</Kbd>{tr('navegar', 'move')}</Box>
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Kbd>↵</Kbd>{tr('abrir', 'open')}</Box>
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Kbd>Esc</Kbd>{tr('fechar', 'close')}</Box>
                </Box>
                {q && (
                    <span>
                        {sections.pageItems.length === 1 ? tr('1 página', '1 page') : tr(`${sections.pageItems.length} páginas`, `${sections.pageItems.length} pages`)}
                        {sections.missingItems.length > 0 && tr(` · ${sections.missingItems.length} sem página`, ` · ${sections.missingItems.length} without a page`)}
                    </span>
                )}
            </Box>
        </Dialog>
    )
}

function Kbd({ children, solid = false }: { children: ReactNode; solid?: boolean }) {
    return (
        <Box component="span" sx={{
            flex: 'none', fontSize: '0.75rem', fontWeight: 700, px: 0.9, py: '1px', borderRadius: 0.75, whiteSpace: 'nowrap',
            ...(solid ? { bgcolor: green.main, color: chrome.text } : { border: `1px solid ${rule}`, bgcolor: parchment.paper, color: ink.secondary }),
        }}>{children}</Box>
    )
}
