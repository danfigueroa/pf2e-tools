import { useState } from 'react'
import {
    Box,
    Button,
    Chip,
    IconButton,
    LinearProgress,
    Stack,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material'
import {
    Favorite as HpIcon,
    HealthAndSafety as TempIcon,
    Restore as RestoreIcon,
} from '@mui/icons-material'
import { HP_COLOR } from '../../../theme/palette'
import { hpBarColor, useHpTracker } from './useHpTracker'

interface Props {
    /** Chave de persistência (ver `petKeyFor`). */
    storageKey: string
    maxHp: number
    /** Rótulo do estado de 0 PV — companheiros ficam inconscientes, não morrendo. */
    downLabel?: string
}

/**
 * Versão compacta do `HpTracker` para companheiros e familiares: mesma
 * persistência e mesmas regras (PV temporários absorvem dano primeiro),
 * num bloco que cabe dentro do card do companheiro.
 */
export const CompanionHpBar = ({ storageKey, maxHp, downLabel = 'Inconsciente' }: Props) => {
    const theme = useTheme()
    const { current, temp, applyDamage, applyHealing, setTemp, resetFull } = useHpTracker(storageKey, maxHp)

    const [amountInput, setAmountInput] = useState('')
    const [tempInput, setTempInput] = useState('')

    const amount = parseInt(amountInput, 10)
    const hasAmount = Number.isFinite(amount) && amount > 0
    const tempValue = parseInt(tempInput, 10)
    const hasTemp = Number.isFinite(tempValue) && tempValue >= 0

    const ratio = maxHp > 0 ? current / maxHp : 0
    const barColor = hpBarColor(current, maxHp, theme.palette)

    const handleDamage = () => {
        if (!hasAmount) return
        applyDamage(amount)
        setAmountInput('')
    }
    const handleHeal = () => {
        if (!hasAmount) return
        applyHealing(amount)
        setAmountInput('')
    }
    const handleSetTemp = () => {
        if (!hasTemp) return
        setTemp(tempValue)
        setTempInput('')
    }

    return (
        <Box
            sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: HP_COLOR + '40',
                backgroundColor: HP_COLOR + '0a',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <HpIcon sx={{ color: HP_COLOR, fontSize: '1.1rem' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Pontos de Vida
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, ml: 'auto' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', lineHeight: 1, color: barColor }}>
                        {current}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        / {maxHp}
                    </Typography>
                </Box>
                {temp > 0 && (
                    <Chip
                        icon={<TempIcon sx={{ fontSize: '0.9rem' }} />}
                        label={`+${temp} temp`}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700, color: theme.palette.info.main, borderColor: theme.palette.info.main }}
                    />
                )}
                {current === 0 && (
                    <Chip label={downLabel} size="small" color="error" sx={{ fontWeight: 700 }} />
                )}
            </Box>

            <LinearProgress
                variant="determinate"
                value={Math.min(100, ratio * 100)}
                sx={{
                    height: 8,
                    borderRadius: 4,
                    mt: 1,
                    mb: 1.5,
                    backgroundColor: theme.palette.action.hover,
                    '& .MuiLinearProgress-bar': { backgroundColor: barColor, borderRadius: 4 },
                }}
            />

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                <TextField
                    type="number"
                    size="small"
                    label="Valor"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDamage() }}
                    inputProps={{ min: 0, inputMode: 'numeric' }}
                    sx={{ width: 92 }}
                />
                <Button size="small" variant="contained" color="error" disabled={!hasAmount} onClick={handleDamage} sx={{ fontWeight: 700 }}>
                    Dano
                </Button>
                <Button size="small" variant="contained" color="success" disabled={!hasAmount} onClick={handleHeal} sx={{ fontWeight: 700 }}>
                    Curar
                </Button>
                <TextField
                    type="number"
                    size="small"
                    label="PV temp"
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSetTemp() }}
                    inputProps={{ min: 0, inputMode: 'numeric' }}
                    sx={{ width: 96 }}
                />
                <Button size="small" variant="outlined" color="info" disabled={!hasTemp} onClick={handleSetTemp}>
                    Definir
                </Button>
                <Tooltip title="Restaurar PV">
                    <IconButton size="small" onClick={resetFull} sx={{ ml: 'auto' }}>
                        <RestoreIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Box>
    )
}
