import { Box, Card, CardContent, Typography, Stack, Chip, Divider } from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'
import { signed } from '../helpers'

interface Props { build: BuildInfo }

export const CombatSection = ({ build }: Props) => {
    if (!build.weapons?.length) {
        return <EmptyMsg>Sem armas equipadas.</EmptyMsg>
    }

    return (
        <Stack spacing={1.5}>
            {build.weapons.map((w, idx) => (
                <Card key={`${w.name}-${idx}`}>
                    <CardContent>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    {w.display || w.name}
                                </Typography>
                                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                                    <Chip label={`${w.die} ${w.damageType}`} size="small" variant="outlined" />
                                    <Chip label={`Proficiência: ${capitalize(w.prof)}`} size="small" variant="outlined" />
                                    {w.qty > 1 && <Chip label={`x${w.qty}`} size="small" variant="outlined" />}
                                    {w.runes?.map((r) => (
                                        <Chip key={r} label={r} size="small" sx={{ textTransform: 'capitalize' }} />
                                    ))}
                                </Stack>
                                {w.extraDamage && w.extraDamage.length > 0 && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        Dano extra: {w.extraDamage.join(', ')}
                                    </Typography>
                                )}
                            </Box>
                            <Box
                                sx={{
                                    minWidth: { sm: 120 },
                                    textAlign: { xs: 'left', sm: 'center' },
                                    display: 'flex',
                                    flexDirection: { xs: 'row', sm: 'column' },
                                    gap: { xs: 2, sm: 0 },
                                }}
                            >
                                <StatRow label="Ataque" value={signed(w.attack)} highlight />
                                <Divider sx={{ display: { xs: 'none', sm: 'block' }, my: 0.5 }} flexItem />
                                <StatRow label="Bônus de dano" value={signed(w.damageBonus)} />
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>
            ))}

            {build.armor?.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                            Armadura
                        </Typography>
                        <Stack spacing={1} sx={{ mt: 1 }}>
                            {build.armor.map((a, idx) => (
                                <Box key={`${a.name}-${idx}`}>
                                    <Typography sx={{ fontWeight: 600 }}>
                                        {a.display || a.name}
                                    </Typography>
                                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                        <Chip label={capitalize(a.prof)} size="small" variant="outlined" />
                                        {a.worn && <Chip label="Vestida" size="small" color="primary" />}
                                        {a.runes?.map((r) => (
                                            <Chip key={r} label={r} size="small" sx={{ textTransform: 'capitalize' }} />
                                        ))}
                                    </Stack>
                                </Box>
                            ))}
                        </Stack>
                        {build.acTotal && (
                            <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <MiniStat label="CA total" value={build.acTotal.acTotal} />
                                <MiniStat label="Prof." value={signed(build.acTotal.acProfBonus)} />
                                <MiniStat label="Atr." value={signed(build.acTotal.acAbilityBonus)} />
                                <MiniStat label="Item" value={signed(build.acTotal.acItemBonus)} />
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}

const StatRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
        <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: highlight ? 'primary.light' : 'text.primary', lineHeight: 1.2 }}
        >
            {value}
        </Typography>
    </Box>
)

const MiniStat = ({ label, value }: { label: string; value: string | number }) => (
    <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
            {label}
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
)

const EmptyMsg = ({ children }: { children: React.ReactNode }) => (
    <Card>
        <CardContent>
            <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {children}
            </Typography>
        </CardContent>
    </Card>
)

function capitalize(s: string) {
    return s ? s[0].toUpperCase() + s.slice(1) : s
}
