import {
    Box,
    Button,
    Chip,
    Divider,
    Stack,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import {
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    PlayArrow as StartIcon,
    Refresh as RefreshIcon,
    Sort as SortIcon,
    Stop as StopIcon,
} from '@mui/icons-material'
import { gold, green, parchment } from '../../../theme'
import type { Combatant } from '../types'

interface Props {
    round: number
    active: Combatant | null
    next: Combatant | null
    canStart: boolean
    onStart: () => void
    onNext: () => void
    onPrev: () => void
    onSort: () => void
    onRefresh: () => void
    onEnd: () => void
}

/** Moldura verde com filete dourado, como os cabeçalhos de seção do projeto. */
export const EncounterToolbar = ({
    round, active, next, canStart, onStart, onNext, onPrev, onSort, onRefresh, onEnd,
}: Props) => {
    const theme = useTheme()
    const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
    const started = round > 0 && !!active

    return (
        <Box
            sx={{
                backgroundColor: green.main,
                color: parchment.page,
                borderBottom: `2px solid ${gold.main}`,
                borderRadius: 1,
                px: { xs: 1.5, sm: 2 },
                py: { xs: 1.25, sm: 1.5 },
                mb: 2,
            }}
        >
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 1.25, sm: 2 }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
            >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {started ? (
                        <>
                            <Typography variant="overline" sx={{ color: gold.bright, lineHeight: 1.2 }}>
                                Rodada {round}
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                                {active.name}
                            </Typography>
                            {next && (
                                <Typography variant="caption" sx={{ color: parchment.page + 'B3' }} noWrap>
                                    Depois: {next.name}
                                </Typography>
                            )}
                        </>
                    ) : (
                        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            Combate não iniciado
                        </Typography>
                    )}
                </Box>

                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {started ? (
                        <>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={onPrev}
                                startIcon={<PrevIcon />}
                                sx={chromeButton}
                            >
                                {isPhone ? '' : 'Anterior'}
                            </Button>
                            <Button
                                variant="contained"
                                onClick={onNext}
                                endIcon={<NextIcon />}
                                sx={{
                                    flex: { xs: 1, sm: 'none' },
                                    backgroundColor: gold.bright,
                                    color: green.deepest,
                                    fontWeight: 700,
                                    '&:hover': { backgroundColor: gold.main },
                                }}
                            >
                                Próximo turno
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="contained"
                            onClick={onStart}
                            disabled={!canStart}
                            startIcon={<StartIcon />}
                            sx={{
                                flex: { xs: 1, sm: 'none' },
                                backgroundColor: gold.bright,
                                color: green.deepest,
                                fontWeight: 700,
                                '&:hover': { backgroundColor: gold.main },
                            }}
                        >
                            Iniciar combate
                        </Button>
                    )}
                </Stack>

                <Divider
                    orientation={isPhone ? 'horizontal' : 'vertical'}
                    flexItem
                    sx={{ borderColor: parchment.page + '33' }}
                />

                <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-start' }}>
                    <Tooltip title="Reordenar por iniciativa">
                        <Button size="small" onClick={onSort} startIcon={<SortIcon />} sx={chromeButton}>
                            Reordenar
                        </Button>
                    </Tooltip>
                    <Tooltip title="Puxar PV e condições da mesa">
                        <Button size="small" onClick={onRefresh} startIcon={<RefreshIcon />} sx={chromeButton}>
                            Atualizar
                        </Button>
                    </Tooltip>
                    <Tooltip title="Encerrar e limpar o encontro">
                        <Button size="small" onClick={onEnd} startIcon={<StopIcon />} sx={chromeButton}>
                            Encerrar
                        </Button>
                    </Tooltip>
                </Stack>
            </Stack>

            {started && active.delayed && (
                <Chip size="small" label="Adiado" sx={{ mt: 1, backgroundColor: gold.main + '55' }} />
            )}
        </Box>
    )
}

const chromeButton = {
    color: parchment.page,
    borderColor: parchment.page + '55',
    '&:hover': { borderColor: gold.bright, backgroundColor: parchment.page + '11' },
}
