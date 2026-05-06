import { Box, Card, CardContent, Typography, Stack, Chip } from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'

interface Props { build: BuildInfo }

export const PetsSection = ({ build }: Props) => {
    const pets = build.pets || []
    const familiars = build.familiars || []

    if (pets.length === 0 && familiars.length === 0) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Sem companheiros ou familiares.
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Stack spacing={2}>
            {pets.map((pet, idx) => (
                <Card key={`${pet.name}-${idx}`}>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {pet.type}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
                            {pet.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                            {pet.animal && <Chip label={pet.animal} size="small" variant="outlined" />}
                            {pet.mature && <Chip label="Maduro" size="small" color="primary" />}
                            {pet.incredible && (
                                <Chip
                                    label={pet.incredibleType ? `Incrível (${pet.incredibleType})` : 'Incrível'}
                                    size="small"
                                    color="primary"
                                />
                            )}
                            {pet.specializations?.map((s) => (
                                <Chip key={s} label={s} size="small" />
                            ))}
                            {pet.armor && <Chip label={pet.armor} size="small" variant="outlined" />}
                        </Stack>

                        {pet.animal && build.petDescriptions?.[pet.animal] && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <CompanionStatsView stats={build.petDescriptions[pet.animal]} />
                            </Box>
                        )}
                    </CardContent>
                </Card>
            ))}

            {familiars.map((fam, idx) => (
                <Card key={`fam-${fam.name}-${idx}`}>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                            Familiar
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
                            {fam.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {fam.type}
                        </Typography>
                        {fam.abilities?.length && (
                            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                {fam.abilities.map((a) => (
                                    <Chip key={a} label={a} size="small" />
                                ))}
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            ))}
        </Stack>
    )
}

const CompanionStatsView = ({ stats }: { stats: NonNullable<BuildInfo['petDescriptions']>[string] }) => (
    <Stack spacing={1}>
        <Stack direction="row" spacing={1.5}>
            {stats.size && <Stat label="Tamanho" value={stats.size} />}
            {stats.speed != null && <Stat label="Deslocamento" value={`${stats.speed} pés`} />}
        </Stack>
        {stats.attacks?.length > 0 && (
            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Ataques
                </Typography>
                {stats.attacks.map((a) => (
                    <Typography key={a.name} variant="body2">
                        <strong>{a.name}</strong>: {a.damage}
                        {a.traits?.length ? ` (${a.traits.join(', ')})` : ''}
                    </Typography>
                ))}
            </Box>
        )}
        {stats.supportBenefit && (
            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                    Benefício de apoio
                </Typography>
                <Typography variant="body2">{stats.supportBenefit}</Typography>
            </Box>
        )}
        {stats.advancedManeuver && (
            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                    Manobra avançada
                </Typography>
                <Typography variant="body2">{stats.advancedManeuver}</Typography>
            </Box>
        )}
    </Stack>
)

const Stat = ({ label, value }: { label: string; value: string }) => (
    <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
)
