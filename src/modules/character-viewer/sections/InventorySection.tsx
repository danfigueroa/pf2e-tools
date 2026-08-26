import { Box, Card, CardContent, Typography, Stack, Chip } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import { COIN_COLORS } from '../../../theme/palette'
import type { BuildInfo } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
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
    }))
    const armor = (build.armor ?? []).map((a) => ({
        label: a.display || a.name,
        name: a.name,
        qty: a.qty,
        tags: a.worn ? ['Armadura', 'Vestida'] : ['Armadura'],
    }))
    const equipment = (build.equipment ?? []).map(([name, qty, status]) => ({
        label: name,
        name,
        qty,
        tags: status ? [status] : [],
    }))
    return [...weapons, ...armor, ...equipment]
}

export const InventorySection = ({ build, onSelect }: Props) => {
    const rows = inventoryRows(build)
    const money = build.money || { cp: 0, sp: 0, gp: 0, pp: 0 }
    const hasMoney = money.pp + money.gp + money.sp + money.cp > 0
    const hasEquipment = rows.length > 0

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
                            {rows.map((row, idx) => (
                                <Box
                                    key={`${row.name}-${idx}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onSelect({ type: 'item', name: row.name })}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect({ type: 'item', name: row.name }) }}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        px: 2, py: 1.25,
                                        cursor: 'pointer',
                                        transition: 'background-color 0.15s',
                                        '&:hover': { backgroundColor: 'action.hover' },
                                        '&:focus-visible': { backgroundColor: 'action.focus', outline: 'none' },
                                    }}
                                >
                                    <Typography sx={{ fontWeight: 500, minWidth: 0, pr: 1 }}>{row.label}</Typography>
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                                        {row.qty > 1 && <Chip label={`x${row.qty}`} size="small" variant="outlined" />}
                                        {row.tags.map((t) => (
                                            <Chip key={t} label={t} size="small" />
                                        ))}
                                        <ChevronIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                    </Stack>
                                </Box>
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            )}
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
