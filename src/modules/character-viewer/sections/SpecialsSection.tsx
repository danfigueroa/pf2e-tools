import { memo } from 'react'
import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import type { BuildInfo } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import type { ConditionModifiers } from '../conditions'
import type { MythicPointsApi } from '../components/useMythicPoints'
import { ActivityButton } from '../components/ActivityButton'
import { getCachedSpecial, useDescriptionCacheVersion } from '../../../services/descriptions'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
}

const SpecialsSectionView = ({ build, onSelect, mods, mythicPoints }: Props) => {
    useDescriptionCacheVersion()
    if (!build.specials?.length) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Sem habilidades especiais.
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                    {build.specials.map((s, idx) => {
                        const name = String(s)
                        return (
                            <Box
                                key={`${name}-${idx}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelect({ type: 'special', name })}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect({ type: 'special', name }) }}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 2,
                                    py: 1.5,
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s',
                                    '&:hover': { backgroundColor: 'action.hover' },
                                    '&:focus-visible': { backgroundColor: 'action.focus', outline: 'none' },
                                }}
                            >
                                <Typography sx={{ fontWeight: 500 }}>{name}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ActivityButton build={build} mods={mods} mythicPoints={mythicPoints} name={name} desc={getCachedSpecial(name)} />
                                    <ChevronIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                </Box>
                            </Box>
                        )
                    })}
                </Stack>
            </CardContent>
        </Card>
    )
}

export const SpecialsSection = memo(SpecialsSectionView)
