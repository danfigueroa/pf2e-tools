import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert, Box, Button, Chip, IconButton, Link, ListItemIcon, Menu, MenuItem, Stack, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import {
    AccountTree as ParentIcon, ArrowBackIosNew as BackIcon, AutoAwesome as LoreIcon, Campaign as ShareIcon, Delete as DeleteIcon,
    Edit as EditIcon, Event as EventIcon, ExpandMore, Favorite as HeartIcon, History as HistoryIcon, Lock as LockIcon,
    LockOpen as UnlockIcon, MenuBook as BookIcon, MoreHoriz as MoreIcon, OpenInNew, Person as PersonIcon, Place as PlaceIcon,
    Shield as ShieldIcon, Visibility as RevealIcon, VisibilityOff as SecretIcon, ZoomIn,
} from '@mui/icons-material'
import { Markdown } from '../../../components/markdown/Markdown'
import { headingsOf, splitSegments } from '../../../components/markdown/blocks'
import { ImageLightbox } from '../../../components/ImageLightbox'
import { KindGlyph, KindTile } from './KindIcon'
import { useImageUrl } from '../../../services/images'
import { searchCreatures } from '../../../services/creatures'
import { fetchJournalList } from '../../../services/journal'
import type { WikiPageView, WikiSummary } from '../../../services/wiki'
import { npcFromCreature } from '../../initiative-tracker/importCharacter'
import { appendCombatants } from '../../initiative-tracker/encounterStorage'
import { bodySerif, chrome, core, displayFont, gold, green, greenInk, ink, parchment, rule, status } from '../../../theme'
import { INFOBOX, KIND_LABEL, PARENT_LABEL, type FieldDef } from '../kinds'
import { authorName, formatWhen, trailOf } from '../useWiki'
import { tr } from '../../../i18n'
import { MOBILE_HEADER_HEIGHT } from '../../../layouts/navigation'

// Uma página da Wiki, para ler. Desktop: cabeçalho (trilha, selos, título, resumo, ações), o artigo e, ao
// lado, a ficha escura com o retrato e o sumário "Nesta página" (que acompanha a rolagem). Celular: a capa
// escura (retrato, selos, nome, situação, "Mostrar à mesa"/"Editar"), a ficha clara recolhível, o sumário em
// pílulas e o artigo. O retrato amplia ao toque e, para o GM, vai para a tela da mesa com o nome da página.

interface Props {
    view: WikiPageView
    pages: WikiSummary[]
    authors: Record<string, string>
    isGm: boolean
    onOpen: (id: string) => void
    onLink: (target: string) => void
    resolveLink: (target: string) => 'known' | 'wiki' | 'missing'
    /** Volta ao índice da Wiki (a trilha e o "‹ Wiki" do celular). */
    onHome: () => void
    onEdit: () => void
    onHistory: () => void
    onDelete: () => void
    onFlags: (flags: { locked?: boolean; visibility?: 'public' | 'gm' }) => void
    /** Mostra à mesa a página inteira ou, com `image`, só essa imagem e o nome da página. */
    onShow: (image?: string) => void
    onNotice: (text: string, action?: { label: string; go: () => void }) => void
}

const pill = {
    display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 28, px: 1.5, borderRadius: 999, fontSize: '0.8125rem',
    fontWeight: 600, whiteSpace: 'nowrap',
} as const

const kicker = { fontSize: '0.75rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: gold.deep } as const

/** Situação e atitude viram pílula (embaixo do nome), não linha da ficha. */
const PILL_FIELDS = new Set(['status', 'attitude'])
/** Campos curtos: vão lado a lado, com o tipo, no topo da ficha. */
const GRID_FIELDS = new Set(['ancestry', 'type', 'level', 'rarity', 'population'])
const FIELD_ICONS: Record<string, typeof PlaceIcon> = {
    role: BookIcon, location: PlaceIcon, where: PlaceIcon, habitat: PlaceIcon, base: PlaceIcon, faction: ShieldIcon,
    leader: PersonIcon, ruler: PersonIcon, holder: PersonIcon, domains: LoreIcon, edicts: LoreIcon, anathema: LoreIcon,
    when: EventIcon, session: EventIcon,
}
/** Atitudes boas ganham o coração na pílula. */
const FRIENDLY = /^(aliad|amist|ally|friend)/i
/** Situações "de pé" ganham o ponto verde; as outras, o ponto apagado. */
const ALIVE = /^(viv|aliv)/i

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

/** A seção em que a leitura está: o último título que já passou do topo da tela (ou o primeiro). */
function useActiveSection(ids: string[]): string | null {
    const [active, setActive] = useState<string | null>(ids[0] ?? null)
    const key = ids.join('|')
    useEffect(() => {
        const list = key ? key.split('|') : []
        if (!list.length) { setActive(null); return }
        let frame = 0
        const update = () => {
            frame = 0
            let current = list[0]
            for (const id of list) {
                const el = document.getElementById(id)
                if (el && el.getBoundingClientRect().top <= 140) current = id
            }
            // No fim da página, o último item (que pode nunca chegar ao topo).
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = list[list.length - 1]
            setActive(current)
        }
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
        update()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            if (frame) cancelAnimationFrame(frame)
        }
    }, [key])
    return active
}

