import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
    Box, Button, InputAdornment, List, ListItemButton, ListItemText, Stack, TextField, ToggleButton,
    ToggleButtonGroup, Typography,
} from '@mui/material'
import { Add as AddIcon, Lock as LockIcon, Search as SearchIcon, VisibilityOff as SecretIcon } from '@mui/icons-material'
import { foldName } from '../../../components/markdown/blocks'
import { fetchWikiRecent, searchWiki, WIKI_KINDS, type WikiChange, type WikiKind, type WikiSearchHit, type WikiSummary } from '../../../services/wiki'
import { chrome, displayFont, gold, green, greenInk, ink, parchment, rule } from '../../../theme'
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
}

const matches = (p: WikiSummary, q: string) =>
    [p.title, ...p.aliases, ...p.tags, p.summary].some((t) => foldName(t).includes(q))

export const WikiList = memo(function WikiList({ pages, authors, selected, me, onOpen, onNew }: Props) {
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

    return (
        <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={tab}
                    onChange={(_, v: Tab | null) => { if (v) setTab(v) }}
                    sx={{ flex: 1, '& .MuiToggleButton-root': { flex: 1, textTransform: 'none', py: 0.5 } }}
                >
                    <ToggleButton value="pages">{tr('Páginas', 'Pages')}</ToggleButton>
                    <ToggleButton value="recent">{tr('Recentes', 'Recent')}</ToggleButton>
                </ToggleButtonGroup>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onNew} sx={{ flexShrink: 0 }}>
                    {tr('Nova', 'New')}</Button>
            </Stack>

            {tab === 'recent'
                ? <RecentChanges pages={pages} authors={authors} onOpen={onOpen} />
                : (
                    <>
                        <TextField
                            size="small"
                            fullWidth
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={tr('Buscar na Wiki…', 'Search the wiki…')}
                            slotProps={{
                                input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
                                htmlInput: { 'aria-label': tr('Buscar na Wiki', 'Search the wiki') },
                            }}
                            sx={{ mb: 1 }}
                        />
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap role="group" aria-label={tr('Filtrar por tipo', 'Filter by type')} sx={{ mb: 1.5 }}>
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
                                    {list.map((p) => <PageRow key={p.id} page={p} selected={p.id === selected} onOpen={onOpen} />)}
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
function PageRow({ page: p, selected, onOpen }: { page: WikiSummary; selected: boolean; onOpen: (id: string) => void }) {
    const image = useImageUrl(p.image)
    return (
        <Box
            component="button"
            type="button"
            onClick={() => onOpen(p.id)}
            aria-current={selected ? 'page' : undefined}
            sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, minHeight: 64, width: 1, textAlign: 'left', font: 'inherit', cursor: 'pointer',
                color: ink.primary, border: 0, borderRadius: 2,
                bgcolor: selected ? parchment.paper : 'transparent',
                boxShadow: selected ? `0 0 0 2px ${gold.bright}` : 'none',
                '&:hover': { bgcolor: selected ? parchment.paper : parchment.sunken },
            }}
        >
            {image
                ? <Box component="img" src={image} alt="" loading="lazy" sx={{ width: 44, height: 44, borderRadius: 1.5, objectFit: 'cover', objectPosition: 'center 15%', flex: 'none' }} />
                : <KindTile kind={p.kind} />}
            <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontWeight: 700, fontSize: '0.95rem', color: greenInk.main }}>
                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Box>
                    {p.visibility === 'gm' && <SecretIcon sx={{ fontSize: 14, color: ink.secondary, flex: 'none' }} aria-label={tr('Só o mestre vê', 'GM only')} />}
                    {p.locked && <LockIcon sx={{ fontSize: 14, color: ink.secondary, flex: 'none' }} aria-label={tr('Travada', 'Locked')} />}
                </Box>
                <Box component="span" sx={{ fontSize: '0.8125rem', color: ink.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.summary || KIND_LABEL[p.kind].one}</Box>
            </Box>
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
