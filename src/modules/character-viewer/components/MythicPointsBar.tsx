import { useState } from 'react'
import {
    Button,
    Card,
    CardContent,
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
import { EmbedDialog } from './EmbedDialog'
import { tr } from '../../../i18n'

interface Props {
    points: MythicPointsApi
    /** Novo dia também devolve as atividades de uso diário (`useUses`). */
    onNewDay?: () => void
    /** Há uso diário marcado: o Novo dia tem o que devolver mesmo com os pontos cheios. */
    dailyUsed?: boolean
}

/**
 * Pool de Pontos Míticos. Fica fora das abas, ao lado das condições, porque o
 * ponto é gasto de qualquer aba — é ele que troca a proficiência de uma
 * salvaguarda, de uma perícia ou de um ataque pela mítica.
 *
 * Os pips funcionam como os de slot de magia: tocar num disponível gasta,
 * tocar num gasto devolve.
 */
export const MythicPointsBar = ({ points, onNewDay, dailyUsed = false }: Props) => {
    const [confirmReset, setConfirmReset] = useState(false)

    return (
        <>
            <Card sx={{ mb: 3, borderColor: points.used > 0 ? MYTHIC_COLOR + '80' : undefined }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <MythicIcon sx={{ color: MYTHIC_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                            {tr('Pontos Míticos', 'Mythic Points')}</Typography>

                        <Typography variant="caption" color="text.secondary">
                            <SlotCount total={points.max} used={points.used} /> {tr('disponíveis', 'available')}</Typography>

                        <SlotPips
                            total={points.max}
                            used={points.used}
                            color={MYTHIC_COLOR}
                            onChange={points.setUsed}
                            label={tr("Ponto mítico", 'Mythic point')}
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
                                {tr('Gastar 1', 'Spend 1')}</Button>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<RestoreIcon />}
                                disabled={points.used === 0 && !dailyUsed}
                                onClick={() => setConfirmReset(true)}
                            >
                                {tr('Novo dia', 'New day')}</Button>
                        </Stack>
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {tr('Gaste um ponto para usar a proficiência mítica (✦) numa salvaguarda, perícia ou ataque. Toque num ponto gasto para devolvê-lo.', 'Spend a point to use mythic proficiency (✦) on a saving throw, skill or attack. Tap a spent point to give it back.')}</Typography>
                </CardContent>
            </Card>

            <EmbedDialog open={confirmReset} onClose={() => setConfirmReset(false)}>
                <DialogTitle>{tr('Começar um novo dia?', 'Start a new day?')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {tr('Os ', 'The ')}{points.max} {tr('Pontos Míticos e os usos diários (1×/dia) voltam a ficar disponíveis. Como a ficha é compartilhada, isso vale para todos os jogadores.', 'Mythic Points and daily uses (1/day) become available again. Since the sheet is shared, this applies for every player.')}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => setConfirmReset(false)}>{tr('Cancelar', 'Cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={() => { points.resetAll(); onNewDay?.(); setConfirmReset(false) }}
                    >
                        {tr('Novo dia', 'New day')}</Button>
                </DialogActions>
            </EmbedDialog>
        </>
    )
}
