import { Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { SelfImprovement as MonkIcon } from '@mui/icons-material'
import { MONK_COLOR } from '../../../theme'
import type { BuildInfo } from '../../../pathbuilder/types'
import { actionsKeyFor, legacyCharKey, slotsKeyFor, usesKeyFor } from '../charId'
import type { ConditionModifiers } from '../conditions'
import { STANCE_USE_KEY, hasFlurryOfBlows, hasKiStrike, hasPerfectStrike, kiStrikeDice } from '../monk'
import { FeatureRow } from './FeatureRow'
import { useActions } from './useActions'
import { useSpellSlots } from './useSpellSlots'
import { useUses } from './useUses'
import { tr } from '../../../i18n'

interface Props {
    build: BuildInfo
    mods: ConditionModifiers
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }
const solid = { bgcolor: MONK_COLOR, '&:hover': { bgcolor: MONK_COLOR, filter: 'brightness(0.9)' } }

/**
 * A faixa do Monge. A **Monastic Archer Stance** (Player Core 2 pg. 118, 1 ação) exige estar sem armadura e
 * empunhando longbow, shortbow ou arco com o traço monk; nela os únicos Golpes são de arco, e o Flurry of
 * Blows vale com eles. A postura é marcada à mão (o app não vê o fim do encontro) e mora em `uses`.
 * O Flurry, o Ki Strike / Inner Upheaval e o Perfect Strike ficam no diálogo do Golpe.
 */
export const MonkBar = ({ build, mods }: Props) => {
    const actions = useActions(actionsKeyFor(build), mods)
    const uses = useUses(usesKeyFor(build))
    const slots = useSpellSlots(slotsKeyFor(build), build.focusPoints ?? 0, legacyCharKey(build))
    const stanceOn = uses.usedOf(STANCE_USE_KEY) > 0
    const focusLeft = Math.max(0, slots.focusMax - slots.focusUsed)
    const armored = (build.armor ?? []).some((a) => a.worn && a.prof !== 'shield')

    return (
        <Card sx={{ mb: 3, borderColor: stanceOn ? MONK_COLOR + '99' : undefined, borderWidth: stanceOn ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <MonkIcon sx={{ color: MONK_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>{tr('Monge', 'Monk')}</Typography>
                        <Chip label={tr(`Foco ${focusLeft}/${slots.focusMax}`, `Focus ${focusLeft}/${slots.focusMax}`)} size="small" variant="outlined" sx={chipSx} />
                    </Stack>

                    <FeatureRow title="Monastic Archer Stance">
                        {stanceOn ? (
                            <>
                                <Chip label={tr("Em postura · só Golpes de arco", 'In stance · bow Strikes only')} size="small" sx={{ ...chipSx, bgcolor: MONK_COLOR, color: '#FFFFFF' }} />
                                <Button size="small" variant="outlined" onClick={() => uses.unmark(STANCE_USE_KEY)} sx={{ ml: 'auto' }}>
                                    {tr('Sair da postura', 'Leave the stance')}</Button>
                            </>
                        ) : (
                            <>
                                <Typography variant="body2" color={armored ? 'warning.main' : 'text.secondary'} sx={{ flex: 1, minWidth: 160 }}>
                                    {armored
                                        ? tr('Exige estar sem armadura: há armadura vestida na ficha.', 'Requires being unarmored: there\'s armor worn on the sheet.')
                                        : tr('1 ação. Sem armadura e com um arco: os únicos Golpes passam a ser de arco, e o Flurry vale com ele.', '1 action. Unarmored and with a bow: your only Strikes become bow Strikes, and Flurry works with it.')}
                                </Typography>
                                <Button size="small" variant="contained" onClick={() => { actions.spend(1, 'any'); uses.mark(STANCE_USE_KEY) }} sx={solid}>
                                    {tr('Entrar · 1 ação', 'Enter · 1 action')}</Button>
                            </>
                        )}
                    </FeatureRow>

                    <Typography variant="caption" color="text.secondary">
                        {[
                            hasFlurryOfBlows(build) ? tr('Flurry of Blows (1 ação, 2 Golpes)', 'Flurry of Blows (1 action, 2 Strikes)') : null,
                            hasKiStrike(build) ? tr(`Ki Strike / Inner Upheaval (+1 ataque, +${kiStrikeDice(build.level)}d6)`, `Ki Strike / Inner Upheaval (+1 attack, +${kiStrikeDice(build.level)}d6)`) : null,
                            hasPerfectStrike(build) ? tr('Perfect Strike (reação, rerrola o ataque desarmado)', 'Perfect Strike (reaction, rerolls the unarmed attack)') : null,
                        ].filter(Boolean).join(' · ')}
                        {' '}{tr('ficam no diálogo do Golpe, na aba Combate.', 'live in the Strike dialog, on the Combat tab.')}</Typography>
                </Stack>
            </CardContent>
        </Card>
    )
}
