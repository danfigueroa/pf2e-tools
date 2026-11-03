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
import { fetchMonster } from '../../../services/monster'
import { scaleMonster, clampLevel } from '../../monster-scaler/scaling'
import { npcFromScaled } from '../../monster-scaler/toCombatant'
import { listMaps } from '../../../services/maps'
import { chrome, displayFont, gold, ink, parchment, rule, status as statusColor, greenInk } from '../../../theme'
import { encounterXp, THREAT_LABEL, THREATS, type Threat } from '../xp'
import type { EncounterStatus, PlannedEncounter } from '../doc'
import { TEMPLATES } from '../templates'
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor'
import { tr } from '../../../i18n'

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

const STATUS_LABEL: Record<EncounterStatus, string> = { planned: tr('Planejado', 'Planned'), sent: tr('Na Iniciativa', 'In Initiative'), done: tr('Feito', 'Done') }

interface Props {
    encounter: PlannedEncounter
    party: { level: number; size: number }
    version: number
    onChange: (next: PlannedEncounter) => void
    onRemove: () => void
}

function XpBar({ total, budgets }: { total: number; budgets: Record<Threat, number> }) {
    const max = Math.max(budgets.extreme * 1.15, total)
    const marks = THREATS.filter((t) => t !== 'trivial')
    return (
        <Box sx={{ mt: 1, mb: 1.5 }}>
            <Box sx={{ position: 'relative', height: 18 }}>
                <Box sx={{ position: 'absolute', inset: '4px 0', bgcolor: parchment.sunken, borderRadius: 1 }} />
                <Box sx={{
                    position: 'absolute', top: 4, bottom: 4, left: 0, width: `${(Math.min(total, max) / max) * 100}%`,
                    bgcolor: greenInk.mid, borderRadius: 1, transition: 'width 200ms ease',
                }} />
                {marks.map((t) => (
                    <Box key={t} sx={{ position: 'absolute', left: `${(budgets[t] / max) * 100}%`, top: 0, bottom: 0, width: '2px', bgcolor: THREAT_COLOR[t] }} />
                ))}
            </Box>
            {/* Legenda em linha, não sobre a barra: Baixa e Moderada ficam a 20 XP uma da outra. */}
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                {marks.map((t) => (
                    <Typography key={t} variant="caption" sx={{ color: THREAT_COLOR[t], display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box component="span" sx={{ width: 8, height: 8, bgcolor: THREAT_COLOR[t], display: 'inline-block' }} />
                        {THREAT_LABEL[t]} {budgets[t]}
                    </Typography>
                ))}
            </Stack>
        </Box>
    )
}

export const EncounterPlanner = memo(function EncounterPlanner({ encounter, party, version, onChange, onRemove }: Props) {
    const navigate = useNavigate()
    const [searching, setSearching] = useState(encounter.creatures.length === 0)
    const [mapName, setMapName] = useState<string | null>(null)
    const xp = useMemo(() => encounterXp(
        encounter.creatures.map((c) => ({ name: c.creature.name, level: c.level ?? c.creature.level, count: c.count })),
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

    const setLevel = (i: number, level: number) => set({
        creatures: encounter.creatures.map((c, j) => {
            if (j !== i) return c
            const next = clampLevel(level)
            return next === c.creature.level
                ? { creature: c.creature, count: c.count }
                : { ...c, level: next }
        }),
    })

    const [sending, setSending] = useState(false)
    const [sendError, setSendError] = useState<string | null>(null)
    const send = async () => {
        setSending(true)
        setSendError(null)
        try {
            const groups = await Promise.all(encounter.creatures.map(async ({ creature, count, level }) => {
                if (level === undefined || level === creature.level) {
                    return Array.from({ length: count }, (_, i) => npcFromCreature(creature, count > 1 ? i : 0))
                }
                // Escalada: precisa da ficha completa da AON, não só do resumo da busca.
                const detail = await fetchMonster(creature.name)
                if (!detail) throw new Error(tr(`Não deu para carregar a ficha de "${creature.name}" para escalar.`, `Couldn't load "${creature.name}"'s sheet to scale it.`))
                const scaled = scaleMonster(detail, level, {}, null)
                return Array.from({ length: count }, (_, i) => npcFromScaled(scaled, count > 1 ? i : 0))
            }))
            appendCombatants(groups.flat())
            set({ status: 'sent' })
            navigate('/iniciativa')
        } catch (e) {
            setSendError(e instanceof Error ? e.message : tr('Não deu para enviar o encontro.', 'Couldn\'t send the encounter.'))
        } finally {
            setSending(false)
        }
    }

    const total = encounter.creatures.reduce((n, c) => n + c.count, 0)

    return (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: parchment.paper }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <TextField
                    size="small"
                    label={tr("Encontro", 'Encounter')}
                    value={encounter.title}
                    onChange={(e) => set({ title: e.target.value.slice(0, 120) })}
                    sx={{ flex: 1, minWidth: 0 }}
                />
                <IconButton aria-label={tr(`Apagar o encontro ${encounter.title}`, `Delete the encounter ${encounter.title}`)} onClick={onRemove}><DeleteIcon /></IconButton>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
                <Chip
                    label={tr(`Ameaça ${THREAT_LABEL[xp.threat].toLowerCase()}`, `${THREAT_LABEL[xp.threat]} threat`)}
                    sx={{ bgcolor: THREAT_COLOR[xp.threat], color: chrome.onAccent, fontWeight: 700 }}
                />
                <Typography sx={{ fontFamily: displayFont, fontWeight: 700 }}>{xp.total} XP</Typography>
                <Typography variant="body2" color="text.secondary">
                    {tr('para ', 'for ')}{party.size} {tr('personagens de nível ', 'characters of level ')}{party.level}
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
                    {tr('Fora da tabela do GM Core (mais de 4 níveis do grupo), sem XP na conta:', 'Outside the GM Core table (more than 4 levels from the group), no XP counted:')}{' '}
                    {xp.outOfRange.map((o) => `${o.name} (${o.diff > 0 ? '+' : ''}${o.diff})`).join(', ')}.
                </Alert>
            )}

            <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                {encounter.creatures.map((c, i) => {
                    const lvl = c.level ?? c.creature.level
                    const diff = lvl - party.level
                    return (
                        <Box key={`${c.creature.name}-${i}`} sx={{
                            display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
                            border: `1px solid ${rule}`, borderRadius: 1, bgcolor: parchment.page,
                        }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 600 }} noWrap>{c.creature.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {tr('Nível ', 'Level ')}{lvl} ({diff >= 0 ? '+' : ''}{diff})
                                    {c.level !== undefined ? tr(` · escalada do nível ${c.creature.level}`, ` · scaled from level ${c.creature.level}`) : tr(` · CA ${c.creature.ac} · PV ${c.creature.hp}`, ` · AC ${c.creature.ac} · HP ${c.creature.hp}`)}
                                </Typography>
                            </Box>
                            <IconButton size="small" aria-label={tr(`Diminuir o nível de ${c.creature.name}`, `Lower ${c.creature.name}'s level`)} onClick={() => setLevel(i, lvl - 1)}>
                                <RemoveIcon fontSize="small" sx={{ color: gold.deep }} />
                            </IconButton>
                            <Typography variant="caption" sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700, color: gold.deep }}>
                                N{lvl}
                            </Typography>
                            <IconButton size="small" aria-label={tr(`Aumentar o nível de ${c.creature.name}`, `Raise ${c.creature.name}'s level`)} onClick={() => setLevel(i, lvl + 1)}>
                                <AddIcon fontSize="small" sx={{ color: gold.deep }} />
                            </IconButton>
                            <Box sx={{ width: 8 }} />
                            <IconButton size="small" aria-label={tr(`Um ${c.creature.name} a menos`, `One fewer ${c.creature.name}`)} onClick={() => setCount(i, c.count - 1)}>
                                <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{c.count}</Typography>
                            <IconButton size="small" aria-label={tr(`Um ${c.creature.name} a mais`, `One more ${c.creature.name}`)} onClick={() => setCount(i, c.count + 1)}>
                                <AddIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" aria-label={tr(`Tirar ${c.creature.name}`, `Remove ${c.creature.name}`)} onClick={() => setCount(i, 0)}>
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
                sx={{ mb: 1, color: greenInk.mid }}
            >
                {searching ? tr('Fechar a busca', 'Close the search') : tr('Adicionar criaturas da AON', 'Add creatures from AON')}
            </Button>
            <Collapse in={searching} unmountOnExit>
                <Box sx={{ mb: 2, p: 1.5, border: `1px dashed ${gold.main}`, borderRadius: 1 }}>
                    <AonCreatureSearch
                        onPick={(creature, count) => {
                            const i = encounter.creatures.findIndex((c) => c.creature.name === creature.name && c.level === undefined)
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
                imageName={encounter.title || tr('encontro', 'encounter')}
                template={TEMPLATES.encounter}
                minRows={4}
                placeholder={tr("Terreno, táticas, recompensa…", 'Terrain, tactics, reward…')}
                aria-label={tr(`Notas do encontro ${encounter.title}`, `Notes for the encounter ${encounter.title}`)}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mt: 1.5 }}>
                <Button variant="contained" startIcon={<SendIcon />} disabled={total === 0 || sending} onClick={() => void send()}>
                    {sending ? tr('Enviando…', 'Sending…') : tr('Enviar para a Iniciativa', 'Send to Initiative')}
                </Button>
                <Typography variant="caption" color="text.secondary">
                    {total === 0
                        ? tr('Adicione criaturas para enviar.', 'Add creatures to send.')
                        : tr(`${total} combatente${total > 1 ? 's' : ''} no encontro ${mapName ? `do mapa "${mapName}"` : 'aberto na Iniciativa'}.`, `${total} combatant${total > 1 ? 's' : ''} in the encounter ${mapName ? `of the map "${mapName}"` : 'open in Initiative'}.`)}
                </Typography>
            </Stack>
            {sendError && <Alert severity="error" sx={{ mt: 1 }}>{sendError}</Alert>}
        </Paper>
    )
})
