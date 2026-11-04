import { memo, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import {
    Add as AddIcon, ArrowBackIosNew as BackIcon, ChevronRight, DeleteSweep as TrashIcon, ExpandMore, Lock as LockIcon,
    Person as PersonIcon, Schedule as RecentIcon, Search as SearchIcon, Star as StarIcon, SwapVert as SortIcon,
    VisibilityOff as SecretIcon,
} from '@mui/icons-material'
import { WIKI_KINDS, type WikiKind, type WikiMissing, type WikiSummary } from '../../../services/wiki'
import { bodySerif, chrome, core, displayFont, gold, green, greenInk, ink, parchment, rule, status, WIKI_KIND_COLORS } from '../../../theme'
import { KIND_LABEL } from '../kinds'
import { sortPages, type WikiSort } from '../useWiki'
import { KindSwatch, PageBadges, PageThumb } from './KindIcon'
import { RecentChanges } from './WikiList'
import type { WikiHomeView } from './WikiNav'
import { tr } from '../../../i18n'

// O Início da Wiki: o nome da mesa, as páginas em cartões (com filtro por tipo e ordem), os atalhos
// (Recentes, Favoritas, Travadas) e os nomes citados que ainda não têm página — cada um vira página nova
// já ligada. No celular, cabeçalho escuro, atalhos em pílulas e grupos por tipo que recolhem.

interface Props {
    pages: WikiSummary[]
    authors: Record<string, string>
    mesaName: string
    view: WikiHomeView
    wide: boolean
    favorites: string[]
    mine: boolean
    sort: WikiSort
    missing: WikiMissing[] | null
    onSort: (s: WikiSort) => void
    onMine: (v: boolean) => void
    onView: (v: WikiHomeView) => void
    onOpen: (id: string) => void
    onNew: (title?: string, kind?: WikiKind) => void
    onSearch: () => void
    onTrash?: () => void
}

const KIND_VIEW = new Set<string>(WIKI_KINDS)
const MISSING_SHOWN = { wide: 24, narrow: 5 }

const viewTitle = (v: WikiHomeView) => (v === 'recent' ? tr('Recentes', 'Recent')
    : v === 'favorites' ? tr('Favoritas', 'Favorites')
    : v === 'locked' ? tr('Travadas', 'Locked')
    : tr('Páginas', 'Pages'))

export const WikiHome = memo(function WikiHome(props: Props) {
    const { pages, authors, mesaName, view, wide, favorites, sort, missing, onSort, onView, onOpen, onNew } = props
    const kind = KIND_VIEW.has(view) ? view as WikiKind : null
    const shown = useMemo(() => sortPages(pages.filter((p) => (
        view === 'favorites' ? favorites.includes(p.id)
            : view === 'locked' ? p.locked
            : kind ? p.kind === kind
            : true
    )), sort), [pages, view, kind, favorites, sort])
    const counts = useMemo(() => WIKI_KINDS.map((k) => [k, pages.filter((p) => p.kind === k).length] as const).filter(([, n]) => n > 0), [pages])
    const countLine = [
        pages.length === 1 ? tr('1 página', '1 page') : tr(`${pages.length} páginas`, `${pages.length} pages`),
        ...counts.map(([k, n]) => {
            const label = n === 1 ? KIND_LABEL[k].one : KIND_LABEL[k].many
            // Sigla (NPC) fica como está; o resto vai em minúscula no meio da frase.
            return `${n} ${/^[A-Z]{2,}/.test(label) ? label : label.toLowerCase()}`
        }),
    ].join(' · ')

    const sortButton = (
        <Button
            onClick={() => onSort(sort === 'title' ? 'recent' : 'title')}
            endIcon={wide ? <SortIcon /> : undefined}
            startIcon={wide ? undefined : <SortIcon />}
            sx={wide
                ? { height: 44, px: 1.75, borderRadius: 1.5, border: `1px solid ${rule}`, bgcolor: parchment.paper, color: ink.primary, fontWeight: 600 }
                : { color: ink.secondary, fontWeight: 600, px: 0.5 }}
        >
            {sort === 'recent' ? tr('Editadas por último', 'Last edited') : tr('Em ordem alfabética', 'Alphabetical')}</Button>
    )

    const missingSection = missing && missing.length > 0 && view === 'home' && (
        <MissingSection missing={missing} wide={wide} onCreate={(name) => onNew(name)} />
    )

    if (!wide) return <MobileHome {...props} shown={shown} kind={kind} sortButton={sortButton} missingSection={missingSection} />

    return (
        <Box sx={{ minWidth: 0, maxWidth: 1060, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 4.5, pt: 1 }}>
            <Box component="header" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: gold.deep }}>{tr('Wiki da campanha', 'Campaign wiki')}</Typography>
                    <Typography component="h1" sx={{ m: 0, fontFamily: displayFont, fontWeight: 700, fontSize: '2.5rem', lineHeight: 1.1, color: greenInk.main, overflowWrap: 'anywhere' }}>{mesaName}</Typography>
                    <Typography sx={{ color: ink.secondary }}>{countLine}</Typography>
                </Box>
                <Button startIcon={<AddIcon sx={{ color: gold.bright }} />} onClick={() => onNew(undefined, kind ?? undefined)} sx={{ height: 48, px: 2.5, borderRadius: 1.75, bgcolor: green.main, color: chrome.text, fontWeight: 600, '&:hover': { bgcolor: green.mid } }}>
                    {tr('Nova página', 'New page')}</Button>
            </Box>

            <Box component="section" aria-labelledby="wiki-home-pages" sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                    <Typography id="wiki-home-pages" component="h2" sx={{ m: 0, fontFamily: displayFont, fontWeight: 600, fontSize: '1.4rem', color: greenInk.main }}>
                        {kind ? KIND_LABEL[kind].many : viewTitle(view)}</Typography>
                    {view !== 'recent' && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
                            {(view === 'home' || kind) && counts.length > 1 && (
                                <Box role="group" aria-label={tr('Filtrar por tipo', 'Filter by type')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 0.5, borderRadius: 1.5, bgcolor: parchment.sunken }}>
                                    {[null, ...counts.map(([k]) => k)].map((k) => {
                                        const on = k === kind
                                        return (
                                            <Box key={k ?? 'all'} component="button" type="button" aria-pressed={on} onClick={() => onView(k ?? 'home')} sx={{
                                                height: 36, px: 1.75, borderRadius: 1.1, border: 0, font: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                                                ...(on ? { bgcolor: parchment.paper, color: greenInk.main, boxShadow: `0 1px 2px ${core.fx.shadowHover}` } : { bgcolor: 'transparent', color: ink.secondary }),
                                            }}>{k ? KIND_LABEL[k].many : tr('Todas', 'All')}</Box>
                                        )
                                    })}
                                </Box>
                            )}
                            {sortButton}
                        </Box>
                    )}
                </Box>

                {view === 'recent'
                    ? <Box sx={{ bgcolor: parchment.paper, border: `1px solid ${rule}`, borderRadius: 2.5, p: 1.5 }}><RecentChanges pages={pages} authors={authors} onOpen={onOpen} /></Box>
                    : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                            {shown.map((p) => <PageCard key={p.id} page={p} onOpen={onOpen} />)}
                            {(view === 'home' || kind) && (
                                <Box component="button" type="button" onClick={() => onNew(undefined, kind ?? undefined)} sx={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, minHeight: 320, p: 2.5,
                                    borderRadius: 2.5, border: `2px dashed ${rule}`, bgcolor: 'transparent', font: 'inherit', cursor: 'pointer', color: ink.secondary,
                                    '&:hover': { borderColor: gold.main },
                                }}>
                                    <Box aria-hidden="true" sx={{ width: 56, height: 56, borderRadius: 999, bgcolor: parchment.sunken, display: 'flex', alignItems: 'center', justifyContent: 'center', color: greenInk.main }}><AddIcon /></Box>
                                    <Box component="span" sx={{ fontWeight: 700, fontSize: '1rem', color: greenInk.main }}>{tr('Criar página', 'Create page')}</Box>
                                    <Box component="span" sx={{ fontSize: '0.875rem' }}>{kind ? KIND_LABEL[kind].one : tr('NPC, local, item…', 'NPC, place, item…')}</Box>
                                </Box>
                            )}
                            {shown.length === 0 && view !== 'home' && !kind && <EmptyView view={view} />}
                        </Box>
                    )}
            </Box>

            {missingSection}
        </Box>
    )
})

