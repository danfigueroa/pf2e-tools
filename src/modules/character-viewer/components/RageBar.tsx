import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControlLabel,
    Stack,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material'
import { Whatshot as RageIcon } from '@mui/icons-material'
import { RAGE_COLOR, onSolid } from '../../../theme'
import type { BuildInfo } from '../../../pathbuilder/types'
import { characterMaxHp } from '../helpers'
import { actionsKeyFor, hpKeyFor, legacyCharKey } from '../charId'
import { useActions } from './useActions'
import { RESIST_LABEL, rageGivesTempHp, type RageSpec } from '../rage'
import { useHpTracker } from './useHpTracker'
import type { ConditionsApi } from './useConditions'
import type { RageApi } from './useRage'
import { tr } from '../../../i18n'

interface Props {
    build: BuildInfo
    rage: RageApi
    conditions: ConditionsApi
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }

/** "contundente 7 · fogo 7". */
const resistText = (resist: Record<string, number>) =>
    Object.entries(resist).map(([type, value]) => `${RESIST_LABEL[type] ?? type} ${value}`).join(' · ')

/**
 * A Fúria do bárbaro: liga e desliga, e a ficha inteira acompanha — o dano nos
 * Golpes corpo a corpo, os PV temporários, a resistência e (no Titan Mauler) o
 * Desajeitado. Fica fora das abas, ao lado das condições, porque a Fúria
 * muda números de várias abas e se liga no meio de qualquer uma.
 *
 * Os PV temporários são daqui, e não do `useRage`: entram ao ligar e saem ao
 * encerrar, e quem sabe o PV do personagem é o `useHpTracker` — que precisa do
 * corte de Drenado das condições, e as condições vêm depois do `useRage`.
 */