export const WikiView = memo(function WikiView(props: Props) {
    const { view, pages, authors, isGm, onOpen, onLink, resolveLink, onShow, onHome } = props
    const { page, backlinks } = view
    const theme = useTheme()
    const wide = useMediaQuery(theme.breakpoints.up('md'))
    const image = useImageUrl(page.image)
    const [zoomed, setZoomed] = useState(false)
    const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
    const trail = useMemo(() => trailOf(page.id, byId), [page.id, byId])
    const children = useMemo(() => pages.filter((p) => p.parent === page.id).sort((a, b) => a.title.localeCompare(b.title)), [pages, page.id])
    const names = { ...authors, ...view.authors }
    const secrets = useMemo(() => splitSegments(page.body).filter((s) => s.kind === 'gm').length, [page.body])
    const role = page.kind === 'npc' ? page.fields.role?.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').trim() : ''
    const linked = useMemo(() => {
        const seen = new Set<string>()
        const out: { id: string; title: string; kind: WikiSummary['kind']; why: string }[] = []
        for (const c of children) { seen.add(c.id); out.push({ id: c.id, title: c.title, kind: c.kind, why: tr(`dentro de ${page.title}`, `inside ${page.title}`) }) }
        for (const b of backlinks) { if (!seen.has(b.id)) { seen.add(b.id); out.push({ id: b.id, title: b.title, kind: b.kind, why: tr(`cita ${page.title}`, `mentions ${page.title}`) }) } }
        return out
    }, [children, backlinks, page.title])
    const toc = useMemo(() => [
        ...headingsOf(page.body).map((h) => ({ ...h, text: h.gm ? (h.text || tr('Trecho do mestre', 'GM-only part')) : h.text })),
        { level: 2 as const, text: tr('Páginas ligadas', 'Linked pages'), id: 'wiki-ligadas', gm: false },
    ], [page.body])
    const active = useActiveSection(toc.map((t) => t.id))
    const pillFields = INFOBOX[page.kind].filter((f) => PILL_FIELDS.has(f.key) && page.fields[f.key])
    const showImage = isGm ? () => { onShow(page.image ?? undefined); setZoomed(false) } : undefined

    const statusPills = pillFields.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={wide ? 'center' : 'flex-start'}>
            {pillFields.map((f) => {
                const v = page.fields[f.key]
                return f.key === 'status'
                    ? (
                        <Box key={f.key} component="span" sx={{ ...pill, height: 32, fontSize: '0.875rem', bgcolor: chrome.active, color: chrome.textSoft }}>
                            <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: ALIVE.test(v) ? chrome.online : chrome.textMuted }} />{v}
                        </Box>
                    )
                    : (
                        <Box key={f.key} component="span" sx={{ ...pill, height: 32, fontSize: '0.875rem', bgcolor: gold.bright, color: green.deepest, fontWeight: 700 }}>
                            {FRIENDLY.test(v) && <HeartIcon sx={{ fontSize: 15 }} />}{v}
                        </Box>
                    )
            })}
        </Stack>
    )

    const portrait = image && (
        <Box sx={{ position: 'relative', borderRadius: 2.5, p: '4px', bgcolor: gold.bright }}>
            <Box
                component="button"
                type="button"
                onClick={() => setZoomed(true)}
                aria-label={tr(`Ampliar a imagem de ${page.title}`, `Enlarge the image of ${page.title}`)}
                title={tr('Ampliar', 'Enlarge')}
                sx={{ display: 'block', width: 1, p: 0, border: 0, bgcolor: 'transparent', cursor: 'zoom-in', borderRadius: 2, overflow: 'hidden' }}
            >
                <Box component="img" src={image} alt={page.title} sx={{ display: 'block', width: 1, height: { xs: 330, md: 360 }, objectFit: 'cover', objectPosition: 'center 18%' }} />
            </Box>
            <Box aria-hidden="true" sx={{ position: 'absolute', right: 14, bottom: 14, width: 34, height: 34, borderRadius: 1.25, bgcolor: green.main, color: gold.bright, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <ZoomIn fontSize="small" /></Box>
        </Box>
    )

    const article = (
        <Box component="article" sx={{ minWidth: 0, maxWidth: { md: 720 } }}>
            {!wide && page.summary && (
                <Typography sx={{ mb: 3, fontFamily: bodySerif, fontSize: '1.3rem', lineHeight: 1.45, color: ink.secondary }}>{page.summary}</Typography>
            )}
            {page.body.trim()
                ? (
                    <Markdown
                        source={page.body}
                        article
                        justify
                        dropCap
                        onWikiLink={onLink}
                        resolveLink={resolveLink}
                        onShareImage={isGm ? (url) => onShow(url) : undefined}
                    />
                )
                : <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Esta página ainda não tem texto.', 'This page has no text yet.')}</Typography>}

            <Box component="section" id="wiki-ligadas" aria-labelledby="wiki-ligadas-h" sx={{ mt: 5, pt: 3, borderTop: `1px solid ${rule}`, scrollMarginTop: { xs: '132px', md: '80px' } }}>
                <Typography id="wiki-ligadas-h" component="h2" sx={{ ...kicker, mb: 1.75 }}>{tr('Páginas ligadas', 'Linked pages')}</Typography>
                {linked.length === 0
                    ? <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Nenhuma página cita esta ainda (use [[', 'No page cites this one yet (use [[')}{page.title}]]).</Typography>
                    : (
                        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                            {linked.map((l) => (
                                <Box
                                    key={l.id}
                                    component="button"
                                    type="button"
                                    onClick={() => onOpen(l.id)}
                                    sx={{
                                        display: 'flex', alignItems: 'center', gap: 1.75, p: 1.75, textAlign: 'left', font: 'inherit', cursor: 'pointer',
                                        color: ink.primary, bgcolor: parchment.paper, border: `1px solid ${rule}`, borderRadius: 2,
                                        '&:hover': { borderColor: gold.main },
                                    }}
                                >
                                    <KindTile kind={l.kind} />
                                    <Box component="span" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <Box component="span" sx={{ fontWeight: 700, fontSize: '0.95rem', color: greenInk.main, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</Box>
                                        <Box component="span" sx={{ fontSize: '0.8125rem', color: ink.secondary }}>{KIND_LABEL[l.kind].one} · {l.why}</Box>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    )}
                <Typography variant="body2" sx={{ mt: 1.75, display: 'flex', alignItems: 'center', gap: 1.25, color: ink.secondary }}>
                    <Box component="span" aria-hidden="true" sx={{ width: 22, flex: 'none', borderBottom: `2px dashed ${status.error}` }} />
                    {tr('Nomes com sublinhado tracejado ainda não têm página. Toque para criar.', 'Dashed names don\'t have a page yet. Tap to create one.')}
                </Typography>
            </Box>

            {isGm && <JournalAppearances id={page.id} />}

            <Typography variant="caption" component="p" sx={{ mt: 3, pt: 1.5, borderTop: `1px solid ${rule}`, color: ink.secondary }}>
                {tr('Criada por ', 'Created by ')}<b>{authorName(names, page.createdBy)}</b>{` · ${formatWhen(page.createdAt)}`}
                {page.rev > 1 && (
                    <>
                        {' — '}{tr('alterada por ', 'edited by ')}<b>{authorName(names, page.updatedBy)}</b>{` · ${formatWhen(page.updatedAt)}`}
                    </>
                )}
                {` — ${tr('versão', 'version')} ${page.rev}`}
            </Typography>
        </Box>
    )

    const badges = (dark: boolean) => (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Box component="span" sx={{ ...pill, letterSpacing: 0.5, fontWeight: 700, ...(dark ? { bgcolor: gold.bright, color: green.deepest } : { bgcolor: green.main, color: chrome.text }) }}>
                {!dark && <KindGlyph kind={page.kind} />}{KIND_LABEL[page.kind].one}</Box>
            {page.visibility === 'gm' && (
                <Box component="span" sx={{ ...pill, border: `1px dashed ${dark ? gold.bright : gold.main}`, color: dark ? chrome.text : gold.deep }}>
                    <SecretIcon sx={{ fontSize: 15 }} />{tr('Só o mestre vê', 'GM only')}</Box>
            )}
            {page.locked && (
                <Box component="span" sx={{ ...pill, ...(dark ? { bgcolor: chrome.active, color: chrome.textSoft } : { bgcolor: parchment.sunken, color: ink.primary }) }}>
                    <LockIcon sx={{ fontSize: 14 }} />{wide ? tr('Travada pelo GM', 'Locked by the GM') : tr('Travada', 'Locked')}</Box>
            )}
            {secrets > 0 && (
                <Box component="span" sx={{ ...pill, border: `1px dashed ${dark ? gold.bright : gold.main}`, color: dark ? chrome.text : gold.deep }}>
                    <SecretIcon sx={{ fontSize: 15 }} />
                    {secrets === 1 ? tr('1 trecho do mestre', '1 GM-only part') : tr(`${secrets} trechos do mestre`, `${secrets} GM-only parts`)}</Box>
            )}
        </Stack>
    )

    if (!wide) {
        // ── Celular ──
        return (
            <Box sx={{ minWidth: 0 }}>
                <Box component="section" aria-labelledby="wiki-title" sx={{ bgcolor: green.deepest, color: chrome.text, borderRadius: 3.5, px: 2, pt: 1, pb: 2.75, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 48 }}>
                        <Button onClick={onHome} startIcon={<BackIcon sx={{ fontSize: '16px !important' }} />} sx={{ color: chrome.text, ml: -1, fontWeight: 600 }}>{tr('Wiki', 'Wiki')}</Button>
                        <Typography sx={{ flex: 1, textAlign: 'center', fontSize: '0.8125rem', color: chrome.textMuted }}>{KIND_LABEL[page.kind].many}</Typography>
                        <MoreMenu {...props} compact dark />
                    </Box>
                    {portrait}
                    {badges(true)}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography id="wiki-title" component="h1" sx={{ m: 0, fontFamily: displayFont, fontWeight: 700, fontSize: '1.9rem', lineHeight: 1.1, color: chrome.text, overflowWrap: 'anywhere' }}>{page.title}</Typography>
                        {role && <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: gold.bright }}>{role}</Typography>}
                        {page.aliases.length > 0 && <Typography variant="body2" sx={{ color: chrome.textMuted }}>{tr('Também chamado: ', 'Also known as: ')}{page.aliases.join(', ')}</Typography>}
                    </Box>
                    {statusPills}
                    <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
                        {isGm && (
                            <Button
                                fullWidth
                                startIcon={<ShareIcon />}
                                onClick={() => onShow()}
                                disabled={page.visibility === 'gm'}
                                sx={{ flex: 1, height: 48, borderRadius: 1.75, bgcolor: gold.bright, color: green.deepest, fontWeight: 700, '&:hover': { bgcolor: gold.main }, '&.Mui-disabled': { bgcolor: chrome.active, color: chrome.textMuted } }}
                            >
                                {tr('Mostrar à mesa', 'Show the table')}</Button>
                        )}
                        {view.canEdit && (
                            <Button
                                startIcon={<EditIcon />}
                                onClick={props.onEdit}
                                sx={{ flex: isGm ? '0 0 auto' : 1, height: 48, px: 2.25, borderRadius: 1.75, border: `1px solid ${chrome.lineStrong}`, color: chrome.text, fontWeight: 600 }}
                            >
                                {tr('Editar', 'Edit')}</Button>
                        )}
                    </Box>
                    {!view.canEdit && !isGm && page.locked && (
                        <Typography variant="caption" sx={{ color: chrome.textMuted }}>{tr('O GM travou esta página: só ele a edita.', 'The GM locked this page: only they can edit it.')}</Typography>
                    )}
                </Box>

                <Box sx={{ pt: 2.75, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <CardSheet {...props} dark={false} trail={trail} />
                    {page.tags.length > 0 && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {page.tags.map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
                        </Stack>
                    )}
                    {toc.length > 1 && (
                        <Box component="nav" aria-label={tr('Nesta página', 'On this page')} sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: { xs: -1.5, sm: -3 }, px: { xs: 1.5, sm: 3 }, position: 'sticky', top: MOBILE_HEADER_HEIGHT, zIndex: 2, bgcolor: 'background.default', py: 1 }}>
                            {toc.map((t) => (
                                <Box
                                    key={t.id}
                                    component="a"
                                    href={`#${t.id}`}
                                    aria-current={active === t.id ? 'location' : undefined}
                                    onClick={(e: React.MouseEvent) => { e.preventDefault(); goTo(t.id) }}
                                    sx={{
                                        flex: 'none', display: 'flex', alignItems: 'center', height: 40, px: 1.75, borderRadius: 999, fontSize: '0.875rem',
                                        fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
                                        ...(active === t.id
                                            ? { bgcolor: green.main, color: chrome.text, border: `1px solid ${green.main}` }
                                            : t.gm
                                                ? { border: `1px dashed ${gold.main}`, color: gold.deep }
                                                : { border: `1px solid ${rule}`, color: ink.primary }),
                                    }}
                                >
                                    {t.text}
                                </Box>
                            ))}
                        </Box>
                    )}
                    {article}
                </Box>
                {zoomed && image && <ImageLightbox src={image} title={page.title} onClose={() => setZoomed(false)} onShow={showImage} />}
            </Box>
        )
    }

    // ── Desktop ──
    return (
        <Box sx={{ minWidth: 0 }}>
            <Box component="header" sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pb: 3, mb: 4, borderBottom: `1px solid ${rule}` }}>
                <Box component="nav" aria-label={tr('Trilha', 'Breadcrumb')} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, fontSize: '0.875rem', color: ink.secondary }}>
                    <Link component="button" type="button" underline="hover" onClick={onHome} sx={{ font: 'inherit', color: ink.secondary }}>{tr('Wiki', 'Wiki')}</Link>
                    <span aria-hidden="true">›</span>
                    <span>{KIND_LABEL[page.kind].many}</span>
                    {trail.map((p) => (
                        <Box key={p.id} component="span" sx={{ display: 'contents' }}>
                            <span aria-hidden="true">›</span>
                            <Link component="button" type="button" underline="hover" onClick={() => onOpen(p.id)} sx={{ font: 'inherit', color: ink.secondary }}>{p.title}</Link>
                        </Box>
                    ))}
                    <span aria-hidden="true">›</span>
                    <Box component="span" sx={{ color: ink.primary, fontWeight: 600 }}>{page.title}</Box>
                </Box>
                {badges(false)}
                <Typography component="h1" sx={{ m: 0, fontFamily: displayFont, fontWeight: 700, fontSize: '2.9rem', lineHeight: 1.08, color: greenInk.main, overflowWrap: 'anywhere' }}>
                    {page.title}</Typography>
                {page.aliases.length > 0 && (
                    <Typography variant="body2" sx={{ color: ink.secondary }}>{tr('Também chamado: ', 'Also known as: ')}{page.aliases.join(', ')}</Typography>
                )}
                {page.summary && (
                    <Typography sx={{ m: 0, maxWidth: 760, fontFamily: bodySerif, fontSize: '1.4rem', lineHeight: 1.45, color: ink.secondary }}>{page.summary}</Typography>
                )}
                {page.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {page.tags.map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
                    </Stack>
                )}
                <Actions {...props} />
            </Box>

            <Box sx={{ display: 'grid', gap: { md: 4, xl: 6 }, gridTemplateColumns: { md: 'minmax(0, 1fr) minmax(260px, 300px)', xl: 'minmax(0, 1fr) 340px' } }}>
                {article}
                {/* A coluna estica até o fim do artigo; só o sumário gruda no topo ao rolar. */}
                <Box component="aside" aria-label={tr(`Ficha de ${page.title}`, `${page.title}'s card`)} sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <Box sx={{ borderRadius: 3, bgcolor: chrome.hero, color: chrome.text, p: 1.25, boxShadow: `0 12px 32px ${core.fx.shadowHover}` }}>
                        {portrait}
                        <Box sx={{ pt: 2.25, px: 1.75, pb: 0.75, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, textAlign: 'center' }}>
                            <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.35rem', color: chrome.text, overflowWrap: 'anywhere' }}>{page.title}</Typography>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: gold.bright }}>{role || KIND_LABEL[page.kind].one}</Typography>
                        </Box>
                        {statusPills && <Box sx={{ px: 1.75, pt: 1.5, pb: 2 }}>{statusPills}</Box>}
                        <Box sx={{ px: 1.75, pb: 1 }}>
                            <CardFields {...props} dark trail={trail} />
                            {page.aon && <CreatureBox page={page} isGm={isGm} onNotice={props.onNotice} dark />}
                        </Box>
                    </Box>

                    {toc.length > 1 && (
                        <Box component="nav" aria-label={tr('Nesta página', 'On this page')} sx={{ position: 'sticky', top: 16, borderRadius: 2.5, bgcolor: parchment.paper, border: `1px solid ${rule}`, px: 2.25, py: 2, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <Typography sx={{ ...kicker, pb: 1 }}>{tr('Nesta página', 'On this page')}</Typography>
                            {toc.map((t) => {
                                const on = active === t.id
                                return (
                                    <Box
                                        key={t.id}
                                        component="a"
                                        href={`#${t.id}`}
                                        aria-current={on ? 'location' : undefined}
                                        onClick={(e: React.MouseEvent) => { e.preventDefault(); goTo(t.id) }}
                                        sx={{
                                            display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 36, pl: t.level === 3 ? 2 : 0, fontSize: '0.95rem',
                                            fontWeight: on ? 700 : 500, color: on ? greenInk.main : ink.secondary, textDecoration: 'none',
                                            '&:hover': { color: greenInk.main },
                                        }}
                                    >
                                        <Box component="span" aria-hidden="true" sx={{
                                            width: 7, height: 7, flex: 'none', transform: 'rotate(45deg)', boxSizing: 'border-box',
                                            ...(on ? { bgcolor: gold.bright } : { border: `1.5px ${t.gm ? 'dashed' : 'solid'} ${gold.main}` }),
                                        }} />
                                        {t.text}
                                    </Box>
                                )
                            })}
                        </Box>
                    )}
                </Box>
            </Box>

            {zoomed && image && <ImageLightbox src={image} title={page.title} onClose={() => setZoomed(false)} onShow={showImage} />}
        </Box>
    )
})

/** A ficha clara do celular: recolhível, com os mesmos campos do cartão escuro do desktop. */
function CardSheet(props: Props & { dark: false; trail: WikiSummary[] }) {
    const [open, setOpen] = useState(true)
    const { page } = props.view
    const hasAny = INFOBOX[page.kind].some((f) => !PILL_FIELDS.has(f.key) && page.fields[f.key]) || !!page.parent || !!page.aon
        || Object.keys(page.fields).some((k) => !INFOBOX[page.kind].some((f) => f.key === k))
    if (!hasAny) return null
    return (
        <Box sx={{ borderRadius: 2.25, bgcolor: parchment.paper, border: `1px solid ${rule}`, px: 2, py: 0.5 }}>
            <Box
                component="button"
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 1, minHeight: 48, p: 0, border: 0, bgcolor: 'transparent', font: 'inherit', cursor: 'pointer', ...kicker }}
            >
                {tr('Ficha', 'Card')}
                <ExpandMore sx={{ color: gold.deep, transform: open ? 'rotate(180deg)' : 'none', transition: reducedMotion() ? 'none' : 'transform 160ms ease' }} />
            </Box>
            {open && (
                <Box sx={{ pb: 1 }}>
                    <CardFields {...props} />
                    {page.aon && <CreatureBox page={page} isGm={props.isGm} onNotice={props.onNotice} dark={false} />}
                </Box>
            )}
        </Box>
    )
}

/** Os campos da ficha: os curtos lado a lado (com o tipo), os outros em linhas com ícone. */
function CardFields({ view, pages, dark, onOpen, onLink, resolveLink }: Props & { dark: boolean; trail: WikiSummary[] }) {
    const { page } = view
    const defs = INFOBOX[page.kind].filter((f) => page.fields[f.key] && !PILL_FIELDS.has(f.key))
    const grid = defs.filter((f) => GRID_FIELDS.has(f.key))
    const rows = defs.filter((f) => !GRID_FIELDS.has(f.key))
    const extra = Object.entries(page.fields).filter(([k]) => !INFOBOX[page.kind].some((f) => f.key === k))
    const parent = page.parent ? pages.find((p) => p.id === page.parent) ?? null : null
    const line = dark ? chrome.line : rule
    const label = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: dark ? chrome.textMuted : ink.secondary } as const
    const value = { m: 0, minWidth: 0, fontSize: '1rem', fontWeight: 600, lineHeight: 1.4, color: dark ? chrome.text : ink.primary, '&& p': { my: 0 } } as const
    const md = (v: string) => <Markdown source={v} dense onDark={dark} onWikiLink={onLink} resolveLink={resolveLink} />
    const row = (key: string, text: string, icon: typeof PlaceIcon | undefined, body: ReactNode) => {
        const Icon = icon
        return (
            <Box key={key} sx={{ display: 'flex', gap: 1.5, py: 1.75, borderTop: `1px solid ${line}` }}>
                {Icon && <Icon aria-hidden="true" sx={{ fontSize: 18, mt: '2px', color: dark ? gold.bright : gold.deep, flex: 'none' }} />}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, minWidth: 0 }}>
                    <Box component="dt" sx={label}>{text}</Box>
                    <Box component="dd" sx={value}>{body}</Box>
                </Box>
            </Box>
        )
    }
    const cell = (key: string, text: string, body: ReactNode) => (
        <Box key={key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, minWidth: 0 }}>
            <Box component="dt" sx={label}>{text}</Box>
            <Box component="dd" sx={value}>{body}</Box>
        </Box>
    )
    return (
        <Box component="dl" sx={{ m: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5, py: 1.75, borderTop: `1px solid ${line}` }}>
                {grid.map((f: FieldDef) => cell(f.key, f.label, md(page.fields[f.key])))}
                {cell('kind', tr('Tipo', 'Type'), KIND_LABEL[page.kind].one)}
            </Box>
            {parent && row('parent', PARENT_LABEL[page.kind], ParentIcon, (
                <Link component="button" type="button" onClick={() => onOpen(parent.id)} sx={{
                    font: 'inherit', fontWeight: 700, textAlign: 'left', textUnderlineOffset: '4px', textDecorationThickness: '2px',
                    color: dark ? chrome.text : gold.deep, textDecorationColor: gold.bright,
                }}>{parent.title}</Link>
            ))}
            {rows.map((f) => row(f.key, f.label, FIELD_ICONS[f.key], md(page.fields[f.key])))}
            {extra.map(([k, v]) => row(k, k, undefined, md(v)))}
        </Box>
    )
}

/** As ações do desktop: Editar e Mostrar à mesa em destaque, as do GM leves e o resto no "…". */
function Actions(props: Props) {
    const { view, isGm, onEdit, onHistory, onFlags, onShow } = props
    const { page, canEdit } = view
    const ghost = { color: ink.primary, px: 1.5 }
    return (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            {canEdit && (
                <Button variant="contained" startIcon={<EditIcon sx={{ color: gold.bright }} />} onClick={onEdit} sx={{ height: 44, px: 2.25, borderRadius: 1.5, bgcolor: green.main, color: chrome.text, '&:hover': { bgcolor: green.mid } }}>
                    {tr('Editar', 'Edit')}</Button>
            )}
            {isGm && (
                <Button
                    startIcon={<ShareIcon />}
                    onClick={() => onShow()}
                    disabled={page.visibility === 'gm'}
                    title={page.visibility === 'gm' ? tr('Revele a página antes', 'Reveal the page first') : undefined}
                    sx={{ height: 44, px: 2, borderRadius: 1.5, border: `1.5px solid ${gold.bright}`, bgcolor: parchment.paper, color: gold.deep, fontWeight: 600 }}
                >
                    {tr('Mostrar à mesa', 'Show the table')}</Button>
            )}
            <Box aria-hidden="true" sx={{ width: '1px', height: 28, bgcolor: rule, mx: 0.75 }} />
            <Button startIcon={<HistoryIcon />} onClick={onHistory} sx={ghost}>{tr('Histórico', 'History')}</Button>
            {isGm && (
                <>
                    <Button startIcon={page.locked ? <UnlockIcon /> : <LockIcon />} onClick={() => onFlags({ locked: !page.locked })} sx={ghost}>
                        {page.locked ? tr('Destravar', 'Unlock') : tr('Travar', 'Lock')}</Button>
                    <Button startIcon={page.visibility === 'gm' ? <RevealIcon /> : <SecretIcon />} sx={ghost}
                        onClick={() => onFlags({ visibility: page.visibility === 'gm' ? 'public' : 'gm' })}>
                        {page.visibility === 'gm' ? tr('Revelar à mesa', 'Reveal to the table') : tr('Esconder da mesa', 'Hide from the table')}</Button>
                </>
            )}
            <MoreMenu {...props} />
            {!canEdit && !isGm && page.locked && (
                <Typography variant="caption" sx={{ color: ink.secondary }}>{tr('O GM travou esta página: só ele a edita.', 'The GM locked this page: only they can edit it.')}</Typography>
            )}
        </Stack>
    )
}

/** O "…": no desktop, só o que sobra (apagar); no celular (`compact`), também histórico, travar e esconder. */
function MoreMenu({ view, isGm, onHistory, onDelete, onFlags, compact = false, dark = false }: Props & { compact?: boolean; dark?: boolean }) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null)
    const { page, canDelete } = view
    if (!compact && !canDelete) return null
    const run = (fn: () => void) => () => { setAnchor(null); fn() }
    return (
        <>
            <IconButton
                aria-label={tr('Mais ações', 'More actions')}
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={dark ? { color: chrome.text, width: 44, height: 44 } : { width: 44, height: 44, border: `1px solid ${rule}`, borderRadius: 1.5, color: ink.primary }}
            >
                <MoreIcon />
            </IconButton>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                {compact && <MenuItem onClick={run(onHistory)}><ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>{tr('Histórico', 'History')}</MenuItem>}
                {compact && isGm && (
                    <MenuItem onClick={run(() => onFlags({ locked: !page.locked }))}>
                        <ListItemIcon>{page.locked ? <UnlockIcon fontSize="small" /> : <LockIcon fontSize="small" />}</ListItemIcon>
                        {page.locked ? tr('Destravar', 'Unlock') : tr('Travar', 'Lock')}</MenuItem>
                )}
                {compact && isGm && (
                    <MenuItem onClick={run(() => onFlags({ visibility: page.visibility === 'gm' ? 'public' : 'gm' }))}>
                        <ListItemIcon>{page.visibility === 'gm' ? <RevealIcon fontSize="small" /> : <SecretIcon fontSize="small" />}</ListItemIcon>
                        {page.visibility === 'gm' ? tr('Revelar à mesa', 'Reveal to the table') : tr('Esconder da mesa', 'Hide from the table')}</MenuItem>
                )}
                {canDelete && <MenuItem onClick={run(onDelete)}><ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>{tr('Apagar', 'Delete')}</MenuItem>}
            </Menu>
        </>
    )
}

