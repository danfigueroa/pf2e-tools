import { memo, useCallback, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
    Alert, Autocomplete, Avatar, Box, Button, Chip, IconButton, Paper, Stack, Tab, Tabs, TextField,
    ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import {
    Add as AddIcon, ArrowUpward, ArrowDownward, Delete as DeleteIcon, PlayArrow as StartIcon, Stop as StopIcon,
    Close as CloseIcon, History as HistoryIcon,
} from '@mui/icons-material'
import { useMesaInfo } from '../../../services/auth'
import { saveMesaSettings } from '../../../services/members'
import { diaryDayOf } from '../../../services/diary'
import { useImageUrl } from '../../../services/images'
import { bodyFont, displayFont, gold, green, parchment, rule } from '../../../theme'
import { wikiNames } from '../../../components/markdown/blocks'
import {
    CATALOG_KINDS, KIND_LABEL, newId, type CatalogKind, type DocKind, type JournalSummary, type PlannedEncounter,
    type Scene, type SceneStatus, type SessionData, type SessionDoc, type ThreadStatus,
} from '../doc'
import { TEMPLATES } from '../templates'
import { MarkdownEditor } from './MarkdownEditor'
import { EncounterPlanner } from './EncounterPlanner'
import { SessionLog } from './SessionLog'
import { ThreadsPanel } from './ThreadsPanel'

// Uma página por sessão: a preparação, as cenas (com o que já foi feito), os
// encontros planejados, o elenco que aparece (do catálogo da campanha), o
// registro do que acontece na mesa e o resumo do fim.

type TabKey = 'prep' | 'scenes' | 'encounters' | 'cast' | 'log' | 'recap'

const SCENE_STATUS: Record<SceneStatus, string> = { planned: 'Planejada', done: 'Feita', skipped: 'Pulada' }

interface Props {
    doc: SessionDoc
    version: number
    update: (fn: (d: SessionDoc) => SessionDoc) => void
    docs: JournalSummary[]
    /** O grupo das fichas publicadas (o padrão do planejador). */
    publishedParty: { level: number; size: number } | null
    onOpen: (id: string) => void
    /** Cria sem sair daqui; `from` = a sessão de origem (o gancho nasce "introduzido" nela). */
    onCreate: (kind: DocKind, title: string, from?: string) => Promise<string | null>
    onThreadStatus: (id: string, status: ThreadStatus) => void
}

function Thumb({ url, name }: { url: string | null; name: string }) {
    const src = useImageUrl(url)
    return <Avatar src={src ?? undefined} variant="rounded" sx={{ width: 32, height: 32, bgcolor: green.mid, fontSize: '0.8rem' }}>{name.slice(0, 2).toUpperCase()}</Avatar>
}

function SceneCard({ scene, version, first, last, onChange, onMove, onRemove }: {
    scene: Scene; version: number; first: boolean; last: boolean
    onChange: (s: Scene) => void; onMove: (d: -1 | 1) => void; onRemove: () => void
}) {
    return (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, opacity: scene.status === 'skipped' ? 0.7 : 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <TextField
                    size="small"
                    label="Cena"
                    value={scene.title}
                    onChange={(e) => onChange({ ...scene, title: e.target.value.slice(0, 120) })}
                    sx={{ flex: '1 1 200px', minWidth: 0 }}
                />
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={scene.status}
                    onChange={(_, v: SceneStatus | null) => { if (v) onChange({ ...scene, status: v }) }}
                    sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, textTransform: 'none' } }}
                >
                    {(Object.keys(SCENE_STATUS) as SceneStatus[]).map((s) => <ToggleButton key={s} value={s}>{SCENE_STATUS[s]}</ToggleButton>)}
                </ToggleButtonGroup>
                <Box>
                    <IconButton size="small" aria-label={`Subir a cena ${scene.title}`} disabled={first} onClick={() => onMove(-1)}><ArrowUpward fontSize="small" /></IconButton>
                    <IconButton size="small" aria-label={`Descer a cena ${scene.title}`} disabled={last} onClick={() => onMove(1)}><ArrowDownward fontSize="small" /></IconButton>
                    <IconButton size="small" aria-label={`Apagar a cena ${scene.title}`} onClick={onRemove}><DeleteIcon fontSize="small" /></IconButton>
                </Box>
            </Stack>
            <MarkdownEditor
                key={`${scene.id}-${version}`}
                value={scene.md}
                onChange={(md) => onChange({ ...scene, md })}
                imageName={scene.title || 'cena'}
                template={TEMPLATES.scene}
                minRows={5}
                aria-label={`Texto da cena ${scene.title}`}
            />
        </Paper>
    )
}

const move = <T,>(list: T[], i: number, d: -1 | 1): T[] => {
    const j = i + d
    if (j < 0 || j >= list.length) return list
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
}

