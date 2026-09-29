import { useEffect, useRef } from 'react'
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { Edit as EditIcon, Shield as ShieldIcon } from '@mui/icons-material'
import { gold, ink, SHIELD_COLOR, status } from '../../../theme'
import type { ShieldView } from '../../character-viewer/components/useShield'
import { crack, pulseAnimation, useArmed, useReducedMotion } from '../../../motion/motion'
import { useAnimatedNumber } from '../../../motion/useAnimatedNumber'
import { useValueDeltas } from '../../../motion/useValueDeltas'
import { FloatingDeltas } from '../../../motion/FloatingDeltas'

/**
 * A faixa do escudo embaixo do PV no cartão: PV do escudo em aço (item, não
 * criatura), Dureza, BT marcado, Quebrado. Bloqueio, quebra e conserto animam
 * aqui — inclusive os que vêm da Ficha Virtual do jogador, pela mesa.
 */
export const CombatantShield = ({ shield, onEdit }: { shield: ShieldView; onEdit?: () => void }) => {
    const { stats, hp, raised, broken, destroyed } = shield
    const armed = useArmed()
    const reduced = useReducedMotion()

    const lastHp = useRef(hp)
    const { deltas, pulse } = useValueDeltas(hp, (diff) => {
        if (diff > 0) return 'repair'
        return lastHp.current > stats.bt && hp <= stats.bt ? 'break' : 'block'
    })
    useEffect(() => { lastHp.current = hp }, [hp])
    const shown = useAnimatedNumber(hp, { instant: !armed })

    const pct = (n: number) => (stats.maxHp > 0 ? Math.min(100, (n / stats.maxHp) * 100) : 0)
    const barColor = broken ? status.error : SHIELD_COLOR

    return (
        <Box sx={{ mt: 0.75, borderRadius: 1, animation: pulseAnimation(pulse) }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25 }}>
                <ShieldIcon sx={{ fontSize: '0.95rem', color: raised && !broken ? gold.deep : SHIELD_COLOR }} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: barColor }}>
                    {shown}
                </Typography>
                <Typography variant="caption" sx={{ color: ink.secondary }}>/ {stats.maxHp}</Typography>
                <Box sx={{ position: 'relative', alignSelf: 'flex-start' }}>
                    <FloatingDeltas deltas={deltas} />
                </Box>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={`Dureza ${stats.hardness} · BT ${stats.bt}${stats.canBlock ? '' : ' · sem Bloqueio com Escudo'}`}>
                    <Typography variant="caption" sx={{ color: SHIELD_COLOR, fontWeight: 700 }}>
                        Dur. {stats.hardness}
                    </Typography>
                </Tooltip>
                {(broken || destroyed) && (
                    <Chip
                        size="small"
                        color="error"
                        label={destroyed ? 'Destruído' : 'Quebrado'}
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                    />
                )}
                {onEdit && (
                    <IconButton size="small" onClick={onEdit} aria-label="Editar escudo" sx={{ p: 0.25 }}>
                        <EditIcon sx={{ fontSize: '0.9rem' }} />
                    </IconButton>
                )}
            </Stack>
            <Box
                role="progressbar"
                aria-label={`PV do escudo, BT ${stats.bt}`}
                aria-valuemin={0}
                aria-valuemax={stats.maxHp}
                aria-valuenow={hp}
                sx={{ position: 'relative', height: 6, borderRadius: 3, backgroundColor: SHIELD_COLOR + '22' }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        width: `${pct(hp)}%`,
                        borderRadius: 3,
                        overflow: 'hidden',
                        backgroundColor: barColor,
                        opacity: destroyed ? 0.35 : 1,
                        transition: 'width 0.6s cubic-bezier(.2,.8,.2,1), background-color 0.4s',
                    }}
                >
                    {broken && (
                        <Box
                            component="svg"
                            viewBox="0 0 100 6"
                            preserveAspectRatio="none"
                            aria-hidden
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                animation: armed && !reduced ? `${crack} 500ms ease-out` : 'none',
                            }}
                        >
                            <polyline
                                points="0,3 15,1 27,5 40,1 55,5 68,2 82,5 100,2"
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth={1.2}
                                vectorEffect="non-scaling-stroke"
                            />
                        </Box>
                    )}
                </Box>
                <Box
                    sx={{
                        position: 'absolute',
                        top: -2,
                        bottom: -2,
                        left: `calc(${pct(stats.bt)}% - 1px)`,
                        width: 2,
                        backgroundColor: status.error,
                    }}
                />
            </Box>
        </Box>
    )
}
