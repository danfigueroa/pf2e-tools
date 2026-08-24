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
import { CloudUpload as UploadIcon, Person as PersonIcon } from '@mui/icons-material'
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

    const add = (combatants: Combatant[]) => {
        onAdd(combatants)
        onClose()
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
    onAdd: (c: Combatant[]) => void
    existingSlugs: string[]
}) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const [loading, setLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const importJson = (json: unknown, presetFile?: string) => {
        try {
            onAdd([pcFromBuild(parseCharacterJson(json), presetFile)])
        } catch {
            setError('JSON de personagem inválido — exporte a ficha pelo Pathbuilder.')
        }
    }

    const handlePreset = async (filename: string) => {
        setLoading(filename)
        setError(null)
        try {
            const res = await fetch(`/characters/${filename}`)
            importJson(await res.json(), filename)
        } catch {
            setError('Não foi possível carregar a ficha.')
        } finally {
            setLoading(null)
        }
    }

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Typography variant="overline" sx={{ color: ink.secondary }}>
                Fichas da campanha
            </Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 1,
                    mt: 0.5,
                    mb: 2.5,
                }}
            >
                {CAMPAIGN_PRESETS.map((preset) => {
                    const already = existingSlugs.includes(charSlugFromName(preset.name))
                    return (
                        <Card key={preset.filename} sx={{ opacity: already ? 0.5 : 1 }}>
                            <CardActionArea
                                disabled={already || loading !== null}
                                onClick={() => handlePreset(preset.filename)}
                            >
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, textAlign: 'center' }}>
                                    {loading === preset.filename ? (
                                        <CircularProgress size={20} />
                                    ) : (
                                        <PersonIcon sx={{ color: green.main }} />
                                    )}
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
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => inputRef.current?.click()}
            >
                Carregar JSON do Pathbuilder
            </Button>
            <input
                ref={inputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setError(null)
                    try {
                        importJson(JSON.parse(await file.text()))
                    } catch {
                        setError('Não foi possível ler o arquivo.')
                    }
                    e.target.value = ''
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
