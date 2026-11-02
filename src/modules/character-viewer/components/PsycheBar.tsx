import { Box, Button, Card, CardContent, Chip, Stack, Tooltip, Typography } from '@mui/material'
import { Psychology as PsycheIcon } from '@mui/icons-material'
import { PSYCHE_COLOR } from '../../../theme'
import type { PsycheApi } from './usePsyche'
import { tr } from '../../../i18n'

interface Props {
    psyche: PsycheApi
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }

/**
 * Unleash Psyche do Psíquico: libera, e as magias de dano da conjuração de
 * Psíquico ganham o dobro do rank. Fica fora das abas, ao lado da Fúria e das
 * condições, porque muda o dano de qualquer magia e a ressaca (Estupefato 1)
 * entra nas condições. O app não conta rodadas: quem sabe que as 2 rodadas
 * passaram é a mesa, então as duas trocas de fase são botões.
 */
export const PsycheBar = ({ psyche }: Props) => {
    const { stored } = psyche
    const phase = stored.phase

    return (
        <Card sx={{ mb: 3, borderColor: phase === 'unleashed' ? PSYCHE_COLOR + '99' : undefined, borderWidth: phase === 'unleashed' ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <PsycheIcon sx={{ color: PSYCHE_COLOR }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                        Unleash Psyche
                    </Typography>
                    {phase === 'unleashed' && (
                        <Chip label={tr('Psique liberada', 'Psyche unleashed')} size="small" sx={{ ...chipSx, bgcolor: PSYCHE_COLOR, color: '#FFFFFF' }} />
                    )}
                    {phase === 'strain' && (
                        <Chip label={tr("Esgotada · Estupefato 1", 'Exhausted · Stupefied 1')} size="small" variant="outlined" sx={chipSx} />
                    )}

                    <Box sx={{ ml: 'auto' }}>
                        {phase === 'idle' && (
                            <Button
                                size="small"
                                variant="contained"
                                onClick={psyche.unleash}
                                sx={{ bgcolor: PSYCHE_COLOR, '&:hover': { bgcolor: PSYCHE_COLOR, filter: 'brightness(0.9)' } }}
                            >
                                {tr('Liberar a psique', 'Unleash psyche')}
                            </Button>
                        )}
                        {phase === 'unleashed' && (
                            <Tooltip title={tr("Pela regra, a psique não se encerra por vontade: dura 2 rodadas ou até você cair inconsciente. Toque quando passarem.", 'By the rules, the psyche can\'t be ended at will: it lasts 2 rounds or until you fall unconscious. Tap when they pass.')}>
                                <Button size="small" variant="outlined" onClick={psyche.subside}>
                                    {tr('As 2 rodadas passaram', 'The 2 rounds have passed')}</Button>
                            </Tooltip>
                        )}
                        {phase === 'strain' && (
                            <Tooltip title={tr("A mente se recupera por 2 rodadas: Estupefato 1 e sem liberar de novo. Toque quando passarem.", 'The mind recovers for 2 rounds: stupefied 1 and no unleashing again. Tap when they pass.')}>
                                <Button size="small" variant="outlined" onClick={psyche.recover}>
                                    {tr('Recuperada', 'Recovered')}</Button>
                            </Tooltip>
                        )}
                    </Box>
                </Stack>

                {phase === 'unleashed' && (
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        <Tooltip title={tr("Bônus de status no dano de magia da conjuração de Psíquico (truques inclusos, pelo rank em que são elevados). Só magia sem duração; entra no dano inicial, não no persistente.", 'Status bonus to spell damage from Psychic spellcasting (cantrips included, at the rank they\'re heightened to). Only spells without a duration; it goes into the initial damage, not the persistent damage.')}>
                            <Chip
                                label={tr("+2 × rank no dano das magias", '+2 × rank to spell damage')}
                                size="small"
                                sx={{ ...chipSx, bgcolor: PSYCHE_COLOR + '22', color: PSYCHE_COLOR, border: `1px solid ${PSYCHE_COLOR}55` }}
                            />
                        </Tooltip>
                        <Chip label={tr("Ações com o traço psyche", 'Actions with the psyche trait')} size="small" variant="outlined" sx={chipSx} />
                    </Stack>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {phase === 'idle' && tr('Dura 2 rodadas e não se desliga. Depois vem a ressaca: Estupefato 1 por 2 rodadas, sem liberar de novo.', 'Lasts 2 rounds and can\'t be turned off. Then comes the aftermath: stupefied 1 for 2 rounds, no unleashing again.')}
                    {phase === 'unleashed' && tr('Ao acabar (2 rodadas ou inconsciente), você fica Estupefato 1 por 2 rodadas e não pode liberar de novo.', 'When it ends (2 rounds or unconscious), you are stupefied 1 for 2 rounds and can\'t unleash again.')}
                    {phase === 'strain' && tr('Não é possível liberar a psique de novo até se recuperar.', 'You can\'t unleash your psyche again until you recover.')}
                </Typography>
            </CardContent>
        </Card>
    )
}
