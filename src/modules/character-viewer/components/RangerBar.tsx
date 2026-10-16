import {
    Button,
    Card,
    CardContent,
    Chip,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material'
import { Adjust as RangerIcon } from '@mui/icons-material'
import { RANGER_COLOR } from '../../../theme'
import type { BuildInfo } from '../../character-sheet/types'
import { legacyCharKey, slotsKeyFor } from '../charId'
import { hasGravityWeapon, hasHuntPrey, hasPrecisionEdge } from '../ranger'
import { FeatureRow } from './FeatureRow'
import type { RangerApi } from './useRanger'
import { useSpellSlots } from './useSpellSlots'

interface Props {
    build: BuildInfo
    ranger: RangerApi
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }
const solid = { bgcolor: RANGER_COLOR, '&:hover': { bgcolor: RANGER_COLOR, filter: 'brightness(0.9)' } }

/**
 * Hunt Prey e Gravity Weapon do Patrulheiro. Fora das abas, ao lado da Fúria e
 * do Magus, porque mudam o dano de qualquer Golpe. A Gravity Weapon gasta 1
 * Ponto de Foco (o mesmo contador da aba de Magias, que as instâncias dividem).
 */
export const RangerBar = ({ build, ranger }: Props) => {
    const { stored } = ranger
    const slots = useSpellSlots(slotsKeyFor(build), build.focusPoints ?? 0, legacyCharKey(build))
    const focusLeft = Math.max(0, slots.focusMax - slots.focusUsed)

    const activateGravity = () => {
        slots.spendFocus()
        ranger.setGravity(true)
    }

    return (
        <Card sx={{ mb: 3, borderColor: stored.prey || stored.gravity ? RANGER_COLOR + '99' : undefined, borderWidth: stored.prey || stored.gravity ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <RangerIcon sx={{ color: RANGER_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Patrulheiro</Typography>
                    </Stack>

                    {hasHuntPrey(build) && (
                        <FeatureRow title="Hunt Prey">
                            {stored.prey ? (
                                <>
                                    <Chip label="Presa marcada" size="small" sx={{ ...chipSx, bgcolor: RANGER_COLOR, color: '#FFFFFF' }} />
                                    {hasPrecisionEdge(build) && (
                                        <Tooltip title="Hunter's Edge: Precision — o primeiro acerto de cada rodada na presa soma dano de precisão. O chip de precisão da arma vem ligado.">
                                            <Chip label="precisão ligada" size="small" variant="outlined" sx={chipSx} />
                                        </Tooltip>
                                    )}
                                    <Button size="small" variant="outlined" onClick={() => ranger.setPrey(false)} sx={{ ml: 'auto' }}>
                                        Soltar a presa
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                        1 ação: marca uma criatura como presa.
                                    </Typography>
                                    <Button size="small" variant="contained" onClick={() => ranger.setPrey(true)} sx={solid}>
                                        Marcar a presa
                                    </Button>
                                </>
                            )}
                        </FeatureRow>
                    )}

                    {hasGravityWeapon(build) && (
                        <FeatureRow title="Gravity Weapon">
                            {stored.gravity ? (
                                <>
                                    <Chip label="Ativa · 1 minuto" size="small" sx={{ ...chipSx, bgcolor: RANGER_COLOR, color: '#FFFFFF' }} />
                                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                        1º Golpe com arma da rodada: +2 × dados de dano.
                                    </Typography>
                                    <Button size="small" variant="outlined" onClick={() => ranger.setGravity(false)}>
                                        Encerrar
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                        1 ação, 1 Ponto de Foco ({focusLeft} restante{focusLeft === 1 ? '' : 's'}).
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={focusLeft === 0}
                                        onClick={activateGravity}
                                        sx={solid}
                                    >
                                        {focusLeft === 0 ? 'Sem foco' : 'Ativar'}
                                    </Button>
                                </>
                            )}
                        </FeatureRow>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}
