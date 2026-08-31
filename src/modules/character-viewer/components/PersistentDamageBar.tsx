// Dano persistente ativo na Ficha Virtual.
//
// Fica ao lado das condições e das aflições, fora das abas, pela mesma razão:
// o efeito não é de uma aba, é do personagem. E é só leitura mais o botão de
// tirar — o dano cai no gerenciador de Iniciativa, ao final de cada turno.

import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { gold, ink, parchment, rule, status } from '../../../theme'
import { damageTypeLabel } from '../../initiative-tracker/defenses'
import type { PersistentDamage } from '../../initiative-tracker/persistentDamage'

interface Props {
    persistent: PersistentDamage[]
    onRemove: (id: string) => void
}

export const PersistentDamageBar = ({ persistent, onRemove }: Props) => {
    if (persistent.length === 0) return null

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
            {persistent.map((p) => {
                const label = damageTypeLabel(p.type).toLowerCase()
                return (
                    <Box
                        key={p.id}
                        sx={{
                            border: `1px solid ${rule}`,
                            borderLeft: `3px solid ${status.error}`,
                            borderRadius: 1,
                            backgroundColor: parchment.sunken,
                            px: 1.25,
                            py: 0.75,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {p.formula} de {label} persistente
                            </Typography>
                            {p.sourceName && (
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={p.sourceName}
                                    sx={{ height: 18, fontSize: '0.65rem', borderColor: gold.main, color: gold.deep }}
                                />
                            )}
                            <Box sx={{ flex: 1 }} />
                            <Tooltip title="Remover (quando o grupo acabar com o efeito)">
                                <IconButton
                                    size="small"
                                    aria-label={`Remover dano persistente de ${label}`}
                                    onClick={() => onRemove(p.id)}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        <Typography variant="caption" sx={{ display: 'block', color: ink.secondary }}>
                            Cai ao final de cada um dos seus turnos · teste plano CD {p.dc} para acabar
                        </Typography>
                    </Box>
                )
            })}
        </Box>
    )
}
