import { Box, Card, CardContent, Typography, Stack, Chip, Divider } from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'
import { weaponDamageFormula } from '../../character-sheet/weapon'
import { signed } from '../helpers'
import { unarmedAttacks } from '../unarmed'

interface Props { build: BuildInfo }

export const CombatSection = ({ build }: Props) => {
    const weapons = build.weapons ?? []
    const unarmed = unarmedAttacks(build)
    const armor = build.armor ?? []
    const isEmpty = weapons.length === 0 && unarmed.length === 0 && armor.length === 0 && !build.acTotal

    if (isEmpty) {
        return <EmptyMsg>Sem armas ou armadura na ficha.</EmptyMsg>
    }

    return (
        <Stack spacing={1.5}>
            {weapons.map((w, idx) => (
                <Card key={`${w.name}-${idx}`}>
                    <CardContent>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    {w.display || w.name}
                                </Typography>
                                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                                    <Chip label={`Proficiência: ${capitalize(w.prof)}`} size="small" variant="outlined" />
                                    {w.qty > 1 && <Chip label={`x${w.qty}`} size="small" variant="outlined" />}
                                    {w.runes?.map((r) => (
                                        <Chip key={r} label={r} size="small" sx={{ textTransform: 'capitalize' }} />
                                    ))}
                                </Stack>
                            </Box>
                            <AttackStats
                                attack={signed(w.attack)}
                                damage={`${weaponDamageFormula(w)} ${damageTypeLabel(w.damageType)}`.trim()}
                                extra={w.extraDamage?.length ? w.extraDamage.map((d) => `+ ${d}`).join(' ') : undefined}
                            />
                        </Stack>
                    </CardContent>
                </Card>
            ))}

            {unarmed.length > 0 && (
                <Card>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                            Ataques Desarmados
                        </Typography>
                        <Stack spacing={0} sx={{ mt: 1 }} divider={<Divider flexItem />}>
                            {unarmed.map((u) => (
                                <Stack
                                    key={u.id}
                                    direction={{ xs: 'column', sm: 'row' }}
                                    justifyContent="space-between"
                                    spacing={1}
                                    sx={{ py: 1.25 }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                            {u.name}
                                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                                                {u.en}
                                            </Typography>
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                                            {u.traits.map((t) => (
                                                <Chip key={t} label={t} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                                            ))}
                                            <Chip
                                                label={u.source}
                                                size="small"
                                                color={u.choice ? 'default' : 'primary'}
                                                sx={{ height: 22, fontSize: '0.7rem' }}
                                            />
                                            {u.choice && (
                                                <Chip label="à escolha" size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                                            )}
                                        </Stack>
                                    </Box>
                                    <AttackStats
                                        attack={signed(u.attack)}
                                        attackHint={`MAP ${u.map}`}
                                        damage={`${u.damage} ${u.damageType}`}
                                        extra={u.extraDamage?.length ? u.extraDamage.map((d) => `+ ${d}`).join(' ') : undefined}
                                    />
                                </Stack>
                            ))}
                        </Stack>
                        {distinctNotes(unarmed).map((n) => (
                            <Typography key={n} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                                {n}
                            </Typography>
                        ))}
                    </CardContent>
                </Card>
            )}

            {(armor.length > 0 || build.acTotal) && (
                <Card>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                            Armadura
                        </Typography>
                        {armor.length > 0 ? (
                            <Stack spacing={1} sx={{ mt: 1 }}>
                                {armor.map((a, idx) => (
                                    <Box key={`${a.name}-${idx}`}>
                                        <Typography sx={{ fontWeight: 600 }}>
                                            {a.display || a.name}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                            <Chip label={capitalize(a.prof)} size="small" variant="outlined" />
                                            {a.pot > 0 && <Chip label={`+${a.pot} potência`} size="small" variant="outlined" />}
                                            {a.worn && <Chip label="Vestida" size="small" color="primary" />}
                                            {a.runes?.map((r) => (
                                                <Chip key={r} label={r} size="small" sx={{ textTransform: 'capitalize' }} />
                                            ))}
                                        </Stack>
                                    </Box>
                                ))}
                            </Stack>
                        ) : (
                            <Typography color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                Sem armadura — CA de desarmado.
                            </Typography>
                        )}
                        {build.acTotal && (
                            <Stack direction="row" spacing={2} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <MiniStat label="CA total" value={build.acTotal.acTotal} />
                                <MiniStat label="Prof." value={signed(build.acTotal.acProfBonus)} />
                                <MiniStat label="Atr." value={signed(build.acTotal.acAbilityBonus)} />
                                <MiniStat label="Item" value={signed(build.acTotal.acItemBonus)} />
                                {build.acTotal.shieldBonus != null && (
                                    <MiniStat label="Escudo" value={signed(build.acTotal.shieldBonus)} />
                                )}
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}

/** Bloco ataque/dano à direita do card, igual para armas e desarmados. */
const AttackStats = ({ attack, attackHint, damage, extra }: {
    attack: string
    attackHint?: string
    damage: string
    extra?: string
}) => (
    <Box
        sx={{
            minWidth: { sm: 160 },
            textAlign: { xs: 'left', sm: 'center' },
            display: 'flex',
            flexDirection: { xs: 'row', sm: 'column' },
            gap: { xs: 2, sm: 0 },
        }}
    >
        <StatRow label="Ataque" value={attack} highlight extra={attackHint} />
        <Divider sx={{ display: { xs: 'none', sm: 'block' }, my: 0.5 }} flexItem />
        <StatRow label="Dano" value={damage} extra={extra} />
    </Box>
)

const StatRow = ({ label, value, highlight, extra }: { label: string; value: string; highlight?: boolean; extra?: string }) => (
    <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
        <Typography
            variant="h5"
            sx={{ fontWeight: 700, color: highlight ? 'primary.light' : 'text.primary', lineHeight: 1.2 }}
        >
            {value}
        </Typography>
        {extra && (
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                {extra}
            </Typography>
        )}
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

/** Notas sem repetição — as opções de um mesmo ataque à escolha compartilham a nota. */
function distinctNotes(list: Array<{ note?: string }>): string[] {
    return Array.from(new Set(list.map((u) => u.note).filter((n): n is string => !!n)))
}

const DAMAGE_TYPES: Record<string, string> = {
    B: 'contundente',
    P: 'perfurante',
    S: 'cortante',
}

function damageTypeLabel(type: string): string {
    return DAMAGE_TYPES[(type || '').toUpperCase()] ?? type
}

function capitalize(s: string) {
    return s ? s[0].toUpperCase() + s.slice(1) : s
}
