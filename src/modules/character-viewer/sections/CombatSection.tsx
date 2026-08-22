import { Box, Card, CardContent, Typography, Stack, Chip, Divider, Tooltip } from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'
import { weaponDamageFormula } from '../../character-sheet/weapon'
import { signed } from '../helpers'
import { unarmedAttacks } from '../unarmed'
import { sharedMod, type ConditionModifiers } from '../conditions'
import { ConditionDelta } from '../components/ConditionDelta'
import { CONDITION_COLOR } from '../../../theme'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
}

export const CombatSection = ({ build, mods }: Props) => {
    const weapons = build.weapons ?? []
    const unarmed = unarmedAttacks(build)
    const armor = build.armor ?? []
    // O Pathbuilder não diz se a arma é de FOR ou de DES, então no número entra
    // só o que penaliza os dois; o resto vira aviso ao lado.
    const anyAttack = sharedMod(mods, ['attackStr', 'attackDex'])
    const extraStr = mods.total.attackStr - anyAttack
    const extraDex = mods.total.attackDex - anyAttack
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
                                attack={signed(w.attack + anyAttack)}
                                attackDelta={anyAttack}
                                attackBase={w.attack}
                                byAbility={<ByAbilityHint str={extraStr} dex={extraDex} damage={mods.total.damageStr} />}
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
                                        attack={signed(u.attack + unarmedDelta(mods, u.usesDex))}
                                        attackDelta={unarmedDelta(mods, u.usesDex)}
                                        attackBase={u.attack}
                                        attackHint={`MAP ${u.map}`}
                                        damage={`${u.damage} ${u.damageType}`}
                                        damageDelta={mods.total.damageStr}
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
                            <Box
                                sx={{
                                    // Cinco colunas fixas espremiam "CA total"
                                    // em duas linhas num celular; a grade
                                    // reflui para duas ou três por linha.
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
                                    gap: 1.5,
                                    mt: 2,
                                    pt: 2,
                                    borderTop: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <MiniStat
                                    label="CA total"
                                    value={build.acTotal.acTotal + mods.total.ac}
                                    delta={mods.total.ac}
                                    base={build.acTotal.acTotal}
                                />
                                <MiniStat label="Prof." value={signed(build.acTotal.acProfBonus)} />
                                <MiniStat label="Atr." value={signed(build.acTotal.acAbilityBonus)} />
                                <MiniStat label="Item" value={signed(build.acTotal.acItemBonus)} />
                                {build.acTotal.shieldBonus != null && (
                                    <MiniStat label="Escudo" value={signed(build.acTotal.shieldBonus)} />
                                )}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}

/** Bloco ataque/dano à direita do card, igual para armas e desarmados. */
const AttackStats = ({ attack, attackHint, attackDelta = 0, attackBase, byAbility, damage, damageDelta = 0, extra }: {
    attack: string
    attackHint?: string
    attackDelta?: number
    attackBase?: number
    /** Aviso das penalidades que dependem do atributo do ataque. */
    byAbility?: React.ReactNode
    damage: string
    damageDelta?: number
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
        <Box sx={{ flex: 1 }}>
            <StatRow label="Ataque" value={attack} highlight extra={attackHint} />
            <ConditionDelta delta={attackDelta} base={attackBase} />
            {byAbility}
        </Box>
        <Divider sx={{ display: { xs: 'none', sm: 'block' }, my: 0.5 }} flexItem />
        <Box sx={{ flex: 1 }}>
            <StatRow label="Dano" value={damage} extra={extra} />
            {damageDelta !== 0 && (
                <Typography
                    component="span"
                    sx={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: CONDITION_COLOR }}
                >
                    {signed(damageDelta)} no dano de FOR
                </Typography>
            )}
        </Box>
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

const MiniStat = ({ label, value, delta = 0, base }: {
    label: string
    value: string | number
    delta?: number
    base?: number
}) => (
    <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
            {label}
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
        <ConditionDelta delta={delta} base={base} align="left" />
    </Box>
)

/**
 * Penalidades que só valem para um dos atributos de ataque. Aparecem à parte
 * porque a arma na ficha não diz se o ataque é de Força ou de Destreza.
 */
const ByAbilityHint = ({ str, dex, damage }: { str: number; dex: number; damage: number }) => {
    const bits = [
        str !== 0 ? `FOR ${signed(str)}` : null,
        dex !== 0 ? `DES ${signed(dex)}` : null,
        damage !== 0 ? `dano de FOR ${signed(damage)}` : null,
    ].filter(Boolean) as string[]
    if (bits.length === 0) return null
    return (
        <Tooltip title="Penalidade extra conforme o atributo que a arma usa — a ficha do Pathbuilder não registra isso.">
            <Typography
                component="span"
                sx={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: CONDITION_COLOR, cursor: 'help' }}
            >
                {bits.join(' · ')} a mais
            </Typography>
        </Tooltip>
    )
}

/** Desarmado sempre é corpo-a-corpo; o atributo do ataque a gente conhece. */
function unarmedDelta(mods: ConditionModifiers, usesDex: boolean): number {
    return usesDex ? mods.total.attackDex : mods.total.attackStr
}

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
