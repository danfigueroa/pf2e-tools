import { useState } from 'react'
import {
    Box,
    Button,
    ButtonBase,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Paper,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import {
    Gesture as FreeIcon,
    Timeline as LineIcon,
    BackspaceOutlined as EraseIcon,
} from '@mui/icons-material'
import { DRAW_WIDTHS, type DrawMode, type DrawStyle } from '../drawing'
import { gold, ink } from '../../../theme'
import { ColorSwatches } from './ColorSwatches'

interface Props {
    style: DrawStyle
    onChange: (style: DrawStyle) => void
    /** Só no Modo GM: limpar todos os desenhos do mapa. */
    onClearAll?: () => void
    count: number
}

const WIDTH_LABELS = ['Fina', 'Média', 'Grossa']

/** Ferramenta Desenhar: modo, cor do efeito e espessura. */
export const DrawPanel = ({ style, onChange, onClearAll, count }: Props) => {
    const [confirm, setConfirm] = useState(false)
    const erasing = style.mode === 'erase'

    return (
        <Paper
            elevation={6}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                p: 1.5,
                width: 280,
                maxWidth: 'calc(100% - 88px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                zIndex: 3,
            }}
        >
            <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={style.mode}
                onChange={(_, mode: DrawMode | null) => { if (mode) onChange({ ...style, mode }) }}
            >
                <ToggleButton value="free" aria-label="Desenho livre"><FreeIcon fontSize="small" sx={{ mr: 0.5 }} />Livre</ToggleButton>
                <ToggleButton value="line" aria-label="Linha reta"><LineIcon fontSize="small" sx={{ mr: 0.5 }} />Linha</ToggleButton>
                <ToggleButton value="erase" aria-label="Apagar um desenho"><EraseIcon fontSize="small" sx={{ mr: 0.5 }} />Apagar</ToggleButton>
            </ToggleButtonGroup>

            {erasing ? (
                <Typography variant="body2" sx={{ color: ink.secondary }}>
                    Toque no <strong>×</strong> vermelho (ou no próprio traço) para apagar só aquele
                    desenho. Os outros ficam como estão.
                </Typography>
            ) : (
                <>
                    <ColorSwatches value={style.color} onChange={(color) => onChange({ ...style, color })} />
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
                        {DRAW_WIDTHS.map((w, i) => {
                            const selected = style.width === w
                            return (
                                <ButtonBase
                                    key={w}
                                    aria-label={`Espessura ${WIDTH_LABELS[i]}`}
                                    aria-pressed={selected}
                                    onClick={() => onChange({ ...style, width: w })}
                                    sx={{
                                        height: 36,
                                        borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: selected ? gold.deep : 'divider',
                                        backgroundColor: selected ? `${gold.bright}33` : 'transparent',
                                        display: 'grid',
                                        placeItems: 'center',
                                    }}
                                >
                                    <Box
                                        component="span"
                                        sx={{ display: 'block', width: 48, height: 2 + i * 5, borderRadius: 4, backgroundColor: style.color }}
                                    />
                                </ButtonBase>
                            )
                        })}
                    </Box>
                    <Typography variant="caption" sx={{ color: ink.secondary }}>
                        {style.mode === 'line'
                            ? 'As pontas encaixam no grid e o comprimento aparece enquanto você arrasta.'
                            : 'Arraste para desenhar. O botão do meio do mouse move o mapa.'}
                    </Typography>
                </>
            )}

            {onClearAll && count > 0 && (
                <Button size="small" color="error" onClick={() => setConfirm(true)}>
                    Limpar desenhos e áreas ({count})
                </Button>
            )}

            <Dialog open={confirm} onClose={() => setConfirm(false)}>
                <DialogTitle sx={{ fontWeight: 700 }}>Limpar os desenhos?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Os {count} desenhos deste mapa somem para a mesa inteira.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirm(false)}>Cancelar</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => { onClearAll?.(); setConfirm(false) }}
                    >
                        Limpar
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    )
}
