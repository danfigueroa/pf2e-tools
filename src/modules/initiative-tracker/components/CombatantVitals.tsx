import { useRef, useState } from 'react'
import { Box, Button, LinearProgress, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material'
import { Favorite as HpIcon, HealthAndSafety as TempIcon, Shield as ShieldIcon } from '@mui/icons-material'
import { hpBarColor } from '../../character-viewer/components/useHpTracker'
import { HP_COLOR, ink, SHIELD_COLOR } from '../../../theme'
import type { CombatantView } from '../types'
import { useHpFeedback } from '../../../motion/useHpFeedback'
import { FloatingDeltas } from '../../../motion/FloatingDeltas'
import type { BlockResult, ShieldStored } from '../../character-viewer/shield'
import { CombatantShield } from './CombatantShield'

/** O estado antes de um bloqueio — o que o "Desfazer" devolve. */
export interface ShieldBefore {
    shield: ShieldStored
    current: number
    temp: number
}

/** Barra de PV com dano/cura rápidos, para o ajuste avulso fora do lote. */
export const CombatantVitals = ({ view, onBlocked, onEditShield }: {
    view: CombatantView
    /** Um bloqueio aconteceu neste cartão — a página avisa e oferece desfazer. */
    onBlocked?: (view: CombatantView, result: BlockResult, before: ShieldBefore) => void
    /** Só monstro: o GM edita os números do escudo. */
    onEditShield?: () => void
}) => {
    const theme = useTheme()
    const [amount, setAmount] = useState('')
    // O próximo "Dano" passa pelo escudo. Volta a desligar depois de usado:
    // Shield Block é uma reação, gasta num golpe só.
    const [blocking, setBlocking] = useState(false)
    const canBlock = !!view.shield?.canBlock
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

    const damage = (n: number) => {
        if (!(blocking && canBlock && view.shield)) {
            applyDamage(n)
            return
        }
        const before = { shield: { hp: view.shield.hp, raised: view.shield.raised }, current, temp }
        const result = view.blockDamage(n)
        setBlocking(false)
        if (result) onBlocked?.(view, result, before)
        else applyDamage(n)
    }

    // Dano automático (aflição, persistente no fim do turno) e dano em lote
    // caem sem ninguém olhar para este cartão: o tremor e o "−7" é que avisam
    // em qual deles caiu.
    const feedback = useHpFeedback(current, temp)

    const ratio = maxHp > 0 ? current / maxHp : 0

    return (
        <Box sx={{ borderRadius: 1, animation: feedback.animation }}>
            <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 0.5 }}>
                <HpIcon sx={{ fontSize: '1rem', color: HP_COLOR, alignSelf: 'center' }} />
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {feedback.shown}
                </Typography>
                <Typography variant="body2" sx={{ color: ink.secondary }}>/ {maxHp}</Typography>
                {/* À direita, e não acima: o Card corta o que passa da borda
                    (overflow hidden), e o PV fica colado no topo do cartão. */}
                <Box sx={{ position: 'relative', alignSelf: 'flex-start' }}>
                    <FloatingDeltas deltas={feedback.deltas} />
                </Box>
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
                    '& .MuiLinearProgress-bar': {
                        backgroundColor: hpBarColor(current, maxHp, theme.palette),
                        transition: 'transform 0.6s cubic-bezier(.2,.8,.2,1), background-color 0.6s',
                    },
                }}
            />

            <Stack direction="row" spacing={0.75} alignItems="stretch">
                <TextField
                    size="small"
                    placeholder="PV"
                    inputRef={inputRef}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') run(damage) }}
                    inputProps={{ inputMode: 'numeric', 'aria-label': `Quantidade de PV para ${name}` }}
                    sx={{ width: 62, '& .MuiInputBase-input': { py: 0.5, textAlign: 'center' } }}
                />
                <Button
                    size="small"
                    variant="contained"
                    onClick={() => run(damage)}
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

            {canBlock && (
                <Tooltip title="O próximo Dano passa pelo escudo: a Dureza segura, o resto vai para o PV e para o escudo. Só dano físico.">
                    <Button
                        size="small"
                        fullWidth
                        variant={blocking ? 'contained' : 'outlined'}
                        startIcon={<ShieldIcon sx={{ fontSize: '1rem' }} />}
                        onClick={() => setBlocking((b) => !b)}
                        aria-pressed={blocking}
                        aria-label={`Bloquear com escudo o próximo dano em ${name}`}
                        sx={{
                            mt: 0.75,
                            fontSize: '0.75rem',
                            ...(blocking
                                ? { backgroundColor: SHIELD_COLOR, '&:hover': { backgroundColor: SHIELD_COLOR, filter: 'brightness(0.9)' } }
                                : { color: SHIELD_COLOR, borderColor: SHIELD_COLOR + '66', '&:hover': { borderColor: SHIELD_COLOR } }),
                        }}
                    >
                        {blocking ? 'Bloqueando o próximo dano' : 'Bloquear com escudo'}
                    </Button>
                </Tooltip>
            )}

            {view.shield && <CombatantShield shield={view.shield} onEdit={onEditShield} />}
        </Box>
    )
}
