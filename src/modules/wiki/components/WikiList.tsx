import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
    Box, Button, IconButton, List, ListItemButton, ListItemText, Stack, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, ChevronRight, DeleteSweep as TrashIcon, Lock as LockIcon, Search as SearchIcon, VisibilityOff as SecretIcon } from '@mui/icons-material'
import { foldName } from '../../../components/markdown/blocks'
import { fetchWikiRecent, searchWiki, WIKI_KINDS, type WikiChange, type WikiKind, type WikiSearchHit, type WikiSummary } from '../../../services/wiki'
import { chrome, core, displayFont, gold, green, greenInk, ink, parchment, rule } from '../../../theme'
import { useImageUrl } from '../../../services/images'
import { KindTile } from './KindIcon'
import { KIND_LABEL } from '../kinds'
import { authorName, formatWhen } from '../useWiki'
import { tr } from '../../../i18n'

// O índice da Wiki: busca (no título, apelidos, etiquetas e resumo na hora; no texto pelo servidor),
// filtro por tipo e etiqueta, "só as minhas" e as mudanças recentes.

type Tab = 'pages' | 'recent'

interface Props {
    pages: WikiSummary[]
    authors: Record<string, string>
    selected: string | null
    me: string | null
    onOpen: (id: string) => void
    onNew: () => void
    /** O nome da mesa, no topo da lista. */
    mesaName: string
    /** O cabeçalho escuro do celular (a lista ocupa a tela). */
    dark?: boolean
    /** Só o GM: abre a lixeira. */
    onTrash?: () => void
}

const matches = (p: WikiSummary, q: string) =>
    [p.title, ...p.aliases, ...p.tags, p.summary].some((t) => foldName(t).includes(q))

