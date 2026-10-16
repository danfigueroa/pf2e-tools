import { Button, Card, CardContent, Chip, MenuItem, Select, Stack, Typography } from '@mui/material'
import { Science as PoisonIcon } from '@mui/icons-material'
import { ROGUE_COLOR } from '../../../theme'
import type { BuildInfo } from '../../character-sheet/types'
import { actionsKeyFor } from '../charId'
import type { ConditionModifiers } from '../conditions'
import { useActions } from './useActions'
import { hasImprovedPoisonWeapon, isSimplePoison, poisonNote } from '../rogue'
import { FeatureRow } from './FeatureRow'
import { usePoisonDef } from './usePoison'
import { usePoisonOptions } from './usePoisonOptions'
import type { RogueApi } from './useRogue'

interface Props {
    build: BuildInfo
    rogue: RogueApi
    mods: ConditionModifiers
}

const chipSx = { height: 24, fontSize: '0.75rem', fontWeight: 600 }

/**
 * Poison Weapon do Ladino: escolhe um veneno de contato ou de injeção do
 * inventário, gasta uma unidade e deixa a arma envenenada até alguém dizer que
 * o veneno foi usado. O app não sabe se o Golpe acertou, então o "limpar" é à mão.
 */
export const RogueBar = ({ build, rogue, mods }: Props) => {
    const actions = useActions(actionsKeyFor(build), mods)
    const po = usePoisonOptions(build, rogue)
    const { options, selected, dose, simpleLeft, dice } = po

    const loaded = rogue.stored.poison
    const def = usePoisonDef(isSimplePoison(loaded) ? null : loaded)

    const apply = () => {
        if (!selected) return
        actions.spend(1)
        po.applyChosen()
    }

    const loadedText = isSimplePoison(loaded)
        ? `Veneno simples · ${dice.count}d${dice.faces} de veneno`
        : loaded ? poisonNote(loaded, def).replace('veneno: ', '') : ''

    return (
        <Card sx={{ mb: 3, borderColor: loaded ? ROGUE_COLOR + '99' : undefined, borderWidth: loaded ? 2 : undefined }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack spacing={1.25}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <PoisonIcon sx={{ color: ROGUE_COLOR }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>Ladino</Typography>
                    </Stack>

                    <FeatureRow title="Poison Weapon">
                        {loaded ? (
                            <>
                                <Chip label={`Arma envenenada · ${loadedText}`} size="small" sx={{ ...chipSx, bgcolor: ROGUE_COLOR, color: '#FFFFFF' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                    Fica na lâmina até um Golpe acertar.{hasImprovedPoisonWeapon(build) ? ' Num erro crítico a dose não se perde.' : ''}
                                </Typography>
                                <Button size="small" variant="outlined" onClick={rogue.clearPoison}>
                                    Veneno usado
                                </Button>
                            </>
                        ) : (
                            <>
                                <Select
                                    size="small"
                                    value={selected?.name ?? ''}
                                    onChange={(e) => po.setChoice(e.target.value)}
                                    inputProps={{ 'aria-label': 'Veneno' }}
                                    displayEmpty
                                    sx={{ height: 32, fontSize: '0.85rem', minWidth: 190 }}
                                >
                                    {options.map((o) => (
                                        <MenuItem key={o.name} value={o.name} disabled={o.left === 0}>
                                            {o.label} · {isSimplePoison(o.name) ? `${o.left}/${o.of} por dia` : `×${o.left}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Button
                                    size="small"
                                    variant="contained"
                                    disabled={!selected}
                                    onClick={apply}
                                    sx={{ ml: 'auto', bgcolor: ROGUE_COLOR, '&:hover': { bgcolor: ROGUE_COLOR, filter: 'brightness(0.9)' } }}
                                >
                                    {selected ? 'Aplicar · 1 ação' : 'Sem veneno'}
                                </Button>
                            </>
                        )}
                    </FeatureRow>
                    {rogue.stored.simpleUsed > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            Veneno simples: {simpleLeft} de {dose} doses hoje (sem salvaguarda; só você aplica direito, e expira na próxima preparação).{' '}
                            <Button size="small" onClick={rogue.newDay} sx={{ minWidth: 0, p: 0, verticalAlign: 'baseline' }}>Nova preparação</Button>
                        </Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    )
}
