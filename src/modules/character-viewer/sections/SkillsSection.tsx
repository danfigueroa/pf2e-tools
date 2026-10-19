import { memo } from 'react'
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
import { useArmorPenalty } from '../components/useArmorPenalty'
import type { RollRequest } from '../components/RollDialog'
import { RollTrigger } from '../components/RollTrigger'
import { ConditionDelta } from '../components/ConditionDelta'
import { MythicNote } from '../components/MythicNote'
import { TreatWoundsCard } from '../components/TreatWoundsCard'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
    onRoll: (req: RollRequest) => void
}

const ARMOR_NOTE = 'A penalidade de armadura não vale em ação com o traço ataque (Agarrar, Empurrar, Derrubar…) — tire no ajuste.'

const RANK_COLOR: Record<number, string> = RANK_COLORS

const SkillsSectionView = ({ build, mods, onRoll }: Props) => {
    const mythic = isMythicCharacter(build)
    const armor = useArmorPenalty(build)
    return (
        <>
        <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    }}
                >
                    {SKILLS.map((s, idx) => {
                        const check = skillCheck(build, s.key, mods, armor)
                        const { rank } = check
                        const color = RANK_COLOR[rank] || 'text.primary'
                        const armorHit = check.parts.some((p) => p.kind === 'armor')
                        return (
                            <RollTrigger
                                key={s.key}
                                label={s.label}
                                onClick={() => onRoll({ kind: 'check', check, note: armorHit ? ARMOR_NOTE : undefined })}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 2,
                                    py: 1.25,
                                    borderRadius: 0,
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
                            </RollTrigger>
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
                                        onClick={() => onRoll({ kind: 'check', check })}
                                        aria-label={`Rolar ${check.label}`}
                                        sx={{ minHeight: 32 }}
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
        <TreatWoundsCard build={build} mods={mods} />
        </>
    )
}

export const SkillsSection = memo(SkillsSectionView)
