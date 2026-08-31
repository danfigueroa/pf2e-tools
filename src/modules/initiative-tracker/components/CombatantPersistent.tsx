// Dano persistente ativo num combatente, no cartão do combate.
//
// O que o GM precisa ver sem abrir nada: quanto e de que tipo cai ao fim de
// cada turno, se o teste plano de recuperação está pendente e de onde o dano
// veio. O dano em si o app rola sozinho ao virar o turno (ver `dice.ts`); o
// teste plano é rolagem de quem está jogando, então aqui só se informa o
// resultado — mesma divisão da salvaguarda de aflição.

import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { gold, ink, parchment, rule, status } from '../../../theme'
import { damageTypeLabel } from '../defenses'
import { ASSISTED_DC, FLAT_DC, type PersistentDamage } from '../persistentDamage'

interface Props {
    persistent: PersistentDamage[]
    /** Lista inteira: quem chama calcula a nova com os helpers puros. */
    onChange: (list: PersistentDamage[]) => void
}

export function CombatantPersistent({ persistent, onChange }: Props) {
    if (persistent.length === 0) return null

    const replace = (id: string, patch: Partial<PersistentDamage>) =>
        onChange(persistent.map((p) => (p.id === id ? { ...p, ...patch } : p)))

    const remove = (id: string) => onChange(persistent.filter((p) => p.id !== id))

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
            {persistent.map((p) => {
                const label = damageTypeLabel(p.type)
                return (
                    <Box
                        key={p.id}
                        sx={{
                            border: `1px solid ${p.checkDue ? status.warning : rule}`,
                            borderLeft: `3px solid ${p.checkDue ? status.warning : status.error}`,
                            borderRadius: 1,
                            backgroundColor: parchment.sunken,
                            px: 1,
                            py: 0.75,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {p.formula} de {label.toLowerCase()} persistente
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
                            <Tooltip title="Remover (cura, apagar o fogo, fim do combate)">
                                <IconButton
                                    size="small"
                                    aria-label={`Remover dano persistente de ${label.toLowerCase()}`}
                                    onClick={() => remove(p.id)}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        <Typography variant="caption" sx={{ display: 'block', color: ink.secondary }}>
                            Cai ao final de cada turno · teste plano CD {p.dc} para acabar
                        </Typography>

                        {/* Só depois de o dano cair é que o teste plano existe. */}
                        {p.checkDue ? (
                            <Box sx={{ mt: 0.5 }}>
                                <Typography
                                    variant="caption"
                                    sx={{ display: 'block', color: status.warning, fontWeight: 700 }}
                                >
                                    Teste plano CD {p.dc}:
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                                        gap: 0.5,
                                        mt: 0.25,
                                    }}
                                >
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => remove(p.id)}
                                        aria-label={`Passou no teste plano do dano persistente de ${label.toLowerCase()}`}
                                    >
                                        Passou
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => replace(p.id, { checkDue: false })}
                                        aria-label={`Falhou no teste plano do dano persistente de ${label.toLowerCase()}`}
                                    >
                                        Falhou
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            // Player Core: ajuda apropriada (apagar o fogo, estancar
                            // o sangue) baixa a CD do teste plano de 15 para 10.
                            <Button
                                size="small"
                                onClick={() => replace(p.id, { dc: p.dc === FLAT_DC ? ASSISTED_DC : FLAT_DC })}
                                sx={{ mt: 0.25 }}
                            >
                                {p.dc === FLAT_DC ? `Ajuda apropriada (CD ${ASSISTED_DC})` : `Sem ajuda (CD ${FLAT_DC})`}
                            </Button>
                        )}
                    </Box>
                )
            })}
        </Box>
    )
}
