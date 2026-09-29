import { useEffect, useState } from 'react'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, Stack, Typography, useTheme } from '@mui/material'
import { LocalDrink as DrinkIcon } from '@mui/icons-material'
import { HP_COLOR, status } from '../../../theme/palette'
import { parseFormula, type RollDetail } from '../../initiative-tracker/dice'
import { DiceRoll } from '../../../motion/DiceRoll'
import { bubble, floatUp, tilt, useReducedMotion } from '../../../motion/motion'
import { useAnimatedNumber } from '../../../motion/useAnimatedNumber'
import { hpBarColor } from './useHpTracker'

/** O que a overlay mostra. A cura JÁ foi aplicada quando ela abre. */
export interface DrinkEvent {
    name: string
    formula: string
    roll: RollDetail
    /** PV antes e depois da cura, e o teto usado. */
    before: number
    after: number
    max: number
}

type Phase = 'drink' | 'roll' | 'heal' | 'done'

const DRINK_MS = 650
const HEAL_MS = 1100
/** Depois de tudo, quanto tempo o resultado fica na tela antes de fechar sozinho. */
const LINGER_MS = 2600

const BUBBLES = [
    { left: '12%', delay: 0, size: 8 },
    { left: '28%', delay: 180, size: 6 },
    { left: '46%', delay: 60, size: 10 },
    { left: '63%', delay: 260, size: 7 },
    { left: '80%', delay: 120, size: 9 },
    { left: '92%', delay: 320, size: 5 },
]

/**
 * A poção sendo bebida: frasco, dados rolando a fórmula da cura e a barra de PV
 * enchendo. **Só apresenta** — o PV e o consumo já foram gravados no clique,
 * então fechar no meio (toque, Esc, fora do diálogo) não perde nada, e o
 * "Desfazer" continua no aviso que aparece depois.
 */
export const PotionOverlay = ({ drink, onClose }: { drink: DrinkEvent | null; onClose: () => void }) => (
    <Dialog
        open={!!drink}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { border: '2px solid', borderColor: HP_COLOR, overflow: 'hidden' } } }}
    >
        {/* Remonta a cada gole: as fases recomeçam do frasco. */}
        {drink && <PotionContent key={`${drink.name}-${drink.roll.total}-${drink.before}`} drink={drink} onClose={onClose} />}
    </Dialog>
)

const PotionContent = ({ drink, onClose }: { drink: DrinkEvent; onClose: () => void }) => {
    const theme = useTheme()
    const reduced = useReducedMotion()
    const [phase, setPhase] = useState<Phase>(reduced ? 'done' : 'drink')
    const skipped = phase === 'done'

    useEffect(() => {
        if (phase === 'drink') {
            const t = window.setTimeout(() => setPhase('roll'), DRINK_MS)
            return () => window.clearTimeout(t)
        }
        if (phase === 'heal') {
            const t = window.setTimeout(() => setPhase('done'), HEAL_MS)
            return () => window.clearTimeout(t)
        }
        if (phase === 'done') {
            const t = window.setTimeout(onClose, LINGER_MS + (reduced ? 1500 : 0))
            return () => window.clearTimeout(t)
        }
    }, [phase, onClose, reduced])

    const healing = phase === 'heal' || phase === 'done'
    const shownHp = useAnimatedNumber(healing ? drink.after : drink.before, { duration: HEAL_MS - 200, instant: reduced })
    const healed = drink.after - drink.before
    const capped = healed < drink.roll.total
    const faces = parseFormula(drink.formula)?.faces ?? 6
    const pct = (hp: number) => (drink.max > 0 ? Math.min(100, (hp / drink.max) * 100) : 0)

    return (
        <>
            <DialogContent
                onClick={() => { if (!skipped) setPhase('done') }}
                sx={{ pt: 3, pb: 1, textAlign: 'center', cursor: skipped ? 'default' : 'pointer' }}
            >
                <Stack alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
                    <DrinkIcon
                        sx={{
                            fontSize: 44,
                            color: HP_COLOR,
                            transformOrigin: '50% 80%',
                            transform: phase === 'drink' ? undefined : 'rotate(-20deg)',
                            animation: phase === 'drink' ? `${tilt} ${DRINK_MS}ms ease-in-out forwards` : 'none',
                        }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {drink.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Cura {drink.formula}
                    </Typography>
                </Stack>

                <Box sx={{ minHeight: 104, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {phase !== 'drink' && (
                        <DiceRoll
                            roll={drink.roll}
                            faces={faces}
                            color={status.success}
                            skip={skipped}
                            onDone={() => setPhase((p) => (p === 'roll' ? 'heal' : p))}
                        />
                    )}
                </Box>

                {/* PV enchendo: o trecho que a cura somou fica mais claro. */}
                <Box sx={{ mt: 2.5, position: 'relative' }}>
                    {healing && !reduced && (
                        <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                            {BUBBLES.map((b, i) => (
                                <Box
                                    key={i}
                                    sx={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: b.left,
                                        width: b.size,
                                        height: b.size,
                                        borderRadius: '50%',
                                        backgroundColor: status.success,
                                        opacity: 0,
                                        animation: `${bubble} 1100ms ease-out ${b.delay}ms forwards`,
                                    }}
                                />
                            ))}
                        </Box>
                    )}
                    <Stack direction="row" alignItems="baseline" justifyContent="center" spacing={0.75} sx={{ mb: 1, position: 'relative' }}>
                        <Typography
                            sx={{
                                fontSize: '2.2rem',
                                fontWeight: 800,
                                lineHeight: 1,
                                fontVariantNumeric: 'tabular-nums',
                                color: hpBarColor(shownHp, drink.max, theme.palette),
                            }}
                        >
                            {shownHp}
                        </Typography>
                        <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600 }}>
                            / {drink.max} PV
                        </Typography>
                        {healing && healed > 0 && (
                            <Typography
                                aria-hidden
                                sx={{
                                    position: 'absolute',
                                    top: -6,
                                    right: 8,
                                    fontWeight: 800,
                                    color: status.success,
                                    animation: reduced ? 'none' : `${floatUp} 1400ms ease-out forwards`,
                                }}
                            >
                                +{healed}
                            </Typography>
                        )}
                    </Stack>
                    <Box
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={drink.max}
                        aria-valuenow={healing ? drink.after : drink.before}
                        aria-label="Pontos de Vida"
                        sx={{
                            position: 'relative',
                            height: 12,
                            borderRadius: 6,
                            overflow: 'hidden',
                            backgroundColor: theme.palette.action.hover,
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                width: `${pct(healing ? drink.after : drink.before)}%`,
                                backgroundColor: status.success + '66',
                                transition: reduced ? 'none' : `width ${HEAL_MS - 200}ms cubic-bezier(.2,.8,.2,1)`,
                            }}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                width: `${pct(drink.before)}%`,
                                backgroundColor: hpBarColor(drink.before, drink.max, theme.palette),
                            }}
                        />
                    </Box>
                </Box>

                <Box sx={{ minHeight: 36, mt: 1.5, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    {phase === 'done' && (
                        <>
                            <Typography sx={{ fontWeight: 700, color: status.success }}>
                                {healed > 0 ? `+${healed} PV` : 'Nenhum PV recuperado'}
                            </Typography>
                            {capped && <Chip size="small" label="PV cheio" variant="outlined" />}
                        </>
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button onClick={skipped ? onClose : () => setPhase('done')} autoFocus>
                    {skipped ? 'Fechar' : 'Pular'}
                </Button>
            </DialogActions>
        </>
    )
}
