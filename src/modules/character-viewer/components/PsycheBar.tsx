import { Box, Button, Card, CardContent, Chip, Stack, Tooltip, Typography } from '@mui/material'
import { Psychology as PsycheIcon } from '@mui/icons-material'
import { PSYCHE_COLOR } from '../../../theme'
import type { PsycheApi } from './usePsyche'

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
                        <Chip label="Psique liberada" size="small" sx={{ ...chipSx, bgcolor: PSYCHE_COLOR, color: '#FFFFFF' }} />
                    )}
                    {phase === 'strain' && (
                        <Chip label="Esgotada · Estupefato 1" size="small" variant="outlined" sx={chipSx} />
                    )}

                    <Box sx={{ ml: 'auto' }}>
                        {phase === 'idle' && (
                            <Button
                                size="small"
                                variant="contained"
                                onClick={psyche.unleash}
                                sx={{ bgcolor: PSYCHE_COLOR, '&:hover': { bgcolor: PSYCHE_COLOR, filter: 'brightness(0.9)' } }}
                            >
                                Liberar a psique
                            </Button>
                        )}
                        {phase === 'unleashed' && (
                            <Tooltip title="Pela regra, a psique não se encerra por vontade: dura 2 rodadas ou até você cair inconsciente. Toque quando passarem.">
                                <Button size="small" variant="outlined" onClick={psyche.subside}>
                                    As 2 rodadas passaram
                                </Button>
                            </Tooltip>
                        )}
                        {phase === 'strain' && (
                            <Tooltip title="A mente se recupera por 2 rodadas: Estupefato 1 e sem liberar de novo. Toque quando passarem.">
                                <Button size="small" variant="outlined" onClick={psyche.recover}>
                                    Recuperada
                                </Button>
                            </Tooltip>
                        )}
                    </Box>
                </Stack>

                {phase === 'unleashed' && (
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        <Tooltip title="Bônus de status no dano de magia da conjuração de Psíquico (truques inclusos, pelo rank em que são elevados). Só magia sem duração; entra no dano inicial, não no persistente.">
                            <Chip
                                label="+2 × rank no dano das magias"
                                size="small"
                                sx={{ ...chipSx, bgcolor: PSYCHE_COLOR + '22', color: PSYCHE_COLOR, border: `1px solid ${PSYCHE_COLOR}55` }}
                            />
                        </Tooltip>
                        <Chip label="Ações com o traço psyche" size="small" variant="outlined" sx={chipSx} />
                    </Stack>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {phase === 'idle' && 'Dura 2 rodadas e não se desliga. Depois vem a ressaca: Estupefato 1 por 2 rodadas, sem liberar de novo.'}
                    {phase === 'unleashed' && 'Ao acabar (2 rodadas ou inconsciente), você fica Estupefato 1 por 2 rodadas e não pode liberar de novo.'}
                    {phase === 'strain' && 'Não é possível liberar a psique de novo até se recuperar.'}
                </Typography>
            </CardContent>
        </Card>
    )
}
