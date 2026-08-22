import { Box, Card, CardContent, Typography, Chip } from '@mui/material'
import { RANK_COLORS } from '../../../theme/palette'
import type { BuildInfo, Proficiencies } from '../../character-sheet/types'
import {
    abilityMod,
    signed,
    proficiencyLabel,
    isMythicCharacter,
    MYTHIC_PROFICIENCY_BONUS,
    MYTHIC_COLOR,
    type AbilityKey,
} from '../helpers'
import { SKILL_TARGET, type ConditionModifiers } from '../conditions'
import { ConditionDelta } from '../components/ConditionDelta'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
}

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

const RANK_COLOR: Record<number, string> = RANK_COLORS

export const SkillsSection = ({ build, mods }: Props) => {
    const mythic = isMythicCharacter(build)
    const loreDelta = mods.total[SKILL_TARGET.int]
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
                        const mod = abilityMod(build.abilities[s.ability])
                        const delta = mods.total[SKILL_TARGET[s.ability]]
                        const base = rank > 0 ? build.level + rank + mod : mod
                        const total = base + delta
                        const mythicTotal = build.level + MYTHIC_PROFICIENCY_BONUS + mod + delta
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
                                <Box sx={{ minWidth: 44, textAlign: 'right' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color, lineHeight: 1.1 }}>
                                        {signed(total)}
                                    </Typography>
                                    <ConditionDelta delta={delta} base={base} align="right" />
                                    {mythic && (
                                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: MYTHIC_COLOR, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                                            ✦ {signed(mythicTotal)}
                                        </Typography>
                                    )}
                                </Box>
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
                            {build.lores.map(([loreName, rank]) => {
                                const intMod = abilityMod(build.abilities.int)
                                const loreTotal = build.level + rank + intMod + loreDelta
                                const loreMythic = build.level + MYTHIC_PROFICIENCY_BONUS + intMod + loreDelta
                                return (
                                    <Chip
                                        key={loreName}
                                        label={mythic
                                            ? `${loreName}: ${signed(loreTotal)} · ✦ ${signed(loreMythic)}`
                                            : `${loreName}: ${signed(loreTotal)}`}
                                        size="small"
                                    />
                                )
                            })}
                        </Box>
                    </Box>
                )}
                {mythic && (
                    <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="caption" sx={{ color: MYTHIC_COLOR, fontWeight: 600 }}>
                            ✦ valor com proficiência mítica (nível + 10) — ao gastar um Ponto Mítico
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    )
}
