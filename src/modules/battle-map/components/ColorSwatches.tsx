import { Box, ButtonBase, Tooltip } from '@mui/material'
import { DRAW_COLORS, gold, mapChrome } from '../../../theme'

interface Props {
    value: string
    onChange: (hex: string) => void
}

/** As cores de efeito (`DRAW_COLORS`), usadas pelo Desenhar e pela Área. */
export const ColorSwatches = ({ value, onChange }: Props) => (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {DRAW_COLORS.map((c) => {
            const selected = value === c.hex
            return (
                <Tooltip key={c.id} title={c.label}>
                    <ButtonBase
                        aria-label={`Cor ${c.label}`}
                        aria-pressed={selected}
                        onClick={() => onChange(c.hex)}
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: c.hex,
                            border: `3px solid ${selected ? gold.bright : mapChrome.track}`,
                            boxShadow: selected ? `0 0 0 2px ${mapChrome.outline}` : 'none',
                        }}
                    />
                </Tooltip>
            )
        })}
    </Box>
)
