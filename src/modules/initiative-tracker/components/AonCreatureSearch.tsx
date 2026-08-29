import { useMemo, useState } from 'react'
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
import type { AonCreature } from '../../../services/creatures'
import { levelInput, useCreatureSearch } from '../../../hooks/useCreatureSearch'
import { damageTypeLabel } from '../defenses'
import { npcFromCreature } from '../importCharacter'
import type { NpcCombatant } from '../types'

interface Props {
    onAdd: (npcs: NpcCombatant[]) => void
}

/** A raridade vem da AON como texto livre; o mapa do tema só cobre as quatro conhecidas. */
const rarityColor = (rarity: string): string =>
    (RARITY_COLORS as Record<string, string>)[rarity] ?? ink.secondary

/** Busca criaturas na AON por nome, por faixa de nível, ou pelos dois. */
export const AonCreatureSearch = ({ onAdd }: Props) => {
    const {
        query, setQuery, minLevel, setMinLevel, maxLevel, setMaxLevel,
        results, total, hasMore, loading, loadingMore, searched, loadMore,
    } = useCreatureSearch()
    const [quantity, setQuantity] = useState('1')

    const count = useMemo(() => Math.min(20, Math.max(1, parseInt(quantity, 10) || 1)), [quantity])

    const handleAdd = (creature: AonCreature) => {
        onAdd(Array.from({ length: count }, (_, i) => npcFromCreature(creature, count > 1 ? i : 0)))
    }

    return (
        <Box>
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
                sx={{ mb: 1.5 }}
            />

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
                    gap: 1.5,
                    mb: 2,
                }}
            >
                <TextField
                    size="small"
                    label="Nível mín."
                    value={minLevel}
                    onChange={(e) => setMinLevel(levelInput(e.target.value))}
                    inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                    size="small"
                    label="Nível máx."
                    value={maxLevel}
                    onChange={(e) => setMaxLevel(levelInput(e.target.value))}
                    inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                    size="small"
                    label="Qtd."
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
                    inputProps={{ inputMode: 'numeric' }}
                />
            </Box>

            {searched && results.length === 0 && !loading && (
                <Typography variant="body2" sx={{ color: ink.secondary, fontStyle: 'italic' }}>
                    Nenhuma criatura encontrada. O índice da AON está em inglês — tente "goblin",
                    "skeleton", "dragon", ou busque só pela faixa de nível.
                </Typography>
            )}

            {searched && results.length > 0 && (
                <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1 }}>
                    {hasMore
                        ? `Mostrando ${results.length} de ~${total}.`
                        : `${results.length} ${results.length === 1 ? 'criatura' : 'criaturas'}.`}
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
                                            label={`res. ${damageTypeLabel(type).toLowerCase()} ${v}`}
                                            sx={{ height: 17, fontSize: '0.62rem' }}
                                        />
                                    ))}
                                    {Object.entries(creature.weaknesses).map(([type, v]) => (
                                        <Chip
                                            key={`w-${type}`}
                                            size="small"
                                            variant="outlined"
                                            label={`fraq. ${damageTypeLabel(type).toLowerCase()} ${v}`}
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

            {searched && hasMore && (
                <Button
                    fullWidth
                    variant="outlined"
                    onClick={loadMore}
                    disabled={loadingMore}
                    startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                    sx={{ mt: 1.5 }}
                >
                    {loadingMore ? 'Carregando…' : 'Carregar mais'}
                </Button>
            )}
        </Box>
    )
}
