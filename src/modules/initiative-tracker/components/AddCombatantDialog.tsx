import { useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { Check as CheckIcon, CloudUpload as UploadIcon, Person as PersonIcon } from '@mui/icons-material'
import { gold, green, ink, parchment } from '../../../theme'
import { CAMPAIGN_PRESETS } from '../../character-viewer/campaignPresets'
import { charSlugFromName } from '../../character-viewer/charId'
import { parseCharacterJson } from '../../character-sheet/types'
import { npcFromManual, pcFromBuild } from '../importCharacter'
import { AonCreatureSearch } from './AonCreatureSearch'
import type { Combatant } from '../types'

interface Props {
    open: boolean
    onClose: () => void
    onAdd: (combatants: Combatant[]) => void
    /** Slugs já no encontro, para não importar o mesmo personagem duas vezes. */
    existingSlugs: string[]
}

export const AddCombatantDialog = ({ open, onClose, onAdd, existingSlugs }: Props) => {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const [tab, setTab] = useState(0)

    /**
     * `close: false` serve para adicionar mantendo o diálogo aberto — é o que a
     * aba de personagens usa quando parte da seleção falhou: as fichas que
     * carregaram entram e a mensagem sobre as que faltaram continua à vista.
     */
    const add = (combatants: Combatant[], close = true) => {
        if (combatants.length > 0) onAdd(combatants)
        if (close) onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>Adicionar ao combate</DialogTitle>

            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="fullWidth"
                sx={{ borderBottom: `2px solid ${gold.main}`, mt: 1 }}
            >
                <Tab label="Personagem" />
                <Tab label="Monstro" />
                <Tab label="Buscar AON" />
            </Tabs>

            <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, pt: 2 }}>
                {tab === 0 && <CharacterTab onAdd={add} existingSlugs={existingSlugs} />}
                {tab === 1 && <ManualTab onAdd={add} />}
                {tab === 2 && <AonCreatureSearch onAdd={add} />}
            </DialogContent>
        </Dialog>
    )
}

// --- Aba 1: personagens da campanha ou JSON do Pathbuilder -------------------

const CharacterTab = ({
    onAdd,
    existingSlugs,
}: {
    onAdd: (c: Combatant[], close?: boolean) => void
    existingSlugs: string[]
}) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Quem já está no combate não entra na seleção nem no "selecionar todos".
    const available = CAMPAIGN_PRESETS.filter(
        (p) => !existingSlugs.includes(charSlugFromName(p.name)),
    )
    const allSelected = available.length > 0 && available.every((p) => selected.has(p.filename))

    const toggle = (filename: string) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(filename)) next.delete(filename)
            else next.add(filename)
            return next
        })
    }

    const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(available.map((p) => p.filename)))
    }

    const buildFrom = (json: unknown, preset?: { filename: string; klass: string }) =>
        pcFromBuild(parseCharacterJson(json), preset)

    /**
     * Carrega as fichas em paralelo. Uma que falhe NÃO derruba as outras: as que
     * vieram entram no combate e só as que faltaram viram mensagem — refazer a
     * seleção inteira por causa de um arquivo seria pior do que o problema.
     */
    const addSelected = async () => {
        const chosen = CAMPAIGN_PRESETS.filter((p) => selected.has(p.filename))
        if (chosen.length === 0) return
        setLoading(true)
        setError(null)

        const results = await Promise.all(chosen.map(async (preset) => {
            try {
                const res = await fetch(`/characters/${preset.filename}`)
                if (!res.ok) throw new Error(String(res.status))
                const combatant = buildFrom(await res.json(), {
                    filename: preset.filename,
                    klass: preset.class,
                })
                return { preset, combatant }
            } catch {
                return { preset, combatant: null }
            }
        }))
        setLoading(false)

        const ok = results.filter((r) => r.combatant !== null).map((r) => r.combatant as Combatant)
        const failed = results.filter((r) => r.combatant === null).map((r) => r.preset)

        if (failed.length === 0) {
            onAdd(ok)
            return
        }
        // Mantém o diálogo aberto para a mensagem não sumir junto com ele.
        onAdd(ok, false)
        setSelected(new Set(failed.map((p) => p.filename)))
        setError(
            failed.length === 1
                ? `Não foi possível carregar a ficha de ${failed[0].name}.`
                : `Não foi possível carregar: ${failed.map((p) => p.name).join(', ')}.`,
        )
    }

    const count = selected.size

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="overline" sx={{ color: ink.secondary }}>
                    Fichas da campanha
                </Typography>
                <Button size="small" onClick={toggleAll} disabled={available.length === 0 || loading}>
                    {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
                </Button>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 1,
                    mt: 0.5,
                    mb: 1.5,
                }}
            >
                {CAMPAIGN_PRESETS.map((preset) => {
                    const already = existingSlugs.includes(charSlugFromName(preset.name))
                    const isSelected = selected.has(preset.filename)
                    return (
                        <Card
                            key={preset.filename}
                            sx={{
                                opacity: already ? 0.5 : 1,
                                borderColor: isSelected ? gold.main : undefined,
                                borderWidth: isSelected ? 2 : 1,
                            }}
                        >
                            <CardActionArea
                                disabled={already || loading}
                                onClick={() => toggle(preset.filename)}
                                aria-pressed={isSelected}
                                sx={{ backgroundColor: isSelected ? parchment.sunken : undefined }}
                            >
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, textAlign: 'center' }}>
                                    {isSelected
                                        ? <CheckIcon sx={{ color: gold.deep }} />
                                        : <PersonIcon sx={{ color: green.main }} />}
                                    <Typography sx={{ fontWeight: 700 }} noWrap>{preset.name}</Typography>
                                    <Typography variant="caption" sx={{ color: ink.secondary }}>
                                        {already ? 'já no combate' : `${preset.class} ${preset.level}`}
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    )
                })}
            </Box>

            <Button
                fullWidth
                variant="contained"
                onClick={addSelected}
                disabled={count === 0 || loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
                sx={{ mb: 2.5 }}
            >
                {loading
                    ? 'Carregando…'
                    : count === 0
                        ? 'Selecione ao menos um personagem'
                        : `Adicionar ${count} ${count > 1 ? 'personagens' : 'personagem'}`}
            </Button>

            <Button
                fullWidth
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => inputRef.current?.click()}
                disabled={loading}
            >
                Carregar JSON do Pathbuilder
            </Button>
            <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                // Vários de uma vez, pela mesma razão dos presets: um grupo
                // inteiro é o caso normal no começo da sessão.
                multiple
                hidden
                onChange={async (e) => {
                    const files = Array.from(e.target.files ?? [])
                    e.target.value = ''
                    if (files.length === 0) return
                    setError(null)

                    const built: Combatant[] = []
                    const bad: string[] = []
                    for (const file of files) {
                        try {
                            built.push(buildFrom(JSON.parse(await file.text())))
                        } catch {
                            bad.push(file.name)
                        }
                    }

                    if (bad.length === 0) {
                        onAdd(built)
                        return
                    }
                    onAdd(built, false)
                    setError(
                        `JSON de personagem inválido — exporte a ficha pelo Pathbuilder: ${bad.join(', ')}.`,
                    )
                }}
            />
        </Box>
    )
}

