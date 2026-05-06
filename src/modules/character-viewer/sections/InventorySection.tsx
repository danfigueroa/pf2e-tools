import { Box, Card, CardContent, Typography, Stack, Chip } from '@mui/material'
import { ChevronRight as ChevronIcon } from '@mui/icons-material'
import type { BuildInfo } from '../../character-sheet/types'
import type { DescriptionRequest } from '../components/DescriptionDrawer'

interface Props {
    build: BuildInfo
    onSelect: (req: DescriptionRequest) => void
}

export const InventorySection = ({ build, onSelect }: Props) => {
    const equipment = build.equipment || []
    const money = build.money || { cp: 0, sp: 0, gp: 0, pp: 0 }
    const hasMoney = money.pp + money.gp + money.sp + money.cp > 0
    const hasEquipment = equipment.length > 0

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
                            <Coin label="pp" value={money.pp} accent="#bcd2f5" />
                            <Coin label="po" value={money.gp} accent="#f5c542" />
                            <Coin label="pp" value={money.sp} accent="#cfd1d4" />
                            <Coin label="pc" value={money.cp} accent="#b9794a" />
                        </Stack>
                    </CardContent>
                </Card>
            )}

            {hasEquipment && (
                <Card>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                                Equipamento
                            </Typography>
                        </Box>
                        <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                            {equipment.map(([name, qty, status], idx) => (
                                <Box
                                    key={`${name}-${idx}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onSelect({ type: 'item', name })}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect({ type: 'item', name }) }}
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
                                    <Typography sx={{ fontWeight: 500 }}>{name}</Typography>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        {qty > 1 && <Chip label={`x${qty}`} size="small" variant="outlined" />}
                                        {status && <Chip label={status} size="small" />}
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