function EmptyView({ view }: { view: WikiHomeView }) {
    return (
        <Typography sx={{ gridColumn: '1 / -1', color: ink.secondary, fontStyle: 'italic', py: 2 }}>
            {view === 'favorites'
                ? tr('Nenhuma favorita ainda. Toque na estrela de uma página para ela aparecer aqui (vale para este aparelho).', 'No favorites yet. Tap the star on a page to keep it here (on this device).')
                : tr('Nenhuma página travada.', 'No locked page.')}
        </Typography>
    )
}

/** O cartão de uma página no Início do desktop: capa (ou o pontilhado do tipo), nome, resumo e pílulas. */
function PageCard({ page: p, onOpen }: { page: WikiSummary; onOpen: (id: string) => void }) {
    const color = WIKI_KIND_COLORS[p.kind]
    return (
        <Box component="button" type="button" onClick={() => onOpen(p.id)} sx={{
            display: 'flex', flexDirection: 'column', p: 0, textAlign: 'left', font: 'inherit', cursor: 'pointer', color: ink.primary,
            borderRadius: 2.5, bgcolor: parchment.paper, border: `1px solid ${rule}`, overflow: 'hidden', boxShadow: `0 6px 18px ${core.fx.shadowSoft}`,
            '&:hover': { borderColor: gold.main },
        }}>
            <Box sx={{ position: 'relative', width: 1, height: 210 }}>
                <PageThumb page={p} size={220} height={210} cover />
                <Box component="span" sx={{
                    position: 'absolute', left: 12, top: 12, display: 'flex', alignItems: 'center', height: 26, px: 1.25, borderRadius: 999,
                    fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                    ...(p.image ? { bgcolor: green.deepest, color: chrome.text } : { bgcolor: color, color: chrome.onAccent }),
                }}>{KIND_LABEL[p.kind].one}</Box>
                {(p.locked || p.visibility === 'gm') && (
                    <Box component="span" sx={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 0.5 }}>
                        {p.visibility === 'gm' && <Box component="span" title={tr('Só o mestre vê', 'GM only')} sx={roundIcon}><SecretIcon sx={{ fontSize: 15, color: gold.deep }} /></Box>}
                        {p.locked && <Box component="span" title={tr('Travada', 'Locked')} sx={roundIcon}><LockIcon sx={{ fontSize: 14, color: gold.deep }} /></Box>}
                    </Box>
                )}
            </Box>
            <Box sx={{ p: 2, pb: 2.25, display: 'flex', flexDirection: 'column', gap: 1, flex: 1, width: 1, boxSizing: 'border-box' }}>
                <Box sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2, color: greenInk.main, overflowWrap: 'anywhere' }}>{p.title}</Box>
                {p.summary && <Box sx={{ fontFamily: bodySerif, fontSize: '1rem', lineHeight: 1.4, color: ink.secondary, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.summary}</Box>}
                <Box sx={{ mt: 'auto', pt: 0.5 }}><PageBadges badges={p.badges} size="medium" /></Box>
            </Box>
        </Box>
    )
}

