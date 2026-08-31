// Aflições ativas de um combatente, no cartão do combate.
//
// O que o GM precisa ver sem abrir nada: em que estágio está, o que o estágio
// faz, quanto de dano ele causou e quando cai a próxima salvaguarda.
//
// A SALVAGUARDA não é rolada pelo app — mostram-se os quatro graus e o RAW é
// aplicado sobre o que o GM escolher. O DANO do estágio é, e já caiu quando a
// aflição entrou no estágio: o chip vermelho existe para o GM conferir o que
// o app aplicou (o aviso da página traz o valor rolado e o "Desfazer").

import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { Close as CloseIcon, ArrowForward as NextIcon } from '@mui/icons-material'
import { CONDITIONS_BY_ID } from '../../character-viewer/conditions'
import { gold, ink, parchment, rule, status } from '../../../theme'
import { SAVE_DEGREES, stageDamage, stageOf, type AfflictionState } from '../afflictions'
import { damageTypeLabel } from '../defenses'

interface Props {
    afflictions: AfflictionState[]
    onSave: (afflictionId: string, degree: (typeof SAVE_DEGREES)[number]['id']) => void
    onAdvance: (afflictionId: string, by: number) => void
    onRemove: (afflictionId: string) => void
}

const conditionLabel = (id: string, value?: number) => {
    const def = CONDITIONS_BY_ID[id]
    if (!def) return id
    return def.valued && value ? `${def.name} ${value}` : def.name
}

export function CombatantAfflictions({ afflictions, onSave, onAdvance, onRemove }: Props) {
    if (afflictions.length === 0) return null

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
            {afflictions.map((a) => {
                const stage = stageOf(a)
                const total = a.def.stages.length
                // `roundsLeft === 0` é a salvaguarda vencida; `null` é aflição
                // cujo estágio não se conta em rodadas (minutos, dias…).
                const due = a.roundsLeft === 0
                const untracked = a.roundsLeft === null
                // O dano do estágio já caiu quando a aflição entrou nele; o
                // chip está aqui para o GM conferir o que o app aplicou.
                const damage = stageDamage(a).filter((d) => !d.persistent)

                return (
                    <Box
                        key={a.id}
                        sx={{
                            border: `1px solid ${due ? status.warning : rule}`,
                            borderLeft: `3px solid ${due ? status.warning : gold.main}`,
                            borderRadius: 1,
                            backgroundColor: parchment.sunken,
                            px: 1,
                            py: 0.75,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 0, overflowWrap: 'break-word' }}>
                                {a.def.name}
                            </Typography>
                            <Chip
                                size="small"
                                label={`Estágio ${a.stage}/${total}`}
                                sx={{ backgroundColor: gold.main + '33', fontWeight: 700 }}
                            />
                            {a.def.virulent && (
                                <Tooltip title="Virulento: precisa de dois sucessos seguidos para melhorar um estágio.">
                                    <Chip size="small" variant="outlined" label="Virulento" />
                                </Tooltip>
                            )}
                            <Box sx={{ flex: 1 }} />
                            <IconButton
                                size="small"
                                aria-label={`Remover ${a.def.name}`}
                                onClick={() => onRemove(a.id)}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        {/* Prosa do estágio: fica em inglês, como vem da AON. */}
                        {stage && (
                            <Typography variant="caption" sx={{ display: 'block', color: ink.secondary }}>
                                {stage.text}
                            </Typography>
                        )}

                        {(stage?.conditions.length || damage.length) ? (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                                {damage.map((d, i) => (
                                    <Chip
                                        key={`dmg${i}`}
                                        size="small"
                                        label={`${d.formula} de ${damageTypeLabel(d.type).toLowerCase()}`}
                                        sx={{ backgroundColor: status.error + '22', color: status.error, fontWeight: 700 }}
                                    />
                                ))}
                                {stage?.conditions.map((c) => (
                                    <Chip
                                        key={c.id}
                                        size="small"
                                        variant="outlined"
                                        label={conditionLabel(c.id, c.value)}
                                        sx={{ borderColor: gold.main, color: gold.deep }}
                                    />
                                ))}
                            </Box>
                        ) : null}

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                            <Typography variant="caption" sx={{ color: ink.secondary }}>
                                {a.def.dc !== null && a.def.save
                                    ? `CD ${a.def.dc} ${a.def.save === 'fortitude' ? 'Fort' : a.def.save === 'reflex' ? 'Ref' : 'Von'}`
                                    : (a.def.raw ?? 'salvaguarda não lida')}
                                {untracked && stage?.durationRaw ? ` · ${stage.durationRaw}` : ''}
                                {!untracked && !due && a.roundsLeft !== null
                                    ? ` · salva em ${a.roundsLeft} rodada${a.roundsLeft > 1 ? 's' : ''}`
                                    : ''}
                                {a.maxRoundsLeft !== null
                                    ? ` · acaba em ${a.maxRoundsLeft} rodada${a.maxRoundsLeft > 1 ? 's' : ''}`
                                    : a.def.maxDurationRaw ? ` · máx. ${a.def.maxDurationRaw}` : ''}
                            </Typography>
                        </Box>

                        {/* Vencida em rodadas: pede a salvaguarda agora. */}
                        {due && (
                            <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" sx={{ display: 'block', color: status.warning, fontWeight: 700 }}>
                                    Salvaguarda de estágio:
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: 0.5, mt: 0.25 }}>
                                    {SAVE_DEGREES.map((d) => (
                                        <Button
                                            key={d.id}
                                            size="small"
                                            variant="outlined"
                                            onClick={() => onSave(a.id, d.id)}
                                            aria-label={`${d.label} na salvaguarda de ${a.def.name}`}
                                        >
                                            {d.short}
                                        </Button>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Fora do combate (minutos, horas, dias): o GM avança. */}
                        {untracked && (
                            <Button
                                size="small"
                                startIcon={<NextIcon />}
                                onClick={() => onAdvance(a.id, 1)}
                                sx={{ mt: 0.25 }}
                            >
                                Avançar estágio
                            </Button>
                        )}
                    </Box>
                )
            })}
        </Box>
    )
}
