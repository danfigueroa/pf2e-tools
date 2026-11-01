import { Alert, Box, Chip, FormControl, InputLabel, MenuItem, Select, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { MAGUS_COLOR } from '../../../theme'
import { componentLabel } from '../heightening'
import type { MagusApi } from './useMagus'
import type { SpellstrikeApi } from './useSpellstrike'
import { tr } from '../../../i18n'

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
                        {tr('O Spellstrike está gasto: recarregue (1 ação) antes de usar de novo — o botão está na faixa do Magus.', 'Spellstrike is spent: recharge it (1 action) before using it again — the button is in the Magus bar.')}</Alert>
                )}

                <FormControl size="small" fullWidth>
                    <InputLabel id="spellstrike-spell">{tr('Magia no Golpe', 'Spell in the Strike')}</InputLabel>
                    <Select
                        labelId="spellstrike-spell"
                        label={tr("Magia no Golpe", 'Spell in the Strike')}
                        value={ss.choice ?? ''}
                        onChange={(e) => ss.setChoice(e.target.value || null)}
                    >
                        <MenuItem value=""><em>{tr('Só o Golpe (sem magia)', 'Just the Strike (no spell)')}</em></MenuItem>
                        {[...ss.options].sort((a, b) => a.caster.localeCompare(b.caster) || b.rank - a.rank || a.name.localeCompare(b.name)).map((o) => (
                            <MenuItem key={o.id} value={o.id} disabled={o.left === 0}>
                                {o.name} · {o.kind === 'cantrip'
                                    ? tr(`truque (rank ${o.rank})`, `cantrip (rank ${o.rank})`)
                                    : o.kind === 'mythic'
                                        ? tr(`rank ${o.rank} · 1 Ponto Mítico (${o.left} disponível)`, `rank ${o.rank} · 1 Mythic Point (${o.left} available)`)
                                        : `rank ${o.rank} · ${o.left} slot${o.left === 1 ? '' : 's'}`}
                                {ss.options.some((x) => x.caster !== o.caster) ? ` — ${o.caster}` : ''}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {option && ss.loading && (
                    <Typography variant="caption" color="text.secondary">{tr('Buscando a magia no AON…', 'Looking up the spell on AON…')}</Typography>
                )}
                {option && ss.issue && <Alert severity="warning" sx={{ py: 0 }}>{ss.issue}</Alert>}

                {option && ss.spell && !ss.issue && (
                    <>
                        {ss.actionLimit && ss.nActions != null && (
                            <Box>
                                <Typography variant="caption" color="text.secondary">{tr('Ações da magia dentro do Spellstrike', 'Spell actions inside Spellstrike')}</Typography>
                                <ToggleButtonGroup exclusive size="small" fullWidth value={ss.nActions} onChange={(_, v: number | null) => { if (v != null) ss.setNActions(v) }}>
                                    {Array.from({ length: ss.actionLimit.max - ss.actionLimit.min + 1 }, (_, i) => ss.actionLimit!.min + i).map((n) => (
                                        <ToggleButton key={n} value={n}>{n} {n === 1 ? tr('ação', 'action') : tr('ações', 'actions')}</ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                                {ss.variant && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        {ss.variant.rays > 1
                                            ? tr('O Spellstrike entrega a magia num único Golpe: vale um raio só (o dano é o da versão com estas ações).', 'Spellstrike delivers the spell in a single Strike: only one ray applies (the damage is the version with these actions).')
                                            : ss.variant.notes[0]}
                                    </Typography>
                                )}
                            </Box>
                        )}
                        {ss.amp && (
                            <Box>
                                <Chip
                                    label={tr(`Amplificar · 1 Ponto de Foco (${ss.focusLeft} disponível${ss.focusLeft === 1 ? '' : 'is'})`, `Amp · 1 Focus Point (${ss.focusLeft} available)`)}
                                    color={ss.ampOn ? 'primary' : 'default'}
                                    variant={ss.ampOn ? 'filled' : 'outlined'}
                                    disabled={!ss.ampOn && ss.focusLeft === 0}
                                    aria-pressed={ss.ampOn}
                                    onClick={() => ss.setAmpOn(!ss.ampOn)}
                                    sx={{ minHeight: 32 }}
                                />
                                {ss.ampOn && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        {ss.amp.summary} {tr('No Spellstrike, só o alvo do Golpe recebe.', 'In Spellstrike, only the Strike\'s target is affected.')}</Typography>
                                )}
                            </Box>
                        )}
                        {ss.components.length > 0 ? (
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    {tr('Dano da magia (rank ', 'Spell damage (rank ')}{option.rank}{tr(') — ligue o que vale', ') — turn on what applies')}</Typography>
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
                                {tr('Esta magia não tem dano legível para rolar; o efeito dela vale à parte.', 'This spell has no readable damage to roll; its effect applies separately.')}</Typography>
                        )}

                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {ss.usesAttack
                                ? tr('Magia de ataque: usa o resultado do Golpe e dobra no crítico.', 'Attack spell: uses the Strike\'s result and doubles on a critical.')
                                : tr(`Salvaguarda${ss.spell.defense ? ` (${ss.spell.defense})` : ''}: o alvo rola a dele; o dano da magia não dobra com o crítico do Golpe.`, `Saving throw${ss.spell.defense ? ` (${ss.spell.defense})` : ''}: the target rolls theirs; the spell's damage doesn't double with the Strike's critical.`)}
                            {' '}
                            {option.kind === 'cantrip' ? (ss.ampOn ? tr('Truque amplificado: gasta 1 Ponto de Foco ao rolar.', 'Amped cantrip: spends 1 Focus Point when rolling.') : tr('Truque: não gasta slot.', 'Cantrip: doesn\'t spend a slot.')) : option.kind === 'mythic' ? tr('Mythic Magic: gasta 1 Ponto Mítico, e o ataque é o do Golpe (sem a proficiência mítica da magia).', 'Mythic Magic: spends 1 Mythic Point, and the attack is the Strike\'s (without the spell\'s mythic proficiency).') : tr(`Ao rolar, gasta 1 slot de rank ${option.spellLevel}.`, `When rolling, spends 1 rank ${option.spellLevel} slot.`)}
                            {' '}{tr('Conta como dois ataques para a penalidade (aplicada depois).', 'Counts as two attacks for the penalty (applied afterwards).')}</Typography>

                        {magus.canCascade && !magus.stored.cascade && (
                            <Chip
                                label={tr("Entrar na Arcane Cascade depois", 'Enter Arcane Cascade afterwards')}
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
