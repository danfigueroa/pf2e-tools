import { Box, Card, CardContent, Typography, Chip } from '@mui/material'
import { RANK_COLORS } from '../../../theme/palette'
import type { BuildInfo } from '../../character-sheet/types'
import {
    signed,
    proficiencyLabel,
    isMythicCharacter,
    MYTHIC_COLOR,
} from '../helpers'
import type { ConditionModifiers } from '../conditions'
import { loreCheck, skillCheck, SKILLS } from '../checks'
import { ConditionDelta } from '../components/ConditionDelta'
import { MythicNote } from '../components/MythicNote'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
}

const RANK_COLOR: Record<number, string> = RANK_COLORS

export const SkillsSection = ({ build, mods }: Props) => {
    const mythic = isMythicCharacter(build)
    return (
        <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    }}
                >
                    {SKILLS.map((s, idx) => {
                        const check = skillCheck(build, s.key, mods)
                        const { rank } = check
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
                                        {signed(check.total)}
                                    </Typography>
                                    <ConditionDelta delta={check.conditionDelta} base={check.base} align="right" />
                                    {mythic && (
                                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: MYTHIC_COLOR, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                                            ✦ {signed(check.total + check.mythicDelta)}
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
                            {build.lores.map((lore) => {
                                const [loreName] = lore
                                const check = loreCheck(build, lore, mods)
                                const loreTotal = check.total
                                const loreMythic = check.total + check.mythicDelta
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
                        <MythicNote />
                    </Box>
                )}
            </CardContent>
        </Card>
    )
}