export const RageBar = ({ build, rage, conditions }: Props) => {
    const { stored, spec, effect } = rage
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, conditions.mods.hpMaxDelta), legacyCharKey(build))

    const actions = useActions(actionsKeyFor(build), conditions.mods)

    if (!spec) return null
    const active = !!effect
    const fatigued = (conditions.effective.fatigued ?? 0) > 0

    const begin = () => {
        // PV temporários não empilham: vale o maior. E a Fúria que vem logo depois
        // de outra não os dá. `granted` é só o que ESTA Fúria pôs, para tirar só isso.
        const gain = rageGivesTempHp(stored, Date.now()) ? spec.tempHp : 0
        const put = gain > hp.temp ? gain : 0
        if (put > 0) hp.setTemp(put)
        actions.spend(1)
        rage.start(put)
    }

    const end = () => {
        // Ao acabar, os PV temporários da Fúria somem. Se sobrou mais do que ela deu,
        // é de outra fonte (Renewed Vigor, por exemplo) e fica.
        const granted = stored.granted ?? 0
        if (granted > 0 && hp.temp > 0 && hp.temp <= granted) hp.setTemp(0)
        rage.stop()
    }

    const coolingDown = !active && !rageGivesTempHp(stored, Date.now())

    return (
        <Card sx={{ mb: 3, borderColor: active ? RAGE_COLOR + '99' : undefined, borderWidth: active ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <RageIcon sx={{ color: RAGE_COLOR }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                        {tr('Fúria', 'Rage')}</Typography>
                    {active && (
                        <Chip
                            label={tr("Em fúria", 'Raging')}
                            size="small"
                            sx={{ ...chipSx, bgcolor: RAGE_COLOR, color: onSolid }}
                        />
                    )}

                    <Box sx={{ ml: 'auto' }}>
                        {active ? (
                            <Tooltip title={tr("Pela regra, a Fúria não se encerra por vontade: acaba em 1 minuto, ao fim do encontro ou ao cair inconsciente.", 'By the rules, Rage can\'t be ended at will: it ends after 1 minute, at the end of the encounter or when you fall unconscious.')}>
                                <Button size="small" variant="outlined" onClick={end}>
                                    {tr('Encerrar Fúria', 'End Rage')}</Button>
                            </Tooltip>
                        ) : (
                            <Tooltip title={fatigued ? tr('Fatigado: não é possível entrar em Fúria.', 'Fatigued: you can\'t Rage.') : tr('Rage — 1 ação.', 'Rage — 1 action.')}>
                                <span>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={fatigued}
                                        onClick={begin}
                                        sx={{ bgcolor: RAGE_COLOR, '&:hover': { bgcolor: RAGE_COLOR, filter: 'brightness(0.9)' } }}
                                    >
                                        {tr('Entrar em Fúria', 'Rage')}</Button>
                                </span>
                            </Tooltip>
                        )}
                    </Box>
                </Stack>

                {active && effect && (
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        <DamageChip spec={spec} titan={effect.titan} />
                        {Object.keys(effect.resist).length > 0 && (
                            <Chip label={tr(`Resiste: ${resistText(effect.resist)}`, `Resists: ${resistText(effect.resist)}`)} size="small" variant="outlined" sx={chipSx} />
                        )}
                        {(stored.granted ?? 0) > 0 && (
                            <Chip label={tr(`+${stored.granted} PV temporários`, `+${stored.granted} temporary HP`)} size="small" variant="outlined" sx={chipSx} />
                        )}
                        {effect.brutality && (
                            <Tooltip title={tr("Brutality: em Fúria você tem os efeitos de especialização crítica das armas corpo a corpo e dos ataques desarmados.", 'Brutality: while raging you get the critical specialization effects of melee weapons and unarmed attacks.')}>
                                <Chip label={tr("Especialização crítica", 'Critical specialization')} size="small" variant="outlined" sx={chipSx} />
                            </Tooltip>
                        )}
                    </Stack>
                )}

                {spec.titan && (
                    <Tooltip title={tr("Titan Mauler (Giant Instinct): com uma arma Grande em mãos, o dano da Fúria sobe, mas você fica Desajeitado 1 — com Fúria ou sem — e não há como remover isso enquanto a empunha.", 'Titan Mauler (Giant Instinct): with a Large weapon in hand, Rage damage goes up, but you are clumsy 1 — raging or not — and there\'s no way to remove it while you wield it.')}>
                        <FormControlLabel
                            sx={{ display: 'flex', mt: 0.5, mr: 0 }}
                            control={
                                <Switch size="small" checked={stored.titan} onChange={(_, on) => rage.setTitan(on)} />
                            }
                            label={
                                <Typography variant="body2">
                                    {tr('Arma Grande em mãos (', 'Large weapon in hand (')}{spec.titan.weapons.join(', ')}{tr(') · Desajeitado 1', ') · Clumsy 1')}</Typography>
                            }
                        />
                    </Tooltip>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {active
                        ? tr('Sem ações com o traço concentrar, exceto as de Fúria (Procurar vale). Dura 1 minuto, até o fim do encontro ou a queda à inconsciência.', 'No actions with the concentrate trait, except Rage ones (Seek works). Lasts 1 minute, until the end of the encounter or falling unconscious.')
                        : tr(`Entrar dá ${spec.tempHp} PV temporários (nível + CON).${spec.quickTempered ? ' Quick-Tempered: ao rolar iniciativa, ação livre.' : ''}`, `Entering gives ${spec.tempHp} temporary HP (level + CON).${spec.quickTempered ? ' Quick-Tempered: when rolling initiative, free action.' : ''}`)}
                    {coolingDown && tr(' A Fúria acabou há menos de 1 minuto: entrar de novo agora não dá PV temporários.', ' Rage ended less than 1 minute ago: entering again now gives no temporary HP.')}
                </Typography>
            </CardContent>
        </Card>
    )
}

/** O dano extra na Fúria, com o caso da arma Grande e o da arma ágil. */
const DamageChip = ({ spec, titan }: { spec: RageSpec; titan: { weapons: string[]; damage: number } | null }) => (
    <Tooltip title={tr("Dano extra em Golpes corpo a corpo. Metade se a arma ou o ataque desarmado é ágil. Dobra no crítico.", 'Extra damage on melee Strikes. Half if the weapon or unarmed attack is agile. Doubles on a critical.')}>
        <Chip
            label={
                titan
                    ? tr(`+${titan.damage} dano com ${titan.weapons.join(', ')} · +${spec.damage} nas demais`, `+${titan.damage} damage with ${titan.weapons.join(', ')} · +${spec.damage} with the others`)
                    : tr(`+${spec.damage} dano corpo a corpo`, `+${spec.damage} melee damage`)
            }
            size="small"
            sx={{ ...chipSx, bgcolor: RAGE_COLOR + '22', color: RAGE_COLOR, border: `1px solid ${RAGE_COLOR}55` }}
        />
    </Tooltip>
)
