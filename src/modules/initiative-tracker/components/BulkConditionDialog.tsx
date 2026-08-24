import { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    InputAdornment,
    Stack,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { Search as SearchIcon } from '@mui/icons-material'
import { CONDITION_COLOR, ink, parchment, rule } from '../../../theme'
import {
    CONDITIONS,
    GROUP_LABELS,
    type ConditionDef,
    type ConditionGroup,
} from '../../character-viewer/conditions'
import type { CombatantView } from '../types'

interface Props {
    open: boolean
    onClose: () => void
    targets: CombatantView[]
    onApply: (conditionId: string, value: number, rounds: number | null) => void
}

const GROUP_ORDER: ConditionGroup[] = ['debuff', 'movement', 'senses', 'death', 'attitude']

/**
 * Aplica UMA condição a vários alvos, com valor e duração.
 *
 * Não reusa o `ConditionsDialog` da Ficha Virtual porque lá o diálogo edita o
 * estado de um personagem só (liga/desliga direto); aqui é preciso escolher a
 * condição, o valor e a duração antes de confirmar para o grupo inteiro.
 */
export const BulkConditionDialog = ({ open, onClose, targets, onApply }: Props) => {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<ConditionDef | null>(null)
    const [value, setValue] = useState('1')
    const [rounds, setRounds] = useState('')

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase()
        const matches = (c: ConditionDef) =>
            !q || c.name.toLowerCase().includes(q) || c.en.toLowerCase().includes(q)
        return GROUP_ORDER
            .map((g) => ({ group: g, items: CONDITIONS.filter((c) => c.group === g && matches(c)) }))
            .filter((g) => g.items.length > 0)
    }, [query])

    const close = () => {
        setQuery('')
        setSelected(null)
        setValue('1')
        setRounds('')
        onClose()
    }

    const handleApply = () => {
        if (!selected) return
        const parsedValue = selected.valued ? Math.max(1, parseInt(value, 10) || 1) : 1
        const parsedRounds = rounds.trim() === '' ? null : Math.max(1, parseInt(rounds, 10) || 1)
        onApply(selected.id, parsedValue, parsedRounds)
        close()
    }

    return (
        <Dialog open={open} onClose={close} fullScreen={fullScreen} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>
                Aplicar condição a {targets.length} {targets.length === 1 ? 'alvo' : 'alvos'}
            </DialogTitle>

            <DialogContent dividers sx={{ px: { xs: 1.5, sm: 3 } }}>
                <TextField
                    autoFocus={!fullScreen}
                    fullWidth
                    size="small"
                    placeholder="Buscar condição…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                        ),
                    }}
                    sx={{ mb: 2 }}
                />

                {groups.map(({ group, items }) => (
                    <Box key={group} sx={{ mb: 2 }}>
                        <Typography variant="overline" sx={{ color: ink.secondary }}>
                            {GROUP_LABELS[group]}
                        </Typography>
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                            {items.map((def) => {
                                const active = selected?.id === def.id
                                return (
                                    <Button
                                        key={def.id}
                                        size="small"
                                        variant={active ? 'contained' : 'outlined'}
                                        onClick={() => { setSelected(def); setValue('1') }}
                                        sx={{
                                            backgroundColor: active ? CONDITION_COLOR : undefined,
                                            borderColor: active ? CONDITION_COLOR : rule,
                                            color: active ? parchment.paper : ink.primary,
                                            '&:hover': { backgroundColor: active ? CONDITION_COLOR : undefined },
                                        }}
                                    >
                                        {def.name}
                                    </Button>
                                )
                            })}
                        </Stack>
                    </Box>
                ))}

                {selected && (
                    <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="body2" sx={{ color: ink.secondary, mb: 1.5 }}>
                            {selected.summary}
                        </Typography>
                        <Stack direction="row" spacing={1.5}>
                            {selected.valued && (
                                <TextField
                                    label="Valor"
                                    size="small"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
                                    inputProps={{ inputMode: 'numeric' }}
                                    sx={{ width: 100 }}
                                />
                            )}
                            <TextField
                                label="Duração"
                                size="small"
                                placeholder="sem prazo"
                                value={rounds}
                                onChange={(e) => setRounds(e.target.value.replace(/\D/g, ''))}
                                inputProps={{ inputMode: 'numeric' }}
                                helperText="Rodadas — conta no turno do alvo"
                                sx={{ width: 170 }}
                            />
                        </Stack>
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={close}>Cancelar</Button>
                <Button variant="contained" disabled={!selected} onClick={handleApply}>
                    Aplicar
                </Button>
            </DialogActions>
        </Dialog>
    )
}