const roundIcon = { width: 28, height: 28, borderRadius: 999, bgcolor: parchment.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const

/** "Citados, mas ainda sem página": cada nome vira página nova (e os links para ele deixam de ser vermelhos). */
function MissingSection({ missing, wide, onCreate }: { missing: WikiMissing[]; wide: boolean; onCreate: (name: string) => void }) {
    const [all, setAll] = useState(false)
    const limit = wide ? MISSING_SHOWN.wide : MISSING_SHOWN.narrow
    const list = all ? missing : missing.slice(0, limit)
    return (
        <Box component="section" aria-labelledby="wiki-missing" sx={{ borderRadius: { xs: 2.25, md: 2.75 }, bgcolor: parchment.sunken, p: { xs: 2, md: '24px 26px' }, display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography id="wiki-missing" component="h2" sx={{ m: 0, fontFamily: displayFont, fontWeight: 600, fontSize: { xs: '1.05rem', md: '1.25rem' }, color: greenInk.main }}>
                        {wide ? tr('Citados, mas ainda sem página', 'Mentioned, but no page yet') : tr('Citados, mas sem página', 'Mentioned, but no page')}</Typography>
                    <Typography sx={{ fontSize: { xs: '0.875rem', md: '0.95rem' }, color: ink.secondary }}>
                        {wide ? tr('Nomes que aparecem nos artigos. Clique para criar a página já ligada.', 'Names that show up in the articles. Click to create the page, already linked.')
                            : tr('Toque para criar a página já ligada.', 'Tap to create the page, already linked.')}</Typography>
                </Box>
                {wide && <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: ink.secondary }}>{missing.length === 1 ? tr('1 nome', '1 name') : tr(`${missing.length} nomes`, `${missing.length} names`)}</Typography>}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {list.map((m) => (
                    <Box key={m.name} component="button" type="button" onClick={() => onCreate(m.name)}
                        title={tr(`Citado em ${m.from.map((f) => f.title).join(', ')}`, `Mentioned in ${m.from.map((f) => f.title).join(', ')}`)}
                        sx={{
                            display: 'flex', alignItems: 'center', gap: 0.75, height: { xs: 40, md: 38 }, px: 1.75, borderRadius: 999, cursor: 'pointer',
                            border: `1.5px dashed ${status.error}`, bgcolor: parchment.paper, color: ink.primary, font: 'inherit', fontSize: '0.875rem', fontWeight: 600,
                        }}>
                        <AddIcon sx={{ fontSize: 16, color: status.error }} />{m.name}
                    </Box>
                ))}
                {missing.length > limit && (
                    <Box component="button" type="button" onClick={() => setAll(!all)} sx={{ height: 40, px: 1.5, border: 0, bgcolor: 'transparent', color: gold.deep, font: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
                        {all ? tr('Ver menos', 'Show less') : tr(`Ver mais ${missing.length - limit}`, `Show ${missing.length - limit} more`)}</Box>
                )}
            </Box>
        </Box>
    )
}

/** O Início no celular. */
function MobileHome(props: Props & { shown: WikiSummary[]; kind: WikiKind | null; sortButton: ReactNode; missingSection: ReactNode }) {
    const { pages, authors, mesaName, view, favorites, mine, onMine, onView, onOpen, onNew, onSearch, onTrash, shown, kind, sortButton, missingSection } = props
    const navigate = useNavigate()
    const [closed, setClosed] = useState<Set<WikiKind>>(new Set())
    const groups = WIKI_KINDS.map((k) => [k, shown.filter((p) => p.kind === k)] as const).filter(([, l]) => l.length > 0)
    const locked = pages.filter((p) => p.locked).length
    const favCount = pages.filter((p) => favorites.includes(p.id)).length

    const chip = (key: string, icon: ReactNode, text: string, on: boolean, click: () => void) => (
        <Box key={key} component="button" type="button" aria-pressed={on} onClick={click} sx={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 1, height: 42, px: 1.75, borderRadius: 999, font: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            ...(on ? { bgcolor: green.main, color: chrome.text, border: `1px solid ${green.main}`, '& svg': { fontSize: 16, color: gold.bright } } : { bgcolor: parchment.paper, color: greenInk.main, border: `1px solid ${rule}`, '& svg': { fontSize: 16, color: gold.deep } }),
        }}>{icon}{text}</Box>
    )
    const toggleView = (v: WikiHomeView) => onView(view === v ? 'home' : v)

    return (
        <Box sx={{ minWidth: 0 }}>
            <Box component="header" sx={{ bgcolor: green.deepest, color: chrome.text, borderRadius: 3, px: 2, pt: 1.25, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box component="button" type="button" aria-label={tr('Voltar ao início', 'Back to home')} onClick={() => navigate('/')} sx={{ width: 44, height: 44, ml: -1, borderRadius: 1.5, border: 0, bgcolor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <BackIcon sx={{ fontSize: 18, color: gold.bright }} /></Box>
                    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <Typography component="h1" sx={{ m: 0, fontFamily: displayFont, fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.1, color: chrome.text }}>{tr('Wiki', 'Wiki')}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: chrome.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {mesaName} · {pages.length === 1 ? tr('1 página', '1 page') : tr(`${pages.length} páginas`, `${pages.length} pages`)}</Typography>
                    </Box>
                    <Box component="button" type="button" aria-label={tr('Nova página', 'New page')} onClick={() => onNew(undefined, kind ?? undefined)} sx={{ width: 44, height: 44, borderRadius: 1.5, border: 0, bgcolor: gold.bright, color: green.deepest, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <AddIcon /></Box>
                </Box>
                <Box component="button" type="button" onClick={onSearch} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, height: 50, px: 1.75, borderRadius: 1.75, cursor: 'pointer', font: 'inherit', fontSize: 16, textAlign: 'left',
                    bgcolor: chrome.raised, border: `1px solid ${chrome.line}`, color: chrome.textMuted,
                }}>
                    <SearchIcon sx={{ fontSize: 18, color: gold.bright }} />{tr('Buscar NPC, local, item ou trecho…', 'Search NPC, place, item or passage…')}
                </Box>
            </Box>

            <Box sx={{ pt: 2.25, display: 'flex', flexDirection: 'column', gap: 2.75 }}>
                <Box component="nav" aria-label={tr('Atalhos da Wiki', 'Wiki shortcuts')} sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: { xs: -1.5, sm: -3 }, px: { xs: 1.5, sm: 3 } }}>
                    {chip('recent', <RecentIcon />, tr('Recentes', 'Recent'), view === 'recent', () => toggleView('recent'))}
                    {chip('favorites', <StarIcon />, favCount ? tr(`Favoritas · ${favCount}`, `Favorites · ${favCount}`) : tr('Favoritas', 'Favorites'), view === 'favorites', () => toggleView('favorites'))}
                    {chip('locked', <LockIcon />, locked ? tr(`Travadas · ${locked}`, `Locked · ${locked}`) : tr('Travadas', 'Locked'), view === 'locked', () => toggleView('locked'))}
                    {chip('mine', <PersonIcon />, tr('Só as minhas', 'Only mine'), mine, () => onMine(!mine))}
                    {onTrash && chip('trash', <TrashIcon />, tr('Lixeira', 'Trash'), false, onTrash)}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography component="h2" sx={{ m: 0, fontFamily: displayFont, fontWeight: 600, fontSize: '1.25rem', color: greenInk.main }}>
                            {kind ? KIND_LABEL[kind].many : viewTitle(view)}</Typography>
                        {view !== 'recent' && sortButton}
                    </Box>
                    {view === 'recent'
                        ? <Box sx={{ bgcolor: parchment.paper, border: `1px solid ${rule}`, borderRadius: 2.25, p: 1 }}><RecentChanges pages={pages} authors={authors} onOpen={onOpen} /></Box>
                        : groups.length === 0
                            ? (
                                view === 'home' && !kind
                                    ? <Typography sx={{ color: ink.secondary, fontStyle: 'italic' }}>{tr('A Wiki está vazia. Crie a primeira página: um NPC, a cidade onde tudo começou…', 'The wiki is empty. Create the first page: an NPC, the city where it all began…')}</Typography>
                                    : <EmptyView view={view} />
                            )
                            : groups.map(([k, list]) => {
                                const open = !closed.has(k)
                                return (
                                    <Box key={k} sx={{ borderRadius: 2.25, bgcolor: parchment.paper, border: `1px solid ${rule}`, overflow: 'hidden' }}>
                                        <Box component="button" type="button" aria-expanded={open}
                                            onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n })}
                                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: 1, minHeight: 52, px: 1.75, border: 0, bgcolor: 'transparent', font: 'inherit', fontSize: '1rem', fontWeight: 700, color: greenInk.main, cursor: 'pointer', textAlign: 'left' }}>
                                            <KindSwatch kind={k} size={28} />{KIND_LABEL[k].many}
                                            <Box component="span" sx={{ ml: 'auto', fontSize: '0.8125rem', fontWeight: 600, color: ink.secondary }}>{list.length}</Box>
                                            <ExpandMore aria-hidden="true" sx={{ fontSize: 18, color: ink.secondary, transform: open ? 'rotate(180deg)' : 'none' }} />
                                        </Box>
                                        {open && list.map((p) => <MobileRow key={p.id} page={p} onOpen={onOpen} />)}
                                    </Box>
                                )
                            })}
                </Box>

                {missingSection}
            </Box>
        </Box>
    )
}

