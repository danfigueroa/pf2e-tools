import { Box, Card, CardContent, Typography, Chip } from '@mui/material'
import type { BuildInfo, Proficiencies } from '../../character-sheet/types'
import { abilityMod, signed, proficiencyLabel, type AbilityKey } from '../helpers'

interface Props { build: BuildInfo }

const SKILL_ROWS: Array<{ key: keyof Proficiencies; label: string; ability: AbilityKey }> = [
    { key: 'acrobatics', label: 'Acrobacia', ability: 'dex' },
    { key: 'arcana', label: 'Arcanismo', ability: 'int' },
    { key: 'athletics', label: 'Atletismo', ability: 'str' },
    { key: 'crafting', label: 'Ofício', ability: 'int' },
    { key: 'deception', label: 'Engano', ability: 'cha' },
    { key: 'diplomacy', label: 'Diplomacia', ability: 'cha' },
    { key: 'intimidation', label: 'Intimidação', ability: 'cha' },
    { key: 'medicine', label: 'Medicina', ability: 'wis' },
    { key: 'nature', label: 'Natureza', ability: 'wis' },
    { key: 'occultism', label: 'Ocultismo', ability: 'int' },
    { key: 'performance', label: 'Performance', ability: 'cha' },
    { key: 'religion', label: 'Religião', ability: 'wis' },
    { key: 'society', label: 'Sociedade', ability: 'int' },
    { key: 'stealth', label: 'Furtividade', ability: 'dex' },
    { key: 'survival', label: 'Sobrevivência', ability: 'wis' },
    { key: 'thievery', label: 'Roubo', ability: 'dex' },
]

const RANK_COLOR: Record<number, string> = {
    0: 'text.disabled',
    2: 'primary.light',
    4: '#5b8def',
    6: '#a259e0',
    8: '#f5c542',
}

export const SkillsSection = ({ build }: Props) => {
    return (
        <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    }}
                >
                    {SKILL_ROWS.map((s, idx) => {
                        const rank = build.proficiencies[s.key] as number
                        const total = rank > 0 ? build.level + rank + abilityMod(build.abilities[s.ability]) : abilityMod(build.abilities[s.ability])
                        const color = RANK_COLOR[rank] || 'text.primary'
                        return (
                            <Box
                                key={s.key}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    borderRight: { xs: 'none', sm: idx % 2 === 0 ? '1px solid' : 'none' },
                                    borderRightColor: { sm: 'divider' },
                                }}
                            >
                                <Box>
                                    <Typography sx={{ fontWeight: 500 }}>{s.label}</Typography>
                                    <Chip
                                        label={proficiencyLabel(rank)}
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.65rem',
                                            mt: 0.25,
                                            backgroundColor: rank > 0 ? (color as string) + '22' : 'transparent',
                                            color,
                                            border: '1px solid',
                                            borderColor: rank > 0 ? (color as string) + '55' : 'divider',
                                        }}
                                    />
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, color, minWidth: 44, textAlign: 'right' }}>
                                    {signed(total)}
                                </Typography>
                            </Box>
                        )
                    })}
                </Box>
                {build.lores?.length > 0 && (
                    <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                            Saberes (Lore)
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                            {build.lores.map(([loreName, rank]) => (
                                <Chip
                                    key={loreName}
                                    label={`${loreName}: ${signed(build.level + rank + abilityMod(build.abilities.int))}`}
                                    size="small"
                                />
                            ))}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    )
}
