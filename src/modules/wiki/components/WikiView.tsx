import { memo, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert, Box, Breadcrumbs, Button, Chip, Link, Stack, Typography,
} from '@mui/material'
import {
    Campaign as ShareIcon, Delete as DeleteIcon, Edit as EditIcon, History as HistoryIcon, Lock as LockIcon,
    LockOpen as UnlockIcon, OpenInNew, Visibility as RevealIcon, VisibilityOff as SecretIcon, ZoomIn,
} from '@mui/icons-material'
import { Markdown } from '../../../components/markdown/Markdown'
import { headingsOf } from '../../../components/markdown/blocks'
import { ImageLightbox } from '../../../components/ImageLightbox'
import { KindGlyph, KindTile } from './KindIcon'
import { useImageUrl } from '../../../services/images'
import { searchCreatures } from '../../../services/creatures'
import { fetchJournalList } from '../../../services/journal'
import type { WikiPageView, WikiSummary } from '../../../services/wiki'
import { npcFromCreature } from '../../initiative-tracker/importCharacter'
import { appendCombatants } from '../../initiative-tracker/encounterStorage'
import { bodySerif, chrome, core, displayFont, gold, green, greenInk, ink, onFrame, parchment, rule, status } from '../../../theme'
import { INFOBOX, KIND_LABEL, PARENT_LABEL } from '../kinds'
import { authorName, formatWhen, trailOf } from '../useWiki'
import { tr } from '../../../i18n'

// Uma página da Wiki, para ler: cabeçalho (trilha, selos, título, resumo, ações), o artigo (com os links da
// Wiki), a ficha lateral com o retrato (que amplia ao toque e, para o GM, vai para a tela da mesa), o
// sumário, as páginas ligadas, a autoria e — para quem pode — as ações.

interface Props {
    view: WikiPageView
    pages: WikiSummary[]
    authors: Record<string, string>
    isGm: boolean
    onOpen: (id: string) => void
    onLink: (target: string) => void
    resolveLink: (target: string) => 'known' | 'wiki' | 'missing'
    onEdit: () => void
    onHistory: () => void
    onDelete: () => void
    onFlags: (flags: { locked?: boolean; visibility?: 'public' | 'gm' }) => void
    /** Mostra à mesa a página inteira ou, com `image`, só essa imagem e o nome da página. */
    onShow: (image?: string) => void
    onNotice: (text: string, action?: { label: string; go: () => void }) => void
}

/** Pílula de cabeçalho (tipo, travada, trechos do mestre). */
const pill = {
    display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 28, px: 1.5, borderRadius: 999, fontSize: '0.8rem', fontWeight: 600,
} as const

const kicker = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: gold.deep } as const

/** Os campos que viram pílula no cartão (situação e atitude), em vez de linha da lista. */
const PILL_FIELDS = new Set(['status', 'attitude'])

