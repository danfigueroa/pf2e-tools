import { useState } from 'react'
import { HP_COLOR } from '../../../theme/palette'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    LinearProgress,
    Stack,
    TextField,
    Typography,
    useTheme,
} from '@mui/material'
import {
    Favorite as HpIcon,
    HealthAndSafety as TempIcon,
    Restore as RestoreIcon,
} from '@mui/icons-material'
import type { BuildInfo } from '../../character-sheet/types'
import { charKeyFor, hpBarColor, useHpTracker } from './useHpTracker'

interface Props {
    build: BuildInfo
    maxHp: number
}

export const HpTracker = ({ build, maxHp }: Props) => {
    const theme = useTheme()
    const { current, temp, applyDamage, applyHealing, setTemp, resetFull } = useHpTracker(charKeyFor(build), maxHp)

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
        <Card sx={{ borderColor: HP_COLOR + '60' }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    <HpIcon sx={{ color: HP_COLOR }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Pontos de Vida
                    </Typography>
                    {current === 0 && (
                        <Chip
                            label="Inconsciente / Morrendo"
                            size="small"
                            color="error"
                            sx={{ ml: 'auto', fontWeight: 700 }}
                        />
                    )}
                </Box>

                {/* Números grandes */}
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: barColor, lineHeight: 1 }}>
                        {current}
                    </Typography>
                    <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 600 }}>
                        / {maxHp}
                    </Typography>
                    {temp > 0 && (
                        <Chip
                            icon={<TempIcon sx={{ fontSize: '1rem' }} />}
                            label={`+${temp} temp`}
                            size="small"
                            sx={{
                                ml: 1,
                                fontWeight: 700,
                                color: theme.palette.info.main,
                                borderColor: theme.palette.info.main,
                            }}
                            variant="outlined"
                        />
                    )}
                </Box>

                {/* Barra */}
                <LinearProgress
                    variant="determinate"
                    value={Math.min(100, ratio * 100)}
                    sx={{
                        height: 10,
                        borderRadius: 5,
                        mb: 2,
                        backgroundColor: theme.palette.action.hover,
                        '& .MuiLinearProgress-bar': { backgroundColor: barColor, borderRadius: 5 },
                    }}
                />

                {/* Dano / Cura */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                    <TextField
                        type="number"
                        size="small"
                        label="Valor"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleDamage() }}
                        inputProps={{ min: 0, inputMode: 'numeric' }}
                        sx={{ width: { xs: '100%', sm: 120 } }}
                    />
                    <Button
                        variant="contained"
                        color="error"
                        disabled={!hasAmount}
                        onClick={handleDamage}
                        sx={{ fontWeight: 700 }}
                    >
                        Dano
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        disabled={!hasAmount}
                        onClick={handleHeal}
                        sx={{ fontWeight: 700 }}
                    >
                        Curar
                    </Button>
                </Stack>

                {/* PV temporários + Restaurar */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                    <TextField
                        type="number"
                        size="small"
                        label="PV temp"
                        value={tempInput}
                        onChange={(e) => setTempInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSetTemp() }}
                        inputProps={{ min: 0, inputMode: 'numeric' }}
                        sx={{ width: { xs: '100%', sm: 120 } }}
                    />
                    <Button
                        variant="outlined"
                        color="info"
                        disabled={!hasTemp}
                        onClick={handleSetTemp}
                    >
                        Definir PV Temp
                    </Button>
                    <Button
                        variant="text"
                        color="inherit"
                        startIcon={<RestoreIcon />}
                        onClick={resetFull}
                        sx={{ ml: { sm: 'auto' } }}
                    >
                        Restaurar
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    )
}
