// Aflições ativas na Ficha Virtual — a ponta de LEITURA do que o GM aplicou no
// combate. Fica ao lado da barra de condições, fora das abas, pela mesma razão:
// veneno afeta a ficha inteira.

import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { CONDITIONS_BY_ID } from '../conditions'
import { gold, ink, parchment, rule, status } from '../../../theme'
import { stageOf, type AfflictionState } from '../../initiative-tracker/afflictions'

interface Props {
    afflictions: AfflictionState[]
    onRemove: (id: string) => void
}

const conditionLabel = (id: string, value?: number) => {
    const def = CONDITIONS_BY_ID[id]
    if (!def) return id
    return def.valued && value ? `${def.name} ${value}` : def.name
}

export const AfflictionsBar = ({ afflictions, onRemove }: Props) => {
    if (afflictions.length === 0) return null

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
            {afflictions.map((a) => {
                const stage = stageOf(a)
                const due = a.roundsLeft === 0
                return (
                    <Box
                        key={a.id}
                        sx={{
                            border: `1px solid ${rule}`,
                            borderLeft: `3px solid ${due ? status.warning : gold.main}`,
                            borderRadius: 1,
                            backgroundColor: parchment.sunken,
                            px: 1.25,
                            py: 0.75,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0, overflowWrap: 'break-word' }}>
                                {a.def.name}
                            </Typography>
                            <Chip
                                size="small"
                                label={`Estágio ${a.stage}/${a.def.stages.length}`}
                                sx={{ backgroundColor: gold.main + '33', fontWeight: 700 }}
                            />
                            {a.def.virulent && (
                                <Tooltip title="Virulento: precisa de dois sucessos seguidos para melhorar um estágio.">
                                    <Chip size="small" variant="outlined" label="Virulento" />
                                </Tooltip>
                            )}
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title="Remover (quando o grupo curar a aflição)">
                                <IconButton size="small" aria-label={`Remover ${a.def.name}`} onClick={() => onRemove(a.id)}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        {/* Prosa do estágio: em inglês, como vem da AON. */}
                        {stage && (
                            <Typography variant="caption" sx={{ display: 'block', color: ink.secondary }}>
                                {stage.text}
                            </Typography>
                        )}

                        {stage && stage.conditions.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                {stage.conditions.map((c) => (
                                    <Chip
                                        key={c.id}
                                        size="small"
                                        variant="outlined"
                                        label={conditionLabel(c.id, c.value)}
                                        sx={{ borderColor: gold.main, color: gold.deep }}
                                    />
                                ))}
                            </Box>
                        )}

                        <Typography variant="caption" sx={{ display: 'block', color: ink.secondary, mt: 0.5 }}>
                            {a.def.dc !== null && a.def.save
                                ? `CD ${a.def.dc} ${a.def.save === 'fortitude' ? 'Fortitude' : a.def.save === 'reflex' ? 'Reflexos' : 'Vontade'}`
                                : (a.def.raw ?? 'salvaguarda não lida')}
                            {due
                                ? ' · salvaguarda pendente'
                                : a.roundsLeft !== null
                                    ? ` · salva em ${a.roundsLeft} rodada${a.roundsLeft > 1 ? 's' : ''}`
                                    : stage?.durationRaw ? ` · ${stage.durationRaw}` : ''}
                        </Typography>
                    </Box>
                )
            })}
        </Box>
    )
}
