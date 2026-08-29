// Busca da criatura na AON. Diferente do AonCreatureSearch da Iniciativa, aqui
// se escolhe UMA ficha, não se adicionam várias ao encontro.

import { Box, Chip, CircularProgress, InputAdornment, TextField, Typography } from '@mui/material'
import { Search as SearchIcon } from '@mui/icons-material'
import { gold, ink, parchment, RARITY_COLORS, rule } from '../../../theme'
import { levelInput, useCreatureSearch } from '../../../hooks/useCreatureSearch'
import { translateRarity, translateSize, translateTrait } from '../../transformation-statblock/i18n'
import type { AonCreature } from '../../../services/creatures'
import { LoadMoreButton } from './LoadMoreButton'

interface Props {
    onSelect: (creature: AonCreature) => void
    selectedName?: string | null
}

/** A raridade vem da AON como texto livre; o mapa do tema só cobre as quatro conhecidas. */
const rarityColor = (rarity: string): string =>
    (RARITY_COLORS as Record<string, string>)[rarity] ?? ink.secondary

export function MonsterSearch({ onSelect, selectedName }: Props) {
    const {
        query, setQuery, minLevel, setMinLevel, maxLevel, setMaxLevel,
        results, total, hasMore, loading, loadingMore, searched, loadMore,
    } = useCreatureSearch()

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
            />

            {/* Grid em vez de flex-wrap com minWidth fixo: a 320px o flex estoura. */}
            <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1 }}>
                <TextField
                    size="small" label="Nível mín." value={minLevel}
                    onChange={(e) => setMinLevel(levelInput(e.target.value))}
                    inputProps={{ inputMode: 'numeric' }}
                />
                <TextField
                    size="small" label="Nível máx." value={maxLevel}
                    onChange={(e) => setMaxLevel(levelInput(e.target.value))}
                    inputProps={{ inputMode: 'numeric' }}
                />
            </Box>

            {searched && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: ink.secondary }}>
                    {hasMore
                        ? `Mostrando ${results.length} de ~${total}.`
                        : `${results.length} criatura(s).`}
                </Typography>
            )}

            {!searched && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: ink.secondary }}>
                    O índice da AON é em inglês: busque por "goblin", "dragon", "ogre"… ou por faixa de nível.
                </Typography>
            )}

            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {results.map((creature) => {
                    const selected = creature.name === selectedName
                    return (
                        <Box
                            key={creature.url}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelect(creature)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onSelect(creature)
                                }
                            }}
                            sx={{
                                p: 1.25,
                                borderRadius: 1,
                                cursor: 'pointer',
                                border: `1px solid ${selected ? gold.main : rule}`,
                                backgroundColor: selected ? parchment.paper : parchment.sunken,
                                '&:hover': { borderColor: gold.main },
                                '&:focus-visible': { outline: `2px solid ${gold.main}`, outlineOffset: 2 },
                            }}
                        >
                            <Typography sx={{ fontWeight: 600 }}>{creature.name}</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                <Chip size="small" label={`Nível ${creature.level}`} sx={{ backgroundColor: gold.main + '33' }} />
                                {creature.rarity && creature.rarity !== 'common' && (
                                    <Chip
                                        size="small" variant="outlined"
                                        label={translateRarity(creature.rarity)}
                                        sx={{ color: rarityColor(creature.rarity), borderColor: rarityColor(creature.rarity) }}
                                    />
                                )}
                                {creature.traits.slice(0, 4).map((t) => (
                                    <Chip key={t} size="small" variant="outlined" label={translateTrait(t)} />
                                ))}
                            </Box>
                            <Typography variant="caption" sx={{ color: ink.secondary }}>
                                {creature.hp} PV · CA {creature.ac} · Percepção +{creature.perception}
                                {creature.size ? ` · ${translateSize(creature.size)}` : ''}
                                {creature.source ? ` · ${creature.source}` : ''}
                            </Typography>
                        </Box>
                    )
                })}
            </Box>

            {searched && hasMore && (
                <LoadMoreButton loading={loadingMore} onClick={loadMore} />
            )}
        </Box>
    )
}
