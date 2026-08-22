import { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import {
    Search as SearchIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
    CheckCircle as OnIcon,
    RadioButtonUnchecked as OffIcon,
} from '@mui/icons-material'
import { CONDITION_COLOR } from '../../../theme'
import { CONDITIONS, GROUP_LABELS, type ConditionDef, type ConditionGroup } from '../conditions'
import type { ConditionState } from './useConditions'

interface Props {
    open: boolean
    onClose: () => void
    state: ConditionState
    onToggle: (id: string) => void
    onAdjust: (id: string, delta: number) => void
}

const GROUP_ORDER: ConditionGroup[] = ['debuff', 'movement', 'senses', 'death', 'attitude']

/** Catálogo completo de condições, com busca por nome pt-BR/inglês. */
export const ConditionsDialog = ({ open, onClose, state, onToggle, onAdjust }: Props) => {
    const theme = useTheme()
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
    const [query, setQuery] = useState('')

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase()
        const matches = (c: ConditionDef) =>
            !q || c.name.toLowerCase().includes(q) || c.en.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q)
        return GROUP_ORDER
            .map((g) => ({ group: g, items: CONDITIONS.filter((c) => c.group === g && matches(c)) }))
            .filter((g) => g.items.length > 0)
    }, [query])

    return (
        <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>Condições</DialogTitle>
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
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ mb: 2 }}
                />

                {groups.length === 0 && (
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic', py: 2 }}>
                        Nenhuma condição corresponde à busca.
                    </Typography>
                )}

                {groups.map(({ group, items }) => (
                    <Box key={group} sx={{ mb: 2 }}>
                        <Typography
                            variant="overline"
                            sx={{ display: 'block', fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}
                        >
                            {GROUP_LABELS[group]}
                        </Typography>
                        <Stack divider={<Divider flexItem />}>
                            {items.map((c) => (
                                <ConditionRow
                                    key={c.id}
                                    def={c}
                                    value={state[c.id]}
                                    onToggle={() => onToggle(c.id)}
                                    onAdjust={(d) => onAdjust(c.id, d)}
                                />
                            ))}
                        </Stack>
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">Pronto</Button>
            </DialogActions>
        </Dialog>
    )
}

const ConditionRow = ({ def, value, onToggle, onAdjust }: {
    def: ConditionDef
    value?: number
    onToggle: () => void
    onAdjust: (delta: number) => void
}) => {
    const active = value != null

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                py: 1.25,
                backgroundColor: active ? CONDITION_COLOR + '14' : 'transparent',
                borderRadius: 1,
                px: 1,
            }}
        >
            <IconButton
                size="small"
                onClick={onToggle}
                aria-label={active ? `Remover ${def.name}` : `Adicionar ${def.name}`}
                sx={{ color: active ? CONDITION_COLOR : 'text.disabled', mt: -0.25 }}
            >
                {active ? <OnIcon /> : <OffIcon />}
            </IconButton>

            <Box sx={{ flex: 1, minWidth: 0 }} onClick={onToggle} role="presentation" style={{ cursor: 'pointer' }}>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                    {def.name}
                    {active && def.valued ? ` ${value}` : ''}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                        {def.en}
                    </Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                    {def.summary}
                </Typography>
                {def.note && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.25 }}>
                        {def.note}
                    </Typography>
                )}
            </Box>

            {def.valued && active && (
                <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
                    <IconButton size="small" onClick={() => onAdjust(-1)} aria-label={`Diminuir ${def.name}`}>
                        <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{value}</Typography>
                    <IconButton size="small" onClick={() => onAdjust(1)} aria-label={`Aumentar ${def.name}`}>
                        <AddIcon fontSize="small" />
                    </IconButton>
                </Stack>
            )}
        </Box>
    )
}
