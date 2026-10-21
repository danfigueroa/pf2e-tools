import { Alert, Box, Chip, FormControl, InputLabel, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { MAGUS_COLOR } from '../../../theme'
import { componentLabel } from '../heightening'
import type { MagusApi } from './useMagus'
import type { SpellstrikeApi } from './useSpellstrike'

interface Props {
    ss: SpellstrikeApi
    magus: MagusApi
}

/**
 * A escolha da magia do Spellstrike, dentro do diálogo do Golpe. Só desenha: o
 * que vale (slot, dano, postura) vem do `useSpellstrike` e é aplicado ao rolar.
 */
export const SpellstrikePanel = ({ ss, magus }: Props) => {
    const { option } = ss
    return (
        <Box sx={{ border: '1px solid', borderColor: MAGUS_COLOR + '66', borderRadius: 1, px: 1.25, py: 1, bgcolor: MAGUS_COLOR + '0D' }}>
            <Stack spacing={1}>
                <Typography variant="overline" sx={{ color: MAGUS_COLOR, lineHeight: 1.4, fontWeight: 700 }}>
                    Spellstrike
                </Typography>

                {magus.stored.spent && (
                    <Alert severity="warning" sx={{ py: 0 }}>
                        O Spellstrike está gasto: recarregue (1 ação) antes de usar de novo — o botão está na faixa do Magus.
                    </Alert>
                )}

                <FormControl size="small" fullWidth>
                    <InputLabel id="spellstrike-spell">Magia no Golpe</InputLabel>
                    <Select
                        labelId="spellstrike-spell"
                        label="Magia no Golpe"
                        value={ss.choice ?? ''}
                        onChange={(e) => ss.setChoice(e.target.value || null)}
                    >
                        <MenuItem value=""><em>Só o Golpe (sem magia)</em></MenuItem>
                        {[...ss.options].sort((a, b) => a.caster.localeCompare(b.caster) || b.rank - a.rank || a.name.localeCompare(b.name)).map((o) => (
                            <MenuItem key={o.id} value={o.id} disabled={o.left === 0}>
                                {o.name} · {o.kind === 'cantrip'
                                    ? `truque (rank ${o.rank})`
                                    : o.kind === 'mythic'
                                        ? `rank ${o.rank} · 1 Ponto Mítico (${o.left} disponível)`
                                        : `rank ${o.rank} · ${o.left} slot${o.left === 1 ? '' : 's'}`}
                                {ss.options.some((x) => x.caster !== o.caster) ? ` — ${o.caster}` : ''}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {option && ss.loading && (
                    <Typography variant="caption" color="text.secondary">Buscando a magia no AON…</Typography>
                )}
                {option && ss.issue && <Alert severity="warning" sx={{ py: 0 }}>{ss.issue}</Alert>}

                {option && ss.spell && !ss.issue && (
                    <>
                        {ss.actionLimit && ss.nActions != null && (
                            <Box>
                                <Typography variant="caption" color="text.secondary">Ações da magia dentro do Spellstrike</Typography>
                                <ToggleButtonGroup exclusive size="small" fullWidth value={ss.nActions} onChange={(_, v: number | null) => { if (v != null) ss.setNActions(v) }}>
                                    {Array.from({ length: ss.actionLimit.max - ss.actionLimit.min + 1 }, (_, i) => ss.actionLimit!.min + i).map((n) => (
                                        <ToggleButton key={n} value={n}>{n} {n === 1 ? 'ação' : 'ações'}</ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                                {ss.variant && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        {ss.variant.rays > 1
                                            ? 'O Spellstrike entrega a magia num único Golpe: vale um raio só (o dano é o da versão com estas ações).'
                                            : ss.variant.notes[0]}
                                    </Typography>
                                )}
                            </Box>
                        )}
                        {ss.amp && (
                            <Box>
                                <Chip
                                    label={`Amplificar · 1 Ponto de Foco (${ss.focusLeft} disponível${ss.focusLeft === 1 ? '' : 'is'})`}
                                    color={ss.ampOn ? 'primary' : 'default'}
                                    variant={ss.ampOn ? 'filled' : 'outlined'}
                                    disabled={!ss.ampOn && ss.focusLeft === 0}
                                    aria-pressed={ss.ampOn}
                                    onClick={() => ss.setAmpOn(!ss.ampOn)}
                                    sx={{ minHeight: 32 }}
                                />
                                {ss.ampOn && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        {ss.amp.summary} No Spellstrike, só o alvo do Golpe recebe.
                                    </Typography>
                                )}
                            </Box>
                        )}
                        {ss.components.length > 0 ? (
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    Dano da magia (rank {option.rank}) — ligue o que vale
                                </Typography>
                                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                                    {ss.components.map((c) => {
                                        const on = ss.selected.has(c.id) && !c.uncertain
                                        return (
                                            <Chip
                                                key={c.id}
                                                label={componentLabel(c)}
                                                color={on ? 'primary' : 'default'}
                                                variant={on ? 'filled' : 'outlined'}
                                                disabled={!!c.uncertain}
                                                aria-pressed={on}
                                                onClick={() => ss.toggle(c.id)}
                                                sx={{ minHeight: 32 }}
                                            />
                                        )
                                    })}
                                </Stack>
                            </Box>
                        ) : (
                            <Typography variant="caption" color="text.secondary">
                                Esta magia não tem dano legível para rolar; o efeito dela vale à parte.
                            </Typography>
                        )}

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {ss.usesAttack
                                ? 'Magia de ataque: usa o resultado do Golpe e dobra no crítico.'
                                : `Salvaguarda${ss.spell.defense ? ` (${ss.spell.defense})` : ''}: o alvo rola a dele; o dano da magia não dobra com o crítico do Golpe.`}
                            {' '}
                            {option.kind === 'cantrip' ? (ss.ampOn ? 'Truque amplificado: gasta 1 Ponto de Foco ao rolar.' : 'Truque: não gasta slot.') : option.kind === 'mythic' ? 'Mythic Magic: gasta 1 Ponto Mítico, e o ataque é o do Golpe (sem a proficiência mítica da magia).' : `Ao rolar, gasta 1 slot de rank ${option.spellLevel}.`}
                            {' '}Conta como dois ataques para a penalidade (aplicada depois).
                        </Typography>

                        {magus.canCascade && !magus.stored.cascade && (
                            <Chip
                                label="Entrar na Arcane Cascade depois"
                                color={ss.enterCascade ? 'primary' : 'default'}
                                variant={ss.enterCascade ? 'filled' : 'outlined'}
                                aria-pressed={ss.enterCascade}
                                onClick={() => ss.setEnterCascade(!ss.enterCascade)}
                                sx={{ minHeight: 32, alignSelf: 'flex-start' }}
                            />
                        )}
                    </>
                )}
            </Stack>
        </Box>
    )
}
