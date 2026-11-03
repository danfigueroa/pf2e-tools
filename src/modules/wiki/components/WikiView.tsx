import { memo, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert, Box, Breadcrumbs, Button, Chip, Link, Stack, Typography,
} from '@mui/material'
import {
    Campaign as ShareIcon, Delete as DeleteIcon, Edit as EditIcon, History as HistoryIcon, Lock as LockIcon,
    LockOpen as UnlockIcon, OpenInNew, Visibility as RevealIcon, VisibilityOff as SecretIcon,
} from '@mui/icons-material'
import { Markdown } from '../../../components/markdown/Markdown'
import { useImageUrl } from '../../../services/images'
import { searchCreatures } from '../../../services/creatures'
import { fetchJournalList } from '../../../services/journal'
import type { WikiPageView, WikiSummary } from '../../../services/wiki'
import { npcFromCreature } from '../../initiative-tracker/importCharacter'
import { appendCombatants } from '../../initiative-tracker/encounterStorage'
import { displayFont, gold, green, greenInk, ink, onFrame, parchment, rule } from '../../../theme'
import { INFOBOX, KIND_LABEL, PARENT_LABEL } from '../kinds'
import { authorName, formatWhen, trailOf } from '../useWiki'
import { tr } from '../../../i18n'

// Uma página da Wiki, para ler: capa e infobox, a trilha de "Fica em", o texto (com os links da
// Wiki), as páginas de dentro, quem cita esta página, a autoria e — para quem pode — as ações.

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
    onShow: () => void
    onNotice: (text: string, action?: { label: string; go: () => void }) => void
}

const sectionTitle = { fontFamily: displayFont, fontWeight: 700, color: greenInk.main, mb: 0.75 }