/** NPCs, locais, itens e facções desta sessão — escolhidos do catálogo, ou criados aqui. */
function CastPanel({ data, docs, onLinks, onOpen, onCreate }: {
    data: SessionData; docs: JournalSummary[]
    onLinks: (links: string[]) => void; onOpen: (id: string) => void
    onCreate: (kind: DocKind, title: string) => Promise<string | null>
}) {
    const [kind, setKind] = useState<CatalogKind>('npc')
    const [name, setName] = useState('')
    const catalog = docs.filter((d) => (CATALOG_KINDS as readonly string[]).includes(d.kind))
    const linked = data.links.map((id) => catalog.find((d) => d.id === id)).filter((d): d is JournalSummary => !!d)
    const options = catalog.filter((d) => !data.links.includes(d.id)).sort((a, b) => a.title.localeCompare(b.title))

    // Nomes citados com [[…]] na sessão que ainda não estão no elenco.
    const cited = useMemo(() => {
        const text = [data.prep, data.recap, ...data.scenes.map((s) => s.md), ...data.encounters.map((e) => e.md)].join('\n')
        return wikiNames(text)
    }, [data.prep, data.recap, data.scenes, data.encounters])
    const byName = new Map(catalog.map((d) => [d.title.toLowerCase(), d]))
    const toLink = cited.map((n) => byName.get(n.toLowerCase())).filter((d): d is JournalSummary => !!d && !data.links.includes(d.id))
    const toCreate = cited.filter((n) => !byName.has(n.toLowerCase()))

    const create = async (title: string, k: CatalogKind) => {
        const id = await onCreate(k, title)
        if (id) onLinks([...data.links, id])
    }

    return (
        <Stack spacing={2}>
            {(toLink.length > 0 || toCreate.length > 0) && (
                <Alert severity="info" icon={false}>
                    <Typography variant="body2" sx={{ mb: 1 }}>Citados no texto desta sessão:</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {toLink.map((d) => (
                            <Chip key={d.id} size="small" icon={<AddIcon />} label={`Pôr no elenco: ${d.title}`} onClick={() => onLinks([...data.links, d.id])} />
                        ))}
                        {toCreate.map((n) => (
                            <Chip key={n} size="small" variant="outlined" icon={<AddIcon />} label={`Criar NPC: ${n}`} onClick={() => void create(n, 'npc')} />
                        ))}
                    </Stack>
                </Alert>
            )}

            {CATALOG_KINDS.map((k) => {
                const list = linked.filter((d) => d.kind === k)
                if (list.length === 0) return null
                return (
                    <Box key={k}>
                        <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: green.main, mb: 0.75 }}>{KIND_LABEL[k].many}</Typography>
                        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))' }}>
                            {list.map((d) => (
                                <Box key={d.id} sx={{
                                    display: 'flex', alignItems: 'center', gap: 1, p: 0.75, pl: 1,
                                    border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.paper,
                                }}>
                                    <Thumb url={d.image} name={d.title} />
                                    <Button onClick={() => onOpen(d.id)} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textTransform: 'none', color: 'text.primary', px: 0.5 }}>
                                        <Typography noWrap sx={{ fontWeight: 600 }}>{d.title}</Typography>
                                    </Button>
                                    <IconButton size="small" aria-label={`Tirar ${d.title} do elenco`} onClick={() => onLinks(data.links.filter((x) => x !== d.id))}>
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )
            })}
            {linked.length === 0 && (
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Ninguém no elenco ainda. Escolha do catálogo da campanha ou crie aqui.
                </Typography>
            )}

            <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Do catálogo</Typography>
                <Autocomplete
                    size="small"
                    options={options}
                    groupBy={(o) => KIND_LABEL[o.kind].many}
                    getOptionLabel={(o) => o.title}
                    value={null}
                    onChange={(_, v) => { if (v) onLinks([...data.links, v.id]) }}
                    renderInput={(params) => <TextField {...params} placeholder="Buscar NPC, local, item…" />}
                    noOptionsText="Nada no catálogo com esse nome"
                    blurOnSelect
                    clearOnBlur
                />
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 2, mb: 1 }}>Novo</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                        size="small"
                        select
                        value={kind}
                        onChange={(e) => setKind(e.target.value as CatalogKind)}
                        slotProps={{ select: { native: true }, htmlInput: { 'aria-label': 'Tipo' } }}
                        sx={{ minWidth: 120 }}
                    >
                        {CATALOG_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k].one}</option>)}
                    </TextField>
                    <TextField
                        size="small"
                        placeholder="Nome"
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 200))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { void create(name.trim(), kind); setName('') } }}
                        sx={{ flex: 1 }}
                    />
                    <Button variant="outlined" startIcon={<AddIcon />} disabled={!name.trim()} onClick={() => { void create(name.trim(), kind); setName('') }}>
                        Criar
                    </Button>
                </Stack>
            </Paper>
        </Stack>
    )
}

