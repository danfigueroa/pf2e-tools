import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Card, CardContent, Typography, Stack, Chip, Snackbar } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import { COIN_COLORS } from '../../../theme/palette'
import { gold } from '../../../theme'
import type { BuildInfo } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import type { ConditionModifiers } from '../conditions'
import { characterMaxHp } from '../helpers'
import { consumedKeyFor, hpKeyFor, legacyCharKey } from '../charId'
import { useConsumables } from '../components/useConsumables'
import { useHpTracker } from '../components/useHpTracker'
import { fetchItemTraits, isConsumable, type ItemTraits } from '../../../services/itemTraits'
import { rollFormulaDetailed, rollMemorial } from '../../initiative-tracker/dice'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    mods: ConditionModifiers
}

/** Uma linha do inventário, já normalizada venha de onde vier. */
interface ItemRow {
    /** Como aparece na lista (pode trazer runas: "+2 Striking Warhammer"). */
    label: string
    /** Nome canônico, o que se busca na AON. */
    name: string
    qty: number
    /** Chips à direita: "Invested", "Vestida", "Arma"… */
    tags: string[]
    /** Só o equipamento pode ser consumível — arma e armadura nunca são. */
    equipment: boolean
}

/**
 * Armas e armaduras são inventário como qualquer outro item, mas o Pathbuilder
 * as exporta em listas próprias (`weapons`/`armor`, usadas na aba de Combate) —
 * então elas sumiam daqui. A lista junta as três, sem tocar no JSON da ficha.
 */
function inventoryRows(build: BuildInfo): ItemRow[] {
    const weapons = (build.weapons ?? []).map((w) => ({
        label: w.display || w.name,
        name: w.name,
        qty: w.qty,
        tags: ['Arma'],
        equipment: false,
    }))
    const armor = (build.armor ?? []).map((a) => ({
        label: a.display || a.name,
        name: a.name,
        qty: a.qty,
        tags: a.worn ? ['Armadura', 'Vestida'] : ['Armadura'],
        equipment: false,
    }))
    const equipment = (build.equipment ?? []).map(([name, qty, status]) => ({
        label: name,
        name,
        qty,
        tags: status ? [status] : [],
        equipment: true,
    }))
    return [...weapons, ...armor, ...equipment]
}

/** O aviso do último uso, com o que é preciso para desfazê-lo. */
interface UseNotice {
    text: string
    name: string
    qty: number
    /** PV que a cura de fato devolveu — o Desfazer tira exatamente isso. */
    healed: number
}

