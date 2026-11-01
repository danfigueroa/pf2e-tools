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
import type { BuildInfo } from '../../../pathbuilder/types'
import { actionsKeyFor, legacyCharKey, slotsKeyFor } from '../charId'
import type { ConditionModifiers } from '../conditions'
import { useActions } from './useActions'
import { hasGravityWeapon, hasHuntPrey, hasPrecisionEdge } from '../ranger'
import { FeatureRow } from './FeatureRow'
import type { RangerApi } from './useRanger'
import { useSpellSlots } from './useSpellSlots'
import { tr } from '../../../i18n'

interface Props {
    build: BuildInfo
    ranger: RangerApi
    mods: ConditionModifiers
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }
const solid = { bgcolor: RANGER_COLOR, '&:hover': { bgcolor: RANGER_COLOR, filter: 'brightness(0.9)' } }

/**
 * Hunt Prey e Gravity Weapon do Patrulheiro. Fora das abas, ao lado da Fúria e
 * do Magus, porque mudam o dano de qualquer Golpe. A Gravity Weapon gasta 1
 * Ponto de Foco (o mesmo contador da aba de Magias, que as instâncias dividem).
 */
export const RangerBar = ({ build, ranger, mods }: Props) => {
    const actions = useActions(actionsKeyFor(build), mods)
    const { stored } = ranger
    const slots = useSpellSlots(slotsKeyFor(build), build.focusPoints ?? 0, legacyCharKey(build))
    const focusLeft = Math.max(0, slots.focusMax - slots.focusUsed)

    const activateGravity = () => {
        actions.spend(1)
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
                                    <Chip label={tr('Presa marcada', 'Prey marked')} size="small" sx={{ ...chipSx, bgcolor: RANGER_COLOR, color: '#FFFFFF' }} />
                                    {hasPrecisionEdge(build) && (
                                        <Tooltip title={tr("Hunter's Edge: Precision — o primeiro acerto de cada rodada na presa soma dano de precisão. O chip de precisão da arma vem ligado.", 'Hunter\'s Edge: Precision — the first hit each round against the prey adds precision damage. The weapon\'s precision chip comes on.')}>
                                            <Chip label={tr("precisão ligada", 'precision on')} size="small" variant="outlined" sx={chipSx} />
                                        </Tooltip>
                                    )}
                                    <Button size="small" variant="outlined" onClick={() => ranger.setPrey(false)} sx={{ ml: 'auto' }}>
                                        {tr('Soltar a presa', 'Release the prey')}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                        {tr('1 ação: marca uma criatura como presa.', '1 action: mark a creature as prey.')}</Typography>
                                    <Button size="small" variant="contained" onClick={() => { actions.spend(1); ranger.setPrey(true) }} sx={solid}>
                                        {tr('Marcar a presa', 'Mark the prey')}</Button>
                                </>
                            )}
                        </FeatureRow>
                    )}

                    {hasGravityWeapon(build) && (
                        <FeatureRow title="Gravity Weapon">
                            {stored.gravity ? (
                                <>
                                    <Chip label={tr("Ativa · 1 minuto", 'Active · 1 minute')} size="small" sx={{ ...chipSx, bgcolor: RANGER_COLOR, color: '#FFFFFF' }} />
                                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                        {tr('1º Golpe com arma da rodada: +2 × dados de dano.', '1st Strike with a weapon each round: +2 × damage dice.')}</Typography>
                                    <Button size="small" variant="outlined" onClick={() => ranger.setGravity(false)}>
                                        Encerrar
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                                        {tr('1 ação, 1 Ponto de Foco (', '1 action, 1 Focus Point (')}{focusLeft} restante{focusLeft === 1 ? '' : 's'}).
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={focusLeft === 0}
                                        onClick={activateGravity}
                                        sx={solid}
                                    >
                                        {focusLeft === 0 ? tr('Sem foco', 'No focus') : tr('Ativar', 'Activate')}
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
