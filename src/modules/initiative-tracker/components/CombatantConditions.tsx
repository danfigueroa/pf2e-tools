import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { Add as AddIcon, Close as CloseIcon, Remove as RemoveIcon } from '@mui/icons-material'
import { CONDITION_COLOR, ink } from '../../../theme'
import { CONDITIONS_BY_ID } from '../../character-viewer/conditions'
import { stageConditions } from '../afflictions'
import type { CombatantView } from '../types'

/** Mesmos alvos de toque da barra de condições da Ficha Virtual. */
const TAP_PADDING = { xs: 0.6, sm: 0.25 }
const TAP_ICON = { xs: '1.15rem', sm: '0.9rem' }

/**
 * Condições ativas de um combatente, com o contador de rodadas ao lado.
 *
 * Percorre `mods.active` e não o estado cru: assim as condições **impostas**
 * (Inconsciente → Cego, Desprevenido, Caído) aparecem, marcadas com borda
 * tracejada e sem botões — elas somem sozinhas quando a origem sai.
 *
 * Condição vinda do estágio de uma AFLIÇÃO entra pelo mesmo caminho, e pela
 * mesma razão: ela é derivada, não está gravada, e um botão de remover ali não
 * teria o que remover — o clique não faria nada e pareceria defeito. Some
 * sozinha quando o estágio muda ou a aflição acaba. Se a mesma condição também
 * estiver marcada à mão, ela reaparece com botões quando a aflição sai.
 */
export const CombatantConditions = ({ view }: { view: CombatantView }) => {
    const { mods, combatant, afflictions, adjustCondition, toggleCondition, setDuration } = view
    const durations = combatant.durations

    /** id da condição → nome da aflição que a impõe agora. */
    const fromAffliction = new Map<string, string>()
    for (const a of afflictions) {
        for (const id of Object.keys(stageConditions(a))) fromAffliction.set(id, a.def.name)
    }

    // Nada a dizer quando não há condição: o "Sem condições" existia como
    // rótulo do ⚡ mudo que abria o diálogo. Com o botão escrito na fileira de
    // ações, repetir isso é só ruído numa lista de dez combatentes.
    if (mods.active.length === 0) return null

    return (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {mods.active.map((entry) => {
                const def = CONDITIONS_BY_ID[entry.id]
                if (!def) return null
                const viaAffliction = fromAffliction.get(entry.id)
                const imposed = !!entry.via || viaAffliction !== undefined
                const rounds = durations[entry.id]

                return (
                    <Tooltip
                        key={entry.id}
                        title={
                            viaAffliction
                                ? `${def.summary} (do estágio de ${viaAffliction})`
                                : entry.via
                                    ? `${def.summary} (imposta por ${entry.via})`
                                    : def.summary
                        }
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.25,
                                borderRadius: 4,
                                border: `1px ${imposed ? 'dashed' : 'solid'} ${CONDITION_COLOR}${imposed ? '80' : ''}`,
                                backgroundColor: imposed ? 'transparent' : CONDITION_COLOR + '18',
                                pl: 1,
                                pr: imposed ? 1 : 0.25,
                                py: { xs: 0.25, sm: 0 },
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{ fontWeight: 600, color: imposed ? ink.secondary : ink.primary }}
                            >
                                {def.name}{def.valued ? ` ${entry.value}` : ''}
                            </Typography>

                            {rounds !== undefined && (
                                <Chip
                                    size="small"
                                    label={`${rounds}r`}
                                    onClick={() => setDuration(entry.id, rounds - 1)}
                                    sx={{
                                        height: 18,
                                        ml: 0.5,
                                        fontSize: '0.65rem',
                                        backgroundColor: CONDITION_COLOR + '33',
                                    }}
                                />
                            )}

                            {!imposed && (
                                <>
                                    {def.valued && (
                                        <>
                                            <IconButton
                                                size="small"
                                                sx={{ p: TAP_PADDING }}
                                                onClick={() => adjustCondition(entry.id, -1)}
                                                aria-label={`Diminuir ${def.name}`}
                                            >
                                                <RemoveIcon sx={{ fontSize: TAP_ICON }} />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                sx={{ p: TAP_PADDING }}
                                                onClick={() => adjustCondition(entry.id, 1)}
                                                aria-label={`Aumentar ${def.name}`}
                                            >
                                                <AddIcon sx={{ fontSize: TAP_ICON }} />
                                            </IconButton>
                                        </>
                                    )}
                                    <IconButton
                                        size="small"
                                        sx={{ p: TAP_PADDING }}
                                        onClick={() => toggleCondition(entry.id)}
                                        aria-label={`Remover ${def.name}`}
                                    >
                                        <CloseIcon sx={{ fontSize: TAP_ICON }} />
                                    </IconButton>
                                </>
                            )}
                        </Box>
                    </Tooltip>
                )
            })}
        </Stack>
    )
}
