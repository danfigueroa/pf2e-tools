import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import { Box, Button, Card, CardContent, Typography, Stack, Chip, IconButton, Snackbar, Tooltip } from '@mui/material'
import {
    Add as AddIcon,
    Send as SendIcon,
    ChevronRight as ChevronIcon,
    LocalDrink as DrinkIcon,
    TouchApp as UseIcon,
} from '@mui/icons-material'
import { COIN_COLORS, HP_COLOR } from '../../../theme/palette'
import { gold } from '../../../theme'
import type { BuildInfo } from '../../../pathbuilder/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'
import type { ConditionModifiers } from '../conditions'
import { characterMaxHp } from '../helpers'
import type { ItemRow } from '../inventory'
import { consumedKeyFor, hpKeyFor, legacyCharKey } from '../charId'
import { useConsumables } from '../components/useConsumables'
import { CompanionsCard } from '../components/CompanionsCard'
import { RelicsCard } from '../components/RelicsCard'
import { ActivityBody } from '../components/ActivityButton'
import { HealActivityButton } from '../components/HealActivityButton'
import { itemHeal } from '../healActivities'
import { itemActivityOf } from '../itemActivities'
import { relicsOf } from '../relics'
import type { MythicPointsApi } from '../components/useMythicPoints'
import { GiveItemDialog } from '../components/GiveItemDialog'
import { useGifts } from '../components/useGifts'
import { useRoster } from '../useRoster'
import { charSlug } from '../charId'
import { useHpTracker } from '../components/useHpTracker'
import { fetchItemTraits, isConsumable, type ItemTraits } from '../../../services/itemTraits'
import { rollFormulaDetailed, rollMemorial } from '../../initiative-tracker/dice'
import { PotionOverlay, type DrinkEvent } from '../components/PotionOverlay'
import { pop, useArmed } from '../../../motion/motion'
import { actionsKeyFor } from '../charId'
import { castTimeOf } from '../spellCast'
import { useActions } from '../components/useActions'
import { payTime } from '../components/useSpellCast'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
    mods: ConditionModifiers
    mythicPoints: MythicPointsApi
}

/** O aviso do último uso, com o que é preciso para desfazê-lo. */
interface UseNotice {
    text: string
    name: string
    /** A quantidade da ficha: a chave do contador de uso. */
    qty: number
    /** PV que a cura de fato devolveu — o Desfazer tira exatamente isso. */
    healed: number
    /** Ações gerais que o uso gastou — o Desfazer devolve. */
    actionsSpent: number
}

/** O aviso da última passagem, com o que é preciso para desfazê-la. */
interface GiveNotice {
    text: string
    to: string
    name: string
    n: number
}

