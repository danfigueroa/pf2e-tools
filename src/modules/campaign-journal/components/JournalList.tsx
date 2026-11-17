import { memo, useMemo, useState } from 'react'
import {
    Box, Button, Chip, InputAdornment, List, ListItemButton, ListItemText, Menu, MenuItem, Stack, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material'
import { displayFont, gold, parchment, rule, greenInk } from '../../../theme'
import { CATALOG_KINDS, KIND_LABEL, type CatalogKind, type DocKind, type JournalSummary, type ThreadStatus } from '../doc'
import { THREAD_COLOR } from '../threadStyle'
import { isOpponent } from '../../wiki/kinds'
import { tr } from '../../../i18n'

// O índice do diário: as sessões (a mais nova no topo), o catálogo da campanha
// por tipo e os ganchos. A busca é pelo título, sem acento.

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
    docs: JournalSummary[]
    selected: string | null
    onOpen: (id: string) => void
    onNew: (kind: DocKind) => void
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" sx={{ px: 1, mb: 0.5 }}>
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: greenInk.main, fontSize: '0.95rem', flex: 1 }}>{title}</Typography>
                {action}
            </Stack>
            {children}
        </Box>
    )
}

export const JournalList = memo(function JournalList({ docs, selected, onOpen, onNew }: Props) {
    const [query, setQuery] = useState('')
    // Um tipo, ou "Oponentes" (o papel na história, que vale para NPC e criatura).
    const [kind, setKind] = useState<CatalogKind | 'opponents' | null>(null)
    const [menu, setMenu] = useState<HTMLElement | null>(null)
    const q = fold(query.trim())
    const match = (d: JournalSummary) => !q || fold(d.title).includes(q)

    const sessions = useMemo(() => docs.filter((d) => d.kind === 'session').sort((a, b) => b.sort - a.sort || b.updatedAt - a.updatedAt), [docs])
    const catalog = useMemo(() => docs.filter((d) => (CATALOG_KINDS as readonly string[]).includes(d.kind)).sort((a, b) => a.title.localeCompare(b.title)), [docs])
    const threads = useMemo(() => docs.filter((d) => d.kind === 'thread').sort((a, b) =>
        (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0) || a.title.localeCompare(b.title)), [docs])

    const item = (d: JournalSummary, secondary?: string, dot?: string) => (
        <ListItemButton
            key={d.id}
            selected={d.id === selected}
            onClick={() => onOpen(d.id)}
            sx={{
                borderRadius: 1, py: 0.5,
                '&.Mui-selected': { bgcolor: parchment.sunken, borderLeft: `3px solid ${gold.main}` },
            }}
        >
            {dot && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot, mr: 1, flexShrink: 0 }} />}
            <ListItemText
                primary={d.title}
                secondary={secondary}
                slotProps={{ primary: { noWrap: true, sx: { fontWeight: d.id === selected ? 700 : 500 } }, secondary: { noWrap: true } }}
            />
        </ListItemButton>
    )

    const opponents = catalog.filter((d) => isOpponent(d.badges.part)).length
    const shownCatalog = catalog.filter((d) => (!kind || (kind === 'opponents' ? isOpponent(d.badges.part) : d.kind === kind)) && match(d))
    const catalogLine = (d: JournalSummary) => [kind && kind !== 'opponents' ? '' : KIND_LABEL[d.kind].one, d.badges.part ?? '']
        .filter(Boolean).join(' · ') || undefined
    return (
        <Box>
            <TextField
                size="small"
                fullWidth
                placeholder={tr("Buscar no diário", 'Search the journal')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                sx={{ mb: 1.5 }}
            />
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => onNew('session')} sx={{ flex: 1 }}>{tr('Sessão', 'Session')}</Button>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={(e) => setMenu(e.currentTarget)} sx={{ flex: 1 }}>{tr('Ficha', 'Entry')}</Button>
                <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
                    {[...CATALOG_KINDS, 'thread' as const].map((k) => (
                        <MenuItem key={k} onClick={() => { setMenu(null); onNew(k) }}>{KIND_LABEL[k].one}</MenuItem>
                    ))}
                </Menu>
            </Stack>

            <Section title={tr("Sessões", 'Sessions')}>
                <List dense disablePadding>
                    {sessions.filter(match).map((d) => item(d, d.status === 'played' ? tr('Jogada', 'Played') : tr('Planejada', 'Planned'), d.status === 'played' ? greenInk.mid : gold.main))}
                </List>
                {sessions.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 1, fontStyle: 'italic' }}>{tr('Nenhuma sessão ainda.', 'No sessions yet.')}</Typography>}
            </Section>

            <Section title={tr("Catálogo da campanha", 'Campaign catalog')}>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1, mb: 0.75 }}>
                    <Chip size="small" label={tr("Tudo", 'All')} variant={kind ? 'outlined' : 'filled'} onClick={() => setKind(null)} />
                    {CATALOG_KINDS.filter((k) => catalog.some((d) => d.kind === k)).map((k) => (
                        <Chip key={k} size="small" label={KIND_LABEL[k].many} variant={kind === k ? 'filled' : 'outlined'} onClick={() => setKind(k)} />
                    ))}
                    {opponents > 0 && (
                        <Chip size="small" label={tr(`Oponentes · ${opponents}`, `Opponents · ${opponents}`)} variant={kind === 'opponents' ? 'filled' : 'outlined'} onClick={() => setKind('opponents')} />
                    )}
                </Stack>
                <List dense disablePadding>
                    {shownCatalog.map((d) => item(d, catalogLine(d)))}
                </List>
                {catalog.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1, fontStyle: 'italic' }}>
                        {tr('NPCs, criaturas, locais, itens, perigos… o que serve a várias sessões e vai inteiro para a Wiki.', 'NPCs, creatures, places, items, hazards… what serves several sessions and goes whole to the wiki.')}</Typography>
                )}
            </Section>

            <Section title={tr("Ganchos", 'Hooks')}>
                <List dense disablePadding>
                    {threads.filter(match).map((d) => item(d, undefined, THREAD_COLOR[(d.status as ThreadStatus | null) ?? 'open']))}
                </List>
                {threads.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 1, fontStyle: 'italic' }}>{tr('Pistas, segredos e pendências.', 'Clues, secrets and loose ends.')}</Typography>}
            </Section>
            <Box sx={{ borderTop: `1px solid ${rule}`, pt: 1, px: 1 }}>
                <Typography variant="caption" color="text.secondary">{tr('Só o GM vê o diário. O que for para a mesa sai pelo "Mostrar à mesa".', 'Only the GM sees the journal. What goes to the table goes out through "Show the table".')}</Typography>
            </Box>
        </Box>
    )
})
