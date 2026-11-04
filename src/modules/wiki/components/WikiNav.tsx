import { memo, useMemo, useState, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import {
    Add as AddIcon, ChevronRight, DeleteSweep as TrashIcon, Home as HomeIcon, Lock as LockIcon, MenuBook as WikiIcon,
    Schedule as RecentIcon, Search as SearchIcon, SwapVert as SortIcon, Star as StarIcon, VisibilityOff as SecretIcon,
} from '@mui/icons-material'
import { WIKI_KINDS, type WikiKind, type WikiSummary } from '../../../services/wiki'
import { chrome, displayFont, gold, green, greenInk, ink, parchment, rule } from '../../../theme'
import { KIND_LABEL } from '../kinds'
import { sortPages, type WikiSort } from '../useWiki'
import { KindSwatch, PageThumb } from './KindIcon'
import { tr } from '../../../i18n'

// A navegação da Wiki no desktop: nome da mesa e "Nova", a busca (⌘K), os atalhos (Início, Recentes,
// Favoritas, Travadas e, para o GM, a Lixeira) e a árvore de páginas por tipo.

/** O que o Início mostra: tudo, um atalho ou um tipo. */
export type WikiHomeView = 'home' | 'recent' | 'favorites' | 'locked' | WikiKind

interface Props {
    pages: WikiSummary[]
    selected: string | null
    view: WikiHomeView | null
    mesaName: string
    favorites: string[]
    mine: boolean
    sort: WikiSort
    onSort: (s: WikiSort) => void
    onMine: (v: boolean) => void
    onOpen: (id: string) => void
    onView: (v: WikiHomeView) => void
    onNew: () => void
    onSearch: () => void
    onTrash?: () => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export const WikiNav = memo(function WikiNav(props: Props) {
    const { pages, selected, view, mesaName, favorites, mine, sort, onSort, onMine, onOpen, onView, onNew, onSearch, onTrash } = props
    const [closed, setClosed] = useState<Set<WikiKind>>(new Set())
    const groups = useMemo(() => WIKI_KINDS
        .map((k) => [k, sortPages(pages.filter((p) => p.kind === k), sort)] as const)
        .filter(([, list]) => list.length > 0), [pages, sort])
    const locked = pages.filter((p) => p.locked).length
    const favCount = pages.filter((p) => favorites.includes(p.id)).length

    const shortcut = (key: WikiHomeView | 'trash', icon: ReactNode, text: string, count: number | null, onClick: () => void) => {
        const on = key === view
        return (
            <Box key={key} component="button" type="button" aria-current={on ? 'page' : undefined} onClick={onClick} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 40, px: 1.25, border: 0, borderRadius: 1.25, width: 1,
                font: 'inherit', fontSize: '0.95rem', fontWeight: on ? 600 : 400, textAlign: 'left', cursor: 'pointer',
                bgcolor: on ? green.main : 'transparent', color: on ? chrome.text : ink.primary,
                '& svg': { fontSize: 18, color: on ? gold.bright : gold.deep },
                '&:hover': { bgcolor: on ? green.main : parchment.sunken },
            }}>
                {icon}{text}
                {count !== null && <Box component="span" sx={{ ml: 'auto', fontSize: '0.75rem', fontWeight: 600, color: on ? chrome.textSoft : ink.secondary }}>{count}</Box>}
            </Box>
        )
    }

    return (
        <Box component="nav" aria-label={tr('Navegação da Wiki', 'Wiki navigation')} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, minHeight: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5 }}>
                <Box aria-hidden="true" sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: green.main, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <WikiIcon sx={{ fontSize: 20, color: gold.bright }} /></Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <Typography component="span" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.25rem', color: greenInk.main, lineHeight: 1.2 }}>{tr('Wiki', 'Wiki')}</Typography>
                    <Typography component="span" sx={{ fontSize: '0.8125rem', color: ink.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mesaName}</Typography>
                </Box>
                <Box component="button" type="button" aria-label={tr('Nova página', 'New page')} title={tr('Nova página', 'New page')} onClick={onNew} sx={{
                    width: 40, height: 40, borderRadius: 1.5, border: 0, bgcolor: gold.bright, color: green.deepest, cursor: 'pointer', flex: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', '&:hover': { bgcolor: gold.main },
                }}><AddIcon /></Box>
            </Box>

            <Box component="button" type="button" onClick={onSearch} sx={{
                display: 'flex', alignItems: 'center', gap: 1.25, height: 46, px: 1.5, borderRadius: 1.75, cursor: 'pointer', font: 'inherit', textAlign: 'left',
                bgcolor: parchment.paper, border: `1px solid ${rule}`, color: ink.secondary, fontSize: '0.95rem',
            }}>
                <SearchIcon sx={{ fontSize: 18, color: gold.deep }} />
                <Box component="span" sx={{ flex: 1 }}>{tr('Buscar na Wiki…', 'Search the wiki…')}</Box>
                <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, px: 0.9, py: '2px', borderRadius: 0.75, border: `1px solid ${rule}` }}>{isMac ? '⌘K' : 'Ctrl K'}</Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {shortcut('home', <HomeIcon />, tr('Início da Wiki', 'Wiki home'), null, () => onView('home'))}
                {shortcut('recent', <RecentIcon />, tr('Recentes', 'Recent'), null, () => onView('recent'))}
                {shortcut('favorites', <StarIcon />, tr('Favoritas', 'Favorites'), favCount || null, () => onView('favorites'))}
                {shortcut('locked', <LockIcon />, tr('Travadas', 'Locked'), locked || null, () => onView('locked'))}
                {onTrash && shortcut('trash', <TrashIcon />, tr('Lixeira', 'Trash'), null, onTrash)}
            </Box>

            <Box aria-hidden="true" sx={{ height: '1px', bgcolor: rule, mx: 0.75 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: 1.25, pr: 0.5, pb: 0.25 }}>
                    <Typography component="h2" sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: ink.secondary }}>
                        {tr('Páginas', 'Pages')} · {pages.length}</Typography>
                    <Box component="button" type="button" onClick={() => onSort(sort === 'title' ? 'recent' : 'title')}
                        aria-label={sort === 'title' ? tr('Ordenar pelas editadas por último', 'Sort by last edited') : tr('Ordenar por nome', 'Sort by name')}
                        title={sort === 'title' ? tr('Em ordem alfabética', 'Alphabetical') : tr('Editadas por último', 'Last edited')}
                        sx={{ width: 32, height: 32, borderRadius: 1, border: 0, bgcolor: 'transparent', color: ink.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', '&:hover': { bgcolor: parchment.sunken } }}>
                        <SortIcon sx={{ fontSize: 17 }} /></Box>
                </Box>
                {pages.length === 0 && (
                    <Typography variant="body2" sx={{ px: 1.25, py: 1, color: ink.secondary, fontStyle: 'italic' }}>
                        {mine ? tr('Você ainda não criou nenhuma página.', 'You haven\'t created any page yet.') : tr('A Wiki está vazia.', 'The wiki is empty.')}</Typography>
                )}
                {groups.map(([k, list]) => {
                    const open = !closed.has(k)
                    return (
                        <Box key={k}>
                            <Box component="button" type="button" aria-expanded={open}
                                onClick={() => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n })}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 1.25, width: 1, minHeight: 40, px: 1.25, border: 0, borderRadius: 1.25, cursor: 'pointer',
                                    font: 'inherit', fontSize: '0.95rem', fontWeight: 600, color: greenInk.main, bgcolor: 'transparent', textAlign: 'left',
                                    '&:hover': { bgcolor: parchment.sunken },
                                }}>
                                <ChevronRight aria-hidden="true" sx={{ fontSize: 18, color: ink.secondary, transform: open ? 'rotate(90deg)' : 'none' }} />
                                <KindSwatch kind={k} />
                                {KIND_LABEL[k].many}
                                <Box component="span" sx={{ ml: 'auto', fontSize: '0.75rem', fontWeight: 600, color: ink.secondary }}>{list.length}</Box>
                            </Box>
                            {open && (
                                <Box sx={{ ml: 2, pl: 1.5, pt: '2px', pb: 0.75, borderLeft: `1.5px solid ${rule}`, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {list.map((p) => {
                                        const on = p.id === selected
                                        return (
                                            <Box key={p.id} component="button" type="button" onClick={() => onOpen(p.id)} aria-current={on ? 'page' : undefined} sx={{
                                                display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 44, pl: 0.75, pr: 1.25, border: 0, borderRadius: 1.5, width: 1,
                                                font: 'inherit', fontSize: '0.875rem', textAlign: 'left', cursor: 'pointer',
                                                bgcolor: on ? parchment.paper : 'transparent', color: on ? greenInk.main : ink.primary, fontWeight: on ? 700 : 400,
                                                boxShadow: on ? `0 0 0 1.5px ${gold.bright}` : 'none',
                                                '&:hover': { bgcolor: on ? parchment.paper : parchment.sunken },
                                            }}>
                                                <PageThumb page={p} size={30} round />
                                                <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</Box>
                                                {p.visibility === 'gm' && <SecretIcon sx={{ fontSize: 13, color: gold.deep }} aria-label={tr('Só o mestre vê', 'GM only')} />}
                                                {p.locked && <LockIcon sx={{ fontSize: 13, color: gold.deep }} aria-label={tr('Travada', 'Locked')} />}
                                            </Box>
                                        )
                                    })}
                                </Box>
                            )}
                        </Box>
                    )
                })}
            </Box>

            <Box component="label" sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 44, pt: 1.5, px: 1.25, borderTop: `1px solid ${rule}`, fontSize: '0.875rem', color: ink.primary, cursor: 'pointer' }}>
                <Box component="input" type="checkbox" checked={mine} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onMine(e.target.checked)} sx={{ width: 18, height: 18, m: 0, accentColor: green.main }} />
                {tr('Mostrar só as minhas páginas', 'Show only my pages')}
            </Box>
        </Box>
    )
})
