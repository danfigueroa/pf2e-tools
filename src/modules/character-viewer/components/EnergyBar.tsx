import { Box, Button, Card, CardContent, Chip, Stack, Tooltip, Typography } from '@mui/material'
import { SwapVert as EnergyIcon } from '@mui/icons-material'
import { PSYCHE_COLOR } from '../../../theme'
import type { EnergyApi } from './useEnergy'
import { tr } from '../../../i18n'

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }

/**
 * Conservation of Energy da Oscillating Wave: lembra se a última magia
 * concedida (ou psi cantrip padrão) ADICIONOU energia (fogo) ou REMOVEU (frio),
 * porque a próxima tem de ser a oposta. A escolha é feita no diálogo de rolagem
 * da magia; aqui só se vê e se zera — no Refocus ou quando o encontro acaba.
 */
export const EnergyBar = ({ energy }: { energy: EnergyApi }) => {
    const { stored } = energy
    const last = stored.last
    return (
        <Card sx={{ mb: 3 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <EnergyIcon sx={{ color: PSYCHE_COLOR }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                        Conservation of Energy
                    </Typography>
                    <Chip
                        size="small"
                        sx={{ ...chipSx, ...(last ? { bgcolor: PSYCHE_COLOR + '22', color: PSYCHE_COLOR, border: `1px solid ${PSYCHE_COLOR}55` } : {}) }}
                        variant={last ? 'filled' : 'outlined'}
                        label={last === 'add' ? tr('Adicionou (fogo) · próxima remove', 'Added (fire) · next one removes') : last === 'remove' ? tr('Removeu (frio) · próxima adiciona', 'Removed (cold) · next one adds') : tr('Neutro · escolha livre', 'Neutral · free choice')}
                    />
                    <Box sx={{ ml: 'auto' }}>
                        <Tooltip title={tr("Ao Refocus você volta ao neutro e escolhe livremente na próxima conjuração.", 'When you Refocus you go back to neutral and choose freely on the next casting.')}>
                            <span>
                                <Button size="small" variant="outlined" disabled={!last} onClick={energy.reset}>
                                    {tr('Neutralizar (Refocus)', 'Neutralize (Refocus)')}</Button>
                            </span>
                        </Tooltip>
                    </Box>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {tr('Vale para as magias concedidas (Burning Hands, Fireball…) e os psi cantrips Frostbite e Ignition: todo o dano delas vira fogo ao adicionar, frio ao remover. Rolar a magia registra a escolha.', 'Applies to the granted spells (Burning Hands, Fireball…) and the psi cantrips Frostbite and Ignition: all their damage becomes fire when adding, cold when removing. Rolling the spell records the choice.')}</Typography>
            </CardContent>
        </Card>
    )
}
