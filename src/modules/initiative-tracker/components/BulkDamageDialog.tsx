import { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    MenuItem,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { gold, HP_COLOR, ink, parchment } from '../../../theme'
import { DAMAGE_TYPES, damageTypeLabel } from '../defenses'
import { computeDamage, describeDamage, OUTCOME_LABELS, type SaveOutcome } from '../damage'
import type { CombatantView } from '../types'

interface Props {
    open: boolean
    onClose: () => void
    targets: CombatantView[]
    onApply: (entries: Array<{ view: CombatantView; amount: number }>) => void
}

/** Botões curtos: no celular "Sucesso crítico" não cabe em quatro colunas. */
const OUTCOME_SHORT: Record<SaveOutcome, string> = {
    critFail: 'Falha cr.',
    fail: 'Falha',
    success: 'Sucesso',
    critSuccess: 'Suc. cr.',
    none: 'Direto',
}

const OUTCOME_ORDER: SaveOutcome[] = ['critFail', 'fail', 'success', 'critSuccess']

/**
 * Dano em área do PF2e: um valor de dano só, e cada alvo com o seu resultado de
 * salvaguarda. A prévia por alvo mostra a conta inteira antes de aplicar —
 * resistência, fraqueza e absorção por PV temporários — porque errar a conta
 * de um fireball em quatro alvos é caro de desfazer sem log.
 */
export const BulkDamageDialog = ({ open, onClose, targets, onApply }: Props) => {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

    const [amount, setAmount] = useState('')
    const [type, setType] = useState<string>('untyped')
    const [defaultOutcome, setDefaultOutcome] = useState<SaveOutcome>('none')
    const [outcomes, setOutcomes] = useState<Record<string, SaveOutcome>>({})

    const value = parseInt(amount, 10)
    const valid = Number.isFinite(value) && value > 0
    const typeLabel = damageTypeLabel(type).toLowerCase()

    const rows = useMemo(() => targets.map((view) => {
        const outcome = outcomes[view.combatant.id] ?? defaultOutcome
        const breakdown = computeDamage(
            { amount: valid ? value : 0, type, outcome },
            view.defense,
        )
        return { view, outcome, breakdown }
    }), [targets, outcomes, defaultOutcome, value, valid, type])

    const total = rows.reduce((sum, r) => sum + r.breakdown.final, 0)

    const reset = () => {
        setAmount('')
        setType('untyped')
        setDefaultOutcome('none')
        setOutcomes({})
    }

    const handleApply = () => {
        onApply(rows.map((r) => ({ view: r.view, amount: r.breakdown.final })))
        reset()
        onClose()
    }

    return (
        <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>Aplicar dano</DialogTitle>

            <DialogContent dividers sx={{ px: { xs: 1.5, sm: 3 } }}>
                <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                    <TextField
                        autoFocus={!fullScreen}
                        label="Dano"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                        inputProps={{ inputMode: 'numeric' }}
                        sx={{ width: 110 }}
                    />
                    <TextField
                        select
                        label="Tipo"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        sx={{ flex: 1 }}
                    >
                        {DAMAGE_TYPES.map((t) => (
                            <MenuItem key={t} value={t}>{damageTypeLabel(t)}</MenuItem>
                        ))}
                    </TextField>
                </Stack>

                <Typography variant="overline" sx={{ color: ink.secondary }}>
                    Resultado para todos
                </Typography>
                <ToggleButtonGroup
                    exclusive
                    fullWidth
                    size="small"
                    value={defaultOutcome}
                    onChange={(_, v: SaveOutcome | null) => {
                        if (!v) return
                        setDefaultOutcome(v)
                        setOutcomes({})
                    }}
                    sx={{ mb: 1 }}
                >
                    <ToggleButton value="none" aria-label={OUTCOME_LABELS.none}>Direto</ToggleButton>
                    {OUTCOME_ORDER.map((o) => (
                        <ToggleButton key={o} value={o} aria-label={OUTCOME_LABELS[o]}>
                            {OUTCOME_SHORT[o]}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={1}>
                    {rows.map(({ view, outcome, breakdown }) => (
                        <Box
                            key={view.combatant.id}
                            sx={{
                                p: 1,
                                borderRadius: 1,
                                backgroundColor: parchment.sunken,
                            }}
                        >
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                                <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                                    {view.combatant.name}
                                </Typography>
                                <Tooltip title={describeDamage(breakdown, typeLabel)}>
                                    <Typography
                                        sx={{ fontWeight: 700, color: breakdown.final > 0 ? HP_COLOR : ink.disabled }}
                                    >
                                        −{breakdown.final} PV
                                    </Typography>
                                </Tooltip>
                                <Typography variant="caption" sx={{ color: ink.secondary, whiteSpace: 'nowrap' }}>
                                    {view.current} → {breakdown.currentAfter}
                                </Typography>
                            </Stack>

                            <ToggleButtonGroup
                                exclusive
                                fullWidth
                                size="small"
                                value={outcome}
                                onChange={(_, v: SaveOutcome | null) =>
                                    v && setOutcomes((prev) => ({ ...prev, [view.combatant.id]: v }))
                                }
                            >
                                <ToggleButton value="none" aria-label={OUTCOME_LABELS.none} sx={{ fontSize: '0.7rem', py: 0.25 }}>
                                    Direto
                                </ToggleButton>
                                {OUTCOME_ORDER.map((o) => (
                                    <ToggleButton
                                        key={o}
                                        value={o}
                                        aria-label={OUTCOME_LABELS[o]}
                                        sx={{ fontSize: '0.7rem', py: 0.25 }}
                                    >
                                        {OUTCOME_SHORT[o]}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>

                            {valid && (
                                <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.5 }}>
                                    {describeDamage(breakdown, typeLabel)}
                                </Typography>
                            )}
                        </Box>
                    ))}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: { xs: 1.5, sm: 3 }, py: 1.5 }}>
                <Typography variant="body2" sx={{ flex: 1, color: ink.secondary }}>
                    Total: <strong style={{ color: gold.deep }}>{total}</strong>
                </Typography>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    variant="contained"
                    disabled={!valid}
                    onClick={handleApply}
                    sx={{ backgroundColor: HP_COLOR, '&:hover': { backgroundColor: '#8F3622' } }}
                >
                    Aplicar a {targets.length} {targets.length === 1 ? 'alvo' : 'alvos'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
