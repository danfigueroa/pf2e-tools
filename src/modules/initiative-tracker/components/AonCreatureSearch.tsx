import { useEffect, useMemo, useState } from 'react'
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material'
import { gold, ink, parchment, RARITY_COLORS, rule } from '../../../theme'
import { translateRarity, translateSize, translateTrait } from '../../transformation-statblock/i18n'
import { searchCreatures, type AonCreature } from '../../../services/creatures'
import { npcFromCreature } from '../importCharacter'
import type { NpcCombatant } from '../types'

interface Props {
    onAdd: (npcs: NpcCombatant[]) => void
}

/** A raridade vem da AON como texto livre; o mapa do tema só cobre as quatro conhecidas. */
const rarityColor = (rarity: string): string =>
    (RARITY_COLORS as Record<string, string>)[rarity] ?? ink.secondary

/** Busca criaturas na AON e adiciona N cópias numeradas de uma vez. */
export const AonCreatureSearch = ({ onAdd }: Props) => {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<AonCreature[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [quantity, setQuantity] = useState('1')

    // Debounce: a busca dispara a cada tecla, e o Elasticsearch da AON não
    // precisa ver "g", "go", "gob"…
    useEffect(() => {
        const term = query.trim()
        if (term.length < 2) {
            setResults([])
            setSearched(false)
            return
        }
        setLoading(true)
        const timer = setTimeout(() => {
            void searchCreatures(term).then((found) => {
                setResults(found)
                setSearched(true)
                setLoading(false)
            })
        }, 350)
        return () => { clearTimeout(timer); setLoading(false) }
    }, [query])

    const count = useMemo(() => Math.min(20, Math.max(1, parseInt(quantity, 10) || 1)), [quantity])

    const handleAdd = (creature: AonCreature) => {
        onAdd(Array.from({ length: count }, (_, i) => npcFromCreature(creature, count > 1 ? i : 0)))
    }

    return (
        <Box>
            <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    placeholder="Nome da criatura (em inglês)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                {loading ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                            </InputAdornment>
                        ),
                    }}
                />
                <TextField
                    size="small"
                    label="Qtd."
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                    inputProps={{ inputMode: 'numeric' }}
                    sx={{ width: 80 }}
                />
            </Stack>

            {searched && results.length === 0 && !loading && (
                <Typography variant="body2" sx={{ color: ink.secondary, fontStyle: 'italic' }}>
                    Nenhuma criatura encontrada. O índice da AON está em inglês — tente "goblin", "skeleton", "dragon".
                </Typography>
            )}

            <Stack spacing={1}>
                {results.map((creature) => (
                    <Box
                        key={creature.url}
                        sx={{
                            p: 1.25,
                            borderRadius: 1,
                            border: `1px solid ${rule}`,
                            backgroundColor: parchment.sunken,
                        }}
                    >
                        <Stack direction="row" alignItems="flex-start" spacing={1}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                    <Typography sx={{ fontWeight: 700 }}>{creature.name}</Typography>
                                    <Chip
                                        size="small"
                                        label={`Nível ${creature.level}`}
                                        sx={{ height: 18, fontSize: '0.65rem', backgroundColor: gold.main + '33' }}
                                    />
                                    {creature.rarity && creature.rarity !== 'common' && (
                                        <Chip
                                            size="small"
                                            label={translateRarity(creature.rarity)}
                                            sx={{
                                                height: 18,
                                                fontSize: '0.65rem',
                                                color: rarityColor(creature.rarity),
                                            }}
                                            variant="outlined"
                                        />
                                    )}
                                </Stack>

                                <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.25 }}>
                                    {creature.hp} PV · CA {creature.ac} · Percepção +{creature.perception}
                                    {creature.size ? ` · ${translateSize(creature.size)}` : ''}
                                    {creature.source ? ` · ${creature.source}` : ''}
                                </Typography>

                                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                    {creature.traits.slice(0, 5).map((t) => (
                                        <Chip
                                            key={t}
                                            size="small"
                                            label={translateTrait(t)}
                                            sx={{ height: 17, fontSize: '0.62rem' }}
                                        />
                                    ))}
                                    {Object.entries(creature.resistances).map(([type, v]) => (
                                        <Chip
                                            key={`r-${type}`}
                                            size="small"
                                            variant="outlined"
                                            label={`res. ${type} ${v}`}
                                            sx={{ height: 17, fontSize: '0.62rem' }}
                                        />
                                    ))}
                                    {Object.entries(creature.weaknesses).map(([type, v]) => (
                                        <Chip
                                            key={`w-${type}`}
                                            size="small"
                                            variant="outlined"
                                            label={`fraq. ${type} ${v}`}
                                            sx={{ height: 17, fontSize: '0.62rem' }}
                                        />
                                    ))}
                                </Stack>
                            </Box>

                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => handleAdd(creature)}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                {count > 1 ? `+${count}` : 'Adicionar'}
                            </Button>
                        </Stack>
                    </Box>
                ))}
            </Stack>
        </Box>
    )
}