function MobileRow({ page: p, onOpen }: { page: WikiSummary; onOpen: (id: string) => void }) {
    return (
        <Box component="button" type="button" onClick={() => onOpen(p.id)} sx={{
            display: 'flex', alignItems: p.image ? 'flex-start' : 'center', gap: 1.75, width: 1, px: 1.75, pt: 1.5, pb: 1.75, border: 0, borderTop: `1px solid ${rule}`,
            bgcolor: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: ink.primary,
        }}>
            <PageThumb page={p} size={60} height={p.image ? 72 : 60} ring={!!p.image} />
            <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontFamily: displayFont, fontWeight: 700, fontSize: '1rem', color: greenInk.main, minWidth: 0 }}>
                    <Box component="span" sx={{ overflowWrap: 'anywhere' }}>{p.title}</Box>
                    {p.visibility === 'gm' && <SecretIcon sx={{ fontSize: 13, color: gold.deep, flex: 'none' }} aria-label={tr('Só o mestre vê', 'GM only')} />}
                    {p.locked && <LockIcon sx={{ fontSize: 13, color: gold.deep, flex: 'none' }} aria-label={tr('Travada', 'Locked')} />}
                </Box>
                {p.summary && <Box component="span" sx={{ fontFamily: bodySerif, fontSize: '1rem', lineHeight: 1.35, color: ink.secondary }}>{p.summary}</Box>}
                <PageBadges badges={p.badges} />
            </Box>
            <ChevronRight aria-hidden="true" sx={{ color: gold.deep, flex: 'none', alignSelf: 'center' }} />
        </Box>
    )
}
