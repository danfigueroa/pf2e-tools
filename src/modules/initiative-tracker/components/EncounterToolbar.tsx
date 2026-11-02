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
import { pop, useArmed } from '../../../motion/motion'
import { tr } from '../../../i18n'

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
    // A `key` pela rodada/combatente refaz a entrada a cada troca; ao abrir a
    // página com o encontro em andamento, nada entra animado.
    const armed = useArmed()
    const enter = armed ? { animation: `${pop} 320ms ease-out`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } } : {}

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
                            <Typography
                                key={`r${round}`}
                                variant="overline"
                                sx={{ display: 'block', color: gold.bright, lineHeight: 1.2, transformOrigin: 'left center', ...enter }}
                            >
                                {tr('Rodada ', 'Round ')}{round}
                            </Typography>
                            <Typography
                                key={active.id}
                                variant="h5"
                                sx={{ fontWeight: 700, lineHeight: 1.2, transformOrigin: 'left center', ...enter }}
                                noWrap
                            >
                                {active.name}
                            </Typography>
                            {next && (
                                <Typography variant="caption" sx={{ color: parchment.page + 'B3' }} noWrap>
                                    {tr('Depois: ', 'Next: ')}{next.name}
                                </Typography>
                            )}
                        </>
                    ) : (
                        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            {tr('Combate não iniciado', 'Combat not started')}</Typography>
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
                                {isPhone ? '' : tr('Anterior', 'Previous')}
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
                                {tr('Próximo turno', 'Next turn')}</Button>
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
                            {tr('Iniciar combate', 'Start combat')}</Button>
                    )}
                </Stack>

                <Divider
                    orientation={isPhone ? 'horizontal' : 'vertical'}
                    flexItem
                    sx={{ borderColor: parchment.page + '33' }}
                />

                <Stack direction="row" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-start' }}>
                    <Tooltip title={tr("Reordenar por iniciativa", 'Reorder by initiative')}>
                        <Button size="small" onClick={onSort} startIcon={<SortIcon />} sx={chromeButton}>
                            {tr('Reordenar', 'Reorder')}</Button>
                    </Tooltip>
                    <Tooltip title={tr("Puxar PV e condições da mesa", 'Pull HP and conditions from the table')}>
                        <Button size="small" onClick={onRefresh} startIcon={<RefreshIcon />} sx={chromeButton}>
                            {tr('Atualizar', 'Refresh')}</Button>
                    </Tooltip>
                    <Tooltip title={tr("Encerrar e limpar o encontro", 'End and clear the encounter')}>
                        <Button size="small" onClick={onEnd} startIcon={<StopIcon />} sx={chromeButton}>
                            {tr('Encerrar', 'End')}</Button>
                    </Tooltip>
                </Stack>
            </Stack>

            {started && active.delayed && (
                <Chip size="small" label={tr("Adiado", 'Delayed')} sx={{ mt: 1, backgroundColor: gold.main + '55' }} />
            )}
        </Box>
    )
}

const chromeButton = {
    color: parchment.page,
    borderColor: parchment.page + '55',
    '&:hover': { borderColor: gold.bright, backgroundColor: parchment.page + '11' },
}
