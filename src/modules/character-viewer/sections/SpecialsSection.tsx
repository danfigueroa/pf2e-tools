import { memo, useMemo } from 'react'
import { Box, Card, CardContent, Stack, Typography } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import type { BuildInfo } from '../../../pathbuilder/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import type { ConditionModifiers } from '../conditions'
import type { MythicPointsApi } from '../components/useMythicPoints'
import { ActivityButton } from '../components/ActivityButton'
import { getCachedSpecial, useDescriptionCacheVersion } from '../../../services/descriptions'
import { SPECIAL_GROUPS, specialGroup, type SpecialGroup } from '../featGroups'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
}

const SpecialsSectionView = ({ build, onSelect, mods, mythicPoints }: Props) => {
    // O grupo vem da descrição da AON (ver `featGroups.ts`): baixar uma repinta e a habilidade muda de grupo.
    const cacheVersion = useDescriptionCacheVersion()
    const specials = build.specials
    const groups = useMemo(() => {
        const by = new Map<SpecialGroup, string[]>()
        for (const s of specials ?? []) {
            const name = String(s)
            const id = specialGroup(name, getCachedSpecial(name))
            by.set(id, [...(by.get(id) ?? []), name])
        }
        return SPECIAL_GROUPS.flatMap((g) => (by.has(g.id) ? [{ ...g, names: by.get(g.id)! }] : []))
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `cacheVersion` é o que invalida a leitura do cache
    }, [specials, cacheVersion])

    if (!specials?.length) {
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
        <Stack spacing={2}>
            {groups.map((group) => (
                <Card key={group.id}>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
                            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: '0.06em', color: 'primary.light' }}>
                                {group.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                ({group.names.length})
                            </Typography>
                        </Box>
                        <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                            {group.names.map((name, idx) => (
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
                                    <Typography sx={{ fontWeight: 500, minWidth: 0 }}>{name}</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ActivityButton build={build} mods={mods} mythicPoints={mythicPoints} name={name} desc={getCachedSpecial(name)} />
                                        <ChevronIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                    </Box>
                                </Box>
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            ))}
        </Stack>
    )
}

export const SpecialsSection = memo(SpecialsSectionView)
