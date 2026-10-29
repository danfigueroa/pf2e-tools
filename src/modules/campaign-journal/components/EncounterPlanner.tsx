import { memo, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Alert, Box, Button, Chip, Collapse, IconButton, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import {
    Add as AddIcon, Remove as RemoveIcon, Close as CloseIcon, PlayArrow as SendIcon, Delete as DeleteIcon,
    ExpandMore, ExpandLess,
} from '@mui/icons-material'
import { AonCreatureSearch } from '../../initiative-tracker/components/AonCreatureSearch'
import { npcFromCreature } from '../../initiative-tracker/importCharacter'
import { appendCombatants, currentMapId } from '../../initiative-tracker/encounterStorage'
import { listMaps } from '../../../services/maps'
import { chrome, displayFont, gold, green, ink, parchment, rule, status as statusColor } from '../../../theme'
import { encounterXp, THREAT_LABEL, THREATS, type Threat } from '../xp'
import type { EncounterStatus, PlannedEncounter } from '../doc'
import { TEMPLATES } from '../templates'
import { MarkdownEditor } from './MarkdownEditor'

// Um encontro planejado: criaturas da AON (a mesma busca da Iniciativa), o
// orçamento de XP do GM Core para o grupo e o botão que manda tudo para a
// Iniciativa — no encontro do mapa que está aberto lá, como o Escalar Monstro.

const THREAT_COLOR: Record<Threat, string> = {
    trivial: ink.secondary,
    low: statusColor.success,
    moderate: statusColor.info,
    // O âmbar de aviso não chega a 4,5:1 com texto branco.
    severe: gold.deep,
    extreme: statusColor.error,
}

const STATUS_LABEL: Record<EncounterStatus, string> = { planned: 'Planejado', sent: 'Na Iniciativa', done: 'Feito' }

interface Props {
    encounter: PlannedEncounter
    party: { level: number; size: number }
    version: number
    onChange: (next: PlannedEncounter) => void
    onRemove: () => void
}

function XpBar({ total, budgets }: { total: number; budgets: Record<Threat, number> }) {
    const max = Math.max(budgets.extreme * 1.15, total)
    return (
        <Box sx={{ position: 'relative', height: 26, mt: 1, mb: 2.5 }}>
            <Box sx={{ position: 'absolute', inset: '8px 0', bgcolor: parchment.sunken, borderRadius: 1 }} />
            <Box sx={{
                position: 'absolute', top: 8, bottom: 8, left: 0, width: `${(Math.min(total, max) / max) * 100}%`,
                bgcolor: green.mid, borderRadius: 1, transition: 'width 200ms ease',
            }} />
            {THREATS.filter((t) => t !== 'trivial').map((t) => (
                <Box key={t} sx={{ position: 'absolute', left: `${(budgets[t] / max) * 100}%`, top: 0, bottom: 0 }}>
                    <Box sx={{ width: '2px', height: '100%', bgcolor: THREAT_COLOR[t] }} />
                    <Typography
                        variant="caption"
                        sx={{ position: 'absolute', top: 26, transform: 'translateX(-50%)', whiteSpace: 'nowrap', color: THREAT_COLOR[t], fontSize: '0.68rem' }}
                    >
                        {THREAT_LABEL[t]} {budgets[t]}
                    </Typography>
                </Box>
            ))}
        </Box>
    )
}

export const EncounterPlanner = memo(function EncounterPlanner({ encounter, party, version, onChange, onRemove }: Props) {
    const navigate = useNavigate()
    const [searching, setSearching] = useState(encounter.creatures.length === 0)
    const [mapName, setMapName] = useState<string | null>(null)
    const xp = useMemo(() => encounterXp(
        encounter.creatures.map((c) => ({ name: c.creature.name, level: c.creature.level, count: c.count })),
        party.level, party.size,
    ), [encounter.creatures, party.level, party.size])

    // Para onde o "Enviar" manda: o encontro do mapa aberto na Iniciativa.
    useEffect(() => {
        const id = currentMapId()
        if (!id) return
        let alive = true
        void listMaps({ gm: true }).then(({ maps }) => { if (alive) setMapName(maps.find((m) => m.id === id)?.name ?? null) }).catch(() => {})
        return () => { alive = false }
    }, [])

    const set = (patch: Partial<PlannedEncounter>) => onChange({ ...encounter, ...patch })
    const setCount = (i: number, count: number) => set({
        creatures: count <= 0
            ? encounter.creatures.filter((_, j) => j !== i)
            : encounter.creatures.map((c, j) => (j === i ? { ...c, count: Math.min(20, count) } : c)),
    })

    const send = () => {
        const combatants = encounter.creatures.flatMap(({ creature, count }) =>
            Array.from({ length: count }, (_, i) => npcFromCreature(creature, count > 1 ? i : 0)))
        appendCombatants(combatants)
        set({ status: 'sent' })
        navigate('/iniciativa')
    }

    const total = encounter.creatures.reduce((n, c) => n + c.count, 0)

    return (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: parchment.paper }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <TextField
                    size="small"
                    label="Encontro"
                    value={encounter.title}
                    onChange={(e) => set({ title: e.target.value.slice(0, 120) })}
                    sx={{ flex: 1, minWidth: 0 }}
                />
                <IconButton aria-label={`Apagar o encontro ${encounter.title}`} onClick={onRemove}><DeleteIcon /></IconButton>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                <Chip
                    label={`Ameaça ${THREAT_LABEL[xp.threat].toLowerCase()}`}
                    sx={{ bgcolor: THREAT_COLOR[xp.threat], color: chrome.onAccent, fontWeight: 700 }}
                />
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700 }}>{xp.total} XP</Typography>
                <Typography variant="body2" color="text.secondary">
                    para {party.size} personagens de nível {party.level}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={encounter.status}
                    onChange={(_, v: EncounterStatus | null) => { if (v) set({ status: v }) }}
                    sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 1, textTransform: 'none' } }}
                >
                    {(Object.keys(STATUS_LABEL) as EncounterStatus[]).map((s) => (
                        <ToggleButton key={s} value={s}>{STATUS_LABEL[s]}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Stack>
            <XpBar total={xp.total} budgets={xp.budgets} />
            {xp.outOfRange.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                    Fora da tabela do GM Core (mais de 4 níveis do grupo), sem XP na conta:{' '}
                    {xp.outOfRange.map((o) => `${o.name} (${o.diff > 0 ? '+' : ''}${o.diff})`).join(', ')}.
                </Alert>
            )}

            <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                {encounter.creatures.map((c, i) => {
                    const diff = c.creature.level - party.level
                    return (
                        <Box key={`${c.creature.name}-${i}`} sx={{
                            display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
                            border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.page,
                        }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 600 }} noWrap>{c.creature.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Nível {c.creature.level} ({diff >= 0 ? '+' : ''}{diff}) · CA {c.creature.ac} · PV {c.creature.hp}
                                </Typography>
                            </Box>
                            <IconButton size="small" aria-label={`Um ${c.creature.name} a menos`} onClick={() => setCount(i, c.count - 1)}>
                                <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{c.count}</Typography>
                            <IconButton size="small" aria-label={`Um ${c.creature.name} a mais`} onClick={() => setCount(i, c.count + 1)}>
                                <AddIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label={`Tirar ${c.creature.name}`} onClick={() => setCount(i, 0)}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    )
                })}
            </Stack>

            <Button
                size="small"
                startIcon={searching ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setSearching((v) => !v)}
                sx={{ mb: 1, color: green.mid }}
            >
                {searching ? 'Fechar a busca' : 'Adicionar criaturas da AON'}
            </Button>
            <Collapse in={searching} unmountOnExit>
                <Box sx={{ mb: 2, p: 1.5, border: `1px dashed ${gold.main}`, borderRadius: 1 }}>
                    <AonCreatureSearch
                        onPick={(creature, count) => {
                            const i = encounter.creatures.findIndex((c) => c.creature.name === creature.name)
                            set({
                                creatures: i >= 0
                                    ? encounter.creatures.map((c, j) => (j === i ? { ...c, count: Math.min(20, c.count + count) } : c))
                                    : [...encounter.creatures, { creature, count }],
                            })
                        }}
                    />
                </Box>
            </Collapse>

            <MarkdownEditor
                key={`${encounter.id}-${version}`}
                value={encounter.md}
                onChange={(md) => set({ md })}
                imageName={encounter.title || 'encontro'}
                template={TEMPLATES.encounter}
                minRows={4}
                placeholder="Terreno, táticas, recompensa…"
                aria-label={`Notas do encontro ${encounter.title}`}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 1.5 }}>
                <Button variant="contained" startIcon={<SendIcon />} disabled={total === 0} onClick={send}>
                    Enviar para a Iniciativa
                </Button>
                <Typography variant="caption" color="text.secondary">
                    {total === 0
                        ? 'Adicione criaturas para enviar.'
                        : `${total} combatente${total > 1 ? 's' : ''} no encontro ${mapName ? `do mapa "${mapName}"` : 'aberto na Iniciativa'}.`}
                </Typography>
            </Stack>
        </Paper>
    )
})
