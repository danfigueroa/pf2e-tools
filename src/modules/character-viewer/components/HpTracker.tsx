import { useCallback, useEffect, useState } from 'react'
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

const STORAGE_PREFIX = 'pf2e:viewer:hp:'

interface HpState {
    current: number
    temp: number
    max: number
}

/** Chave estável por personagem — BuildInfo não tem id único. */
const charKeyFor = (build: BuildInfo): string =>
    [build.name, build.class, build.level, build.ancestry].join('|')

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function loadState(key: string, max: number): HpState {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key)
        if (raw) {
            const saved = JSON.parse(raw) as Partial<HpState>
            const temp = Math.max(0, Math.floor(saved.temp ?? 0))
            // Se o máximo mudou (ex.: subida de nível/re-upload), adota o novo e limita os atuais.
            const current = clamp(Math.floor(saved.current ?? max), 0, max)
            return { current, temp, max }
        }
    } catch { /* noop */ }
    return { current: max, temp: 0, max }
}

/** Estado de PV (atuais/temporários) com persistência em localStorage por personagem. */
function useHpTracker(build: BuildInfo, maxHp: number) {
    const key = charKeyFor(build)
    const [state, setState] = useState<HpState>(() => loadState(key, maxHp))

    // Recarrega ao trocar de personagem ou quando o máximo derivado muda.
    useEffect(() => {
        setState(loadState(key, maxHp))
    }, [key, maxHp])

    // Persiste a cada alteração.
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state))
        } catch { /* noop */ }
    }, [key, state])

    const applyDamage = useCallback((amount: number) => {
        const dmg = Math.max(0, Math.floor(amount))
        if (!dmg) return
        setState((s) => {
            const absorbed = Math.min(s.temp, dmg)
            const rest = dmg - absorbed
            return { ...s, temp: s.temp - absorbed, current: Math.max(0, s.current - rest) }
        })
    }, [])

    const applyHealing = useCallback((amount: number) => {
        const heal = Math.max(0, Math.floor(amount))
        if (!heal) return
        setState((s) => ({ ...s, current: Math.min(s.max, s.current + heal) }))
    }, [])

    const setTemp = useCallback((amount: number) => {
        const temp = Math.max(0, Math.floor(amount))
        setState((s) => ({ ...s, temp }))
    }, [])

    const resetFull = useCallback(() => {
        setState((s) => ({ ...s, current: s.max, temp: 0 }))
    }, [])

    return { current: state.current, temp: state.temp, applyDamage, applyHealing, setTemp, resetFull }
}

interface Props {
    build: BuildInfo
    maxHp: number
}

export const HpTracker = ({ build, maxHp }: Props) => {
    const theme = useTheme()
    const { current, temp, applyDamage, applyHealing, setTemp, resetFull } = useHpTracker(build, maxHp)

    const [amountInput, setAmountInput] = useState('')
    const [tempInput, setTempInput] = useState('')

    const amount = parseInt(amountInput, 10)
    const hasAmount = Number.isFinite(amount) && amount > 0
    const tempValue = parseInt(tempInput, 10)
    const hasTemp = Number.isFinite(tempValue) && tempValue >= 0

    const ratio = maxHp > 0 ? current / maxHp : 0
    const barColor =
        current === 0 ? theme.palette.grey[500]
        : ratio > 0.5 ? theme.palette.success.main
        : ratio > 0.25 ? theme.palette.warning.main
        : theme.palette.error.main

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
        <Card sx={{ borderColor: '#e07a5f60' }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    <HpIcon sx={{ color: '#e07a5f' }} />
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
