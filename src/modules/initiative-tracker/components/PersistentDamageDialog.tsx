// Aplicar dano persistente num combatente.
//
// O par que o RAW pede é curto — fórmula e tipo —, então o diálogo é curto: um
// campo de fórmula com atalhos para os dados usuais e a lista de tipos que o
// resto do módulo já conhece (`DAMAGE_TYPES`). A CD do teste plano começa em 15
// e é ajustada no cartão, não aqui: ajuda apropriada é algo que acontece DEPOIS,
// no meio do combate.

import { useEffect, useState } from 'react'
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { ink } from '../../../theme'
import { DAMAGE_TYPES, damageTypeLabel } from '../defenses'
import { averageFormula, parseFormula } from '../dice'
import { newPersistent, type PersistentDamage } from '../persistentDamage'

interface Props {
    open: boolean
    targetName: string | null
    onClose: () => void
    onApply: (entry: PersistentDamage) => void
}

/** Os dados que aparecem em quase todo efeito de dano persistente do jogo. */
const SHORTCUTS = ['1d4', '1d6', '1d8', '2d6', '1']

export function PersistentDamageDialog({ open, targetName, onClose, onApply }: Props) {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const [formula, setFormula] = useState('1d6')
    const [type, setType] = useState<string>('bleed')

    // Reabrir para outro alvo volta ao padrão, em vez de trazer o do anterior.
    useEffect(() => {
        if (!open) return
        setFormula('1d6')
        setType('bleed')
    }, [open])

    const valid = parseFormula(formula) !== null

    const apply = () => {
        if (!valid) return
        onApply(newPersistent(formula.trim(), type))
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>
                Dano persistente{targetName ? ` — ${targetName}` : ''}
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
                {/* Grid em vez de flex com minWidth fixo: dobra sozinho a 320px. */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 1.5,
                        mt: 0.5,
                    }}
                >
                    <TextField
                        autoFocus
                        size="small"
                        label="Fórmula"
                        value={formula}
                        onChange={(e) => setFormula(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
                        error={formula.trim().length > 0 && !valid}
                        helperText={valid ? `média ${averageFormula(formula)}` : 'ex.: 1d6, 2d8+4, 3'}
                    />
                    <TextField
                        select
                        size="small"
                        label="Tipo"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                    >
                        {DAMAGE_TYPES.map((t) => (
                            <MenuItem key={t} value={t}>{damageTypeLabel(t)}</MenuItem>
                        ))}
                    </TextField>
                </Box>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1.5 }}>
                    {SHORTCUTS.map((s) => (
                        <Chip
                            key={s}
                            size="small"
                            label={s}
                            variant={formula.trim() === s ? 'filled' : 'outlined'}
                            onClick={() => setFormula(s)}
                        />
                    ))}
                </Box>

                <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: ink.secondary }}>
                    Cai ao final de cada turno do alvo, com os dados rolados de novo, e em seguida
                    vem o teste plano de CD 15 para acabar. Pode ser removido a qualquer momento.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" disabled={!valid} onClick={apply}>Aplicar</Button>
            </DialogActions>
        </Dialog>
    )
}