export const WikiView = memo(function WikiView(props: Props) {
    const { view, pages, authors, isGm, onOpen, onLink, resolveLink } = props
    const { page, backlinks, canEdit, canDelete } = view
    const image = useImageUrl(page.image)
    const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
    const trail = useMemo(() => trailOf(page.id, byId), [page.id, byId])
    const children = useMemo(() => pages.filter((p) => p.parent === page.id).sort((a, b) => a.title.localeCompare(b.title)), [pages, page.id])
    const names = { ...authors, ...view.authors }
    const fields = INFOBOX[page.kind].filter((f) => page.fields[f.key])
    const extraFields = Object.entries(page.fields).filter(([k]) => !INFOBOX[page.kind].some((f) => f.key === k))
    const parent = page.parent ? byId.get(page.parent) : null

    const md = (source: string, dense = false) => (
        <Markdown source={source} dense={dense} onWikiLink={onLink} resolveLink={resolveLink} />
    )

    return (
        <Box sx={{ minWidth: 0 }}>
            {trail.length > 0 && (
                <Breadcrumbs sx={{ mb: 1, fontSize: '0.85rem' }} aria-label={tr('Onde fica', 'Where it is')}>
                    {trail.map((p) => (
                        <Link key={p.id} component="button" type="button" onClick={() => onOpen(p.id)} sx={{ font: 'inherit' }}>{p.title}</Link>
                    ))}
                    <Typography sx={{ font: 'inherit', color: ink.secondary }}>{page.title}</Typography>
                </Breadcrumbs>
            )}

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                <Chip size="small" label={KIND_LABEL[page.kind].one} sx={{ bgcolor: green.main, color: onFrame.paper }} />
                {page.visibility === 'gm' && <Chip size="small" icon={<SecretIcon />} label={tr('Só o mestre vê', 'GM only')} variant="outlined" />}
                {page.locked && <Chip size="small" icon={<LockIcon />} label={tr('Travada pelo GM', 'Locked by the GM')} variant="outlined" />}
                {page.hasSecrets && <Chip size="small" icon={<SecretIcon />} label={tr('Tem trechos do mestre', 'Has GM-only parts')} variant="outlined" />}
            </Stack>
            <Typography component="h1" variant="h2" sx={{ mb: 0.5, overflowWrap: 'anywhere' }}>{page.title}</Typography>
            {page.aliases.length > 0 && (
                <Typography variant="body2" sx={{ color: ink.secondary, mb: 0.5 }}>
                    {tr('Também chamado: ', 'Also known as: ')}{page.aliases.join(', ')}</Typography>
            )}
            {page.summary && <Typography sx={{ fontStyle: 'italic', color: ink.secondary, mb: 1 }}>{page.summary}</Typography>}
            {page.tags.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                    {page.tags.map((t) => <Chip key={t} size="small" variant="outlined" label={t} />)}
                </Stack>
            )}

            <Actions {...props} canEdit={canEdit} canDelete={canDelete} />

            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' }, alignItems: 'start', mt: 2 }}>
                <Box sx={{ minWidth: 0, order: { xs: 2, md: 1 } }}>
                    {page.body.trim()
                        ? md(page.body)
                        : <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Esta página ainda não tem texto.', 'This page has no text yet.')}</Typography>}
                </Box>

                {(image || fields.length > 0 || extraFields.length > 0 || parent || page.aon) && (
                    <Box
                        component="aside"
                        sx={{ order: { xs: 1, md: 2 }, border: `1px solid ${rule}`, borderTop: `3px solid ${gold.main}`, borderRadius: 1, bgcolor: parchment.page, overflow: 'hidden' }}
                    >
                        {image && <Box component="img" src={image} alt={page.title} sx={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }} />}
                        <Box component="dl" sx={{ m: 0, p: 1.5, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 1.5, rowGap: 0.75 }}>
                            {parent && (
                                <>
                                    <Box component="dt" sx={{ color: ink.secondary, fontSize: '0.85rem', fontWeight: 600 }}>{PARENT_LABEL[page.kind]}</Box>
                                    <Box component="dd" sx={{ m: 0, minWidth: 0 }}>
                                        <Link component="button" type="button" onClick={() => onOpen(parent.id)} sx={{ font: 'inherit', fontWeight: 600, textAlign: 'left' }}>{parent.title}</Link>
                                    </Box>
                                </>
                            )}
                            {fields.map((f) => (
                                <FieldRow key={f.key} label={f.label}>{md(page.fields[f.key], true)}</FieldRow>
                            ))}
                            {extraFields.map(([k, v]) => <FieldRow key={k} label={k}>{md(v, true)}</FieldRow>)}
                        </Box>
                        {page.aon && <CreatureBox page={view.page} isGm={isGm} onNotice={props.onNotice} />}
                    </Box>
                )}
            </Box>

            {children.length > 0 && (
                <Box sx={{ mt: 3 }}>
                    <Typography sx={sectionTitle}>{tr(`Dentro de ${page.title}`, `Inside ${page.title}`)}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {children.map((c) => <Chip key={c.id} label={c.title} onClick={() => onOpen(c.id)} />)}
                    </Stack>
                </Box>
            )}

            <Box sx={{ mt: 3 }}>
                <Typography sx={sectionTitle}>{tr('Mencionada em', 'Mentioned in')}</Typography>
                {backlinks.length === 0
                    ? <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{tr('Nenhuma página cita esta ainda (use [[', 'No page cites this one yet (use [[')}{page.title}]]).</Typography>
                    : (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            {backlinks.map((b) => <Chip key={b.id} label={`${b.title} · ${KIND_LABEL[b.kind].one}`} onClick={() => onOpen(b.id)} />)}
                        </Stack>
                    )}
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
})

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <>
            <Box component="dt" sx={{ color: ink.secondary, fontSize: '0.85rem', fontWeight: 600 }}>{label}</Box>
            <Box component="dd" sx={{ m: 0, minWidth: 0, fontSize: '0.9rem' }}>{children}</Box>
        </>
    )
}

function Actions(props: Props & { canEdit: boolean; canDelete: boolean }) {
    const { view, isGm, canEdit, canDelete, onEdit, onHistory, onDelete, onFlags, onShow } = props
    const { page } = view
    return (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {canEdit && <Button size="small" variant="contained" startIcon={<EditIcon />} onClick={onEdit}>{tr('Editar', 'Edit')}</Button>}
            <Button size="small" startIcon={<HistoryIcon />} onClick={onHistory}>{tr('Histórico', 'History')}</Button>
            {isGm && (
                <>
                    <Button size="small" startIcon={<ShareIcon />} onClick={onShow} disabled={page.visibility === 'gm'}
                        title={page.visibility === 'gm' ? tr('Revele a página antes', 'Reveal the page first') : undefined}>
                        {tr('Mostrar à mesa', 'Show the table')}</Button>
                    <Button size="small" startIcon={page.locked ? <UnlockIcon /> : <LockIcon />} onClick={() => onFlags({ locked: !page.locked })}>
                        {page.locked ? tr('Destravar', 'Unlock') : tr('Travar', 'Lock')}</Button>
                    <Button size="small" startIcon={page.visibility === 'gm' ? <RevealIcon /> : <SecretIcon />}
                        onClick={() => onFlags({ visibility: page.visibility === 'gm' ? 'public' : 'gm' })}>
                        {page.visibility === 'gm' ? tr('Revelar à mesa', 'Reveal to the table') : tr('Esconder da mesa', 'Hide from the table')}</Button>
                </>
            )}
            {canDelete && <Button size="small" color="inherit" startIcon={<DeleteIcon />} onClick={onDelete}>{tr('Apagar', 'Delete')}</Button>}
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
