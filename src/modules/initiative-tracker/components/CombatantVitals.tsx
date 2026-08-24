import { useRef, useState } from 'react'
import { Box, Button, LinearProgress, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material'
import { Favorite as HpIcon, HealthAndSafety as TempIcon } from '@mui/icons-material'
import { hpBarColor } from '../../character-viewer/components/useHpTracker'
import { HP_COLOR, ink } from '../../../theme'
import type { CombatantView } from '../types'

/** Barra de PV com dano/cura rápidos, para o ajuste avulso fora do lote. */
export const CombatantVitals = ({ view }: { view: CombatantView }) => {
    const theme = useTheme()
    const [amount, setAmount] = useState('')
    const { current, temp, maxHp, maxHpDelta, applyDamage, applyHealing } = view
    const { name } = view.combatant

    const inputRef = useRef<HTMLInputElement>(null)

    const value = parseInt(amount, 10)
    const valid = Number.isFinite(value) && value > 0

    /**
     * Os botões ficam sempre habilitados. Desabilitados até haver número, a
     * lista inteira aparecia acinzentada e parecia travada — o oposto do que
     * um botão escrito "Dano" deveria comunicar. Sem número, o clique manda o
     * foco para o campo em vez de não fazer nada.
     */
    const run = (fn: (n: number) => void) => {
        if (!valid) {
            inputRef.current?.focus()
            return
        }
        fn(value)
        setAmount('')
    }

    const ratio = maxHp > 0 ? current / maxHp : 0

    return (
        <Box>
            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 0.5 }}>
                <HpIcon sx={{ fontSize: '1rem', color: HP_COLOR, alignSelf: 'center' }} />
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {current}
                </Typography>
                <Typography variant="body2" sx={{ color: ink.secondary }}>/ {maxHp}</Typography>
                {maxHpDelta !== 0 && (
                    <Tooltip title="Máximo reduzido por Drenado">
                        <Typography variant="caption" sx={{ color: HP_COLOR }}>({maxHpDelta})</Typography>
                    </Tooltip>
                )}
                {temp > 0 && (
                    <Tooltip title={`${temp} PV temporários`}>
                        <Stack direction="row" alignItems="center" spacing={0.25} sx={{ ml: 0.5 }}>
                            <TempIcon sx={{ fontSize: '0.9rem', color: theme.palette.info.main }} />
                            <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.info.main }}>
                                {temp}
                            </Typography>
                        </Stack>
                    </Tooltip>
                )}
            </Stack>

            <LinearProgress
                variant="determinate"
                value={Math.min(100, ratio * 100)}
                sx={{
                    height: 8,
                    borderRadius: 4,
                    mb: 1,
                    backgroundColor: HP_COLOR + '22',
                    '& .MuiLinearProgress-bar': { backgroundColor: hpBarColor(current, maxHp, theme.palette) },
                }}
            />

            <Stack direction="row" spacing={0.75} alignItems="stretch">
                <TextField
                    size="small"
                    placeholder="PV"
                    inputRef={inputRef}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') run(applyDamage) }}
                    inputProps={{ inputMode: 'numeric', 'aria-label': `Quantidade de PV para ${name}` }}
                    sx={{ width: 62, '& .MuiInputBase-input': { py: 0.5, textAlign: 'center' } }}
                />
                <Button
                    size="small"
                    variant="contained"
                    onClick={() => run(applyDamage)}
                    aria-label={`Causar dano em ${name}`}
                    sx={{
                        flex: 1,
                        px: 1,
                        backgroundColor: HP_COLOR,
                        '&:hover': { backgroundColor: '#8F3622' },
                    }}
                >
                    Dano
                </Button>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => run(applyHealing)}
                    aria-label={`Curar ${name}`}
                    sx={{
                        flex: 1,
                        px: 1,
                        color: theme.palette.success.main,
                        borderColor: theme.palette.success.main,
                        '&:hover': {
                            borderColor: theme.palette.success.dark,
                            backgroundColor: theme.palette.success.main + '14',
                        },
                    }}
                >
                    Cura
                </Button>
            </Stack>
        </Box>
    )
}