export const WikiList = memo(function WikiList({ pages, authors, selected, me, onOpen, onNew, mesaName, dark = false, onTrash }: Props) {
    const [tab, setTab] = useState<Tab>('pages')
    const [query, setQuery] = useState('')
    const [kind, setKind] = useState<WikiKind | null>(null)
    const [tag, setTag] = useState<string | null>(null)
    const [mine, setMine] = useState(false)
    const deferred = useDeferredValue(query)
    const q = foldName(deferred)
    const [textHits, setTextHits] = useState<WikiSearchHit[]>([])

    // Busca no TEXTO das páginas (servidor), a partir de 3 letras, com uma pausa para digitar.
    useEffect(() => {
        if (q.length < 3) { setTextHits([]); return }
        let live = true
        const timer = setTimeout(() => {
            void searchWiki(q).then((hits) => { if (live && hits) setTextHits(hits) })
        }, 350)
        return () => { live = false; clearTimeout(timer) }
    }, [q])

    const counts = useMemo(() => {
        const c = new Map<WikiKind, number>()
        for (const p of pages) c.set(p.kind, (c.get(p.kind) ?? 0) + 1)
        return c
    }, [pages])
    const tags = useMemo(() => [...new Set(pages.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b)), [pages])

    const filtered = useMemo(() => pages
        .filter((p) => (!kind || p.kind === kind) && (!tag || p.tags.includes(tag)) && (!mine || p.createdBy === me) && (!q || matches(p, q)))
        .sort((a, b) => a.title.localeCompare(b.title)), [pages, kind, tag, mine, me, q])

    const groups = useMemo(() => WIKI_KINDS
        .map((k) => [k, filtered.filter((p) => p.kind === k)] as const)
        .filter(([, list]) => list.length > 0), [filtered])
    const shown = new Set(filtered.map((p) => p.id))
    const extraHits = textHits.filter((h) => !shown.has(h.id))

    const search = (
        <Box component="label" sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, height: { xs: 48, md: 44 }, px: 1.5, borderRadius: 1.75, boxSizing: 'border-box',
            ...(dark ? { bgcolor: chrome.raised, border: `1px solid ${chrome.line}`, color: chrome.textMuted } : { bgcolor: parchment.paper, border: `1px solid ${rule}`, color: ink.secondary }),
        }}>
            <SearchIcon sx={{ fontSize: 18 }} />
            <Box
                component="input"
                type="search"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value); setTab('pages') }}
                placeholder={dark ? tr('Buscar NPC, local ou item…', 'Search NPC, place or item…') : tr('Buscar na Wiki…', 'Search the wiki…')}
                aria-label={tr('Buscar na Wiki', 'Search the wiki')}
                sx={{ flex: 1, minWidth: 0, border: 0, bgcolor: 'transparent', font: 'inherit', fontSize: 16, outline: 'none', color: dark ? chrome.text : ink.primary, '&::placeholder': { color: dark ? chrome.textMuted : ink.secondary, opacity: 1 } }}
            />
        </Box>
    )
    const newButton = (
        <Button
            startIcon={<AddIcon sx={{ color: dark ? green.deepest : gold.bright }} />}
            onClick={onNew}
            sx={{
                flexShrink: 0, height: { xs: 44, md: 40 }, px: 1.75, borderRadius: 1.5, fontWeight: dark ? 700 : 600,
                ...(dark ? { bgcolor: gold.bright, color: green.deepest, '&:hover': { bgcolor: gold.main } } : { bgcolor: green.main, color: chrome.text, '&:hover': { bgcolor: green.mid } }),
            }}
        >
            {tr('Nova', 'New')}</Button>
    )
    const trashButton = onTrash && (
        <IconButton aria-label={tr('Lixeira da Wiki', 'Wiki trash')} title={tr('Lixeira', 'Trash')} onClick={onTrash} sx={{ color: ink.secondary }}><TrashIcon /></IconButton>
    )

    return (
        <Box sx={{ minWidth: 0 }}>
            {dark
                ? (
                    <Box component="header" sx={{ bgcolor: green.deepest, color: chrome.text, borderRadius: 3, px: 2, pt: 1.5, pb: 2.5, mb: 2.25, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: gold.bright }}>{mesaName}</Typography>
                                <Typography component="h1" sx={{ m: 0, fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', color: chrome.text }}>{tr('Wiki', 'Wiki')}</Typography>
                            </Box>
                            {newButton}
                        </Box>
                        {search}
                    </Box>
                )
                : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25 }}>
                            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: gold.deep }}>{tr('Wiki da campanha', 'Campaign wiki')}</Typography>
                                <Typography component="h1" sx={{ m: 0, fontFamily: displayFont, fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.25, color: greenInk.main, overflowWrap: 'anywhere' }}>{mesaName}</Typography>
                            </Box>
                            {newButton}
                        </Box>
                        {search}
                    </Box>
                )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            <Box role="group" aria-label={tr('Mostrar', 'Show')} sx={{ flex: 1, display: 'flex', gap: 0.5, p: 0.5, borderRadius: 1.5, bgcolor: parchment.sunken }}>
                {(['pages', 'recent'] as const).map((t) => (
                    <Box
                        key={t}
                        component="button"
                        type="button"
                        aria-pressed={tab === t}
                        onClick={() => setTab(t)}
                        sx={{
                            flex: 1, height: { xs: 38, md: 36 }, borderRadius: 1.1, border: 0, font: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                            ...(tab === t ? { bgcolor: parchment.paper, color: greenInk.main, boxShadow: `0 1px 2px ${core.fx.shadowHover}` } : { bgcolor: 'transparent', color: ink.secondary }),
                        }}
                    >
                        {t === 'pages' ? tr('Páginas', 'Pages') : tr('Recentes', 'Recent')}
                    </Box>
                ))}
            </Box>
            {trashButton}
            </Box>

            {tab === 'recent'
                ? <RecentChanges pages={pages} authors={authors} onOpen={onOpen} />
                : (
                    <>
                        <Stack direction="row" spacing={0.75} flexWrap={dark ? 'nowrap' : 'wrap'} useFlexGap role="group" aria-label={tr('Filtrar por tipo', 'Filter by type')} sx={{ mb: 1.5, ...(dark ? { overflowX: 'auto', mx: -1.5, px: 1.5, '& > *': { flex: 'none' } } : {}) }}>
                            <FilterPill active={!kind && !mine} onClick={() => { setKind(null); setMine(false) }}>{tr('Todas', 'All')} · {pages.length}</FilterPill>
                            {WIKI_KINDS.filter((k) => counts.get(k)).map((k) => (
                                <FilterPill key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>{KIND_LABEL[k].many} · {counts.get(k)}</FilterPill>
                            ))}
                            {me && <FilterPill active={mine} onClick={() => setMine(!mine)}>{tr('Só as minhas', 'Only mine')}</FilterPill>}
                        </Stack>
                        {tags.length > 0 && (
                            <TextField
                                select
                                size="small"
                                fullWidth
                                label={tr('Etiqueta', 'Tag')}
                                value={tag ?? ''}
                                onChange={(e) => setTag(e.target.value || null)}
                                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                                sx={{ mb: 1 }}
                            >
                                <option value="">{tr('Todas', 'All')}</option>
                                {tags.map((t) => <option key={t} value={t}>{t}</option>)}
                            </TextField>
                        )}

                        {pages.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2, fontStyle: 'italic' }}>
                                {tr('A Wiki está vazia. Crie a primeira página: um NPC, a cidade onde tudo começou…', 'The wiki is empty. Create the first page: an NPC, the city where it all began…')}</Typography>
                        )}
                        {pages.length > 0 && filtered.length === 0 && extraHits.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2, fontStyle: 'italic' }}>
                                {tr('Nenhuma página com esse filtro.', 'No page matches that filter.')}</Typography>
                        )}

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {groups.map(([k, list]) => (
                                <Box key={k} component="section" aria-label={KIND_LABEL[k].many} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {!kind && (
                                        <Typography component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.75, pt: 1.5, pb: 0.5, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ink.secondary }}>
                                            <Box component="span" aria-hidden="true" sx={{ width: 7, height: 7, transform: 'rotate(45deg)', bgcolor: gold.bright }} />{KIND_LABEL[k].many}</Typography>
                                    )}
                                    {list.map((p) => <PageRow key={p.id} page={p} selected={p.id === selected} onOpen={onOpen} card={dark} />)}
                                </Box>
                            ))}
                        </Box>

                        {extraHits.length > 0 && (
                            <Box sx={{ mt: 1.5 }}>
                                <Typography variant="caption" sx={{ color: gold.deep, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {tr('Citado no texto', 'Found in the text')}</Typography>
                                <List dense disablePadding>
                                    {extraHits.map((h) => (
                                        <ListItemButton key={h.id} onClick={() => onOpen(h.id)} sx={{ borderRadius: 1, px: 1 }}>
                                            <ListItemText
                                                primary={h.title}
                                                secondary={`…${h.snippet.replace(/\s+/g, ' ').trim()}…`}
                                                slotProps={{ primary: { sx: { fontWeight: 600 } }, secondary: { sx: { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } } }}
                                            />
                                        </ListItemButton>
                                    ))}
                                </List>
                            </Box>
                        )}
                    </>
                )}
        </Box>
    )
})

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <Box
            component="button"
            type="button"
            aria-pressed={active}
            onClick={onClick}
            sx={{
                height: { xs: 40, md: 32 }, px: 1.5, borderRadius: 999, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${active ? green.main : rule}`, bgcolor: active ? green.main : 'transparent', color: active ? chrome.text : ink.primary,
            }}
        >
            {children}
        </Box>
    )
}

/** Uma página na lista: a imagem (ou o ícone do tipo), o nome com os selos e o resumo numa linha. */
function PageRow({ page: p, selected, onOpen, card }: { page: WikiSummary; selected: boolean; onOpen: (id: string) => void; card: boolean }) {
    const image = useImageUrl(p.image)
    return (
        <Box
            component="button"
            type="button"
            onClick={() => onOpen(p.id)}
            aria-current={selected ? 'page' : undefined}
            sx={{
                display: 'flex', alignItems: 'center', gap: card ? 1.75 : 1.5, p: card ? 1.5 : 1.25, minHeight: 64, width: 1, textAlign: 'left', font: 'inherit', cursor: 'pointer',
                color: ink.primary, borderRadius: card ? 2.25 : 2,
                border: card ? `1px solid ${rule}` : 0,
                bgcolor: selected || card ? parchment.paper : 'transparent',
                boxShadow: selected ? `0 0 0 2px ${gold.bright}, 0 4px 12px ${core.fx.shadowHover}` : 'none',
                '&:hover': { bgcolor: selected || card ? parchment.paper : parchment.sunken, borderColor: card ? gold.main : undefined },
            }}
        >
            {image
                ? <Box component="img" src={image} alt="" loading="lazy" sx={{ width: card ? 64 : 44, height: card ? 76 : 44, borderRadius: 1.5, objectFit: 'cover', objectPosition: 'center 15%', flex: 'none', boxShadow: card ? `0 0 0 2px ${gold.bright}` : 'none' }} />
                : <KindTile kind={p.kind} size={card ? 52 : 44} />}
            <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontWeight: 700, fontSize: card ? '1rem' : '0.95rem', color: greenInk.main, ...(card ? { fontFamily: displayFont } : {}) }}>
                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Box>
                    {p.visibility === 'gm' && <SecretIcon sx={{ fontSize: 14, color: ink.secondary, flex: 'none' }} aria-label={tr('Só o mestre vê', 'GM only')} />}
                    {p.locked && <LockIcon sx={{ fontSize: 14, color: ink.secondary, flex: 'none' }} aria-label={tr('Travada', 'Locked')} />}
                </Box>
                <Box component="span" sx={{
                    fontSize: card ? '0.875rem' : '0.8125rem', lineHeight: 1.35, color: ink.secondary, overflow: 'hidden',
                    ...(card ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } : { textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                }}>
                    {p.summary || KIND_LABEL[p.kind].one}</Box>
            </Box>
            {card && <ChevronRight aria-hidden="true" sx={{ color: gold.deep, flex: 'none' }} />}
        </Box>
    )
}

/** As últimas versões gravadas na mesa, de todas as páginas, com quem as gravou. */
export function RecentChanges({ pages, authors, onOpen, limit = 40 }: {
    pages: WikiSummary[]
    authors: Record<string, string>
    onOpen: (id: string) => void
    limit?: number
}) {
    const [changes, setChanges] = useState<WikiChange[] | null>(null)
    const [names, setNames] = useState<Record<string, string>>({})
    // Relê quando o índice muda (alguém gravou): o índice já assina o aviso do banco.
    const stamp = useMemo(() => Math.max(0, ...pages.map((p) => p.updatedAt)), [pages])
    useEffect(() => {
        let live = true
        void fetchWikiRecent().then((out) => {
            if (!live) return
            setChanges(out?.changes ?? [])
            setNames(out?.authors ?? {})
        })
        return () => { live = false }
    }, [stamp])

    if (!changes) return <Typography variant="body2" color="text.secondary">{tr('Carregando…', 'Loading…')}</Typography>
    if (!changes.length) {
        return <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Nada escrito ainda.', 'Nothing written yet.')}</Typography>
    }
    const all = { ...authors, ...names }
    return (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {changes.slice(0, limit).map((c) => (
                <Box component="li" key={`${c.page}:${c.rev}`} sx={{ borderBottom: `1px solid ${rule}`, '&:last-child': { borderBottom: 0 } }}>
                    <ListItemButton onClick={() => onOpen(c.page)} sx={{ px: 1, py: 0.75, borderRadius: 1, display: 'block' }}>
                        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: greenInk.main, fontSize: '0.95rem' }}>{c.title}</Typography>
                        <Typography variant="caption" sx={{ color: ink.secondary }}>
                            {c.rev === 1 ? tr('Criada por ', 'Created by ') : tr('Alterada por ', 'Edited by ')}
                            <Box component="span" sx={{ fontWeight: 700, color: ink.primary }}>{authorName(all, c.by)}</Box>
                            {` · ${formatWhen(c.at)}`}
                        </Typography>
                    </ListItemButton>
                </Box>
            ))}
        </Box>
    )
}
