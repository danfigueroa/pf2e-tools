import { useEffect, useMemo, useState } from 'react'
import { Button, Card, CardContent, Chip, MenuItem, Select, Stack, Typography } from '@mui/material'
import { Science as PoisonIcon } from '@mui/icons-material'
import { ROGUE_COLOR } from '../../../theme'
import type { BuildInfo } from '../../character-sheet/types'
import { fetchItemTraits, type ItemTraits } from '../../../services/itemTraits'
import { actionsKeyFor, consumedKeyFor } from '../charId'
import type { ConditionModifiers } from '../conditions'
import { useActions } from './useActions'
import { isApplicablePoison, poisonNote } from '../rogue'
import { FeatureRow } from './FeatureRow'
import { usePoisonDef } from './usePoison'
import { useConsumables } from './useConsumables'
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
    const consumables = useConsumables(consumedKeyFor(build))
    const [traits, setTraits] = useState<Record<string, ItemTraits | null>>({})
    const [choice, setChoice] = useState('')

    const names = useMemo(() => (build.equipment ?? []).map(([name]) => name), [build.equipment])
    useEffect(() => {
        if (names.length === 0) return
        let cancelled = false
        fetchItemTraits(names).then((t) => { if (!cancelled) setTraits(t) })
        return () => { cancelled = true }
    }, [names])

    // Só veneno de contato/injeção que ainda tem unidade.
    const options = (build.equipment ?? [])
        .filter(([name]) => isApplicablePoison(traits[name]))
        .map(([name, qty]) => ({ name, qty, left: consumables.remaining(name, qty) }))
        .filter((o) => o.left > 0)

    const loaded = rogue.stored.poison
    const def = usePoisonDef(loaded)
    const selected = options.find((o) => o.name === choice) ?? options[0] ?? null

    const apply = () => {
        if (!selected) return
        actions.spend(1)
        consumables.consume(selected.name, selected.qty)
        rogue.setPoison(selected.name)
    }

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
                                <Chip label={`Arma envenenada · ${poisonNote(loaded, def).replace('veneno: ', '')}`} size="small" sx={{ ...chipSx, bgcolor: ROGUE_COLOR, color: '#FFFFFF' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 140 }}>
                                    Fica na lâmina até um Golpe acertar.
                                </Typography>
                                <Button size="small" variant="outlined" onClick={rogue.clearPoison}>
                                    Veneno usado
                                </Button>
                            </>
                        ) : options.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                Sem veneno de contato ou de injeção no inventário.
                            </Typography>
                        ) : (
                            <>
                                <Select
                                    size="small"
                                    value={selected?.name ?? ''}
                                    onChange={(e) => setChoice(e.target.value)}
                                    inputProps={{ 'aria-label': 'Veneno' }}
                                    sx={{ height: 32, fontSize: '0.85rem', minWidth: 140 }}
                                >
                                    {options.map((o) => (
                                        <MenuItem key={o.name} value={o.name}>{o.name} ×{o.left}</MenuItem>
                                    ))}
                                </Select>
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={apply}
                                    sx={{ ml: 'auto', bgcolor: ROGUE_COLOR, '&:hover': { bgcolor: ROGUE_COLOR, filter: 'brightness(0.9)' } }}
                                >
                                    Aplicar · 1 ação
                                </Button>
                            </>
                        )}
                    </FeatureRow>
                </Stack>
            </CardContent>
        </Card>
    )
}