export const SessionView = memo(function SessionView({ doc, version, update, docs, publishedParty, onOpen, onCreate, onThreadStatus }: Props) {
    const [tab, setTab] = useState<TabKey>('prep')
    const mesa = useMesaInfo()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const data = doc.data

    const setData = useCallback((patch: Partial<SessionData> | ((d: SessionData) => Partial<SessionData>)) => {
        update((d) => ({ ...d, data: { ...d.data, ...(typeof patch === 'function' ? patch(d.data) : patch) } }))
    }, [update])

    const party = data.party ?? publishedParty ?? { level: 1, size: 4 }

    const setScene = (id: string, next: Scene) => setData((d) => ({ scenes: d.scenes.map((s) => (s.id === id ? next : s)) }))
    const setEncounter = (id: string, next: PlannedEncounter) =>
        setData((d) => ({ encounters: d.encounters.map((e) => (e.id === id ? next : e)) }))

    const today = diaryDayOf(Date.now())
    const startSession = async () => {
        setBusy(true)
        setError(null)
        if (!mesa.sessionStartedAt) {
            const out = await saveMesaSettings({ session: 'start' })
            if (!out.ok) { setError(out.error); setBusy(false); return }
        }
        setData({ playedOn: today, status: 'played' })
        setTab('log')
        setBusy(false)
    }
    const endSession = async () => {
        setBusy(true)
        const out = await saveMesaSettings({ session: 'end' })
        if (!out.ok) setError(out.error)
        setBusy(false)
    }

    const doneScenes = data.scenes.filter((s) => s.status === 'done').length
    const tabs: { key: TabKey; label: string; count?: number }[] = [
        { key: 'prep', label: 'Preparação' },
        { key: 'scenes', label: 'Cenas', count: data.scenes.length },
        { key: 'encounters', label: 'Encontros', count: data.encounters.length },
        { key: 'cast', label: 'Elenco', count: data.links.filter((id) => docs.some((d) => d.id === id && d.kind !== 'thread')).length },
        { key: 'log', label: 'Registro', count: data.log.length },
        { key: 'recap', label: 'Resumo' },
    ]

    return (
        <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                <TextField
                    size="small"
                    type="number"
                    label="Nº"
                    value={data.number}
                    onChange={(e) => {
                        const n = Math.max(0, Math.min(9999, parseInt(e.target.value, 10) || 0))
                        update((d) => ({ ...d, sort: n, data: { ...d.data, number: n } }))
                    }}
                    sx={{ width: 90 }}
                />
                <TextField
                    size="small"
                    type="date"
                    label="Marcada para"
                    value={data.plannedFor ?? ''}
                    onChange={(e) => setData({ plannedFor: e.target.value || null })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: { xs: '100%', sm: 180 } }}
                />
                <Chip
                    label={data.status === 'played' ? `Jogada${data.playedOn ? ` em ${data.playedOn.split('-').reverse().join('/')}` : ''}` : 'Planejada'}
                    onDelete={data.status === 'played' ? () => setData({ status: 'planned', playedOn: null }) : undefined}
                    sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, ...(data.status === 'played' ? { bgcolor: green.mid, color: parchment.paper } : {}) }}
                />
                <Box sx={{ flex: 1 }} />
                {mesa.sessionStartedAt && data.playedOn === today ? (
                    <Button variant="outlined" color="error" startIcon={<StopIcon />} disabled={busy} onClick={() => void endSession()}>
                        Encerrar a sessão
                    </Button>
                ) : (
                    <Button variant="contained" startIcon={<StartIcon />} disabled={busy} onClick={() => void startSession()}>
                        Começar a sessão
                    </Button>
                )}
                {data.playedOn && (
                    <Button component={RouterLink} to={`/historico?dia=${data.playedOn}`} startIcon={<HistoryIcon />}>
                        Rolagens deste dia
                    </Button>
                )}
            </Stack>
            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 300px' }, alignItems: 'start' }}>
                <Box sx={{ minWidth: 0 }}>
                    <Tabs
                        value={tab}
                        onChange={(_, v: TabKey) => setTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{ mb: 2, borderBottom: `1px solid ${rule}` }}
                    >
                        {tabs.map((t) => (
                            <Tab
                                key={t.key}
                                value={t.key}
                                sx={{ textTransform: 'none', minWidth: 0, px: 1.5 }}
                                label={(
                                    <Box component="span">
                                        {t.label}
                                        {!!t.count && (
                                            <Box component="span" sx={{ ml: 0.75, color: gold.deep, fontWeight: 700, fontSize: '0.8em', fontFamily: bodyFont }}>
                                                {t.key === 'scenes' ? `${doneScenes}/${t.count}` : t.count}
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            />
                        ))}
                    </Tabs>

                    {tab === 'prep' && (
                        <MarkdownEditor
                            key={`prep-${version}`}
                            value={data.prep}
                            onChange={(prep) => setData({ prep })}
                            imageName={doc.title}
                            template={TEMPLATES.prep}
                            minRows={16}
                            placeholder="Onde paramos, o objetivo da sessão, segredos e pistas…"
                            aria-label="Preparação da sessão"
                        />
                    )}

                    {tab === 'scenes' && (
                        <Stack spacing={2}>
                            {data.scenes.map((s, i) => (
                                <SceneCard
                                    key={s.id}
                                    scene={s}
                                    version={version}
                                    first={i === 0}
                                    last={i === data.scenes.length - 1}
                                    onChange={(next) => setScene(s.id, next)}
                                    onMove={(d) => setData((cur) => ({ scenes: move(cur.scenes, cur.scenes.findIndex((x) => x.id === s.id), d) }))}
                                    onRemove={() => {
                                        if (window.confirm(`Apagar a cena "${s.title || 'sem título'}"?`)) setData((cur) => ({ scenes: cur.scenes.filter((x) => x.id !== s.id) }))
                                    }}
                                />
                            ))}
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => setData((cur) => ({ scenes: [...cur.scenes, { id: newId('c'), title: `Cena ${cur.scenes.length + 1}`, md: '', status: 'planned' }] }))}
                                sx={{ alignSelf: 'flex-start' }}
                            >
                                Nova cena
                            </Button>
                        </Stack>
                    )}

                    {tab === 'encounters' && (
                        <Stack spacing={2}>
                            <Paper variant="outlined" sx={{ p: 1.5 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Grupo</Typography>
                                    <Stack direction="row" spacing={1.5}>
                                        <TextField
                                            size="small" type="number" label="Nível" value={party.level}
                                            onChange={(e) => setData({ party: { ...party, level: Math.max(-1, Math.min(25, parseInt(e.target.value, 10) || 1)) } })}
                                            sx={{ width: 90 }}
                                        />
                                        <TextField
                                            size="small" type="number" label="Personagens" value={party.size}
                                            onChange={(e) => setData({ party: { ...party, size: Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 4)) } })}
                                            sx={{ width: 120 }}
                                        />
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                        {data.party
                                            ? 'Definido à mão para esta sessão.'
                                            : publishedParty ? 'Pelas fichas publicadas da mesa.' : 'Sem fichas publicadas: ajuste à mão.'}
                                    </Typography>
                                    {data.party && publishedParty && (
                                        <Button size="small" onClick={() => setData({ party: null })}>Usar as fichas da mesa</Button>
                                    )}
                                </Stack>
                            </Paper>
                            {data.encounters.map((e) => (
                                <EncounterPlanner
                                    key={e.id}
                                    encounter={e}
                                    party={party}
                                    version={version}
                                    onChange={(next) => setEncounter(e.id, next)}
                                    onRemove={() => {
                                        if (window.confirm(`Apagar o encontro "${e.title || 'sem título'}"?`)) setData((cur) => ({ encounters: cur.encounters.filter((x) => x.id !== e.id) }))
                                    }}
                                />
                            ))}
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => setData((cur) => ({ encounters: [...cur.encounters, { id: newId('e'), title: `Encontro ${cur.encounters.length + 1}`, md: '', creatures: [], status: 'planned' }] }))}
                                sx={{ alignSelf: 'flex-start' }}
                            >
                                Novo encontro
                            </Button>
                        </Stack>
                    )}

                    {tab === 'cast' && (
                        <CastPanel data={data} docs={docs} onLinks={(links) => setData({ links })} onOpen={onOpen} onCreate={onCreate} />
                    )}

                    {tab === 'log' && <SessionLog log={data.log} onChange={(log) => setData({ log })} />}

                    {tab === 'recap' && (
                        <MarkdownEditor
                            key={`recap-${version}`}
                            value={data.recap}
                            onChange={(recap) => setData({ recap })}
                            imageName={doc.title}
                            template={TEMPLATES.recap}
                            minRows={12}
                            placeholder="O que aconteceu, ganchos para a próxima, recompensas dadas…"
                            aria-label="Resumo da sessão"
                        />
                    )}
                </Box>
                <ThreadsPanel
                    docs={docs}
                    sessionId={doc.id}
                    linked={data.links}
                    onOpen={onOpen}
                    onLink={(id) => setData((d) => ({ links: d.links.includes(id) ? d.links : [...d.links, id] }))}
                    onStatus={onThreadStatus}
                    onCreate={async (title) => {
                        const id = await onCreate('thread', title, doc.id)
                        if (id) setData((d) => ({ links: [...d.links, id] }))
                    }}
                />
            </Box>
        </Box>
    )
})
