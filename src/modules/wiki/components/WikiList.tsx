import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
    Box, Button, Chip, InputAdornment, List, ListItemButton, ListItemText, Stack, TextField, ToggleButton,
    ToggleButtonGroup, Typography,
} from '@mui/material'
import { Add as AddIcon, Lock as LockIcon, Search as SearchIcon, VisibilityOff as SecretIcon } from '@mui/icons-material'
import { foldName } from '../../../components/markdown/blocks'
import { fetchWikiRecent, searchWiki, WIKI_KINDS, type WikiChange, type WikiKind, type WikiSearchHit, type WikiSummary } from '../../../services/wiki'
import { displayFont, gold, greenInk, ink, rule } from '../../../theme'
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
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                            {WIKI_KINDS.filter((k) => counts.get(k)).map((k) => (
                                <Chip
                                    key={k}
                                    size="small"
                                    label={`${KIND_LABEL[k].many} ${counts.get(k)}`}
                                    color={kind === k ? 'primary' : 'default'}
                                    variant={kind === k ? 'filled' : 'outlined'}
                                    onClick={() => setKind(kind === k ? null : k)}
                                />
                            ))}
                            {me && (
                                <Chip
                                    size="small"
                                    label={tr('Só as minhas', 'Only mine')}
                                    color={mine ? 'primary' : 'default'}
                                    variant={mine ? 'filled' : 'outlined'}
                                    onClick={() => setMine(!mine)}
                                />
                            )}
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

                        <List dense disablePadding>
                            {filtered.map((p) => (
                                <ListItemButton key={p.id} selected={p.id === selected} onClick={() => onOpen(p.id)} sx={{ borderRadius: 1, px: 1 }}>
                                    <ListItemText
                                        primary={(
                                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</Box>
                                                {p.visibility === 'gm' && <SecretIcon sx={{ fontSize: 14, color: ink.secondary }} aria-label={tr('Só o mestre vê', 'GM only')} />}
                                                {p.locked && <LockIcon sx={{ fontSize: 14, color: ink.secondary }} aria-label={tr('Travada', 'Locked')} />}
                                            </Box>
                                        )}
                                        secondary={KIND_LABEL[p.kind].one + (p.summary ? ` · ${p.summary}` : '')}
                                        slotProps={{
                                            primary: { sx: { fontWeight: 600 } },
                                            secondary: { sx: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                                        }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>

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
