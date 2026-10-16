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
import { RAGE_COLOR } from '../../../theme'
import type { BuildInfo } from '../../character-sheet/types'
import { characterMaxHp } from '../helpers'
import { hpKeyFor, legacyCharKey } from '../charId'
import { RESIST_LABEL, rageGivesTempHp, type RageSpec } from '../rage'
import { useHpTracker } from './useHpTracker'
import type { ConditionsApi } from './useConditions'
import type { RageApi } from './useRage'

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

    if (!spec) return null
    const active = !!effect
    const fatigued = (conditions.effective.fatigued ?? 0) > 0

    const begin = () => {
        // PV temporários não empilham: vale o maior. E a Fúria que vem logo depois
        // de outra não os dá. `granted` é só o que ESTA Fúria pôs, para tirar só isso.
        const gain = rageGivesTempHp(stored, Date.now()) ? spec.tempHp : 0
        const put = gain > hp.temp ? gain : 0
        if (put > 0) hp.setTemp(put)
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
                        Fúria
                    </Typography>
                    {active && (
                        <Chip
                            label="Em fúria"
                            size="small"
                            sx={{ ...chipSx, bgcolor: RAGE_COLOR, color: '#FFFFFF' }}
                        />
                    )}

                    <Box sx={{ ml: 'auto' }}>
                        {active ? (
                            <Tooltip title="Pela regra, a Fúria não se encerra por vontade: acaba em 1 minuto, ao fim do encontro ou ao cair inconsciente.">
                                <Button size="small" variant="outlined" onClick={end}>
                                    Encerrar Fúria
                                </Button>
                            </Tooltip>
                        ) : (
                            <Tooltip title={fatigued ? 'Fatigado: não é possível entrar em Fúria.' : 'Rage — 1 ação.'}>
                                <span>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={fatigued}
                                        onClick={begin}
                                        sx={{ bgcolor: RAGE_COLOR, '&:hover': { bgcolor: RAGE_COLOR, filter: 'brightness(0.9)' } }}
                                    >
                                        Entrar em Fúria
                                    </Button>
                                </span>
                            </Tooltip>
                        )}
                    </Box>
                </Stack>

                {active && effect && (
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        <DamageChip spec={spec} titan={effect.titan} />
                        {Object.keys(effect.resist).length > 0 && (
                            <Chip label={`Resiste: ${resistText(effect.resist)}`} size="small" variant="outlined" sx={chipSx} />
                        )}
                        {(stored.granted ?? 0) > 0 && (
                            <Chip label={`+${stored.granted} PV temporários`} size="small" variant="outlined" sx={chipSx} />
                        )}
                        {effect.brutality && (
                            <Tooltip title="Brutality: em Fúria você tem os efeitos de especialização crítica das armas corpo a corpo e dos ataques desarmados.">
                                <Chip label="Especialização crítica" size="small" variant="outlined" sx={chipSx} />
                            </Tooltip>
                        )}
                    </Stack>
                )}

                {spec.titan && (
                    <Tooltip title="Titan Mauler (Giant Instinct): com uma arma Grande em mãos, o dano da Fúria sobe, mas você fica Desajeitado 1 — com Fúria ou sem — e não há como remover isso enquanto a empunha.">
                        <FormControlLabel
                            sx={{ display: 'flex', mt: 0.5, mr: 0 }}
                            control={
                                <Switch size="small" checked={stored.titan} onChange={(_, on) => rage.setTitan(on)} />
                            }
                            label={
                                <Typography variant="body2">
                                    Arma Grande em mãos ({spec.titan.weapons.join(', ')}) · Desajeitado 1
                                </Typography>
                            }
                        />
                    </Tooltip>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {active
                        ? 'Sem ações com o traço concentrar, exceto as de Fúria (Procurar vale). Dura 1 minuto, até o fim do encontro ou a queda à inconsciência.'
                        : `Entrar dá ${spec.tempHp} PV temporários (nível + CON).${spec.quickTempered ? ' Quick-Tempered: ao rolar iniciativa, ação livre.' : ''}`}
                    {coolingDown && ' A Fúria acabou há menos de 1 minuto: entrar de novo agora não dá PV temporários.'}
                </Typography>
            </CardContent>
        </Card>
    )
}

/** O dano extra na Fúria, com o caso da arma Grande e o da arma ágil. */
const DamageChip = ({ spec, titan }: { spec: RageSpec; titan: { weapons: string[]; damage: number } | null }) => (
    <Tooltip title="Dano extra em Golpes corpo a corpo. Metade se a arma ou o ataque desarmado é ágil. Dobra no crítico.">
        <Chip
            label={
                titan
                    ? `+${titan.damage} dano com ${titan.weapons.join(', ')} · +${spec.damage} nas demais`
                    : `+${spec.damage} dano corpo a corpo`
            }
            size="small"
            sx={{ ...chipSx, bgcolor: RAGE_COLOR + '22', color: RAGE_COLOR, border: `1px solid ${RAGE_COLOR}55` }}
        />
    </Tooltip>
)
