import { useState } from 'react'
import {
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material'
import { AutoAwesome as MythicIcon, Restore as RestoreIcon } from '@mui/icons-material'
import { MYTHIC_COLOR } from '../helpers'
import { SlotPips, SlotCount } from './SlotPips'
import type { MythicPointsApi } from './useMythicPoints'

interface Props {
    points: MythicPointsApi
}

/**
 * Pool de Pontos Míticos. Fica fora das abas, ao lado das condições, porque o
 * ponto é gasto de qualquer aba — é ele que troca a proficiência de uma
 * salvaguarda, de uma perícia ou de um ataque pela mítica.
 *
 * Os pips funcionam como os de slot de magia: tocar num disponível gasta,
 * tocar num gasto devolve.
 */
export const MythicPointsBar = ({ points }: Props) => {
    const [confirmReset, setConfirmReset] = useState(false)

    return (
        <>
            <Card sx={{ mb: 3, borderColor: points.used > 0 ? MYTHIC_COLOR + '80' : undefined }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <MythicIcon sx={{ color: MYTHIC_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                            Pontos Míticos
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                            <SlotCount total={points.max} used={points.used} /> disponíveis
                        </Typography>

                        <SlotPips
                            total={points.max}
                            used={points.used}
                            color={MYTHIC_COLOR}
                            onChange={points.setUsed}
                            label="Ponto mítico"
                            size={18}
                        />

                        <Stack direction="row" spacing={1} sx={{ ml: 'auto', flexWrap: 'wrap', gap: 1 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={points.available === 0}
                                onClick={points.spend}
                                sx={{ color: MYTHIC_COLOR, borderColor: MYTHIC_COLOR + '80' }}
                            >
                                Gastar 1
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<RestoreIcon />}
                                disabled={points.used === 0}
                                onClick={() => setConfirmReset(true)}
                            >
                                Novo dia
                            </Button>
                        </Stack>
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Gaste um ponto para usar a proficiência mítica (✦) numa salvaguarda, perícia ou
                        ataque. Toque num ponto gasto para devolvê-lo.
                    </Typography>
                </CardContent>
            </Card>

            <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
                <DialogTitle>Começar um novo dia?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Os {points.max} Pontos Míticos voltam a ficar disponíveis. Como a ficha é
                        compartilhada, isso vale para todos os jogadores.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setConfirmReset(false)}>Cancelar</Button>
                    <Button
                        variant="contained"
                        onClick={() => { points.resetAll(); setConfirmReset(false) }}
                    >
                        Novo dia
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
