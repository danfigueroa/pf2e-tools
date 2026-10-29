import { memo, useMemo, useState } from 'react'
import {
    Box, Button, Chip, InputAdornment, List, ListItemButton, ListItemText, Menu, MenuItem, Stack, TextField, Typography,
} from '@mui/material'
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material'
import { displayFont, gold, green, parchment, rule } from '../../../theme'
import { CATALOG_KINDS, KIND_LABEL, type CatalogKind, type DocKind, type JournalSummary, type ThreadStatus } from '../doc'
import { THREAD_COLOR } from '../threadStyle'

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
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700, color: green.main, fontSize: '0.95rem', flex: 1 }}>{title}</Typography>
                {action}
            </Stack>
            {children}
        </Box>
    )
}

export const JournalList = memo(function JournalList({ docs, selected, onOpen, onNew }: Props) {
    const [query, setQuery] = useState('')
    const [kind, setKind] = useState<CatalogKind | null>(null)
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

    const shownCatalog = catalog.filter((d) => (!kind || d.kind === kind) && match(d))
    return (
        <Box>
            <TextField
                size="small"
                fullWidth
                placeholder="Buscar no diário"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                sx={{ mb: 1.5 }}
            />
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => onNew('session')} sx={{ flex: 1 }}>Sessão</Button>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={(e) => setMenu(e.currentTarget)} sx={{ flex: 1 }}>Ficha</Button>
                <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
                    {[...CATALOG_KINDS, 'thread' as const].map((k) => (
                        <MenuItem key={k} onClick={() => { setMenu(null); onNew(k) }}>{KIND_LABEL[k].one}</MenuItem>
                    ))}
                </Menu>
            </Stack>

            <Section title="Sessões">
                <List dense disablePadding>
                    {sessions.filter(match).map((d) => item(d, d.status === 'played' ? 'Jogada' : 'Planejada', d.status === 'played' ? green.mid : gold.main))}
                </List>
                {sessions.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 1, fontStyle: 'italic' }}>Nenhuma sessão ainda.</Typography>}
            </Section>

            <Section title="Catálogo da campanha">
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ px: 1, mb: 0.75 }}>
                    <Chip size="small" label="Tudo" variant={kind ? 'outlined' : 'filled'} onClick={() => setKind(null)} />
                    {CATALOG_KINDS.filter((k) => catalog.some((d) => d.kind === k)).map((k) => (
                        <Chip key={k} size="small" label={KIND_LABEL[k].many} variant={kind === k ? 'filled' : 'outlined'} onClick={() => setKind(k)} />
                    ))}
                </Stack>
                <List dense disablePadding>
                    {shownCatalog.map((d) => item(d, kind ? undefined : KIND_LABEL[d.kind].one))}
                </List>
                {catalog.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1, fontStyle: 'italic' }}>
                        NPCs, locais, itens e facções que servem a várias sessões.
                    </Typography>
                )}
            </Section>

            <Section title="Ganchos">
                <List dense disablePadding>
                    {threads.filter(match).map((d) => item(d, undefined, THREAD_COLOR[(d.status as ThreadStatus | null) ?? 'open']))}
                </List>
                {threads.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ px: 1, fontStyle: 'italic' }}>Pistas, segredos e pendências.</Typography>}
            </Section>
            <Box sx={{ borderTop: `1px solid ${rule}`, pt: 1, px: 1 }}>
                <Typography variant="caption" color="text.secondary">Só o GM vê o diário. O que for para a mesa sai pelo "Mostrar à mesa".</Typography>
            </Box>
        </Box>
    )
})