const InventorySectionView = ({ build, onSelect, mods, mythicPoints }: Props) => {
    // As linhas já levam o que foi passado entre os personagens (`gifts.ts`).
    const gifts = useGifts(build)
    const rows = gifts.rows
    const roster = useRoster()
    const me = charSlug(build)
    const [giving, setGiving] = useState<{ name: string; max: number; sheetQty: number } | null>(null)
    const [giveNotice, setGiveNotice] = useState<GiveNotice | null>(null)
    const money = build.money || { cp: 0, sp: 0, gp: 0, pp: 0 }
    const hasMoney = money.pp + money.gp + money.sp + money.cp > 0
    const hasEquipment = rows.length > 0
    const hasRelics = relicsOf(build).length > 0

    const consumables = useConsumables(consumedKeyFor(build))
    // Usar/beber custa a ação que a AON diz (poção, elixir e veneno: 1 ação de Interagir).
    const actions = useActions(actionsKeyFor(build), mods)
    // Cura de poção vai no PV do próprio personagem (quem bebe). É a mesma fatia
    // da Visão Geral, e o `maxHp` sai do mesmo helper para o teto não divergir.
    const hp = useHpTracker(hpKeyFor(build), characterMaxHp(build, mods.hpMaxDelta), legacyCharKey(build))

    const [traits, setTraits] = useState<Record<string, ItemTraits | null>>({})
    const [notice, setNotice] = useState<UseNotice | null>(null)
    // A poção sendo bebida na tela. O aviso com "Desfazer" só aparece quando a
    // animação fecha — os dois juntos disputariam o olho de quem bebeu.
    const [drink, setDrink] = useState<{ event: DrinkEvent; notice: UseNotice } | null>(null)
    const drinkRef = useRef(drink)
    drinkRef.current = drink
    const closeDrink = useCallback(() => {
        if (drinkRef.current) setNotice(drinkRef.current.notice)
        setDrink(null)
    }, [])
    // Abrir a aba não é "usar um item": o estouro do contador só depois de montado.
    const armed = useArmed()

    const equipmentNames = useMemo(
        () => rows.filter((r) => r.equipment).map((r) => r.name).join('|'),
        [rows],
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
        consumables.consume(row.name, row.sheetQty, row.qty - row.sheetQty)
        const time = castTimeOf(traits[row.name]?.actions)
        const spentText: string[] = []
        const warnings: string[] = []
        payTime(actions, time, undefined, spentText, warnings)
        // Sem custo conhecido (item sem `actions`) não chuta: o aviso do `payTime` diz para gastar à mão.
        const costNote = [
            spentText.length ? `gastou ${spentText.join(' e ')}` : null,
            warnings.length ? `atenção: ${warnings.join('; ')}` : null,
        ].filter(Boolean).join(' · ')
        const actionsSpent = time.kind === 'actions' ? time.n : 0
        const formula = traits[row.name]?.healing
        const roll = formula ? rollFormulaDetailed(formula) : null
        if (!formula || !roll) {
            setNotice({ text: `${row.name} usado${costNote ? ` · ${costNote}` : ''}.`, name: row.name, qty: row.sheetQty, healed: 0, actionsSpent })
            return
        }
        const before = hp.current
        const healed = hp.applyHealing(roll.total)
        const capped = healed < roll.total ? ' (PV cheio)' : ''
        setNotice(null)
        setDrink({
            event: { name: row.name, formula, roll, before, after: before + healed, max: characterMaxHp(build, mods.hpMaxDelta) },
            notice: {
                text: `${row.name}: ${formula} → ${rollMemorial(roll)} · +${healed} PV${capped}${costNote ? ` · ${costNote}` : ''}`,
                name: row.name,
                qty: row.sheetQty,
                healed,
                actionsSpent,
            },
        })
    }

    // Desfaz só o que o uso fez: devolve o item e tira a cura que entrou, sobre
    // o PV de AGORA — se alguém mexeu no PV nesse meio-tempo, isso fica.
    const undo = (n: UseNotice) => {
        consumables.restore(n.name, n.qty)
        if (n.actionsSpent > 0) actions.setUsed(Math.max(0, actions.stored.used - n.actionsSpent))
        if (n.healed > 0) hp.restoreHp({ current: Math.max(0, hp.current - n.healed), temp: hp.temp })
    }

    if (!hasMoney && !hasEquipment && !hasRelics) {
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
                                const remaining = consumable ? consumables.remaining(row.name, row.sheetQty, row.qty - row.sheetQty) : row.qty
                                const spent = consumable && remaining === 0
                                const healing = consumable && !!info?.healing
                                // O Pathbuilder exporta poção e veneno como "Invested",
                                // igual a um anel. Num consumível confirmado pelo AON, o
                                // chip só confundiria.
                                const tags = consumable && info ? row.tags.filter((t) => t !== 'Invested') : row.tags
                                const open = () => onSelect({ type: 'item', name: row.name })
                                // Ativações do item: cura com dado (Healer's Touch) ou só a ação e o uso do dia (Arachnid Harness).
                                const heal = row.equipment ? itemHeal(row.name) : null
                                const activation = !heal && !consumable ? itemActivityOf(row.name) : null

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
                                                    // A `key` pelo restante refaz o estouro a cada uso.
                                                    <Chip
                                                        key={remaining}
                                                        label={`x${remaining} de ${row.qty}`}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ animation: armed ? `${pop} 320ms ease-out` : 'none', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}
                                                    />
                                                ) : row.qty > 1 ? (
                                                    <Chip label={`x${row.qty}`} size="small" variant="outlined" />
                                                ) : null}
                                                {tags.map((t) => (
                                                    <Chip key={t} label={t} size="small" />
                                                ))}
                                                <ChevronIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                            </Stack>
                                        </Box>
                                        {(heal || activation) && (
                                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flex: '0 0 auto', mr: 2 }}>
                                                {heal && <HealActivityButton build={build} mods={mods} activity={heal} />}
                                                {activation && (
                                                    <ActivityBody build={build} mods={mods} mythicPoints={mythicPoints} name={row.name} info={activation} />
                                                )}
                                            </Stack>
                                        )}
                                        {consumable && (
                                            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flex: '0 0 auto', mr: 2 }}>
                                                {/* Devolve 1 ao inventário — para a poção bebida sem querer, fora
                                                    da janela do "Desfazer". Só até a quantidade da ficha: acima
                                                    disso o item nunca existiu. Não mexe no PV. */}
                                                {remaining < row.qty && (
                                                    <Tooltip title="Devolver 1 ao inventário">
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Devolver 1 ${row.name}`}
                                                            onClick={() => consumables.restore(row.name, row.sheetQty)}
                                                            sx={{
                                                                border: '1px solid',
                                                                borderColor: 'divider',
                                                                '@media (pointer: coarse)': { width: 40, height: 40 },
                                                            }}
                                                        >
                                                            <AddIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {/* Passar a um colega: o item sai daqui e entra no inventário dele. */}
                                                {!spent && (
                                                    <Tooltip title="Passar a um colega">
                                                        <IconButton
                                                            size="small"
                                                            aria-label={`Passar ${row.name}`}
                                                            onClick={() => setGiving({ name: row.name, max: remaining, sheetQty: row.sheetQty })}
                                                            sx={{
                                                                border: '1px solid',
                                                                borderColor: 'divider',
                                                                '@media (pointer: coarse)': { width: 40, height: 40 },
                                                            }}
                                                        >
                                                            <SendIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {!spent && (
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        startIcon={healing ? <DrinkIcon /> : <UseIcon />}
                                                        aria-label={`${healing ? 'Beber' : 'Usar'} ${row.name}`}
                                                        onClick={() => use(row)}
                                                        sx={healing ? {
                                                            fontWeight: 700,
                                                            backgroundColor: HP_COLOR,
                                                            color: 'common.white',
                                                            '&:hover': { backgroundColor: HP_COLOR, filter: 'brightness(0.88)' },
                                                        } : { fontWeight: 700 }}
                                                    >
                                                        {healing ? 'Beber' : 'Usar'}
                                                    </Button>
                                                )}
                                            </Stack>
                                        )}
                                    </Box>
                                )
                            })}
                        </Stack>
                    </CardContent>
                </Card>
            )}

            <GiveItemDialog
                item={giving}
                roster={roster.filter((r) => r.slug !== me)}
                holders={giving ? gifts.holders(giving.name) : []}
                onClose={() => setGiving(null)}
                onConfirm={(target, n) => {
                    if (!giving) return
                    const ok = gifts.give(target.slug, giving.name, n)
                    setGiving(null)
                    setGiveNotice(ok
                        ? { text: `${n}× ${giving.name} passou para ${target.label}.`, to: target.slug, name: giving.name, n }
                        : { text: 'Não deu para registrar: muitos itens passados a esse colega.', to: '', name: '', n: 0 })
                }}
            />
            <Snackbar
                open={!!giveNotice}
                autoHideDuration={10000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setGiveNotice(null) }}
                message={giveNotice?.text}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                action={giveNotice && giveNotice.n > 0 ? (
                    <Button
                        size="small"
                        sx={{ color: gold.bright }}
                        onClick={() => { gifts.give(giveNotice.to, giveNotice.name, -giveNotice.n); setGiveNotice(null) }}
                    >
                        Desfazer
                    </Button>
                ) : undefined}
            />
            <PotionOverlay drink={drink?.event ?? null} onClose={closeDrink} />

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
            {/* A relíquia (se tiver) fica fora do retorno antecipado do inventário vazio. */}
            <RelicsCard build={build} mods={mods} mythicPoints={mythicPoints} onSelect={onSelect} />
            {/* Criaturas que entram no combate junto com o personagem (Animated Armor…). */}
            <CompanionsCard build={build} />
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

export const InventorySection = memo(InventorySectionView)