/** A criatura da AON ligada à página: a ficha de lá e, para o GM, Iniciativa e Escalar Monstro. */
function CreatureBox({ page, isGm, onNotice, dark }: { page: WikiPageView['page']; isGm: boolean; onNotice: Props['onNotice']; dark: boolean }) {
    const navigate = useNavigate()
    const aon = page.aon!
    const [sending, setSending] = useState(false)

    const send = async () => {
        setSending(true)
        try {
            const { results } = await searchCreatures(aon.name, 6)
            const found = results.find((c) => c.name.toLowerCase() === aon.name.toLowerCase()) ?? null
            if (!found) { onNotice(tr(`A AON não achou "${aon.name}"`, `AON didn't find "${aon.name}"`)); return }
            appendCombatants([npcFromCreature(found)])
            onNotice(tr(`${found.name} entrou no encontro da Iniciativa`, `${found.name} joined the Initiative encounter`),
                { label: tr('Abrir', 'Open'), go: () => navigate('/iniciativa') })
        } catch {
            onNotice(tr('Não foi possível buscar a criatura', 'Could not fetch the creature'))
        } finally {
            setSending(false)
        }
    }

    return (
        <Box sx={{
            borderTop: `1px solid ${dark ? chrome.line : rule}`, py: 1.5,
            ...(dark ? { color: chrome.text, '& a': { color: chrome.text }, '& .MuiChip-root': { color: chrome.textSoft, borderColor: chrome.lineStrong }, '& .MuiButton-root': { color: gold.bright } } : {}),
        }}>
            <Typography variant="caption" sx={{ color: dark ? gold.bright : gold.deep, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {tr('Na AON', 'On AON')}</Typography>
            <Typography sx={{ fontWeight: 700 }}>
                {aon.url
                    ? <Link href={aon.url} target="_blank" rel="noopener noreferrer">{aon.name} <OpenInNew sx={{ fontSize: 14, verticalAlign: 'middle' }} /></Link>
                    : aon.name}
                {aon.level !== null && <Box component="span" sx={{ color: dark ? chrome.textMuted : ink.secondary, fontWeight: 400 }}>{tr(` · nível ${aon.level}`, ` · level ${aon.level}`)}</Box>}
            </Typography>
            {aon.traits.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                    {aon.traits.slice(0, 8).map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
                </Stack>
            )}
            {isGm && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    <Button size="small" onClick={() => void send()} disabled={sending}>{tr('Enviar para a Iniciativa', 'Send to Initiative')}</Button>
                    <Button size="small" onClick={() => navigate(`/escalar-monstro?criatura=${encodeURIComponent(aon.name)}`)}>{tr('Escalar', 'Scale')}</Button>
                </Stack>
            )}
        </Box>
    )
}

/** Só o GM: as sessões do Diário que põem esta página no Elenco. */
function JournalAppearances({ id }: { id: string }) {
    const navigate = useNavigate()
    const [sessions, setSessions] = useState<{ id: string; title: string; sort: number }[] | null>(null)
    useEffect(() => {
        let live = true
        void fetchJournalList().then((docs) => {
            if (!live || !docs) return
            const ref = `wiki:${id}`
            setSessions((docs as { id: string; kind: string; title: string; sort: number; links?: unknown }[])
                .filter((d) => d.kind === 'session' && Array.isArray(d.links) && d.links.includes(ref))
                .sort((a, b) => a.sort - b.sort))
        })
        return () => { live = false }
    }, [id])
    if (!sessions?.length) return null
    return (
        <Alert severity="info" icon={false} sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{tr('No Diário de Campanha (só você vê)', 'In the Campaign Journal (only you see this)')}</Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {sessions.map((s) => <Chip key={s.id} size="small" label={s.title} onClick={() => navigate(`/diario-campanha/${s.id}`)} />)}
            </Stack>
        </Alert>
    )
}
