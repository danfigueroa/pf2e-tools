import { Box, Card, CardContent, Typography, Stack, Divider, useTheme } from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'
import { abilityMod, signed, ABILITY_LABELS, totalHp, type AbilityKey } from '../helpers'

interface Props { build: BuildInfo }

export const OverviewSection = ({ build }: Props) => {
    const theme = useTheme()
    const conScore = build.abilities.con
    const hp = totalHp({
        ancestryHp: build.attributes.ancestryhp,
        classHp: build.attributes.classhp,
        bonusHp: build.attributes.bonushp,
        bonusHpPerLevel: build.attributes.bonushpPerLevel,
        level: build.level,
        conScore,
    })

    const ac = build.acTotal?.acTotal ?? 10
    const perception = signed(build.level + build.proficiencies.perception + abilityMod(build.abilities.wis))
    const speed = build.attributes.speed + (build.attributes.speedBonus || 0)

    const saves = [
        { label: 'Fortitude', rank: build.proficiencies.fortitude, ability: 'con' as AbilityKey },
        { label: 'Reflexos', rank: build.proficiencies.reflex, ability: 'dex' as AbilityKey },
        { label: 'Vontade', rank: build.proficiencies.will, ability: 'wis' as AbilityKey },
    ]

    return (
        <Stack spacing={2}>
            {/* Stat tiles */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                gap: 1.5,
            }}>
                <StatTile label="CA" value={ac} accent={theme.palette.primary.main} />
                <StatTile label="PV" value={hp} accent="#e07a5f" />
                <StatTile label="Percepção" value={perception} />
                <StatTile label="Deslocamento" value={`${speed} pés`} />
            </Box>

            {/* Saves */}
            <Card>
                <CardContent>
                    <SectionTitle>Salvaguardas</SectionTitle>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} divider={<Divider flexItem orientation="vertical" />}>
                        {saves.map((s) => {
                            const total = build.level + s.rank + abilityMod(build.abilities[s.ability])
                            return (
                                <Box key={s.label} sx={{ flex: 1, textAlign: 'center', py: { xs: 0.5, sm: 0 } }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {s.label}
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.light' }}>
                                        {signed(total)}
                                    </Typography>
                                </Box>
                            )
                        })}
                    </Stack>
                </CardContent>
            </Card>

            {/* Atributos */}
            <Card>
                <CardContent>
                    <SectionTitle>Atributos</SectionTitle>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
                        gap: 1,
                    }}>
                        {(Object.keys(ABILITY_LABELS) as AbilityKey[]).map((k) => {
                            const score = build.abilities[k]
                            const mod = abilityMod(score)
                            const isKey = build.keyability === k
                            return (
                                <Box
                                    key={k}
                                    sx={{
                                        textAlign: 'center',
                                        py: 1.5,
                                        borderRadius: 1.5,
                                        border: '1px solid',
                                        borderColor: isKey ? 'primary.main' : 'divider',
                                        backgroundColor: isKey ? theme.palette.primary.main + '14' : 'transparent',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                                        {ABILITY_LABELS[k]}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, mt: 0.25 }}>
                                        {signed(mod)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {score}
                                    </Typography>
                                </Box>
                            )
                        })}
                    </Box>
                </CardContent>
            </Card>

            {/* Idiomas + Resistências */}
            {(build.languages?.length || build.resistances?.length) && (
                <Card>
                    <CardContent>
                        {build.languages?.length > 0 && (
                            <Box sx={{ mb: build.resistances?.length ? 2 : 0 }}>
                                <SectionTitle>Idiomas</SectionTitle>
                                <Typography>{build.languages.join(', ')}</Typography>
                            </Box>
                        )}
                        {build.resistances && build.resistances.length > 0 && (
                            <Box>
                                <SectionTitle>Resistências</SectionTitle>
                                <Typography>{build.resistances.join(', ')}</Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}

const StatTile = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
    <Card sx={{ borderColor: accent ? accent + '60' : undefined }}>
        <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: accent || 'primary.light', mt: 0.25 }}>
                {value}
            </Typography>
        </CardContent>
    </Card>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <Typography
        variant="overline"
        sx={{
            display: 'block',
            color: 'text.secondary',
            fontWeight: 700,
            letterSpacing: '0.06em',
            mb: 1.25,
        }}
    >
        {children}
    </Typography>
)
