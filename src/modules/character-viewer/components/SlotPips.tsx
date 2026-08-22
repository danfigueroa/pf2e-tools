import { Box, ButtonBase, Stack, Tooltip } from '@mui/material'

interface Props {
    /** Quantidade de slots do grupo. */
    total: number
    /** Quantos já foram gastos (sempre os primeiros da esquerda). */
    used: number
    /** Cor do slot disponível — tradição do conjurador ou acento de foco. */
    color: string
    /** Recebe o novo total de gastos ao clicar num pip. */
    onChange: (next: number) => void
    /** Prefixo do aria-label, ex.: "slot de nível 3". */
    label: string
    size?: number
}

/**
 * Fileira de slots clicáveis. Clicar num disponível gasta até ele; clicar num
 * gasto recupera a partir dele — é assim que se devolve um slot específico.
 */
export const SlotPips = ({ total, used, color, onChange, label, size = 14 }: Props) => {
    if (total <= 0) return null

    return (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {Array.from({ length: total }, (_, i) => {
                const spent = i < used
                return (
                    <Tooltip key={i} title={spent ? 'Recuperar' : 'Gastar'} enterDelay={400}>
                        <ButtonBase
                            aria-label={`${label} ${i + 1}: ${spent ? 'gasto' : 'disponível'}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange(spent ? i : i + 1)
                            }}
                            sx={{
                                width: size,
                                height: size,
                                borderRadius: '50%',
                                border: '1px solid',
                                borderColor: spent ? 'divider' : color,
                                backgroundColor: spent ? 'action.hover' : color,
                                transition: 'background-color 120ms, border-color 120ms',
                                '&:hover': { transform: 'scale(1.15)' },
                                '&:focus-visible': { outline: '2px solid', outlineColor: color, outlineOffset: 2 },
                            }}
                        />
                    </Tooltip>
                )
            })}
        </Stack>
    )
}

/** Rótulo "2/5" para cabeçalhos; conta disponíveis, não gastos. */
export const SlotCount = ({ total, used }: { total: number; used: number }) => (
    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {Math.max(0, total - used)}/{total}
    </Box>
)
