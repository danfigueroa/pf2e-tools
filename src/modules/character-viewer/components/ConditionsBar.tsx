import { useState } from 'react'
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Collapse,
    Divider,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Bolt as ConditionIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
    Close as CloseIcon,
    ExpandMore as ExpandIcon,
    LayersClear as ClearIcon,
} from '@mui/icons-material'
import { CONDITION_COLOR } from '../../../theme'
import { signed } from '../helpers'
import { CONDITIONS_BY_ID, TARGET_LABELS, affectedTargets } from '../conditions'
import { ConditionsDialog } from './ConditionsDialog'
import type { ConditionsApi } from './useConditions'

interface Props {
    conditions: ConditionsApi
}

/**
 * Os botõezinhos de +/−/× dentro da pílula da condição são o alvo mais
 * apertado da ficha. No celular eles crescem (a pílula acompanha); no desktop,
 * onde há ponteiro, ficam compactos como antes.
 */
const TAP_PADDING = { xs: 0.6, sm: 0.25 }
const TAP_ICON = { xs: '1.15rem', sm: '0.9rem' }

/**
 * Barra de condições ativas. Fica fora das abas, logo abaixo do cabeçalho, para
 * continuar visível enquanto se navega pela ficha — as condições afetam todas
 * as abas ao mesmo tempo.
 */
export const ConditionsBar = ({ conditions }: Props) => {
    const { state, mods, toggle, adjust, clear } = conditions
    const [dialogOpen, setDialogOpen] = useState(false)
    const [showDetails, setShowDetails] = useState(false)

    const targets = affectedTargets(mods)
    const hasDetails = targets.length > 0 || mods.hpMaxDelta !== 0
        || mods.situational.length > 0 || mods.notes.length > 0

    return (
        <>
            <Card sx={{ mb: 3, borderColor: mods.active.length > 0 ? CONDITION_COLOR + '80' : undefined }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <ConditionIcon sx={{ color: CONDITION_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                            Condições
                        </Typography>

                        {mods.active.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                Nenhuma ativa.
                            </Typography>
                        )}

                        <Box sx={{ flex: 1 }} />

                        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                            Adicionar
                        </Button>
                        {mods.count > 0 && (
                            <Tooltip title="Remover todas as condições">
                                <Button size="small" color="inherit" startIcon={<ClearIcon />} onClick={clear}>
                                    Limpar
                                </Button>
                            </Tooltip>
                        )}
                    </Stack>

                    {mods.active.length > 0 && (
                        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                            {mods.active.map((entry) => {
                                const def = CONDITIONS_BY_ID[entry.id]
                                const implied = !!entry.via
                                return (
                                    <Tooltip
                                        key={entry.id}
                                        title={implied ? `${def.summary} (imposta por ${entry.via})` : def.summary}
                                        enterDelay={400}
                                    >
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.25,
                                                pl: 1,
                                                pr: implied ? 1 : 0.25,
                                                py: { xs: 0.4, sm: 0.25 },
                                                borderRadius: 4,
                                                border: '1px solid',
                                                borderStyle: implied ? 'dashed' : 'solid',
                                                borderColor: CONDITION_COLOR + (implied ? '66' : 'FF'),
                                                backgroundColor: implied ? 'transparent' : CONDITION_COLOR + '1A',
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: '0.82rem',
                                                    fontWeight: 700,
                                                    color: implied ? 'text.secondary' : CONDITION_COLOR,
                                                }}
                                            >
                                                {def.name}{def.valued ? ` ${entry.value}` : ''}
                                            </Typography>

                                            {!implied && def.valued && (
                                                <>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Diminuir ${def.name}`}
                                                        onClick={() => adjust(entry.id, -1)}
                                                        sx={{ p: TAP_PADDING }}
                                                    >
                                                        <RemoveIcon sx={{ fontSize: TAP_ICON }} />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Aumentar ${def.name}`}
                                                        onClick={() => adjust(entry.id, 1)}
                                                        sx={{ p: TAP_PADDING }}
                                                    >
                                                        <AddIcon sx={{ fontSize: TAP_ICON }} />
                                                    </IconButton>
                                                </>
                                            )}
                                            {!implied && (
                                                <IconButton
                                                    size="small"
                                                    aria-label={`Remover ${def.name}`}
                                                    onClick={() => toggle(entry.id)}
                                                    sx={{ p: TAP_PADDING }}
                                                >
                                                    <CloseIcon sx={{ fontSize: TAP_ICON }} />
                                                </IconButton>
                                            )}
                                        </Box>
                                    </Tooltip>
                                )
                            })}
                        </Stack>
                    )}

                    {hasDetails && (
                        <>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
                                {targets.slice(0, showDetails ? targets.length : 6).map((t) => (
                                    <Chip
                                        key={t}
                                        size="small"
                                        label={`${TARGET_LABELS[t]} ${signed(mods.total[t])}`}
                                        sx={{
                                            height: 22,
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            color: CONDITION_COLOR,
                                            backgroundColor: CONDITION_COLOR + '14',
                                            border: '1px solid',
                                            borderColor: CONDITION_COLOR + '44',
                                        }}
                                    />
                                ))}
                                {!showDetails && targets.length > 6 && (
                                    <Typography variant="caption" color="text.secondary">
                                        +{targets.length - 6}
                                    </Typography>
                                )}
                                <Button
                                    size="small"
                                    color="inherit"
                                    onClick={() => setShowDetails((v) => !v)}
                                    endIcon={
                                        <ExpandIcon
                                            sx={{ transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                                        />
                                    }
                                    sx={{ ml: 'auto' }}
                                >
                                    {showDetails ? 'Menos' : 'Detalhes'}
                                </Button>
                            </Stack>

                            <Collapse in={showDetails} unmountOnExit>
                                <Divider sx={{ my: 1.5 }} />
                                {mods.hpMaxDelta !== 0 && (
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: CONDITION_COLOR, mb: 1 }}>
                                        PV máximos {signed(mods.hpMaxDelta)}
                                    </Typography>
                                )}
                                {mods.situational.length > 0 && (
                                    <Box sx={{ mb: 1 }}>
                                        <SubTitle>Só em certas situações</SubTitle>
                                        {mods.situational.map((s, i) => (
                                            <Typography key={i} variant="body2" color="text.secondary">
                                                <strong>{s.from}:</strong> {s.text}
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                                {mods.notes.length > 0 && (
                                    <Box>
                                        <SubTitle>Efeitos que a ficha não calcula</SubTitle>
                                        {mods.notes.map((n, i) => (
                                            <Typography key={i} variant="body2" color="text.secondary">
                                                <strong>{n.from}:</strong> {n.text}
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                            </Collapse>
                        </>
                    )}
                </CardContent>
            </Card>

            <ConditionsDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                state={state}
                onToggle={toggle}
                onAdjust={adjust}
            />
        </>
    )
}

const SubTitle = ({ children }: { children: React.ReactNode }) => (
    <Typography
        variant="overline"
        sx={{ display: 'block', fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary', lineHeight: 1.6 }}
    >
        {children}
    </Typography>
)