// --- Aba 2: monstro digitado à mão ------------------------------------------

const ManualTab = ({ onAdd }: { onAdd: (c: Combatant[]) => void }) => {
    const [name, setName] = useState('')
    const [hp, setHp] = useState('')
    const [ac, setAc] = useState('')
    const [level, setLevel] = useState('')
    const [initiative, setInitiative] = useState('')
    const [quantity, setQuantity] = useState('1')

    const digits = (v: string) => v.replace(/\D/g, '')
    const valid = name.trim().length > 0 && parseInt(hp, 10) > 0

    const handleAdd = () => {
        if (!valid) return
        const count = Math.min(20, Math.max(1, parseInt(quantity, 10) || 1))
        const base = {
            name: name.trim(),
            maxHp: parseInt(hp, 10),
            ac: parseInt(ac, 10) || 10,
            level: parseInt(level, 10) || 0,
            initiative: parseInt(initiative, 10) || 0,
        }
        onAdd(Array.from({ length: count }, (_, i) =>
            npcFromManual({ ...base, name: count > 1 ? `${base.name} ${i + 1}` : base.name }),
        ))
    }

    return (
        <Box>
            <Stack spacing={2}>
                <TextField
                    autoFocus
                    fullWidth
                    label="Nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: 1.5,
                    }}
                >
                    <TextField label="PV" value={hp} onChange={(e) => setHp(digits(e.target.value))}
                        inputProps={{ inputMode: 'numeric' }} />
                    <TextField label="CA" value={ac} onChange={(e) => setAc(digits(e.target.value))}
                        inputProps={{ inputMode: 'numeric' }} />
                    <TextField label="Nível" value={level} onChange={(e) => setLevel(digits(e.target.value))}
                        inputProps={{ inputMode: 'numeric' }} />
                    <TextField label="Iniciativa" value={initiative}
                        onChange={(e) => setInitiative(digits(e.target.value))}
                        inputProps={{ inputMode: 'numeric' }} />
                    <TextField label="Quantidade" value={quantity}
                        onChange={(e) => setQuantity(digits(e.target.value))}
                        inputProps={{ inputMode: 'numeric' }} />
                </Box>
                <Typography variant="caption" sx={{ color: ink.secondary }}>
                    Resistências e fraquezas podem ser ajustadas depois, no cartão do combatente.
                </Typography>
            </Stack>

            <Button
                fullWidth
                variant="contained"
                disabled={!valid}
                onClick={handleAdd}
                sx={{ mt: 2.5, backgroundColor: green.main, color: parchment.page }}
            >
                Adicionar
            </Button>
        </Box>
    )
}