export const WikiView = memo(function WikiView(props: Props) {
    const { view, pages, authors, isGm, onOpen, onLink, resolveLink, onShow } = props
    const { page, backlinks, canEdit, canDelete } = view
    const image = useImageUrl(page.image)
    const [zoomed, setZoomed] = useState(false)
    const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
    const trail = useMemo(() => trailOf(page.id, byId), [page.id, byId])
    const children = useMemo(() => pages.filter((p) => p.parent === page.id).sort((a, b) => a.title.localeCompare(b.title)), [pages, page.id])
    const names = { ...authors, ...view.authors }
    const fields = INFOBOX[page.kind].filter((f) => page.fields[f.key])
    const pillFields = fields.filter((f) => PILL_FIELDS.has(f.key))
    const rowFields = fields.filter((f) => !PILL_FIELDS.has(f.key))
    const extraFields = Object.entries(page.fields).filter(([k]) => !INFOBOX[page.kind].some((f) => f.key === k))
    const parent = page.parent ? byId.get(page.parent) : null
    const headings = useMemo(() => headingsOf(page.body), [page.body])
    const linked = useMemo(() => {
        const seen = new Set<string>()
        const out: { id: string; title: string; kind: WikiSummary['kind']; why: string }[] = []
        for (const c of children) { seen.add(c.id); out.push({ id: c.id, title: c.title, kind: c.kind, why: tr(`Dentro de ${page.title}`, `Inside ${page.title}`) }) }
        for (const b of backlinks) { if (!seen.has(b.id)) { seen.add(b.id); out.push({ id: b.id, title: b.title, kind: b.kind, why: tr('Cita esta página', 'Mentions this page') }) } }
        return out
    }, [children, backlinks, page.title])

    const md = (source: string, dense = false) => (
        <Markdown source={source} dense={dense} onWikiLink={onLink} resolveLink={resolveLink} />
    )
    const hasCard = !!image || fields.length > 0 || extraFields.length > 0 || !!parent || !!page.aon

    return (
        <Box sx={{ minWidth: 0 }}>
            <Box component="header" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 3, mb: 3, borderBottom: `1px solid ${rule}` }}>
                {trail.length > 0 && (
                    <Breadcrumbs sx={{ fontSize: '0.9rem' }} aria-label={tr('Onde fica', 'Where it is')}>
                        {trail.map((p) => (
                            <Link key={p.id} component="button" type="button" underline="hover" color="inherit" onClick={() => onOpen(p.id)} sx={{ font: 'inherit', color: ink.secondary }}>{p.title}</Link>
                        ))}
                        <Typography sx={{ font: 'inherit', color: ink.primary, fontWeight: 600 }}>{page.title}</Typography>
                    </Breadcrumbs>
                )}

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Box component="span" sx={{ ...pill, bgcolor: green.main, color: onFrame.paper, letterSpacing: 0.5, fontWeight: 700 }}>
                        <KindGlyph kind={page.kind} />{KIND_LABEL[page.kind].one}</Box>
                    {page.visibility === 'gm' && <Box component="span" sx={{ ...pill, border: `1px dashed ${gold.main}`, color: gold.deep }}><SecretIcon sx={{ fontSize: 15 }} />{tr('Só o mestre vê', 'GM only')}</Box>}
                    {page.locked && <Box component="span" sx={{ ...pill, bgcolor: parchment.sunken, color: ink.primary }}><LockIcon sx={{ fontSize: 14 }} />{tr('Travada pelo GM', 'Locked by the GM')}</Box>}
                    {page.hasSecrets && <Box component="span" sx={{ ...pill, border: `1px dashed ${gold.main}`, color: gold.deep }}><SecretIcon sx={{ fontSize: 15 }} />{tr('Tem trechos do mestre', 'Has GM-only parts')}</Box>}
                </Stack>

                <Typography component="h1" sx={{ m: 0, fontFamily: displayFont, fontWeight: 700, fontSize: { xs: '2rem', md: '2.9rem' }, lineHeight: 1.08, color: greenInk.main, overflowWrap: 'anywhere' }}>
                    {page.title}</Typography>
                {page.aliases.length > 0 && (
                    <Typography variant="body2" sx={{ color: ink.secondary }}>
                        {tr('Também chamado: ', 'Also known as: ')}{page.aliases.join(', ')}</Typography>
                )}
                {page.summary && (
                    <Typography sx={{ m: 0, maxWidth: 760, fontFamily: bodySerif, fontSize: { xs: '1.2rem', md: '1.4rem' }, lineHeight: 1.45, color: ink.secondary }}>{page.summary}</Typography>
                )}
                {page.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {page.tags.map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
                    </Stack>
                )}
                <Actions {...props} canEdit={canEdit} canDelete={canDelete} />
            </Box>

            <Box sx={{ display: 'grid', gap: { xs: 3, md: 6 }, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
                <Box component="article" sx={{ minWidth: 0, maxWidth: 720, order: { xs: 2, md: 1 } }}>
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

                    <Box component="section" aria-labelledby="wiki-linked" sx={{ mt: 5, pt: 3, borderTop: `1px solid ${rule}` }}>
                        <Typography id="wiki-linked" component="h2" sx={{ ...kicker, mb: 1.5 }}>{tr('Páginas ligadas', 'Linked pages')}</Typography>
                        {linked.length === 0
                            ? <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Nenhuma página cita esta ainda (use [[', 'No page cites this one yet (use [[')}{page.title}]]).</Typography>
                            : (
                                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                    {linked.map((l) => (
                                        <Box
                                            key={l.id}
                                            component="button"
                                            type="button"
                                            onClick={() => onOpen(l.id)}
                                            sx={{
                                                display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, minHeight: 64, textAlign: 'left', font: 'inherit', cursor: 'pointer',
                                                color: ink.primary, bgcolor: parchment.paper, border: `1px solid ${rule}`, borderRadius: 2,
                                                '&:hover': { borderColor: gold.main },
                                            }}
                                        >
                                            <KindTile kind={l.kind} />
                                            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <Box component="span" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</Box>
                                                <Box component="span" sx={{ fontSize: '0.8rem', color: ink.secondary }}>{KIND_LABEL[l.kind].one} · {l.why}</Box>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        <Typography variant="body2" sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: ink.secondary }}>
                            <Box component="span" aria-hidden="true" sx={{ width: 22, borderBottom: `2px dashed ${status.error}` }} />
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

                <Box component="aside" aria-label={tr(`Ficha de ${page.title}`, `${page.title}'s card`)} sx={{ order: { xs: 1, md: 2 }, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, position: { md: 'sticky' }, top: { md: 16 } }}>
                    {hasCard && (
                        <Box sx={{ borderRadius: 3, bgcolor: chrome.hero, color: chrome.text, p: 1.25, boxShadow: `0 12px 32px ${core.fx.shadowHover}` }}>
                            {image && (
                                <Box sx={{ position: 'relative', borderRadius: 2, p: '4px', bgcolor: gold.bright }}>
                                    <Box
                                        component="button"
                                        type="button"
                                        onClick={() => setZoomed(true)}
                                        aria-label={tr(`Ampliar a imagem de ${page.title}`, `Enlarge the image of ${page.title}`)}
                                        title={tr('Ampliar', 'Enlarge')}
                                        sx={{ display: 'block', width: '100%', p: 0, border: 0, bgcolor: 'transparent', cursor: 'zoom-in', borderRadius: 1.5, overflow: 'hidden' }}
                                    >
                                        <Box component="img" src={image} alt={page.title} sx={{ display: 'block', width: '100%', height: { xs: 280, md: 360 }, objectFit: 'cover', objectPosition: 'center 20%' }} />
                                    </Box>
                                    <Box aria-hidden="true" sx={{ position: 'absolute', right: 12, bottom: 12, width: 32, height: 32, borderRadius: 1, bgcolor: green.main, color: gold.bright, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                        <ZoomIn fontSize="small" /></Box>
                                </Box>
                            )}
                            <Box sx={{ pt: 2, px: 1.5, pb: 0.5, textAlign: 'center' }}>
                                <Typography sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.35rem', color: chrome.text, overflowWrap: 'anywhere' }}>{page.title}</Typography>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: gold.bright }}>{KIND_LABEL[page.kind].one}</Typography>
                            </Box>
                            {pillFields.length > 0 && (
                                <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
                                    {pillFields.map((f) => (
                                        <Box key={f.key} component="span" sx={{
                                            ...pill, height: 32, fontSize: '0.875rem',
                                            ...(f.key === 'status' ? { bgcolor: chrome.active, color: chrome.text } : { bgcolor: gold.bright, color: green.main, fontWeight: 700 }),
                                        }}>
                                            {f.key === 'status' && <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: chrome.online }} />}
                                            {page.fields[f.key]}
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                            <Box component="dl" sx={{ m: 0, px: 1.5, pb: 1, display: 'flex', flexDirection: 'column' }}>
                                {parent && (
                                    <CardRow label={PARENT_LABEL[page.kind]}>
                                        <Link component="button" type="button" onClick={() => onOpen(parent.id)} sx={{ font: 'inherit', fontWeight: 600, textAlign: 'left', color: chrome.text }}>{parent.title}</Link>
                                    </CardRow>
                                )}
                                {rowFields.map((f) => <CardRow key={f.key} label={f.label}>{md(page.fields[f.key], true)}</CardRow>)}
                                {extraFields.map(([k, v]) => <CardRow key={k} label={k}>{md(v, true)}</CardRow>)}
                            </Box>
                            {page.aon && <CreatureBox page={view.page} isGm={isGm} onNotice={props.onNotice} />}
                        </Box>
                    )}

                    {headings.length > 1 && (
                        <Box component="nav" aria-label={tr('Nesta página', 'On this page')} sx={{ borderRadius: 2.5, bgcolor: parchment.paper, border: `1px solid ${rule}`, p: 2 }}>
                            <Typography sx={{ ...kicker, pb: 1 }}>{tr('Nesta página', 'On this page')}</Typography>
                            {headings.map((h, i) => (
                                <Box
                                    key={`${h.id}-${i}`}
                                    component="a"
                                    href={`#${h.id}`}
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault()
                                        document.getElementById(h.id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
                                    }}
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 36, pl: h.level === 3 ? 2 : 0, fontSize: '0.95rem', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? greenInk.main : ink.secondary, textDecoration: 'none', '&:hover': { color: greenInk.main } }}
                                >
                                    <Box component="span" aria-hidden="true" sx={{ width: 7, height: 7, flex: 'none', transform: 'rotate(45deg)', ...(i === 0 ? { bgcolor: gold.bright } : { border: `1.5px solid ${gold.main}` }) }} />
                                    {h.text}
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>

            {zoomed && image && (
                <ImageLightbox src={image} title={page.title} onClose={() => setZoomed(false)} onShow={isGm ? () => { onShow(page.image ?? undefined); setZoomed(false) } : undefined} />
            )}
        </Box>
    )
})

/** Uma linha da ficha lateral: rótulo pequeno em cima, valor embaixo, filete entre as linhas. */
function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Box sx={{ py: 1.5, borderTop: `1px solid ${chrome.line}`, '& a, & button': { color: chrome.text } }}>
            <Box component="dt" sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: chrome.textMuted }}>{label}</Box>
            <Box component="dd" sx={{ m: 0, minWidth: 0, fontSize: '1rem', fontWeight: 600, color: chrome.text, '& p': { my: 0 }, '& *': { color: 'inherit' } }}>{children}</Box>
        </Box>
    )
}

function Actions(props: Props & { canEdit: boolean; canDelete: boolean }) {
    const { view, isGm, canEdit, canDelete, onEdit, onHistory, onDelete, onFlags, onShow } = props
    const { page } = view
    return (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {canEdit && <Button variant="contained" startIcon={<EditIcon sx={{ color: gold.bright }} />} onClick={onEdit}>{tr('Editar', 'Edit')}</Button>}
            <Button startIcon={<HistoryIcon />} onClick={onHistory}>{tr('Histórico', 'History')}</Button>
            {isGm && (
                <>
                    <Button variant="outlined" startIcon={<ShareIcon />} onClick={() => onShow()} disabled={page.visibility === 'gm'}
                        title={page.visibility === 'gm' ? tr('Revele a página antes', 'Reveal the page first') : undefined}>
                        {tr('Mostrar à mesa', 'Show the table')}</Button>
                    <Button startIcon={page.locked ? <UnlockIcon /> : <LockIcon />} onClick={() => onFlags({ locked: !page.locked })}>
                        {page.locked ? tr('Destravar', 'Unlock') : tr('Travar', 'Lock')}</Button>
                    <Button startIcon={page.visibility === 'gm' ? <RevealIcon /> : <SecretIcon />}
                        onClick={() => onFlags({ visibility: page.visibility === 'gm' ? 'public' : 'gm' })}>
                        {page.visibility === 'gm' ? tr('Revelar à mesa', 'Reveal to the table') : tr('Esconder da mesa', 'Hide from the table')}</Button>
                </>
            )}
            {canDelete && <Button color="inherit" startIcon={<DeleteIcon />} onClick={onDelete}>{tr('Apagar', 'Delete')}</Button>}
            {!canEdit && !isGm && page.locked && (
                <Typography variant="caption" sx={{ color: ink.secondary, alignSelf: 'center' }}>{tr('O GM travou esta página: só ele a edita.', 'The GM locked this page: only they can edit it.')}</Typography>
            )}
        </Stack>
    )
}

/** A criatura da AON ligada à página: a ficha de lá e, para o GM, Iniciativa e Escalar Monstro. */
function CreatureBox({ page, isGm, onNotice }: { page: WikiPageView['page']; isGm: boolean; onNotice: Props['onNotice'] }) {
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
        <Box sx={{ borderTop: `1px solid ${rule}`, p: 1.5 }}>
            <Typography variant="caption" sx={{ color: gold.deep, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {tr('Na AON', 'On AON')}</Typography>
            <Typography sx={{ fontWeight: 700 }}>
                {aon.url
                    ? <Link href={aon.url} target="_blank" rel="noopener noreferrer">{aon.name} <OpenInNew sx={{ fontSize: 14, verticalAlign: 'middle' }} /></Link>
                    : aon.name}
                {aon.level !== null && <Box component="span" sx={{ color: ink.secondary, fontWeight: 400 }}>{tr(` · nível ${aon.level}`, ` · level ${aon.level}`)}</Box>}
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