export const InventorySection = ({ build, onSelect, mods }: Props) => {
    const rows = inventoryRows(build)
    const money = build.money || { cp: 0, sp: 0, gp: 0, pp: 0 }
    const hasMoney = money.pp + money.gp + money.sp + money.cp > 0
    const hasEquipment = rows.length > 0

    const consumables = useConsumables(consumedKeyFor(build))
    // Cura de poção vai no PV do próprio personagem (quem bebe). É a mesma fatia
    // da Visão Geral, e o `maxHp` sai do mesmo helper para o teto não divergir.
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, mods.hpMaxDelta), legacyCharKey(build))

    const [traits, setTraits] = useState<Record<string, ItemTraits | null>>({})
    const [notice, setNotice] = useState<UseNotice | null>(null)

    const equipmentNames = useMemo(
        () => (build.equipment ?? []).map(([name]) => name).join('|'),
        [build.equipment],
    )
    useEffect(() => {
        if (!equipmentNames) return
        let cancelled = false
        fetchItemTraits(equipmentNames.split('|')).then((found) => {
            if (!cancelled) setTraits(found)
        })
        return () => { cancelled = true }
    }, [equipmentNames])

    const use = (row: ItemRow) => {
        consumables.consume(row.name, row.qty)
        const formula = traits[row.name]?.healing
        const roll = formula ? rollFormulaDetailed(formula) : null
        if (!formula || !roll) {
            setNotice({ text: `${row.name} usado.`, name: row.name, qty: row.qty, healed: 0 })
            return
        }
        const healed = hp.applyHealing(roll.total)
        const capped = healed < roll.total ? ' (PV cheio)' : ''
        setNotice({
            text: `${row.name}: ${formula} → ${rollMemorial(roll)} · +${healed} PV${capped}`,
            name: row.name,
            qty: row.qty,
            healed,
        })
    }

    // Desfaz só o que o uso fez: devolve o item e tira a cura que entrou, sobre
    // o PV de AGORA — se alguém mexeu no PV nesse meio-tempo, isso fica.
    const undo = (n: UseNotice) => {
        consumables.restore(n.name, n.qty)
        if (n.healed > 0) hp.restoreHp({ current: Math.max(0, hp.current - n.healed), temp: hp.temp })
    }

    if (!hasMoney && !hasEquipment) {
        return (
            <Card>
                <CardContent>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Inventário vazio.
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Stack spacing={2}>
            {hasMoney && (
                <Card>
                    <CardContent>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                            Dinheiro
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                            {/* platina é "pl": "pp" já é prata, e as duas colidiam. */}
                            <Coin label="pl" value={money.pp} accent={COIN_COLORS.pp} />
                            <Coin label="po" value={money.gp} accent={COIN_COLORS.gp} />
                            <Coin label="pp" value={money.sp} accent={COIN_COLORS.sp} />
                            <Coin label="pc" value={money.cp} accent={COIN_COLORS.cp} />
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {hasEquipment && (
                <Card>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                                Itens
                            </Typography>
                        </Box>
                        <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                            {rows.map((row, idx) => {
                                const info = traits[row.name]
                                const consumable = row.equipment && isConsumable(row.name, info)
                                const remaining = consumable ? consumables.remaining(row.name, row.qty) : row.qty
                                const spent = consumable && remaining === 0
                                const healing = consumable && !!info?.healing
                                // O Pathbuilder exporta poção e veneno como "Invested",
                                // igual a um anel. Num consumível confirmado pelo AON, o
                                // chip só confundiria.
                                const tags = consumable && info ? row.tags.filter((t) => t !== 'Invested') : row.tags
                                const open = () => onSelect({ type: 'item', name: row.name })

                                return (
                                    // O botão de usar fica FORA da área clicável: dentro de um
                                    // `role="button"` ele seria controle aninhado, e o leitor de
                                    // tela leria "Beber" como parte do nome da linha.
                                    <Box
                                        key={`${row.name}-${idx}`}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'background-color 0.15s',
                                            '&:hover': { backgroundColor: 'action.hover' },
                                        }}
                                    >
                                        <Box
                                            role="button"
                                            tabIndex={0}
                                            onClick={open}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open() }}
                                            sx={{
                                                flex: '1 1 auto',
                                                minWidth: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                columnGap: 1,
                                                rowGap: 0.75,
                                                pl: 2, pr: consumable ? 1 : 2, py: 1.25,
                                                cursor: 'pointer',
                                                '&:focus-visible': { backgroundColor: 'action.focus', outline: 'none' },
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontWeight: 500,
                                                    minWidth: 0,
                                                    color: spent ? 'text.secondary' : undefined,
                                                    textDecoration: spent ? 'line-through' : undefined,
                                                }}
                                            >
                                                {row.label}
                                            </Typography>
                                            <Stack
                                                direction="row"
                                                alignItems="center"
                                                sx={{ flexWrap: 'wrap', gap: 0.75, ml: 'auto', justifyContent: 'flex-end' }}
                                            >
                                                {spent ? (
                                                    <Chip label="Esgotado" size="small" />
                                                ) : remaining < row.qty ? (
                                                    <Chip label={`x${remaining} de ${row.qty}`} size="small" variant="outlined" />
                                                ) : row.qty > 1 ? (
                                                    <Chip label={`x${row.qty}`} size="small" variant="outlined" />
                                                ) : null}
                                                {tags.map((t) => (
                                                    <Chip key={t} label={t} size="small" />
                                                ))}
                                                <ChevronIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                            </Stack>
                                        </Box>
                                        {consumable && (
                                            <Button
                                                size="small"
                                                variant={spent ? 'text' : 'outlined'}
                                                aria-label={`${spent ? 'Devolver' : healing ? 'Beber' : 'Usar'} ${row.name}`}
                                                onClick={() => (spent ? consumables.restore(row.name, row.qty) : use(row))}
                                                sx={{ flex: '0 0 auto', mr: 2 }}
                                            >
                                                {spent ? 'Devolver' : healing ? 'Beber' : 'Usar'}
                                            </Button>
                                        )}
                                    </Box>
                                )
                            })}
                        </Stack>
                    </CardContent>
                </Card>
            )}

            <Snackbar
                open={!!notice}
                autoHideDuration={10000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setNotice(null) }}
                message={notice?.text}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                action={notice ? (
                    <Button
                        size="small"
                        sx={{ color: gold.bright }}
                        onClick={() => { undo(notice); setNotice(null) }}
                    >
                        Desfazer
                    </Button>
                ) : undefined}
            />
        </Stack>
    )
}

const Coin = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 0.75,
            px: 1.5,
            py: 0.75,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: accent + '55',
            backgroundColor: accent + '14',
        }}
    >
        <Typography sx={{ fontWeight: 700, color: accent }}>
            {value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {label}
        </Typography>
    </Box>
)
