import { useState } from 'react'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { ink } from '../../../theme'
import type { CombatantView } from '../types'
import { tr } from '../../../i18n'

type Mode = 'heal' | 'temp'

interface Props {
    open: boolean
    onClose: () => void
    targets: CombatantView[]
    onApply: (mode: Mode, amount: number) => void
}

/**
 * Cura e PV temporários no mesmo diálogo: são as duas coisas que um Curar ou um
 * escudo de força fazem, e separá-las em dois botões só aumentaria o caminho.
 * PV temporário não empilha — o maior vence —, por isso é definido, não somado.
 */
export const BulkHealDialog = ({ open, onClose, targets, onApply }: Props) => {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const [amount, setAmount] = useState('')
    const [mode, setMode] = useState<Mode>('heal')

    const value = parseInt(amount, 10)
    const valid = Number.isFinite(value) && value > 0

    const handleApply = () => {
        if (!valid) return
        onApply(mode, value)
        setAmount('')
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>
                {mode === 'heal' ? 'Curar' : tr('PV temporários', 'Temporary HP')}
            </DialogTitle>

            <DialogContent dividers>
                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={mode}
                    onChange={(_, v: Mode | null) => v && setMode(v)}
                    sx={{ mb: 2 }}
                >
                    <ToggleButton value="heal">{tr('Cura', 'Healing')}</ToggleButton>
                    <ToggleButton value="temp">{tr('PV temporários', 'Temporary HP')}</ToggleButton>
                </ToggleButtonGroup>

                <TextField
                    autoFocus={!fullScreen}
                    fullWidth
                    label={mode === 'heal' ? tr('PV recuperados', 'HP regained') : tr('PV temporários', 'Temporary HP')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
                    inputProps={{ inputMode: 'numeric' }}
                />

                <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 1.5 }}>
                    {mode === 'heal'
                        ? tr('A cura nunca passa do PV máximo.', 'Healing never goes over max HP.')
                        : tr('PV temporários não empilham: o valor substitui o que o alvo já tinha.', 'Temporary HP don\'t stack: the value replaces what the target already had.')}
                </Typography>

                <Stack sx={{ mt: 1.5 }}>
                    <Typography variant="caption" sx={{ color: ink.secondary }}>
                        {tr('Alvos: ', 'Targets: ')}{targets.map((t) => t.combatant.name).join(', ')}
                    </Typography>
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>{tr('Cancelar', 'Cancel')}</Button>
                <Button variant="contained" disabled={!valid} onClick={handleApply}>
                    {tr('Aplicar a ', 'Apply to ')}{targets.length} {targets.length === 1 ? tr('alvo', 'target') : tr('alvos', 'targets')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
