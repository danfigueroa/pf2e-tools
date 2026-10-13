import { useState } from 'react'
import { Box, Chip, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { AREA_FEET, AREA_LABELS, type AreaShape, type AreaStyle } from '../areas'
import { ink } from '../../../theme'
import { ColorSwatches } from './ColorSwatches'

interface Props {
    style: AreaStyle
    onChange: (style: AreaStyle) => void
}

const SHAPES: AreaShape[] = ['burst', 'emanation', 'cone', 'line']

/** Como usar cada forma — o gesto muda de uma para outra. */
const HOW_TO: Record<AreaShape, string> = {
    burst: 'Mova o mouse: a explosão segue o cruzamento do grid mais próximo. Clique para fixar.',
    emanation: 'Passe o mouse sobre uma criatura: a emanação sai do espaço dela. Clique para fixar.',
    cone: 'Pressione no cruzamento de origem e arraste para a direção (reto ou diagonal).',
    line: 'Pressione na origem e arraste para a direção. A linha tem 5 pés de largura.',
}

/**
 * Ferramenta Área: explosão, emanação, cone e linha medidos pela regra do
 * PF2e, com a contagem de criaturas atingidas.
 *
 * É uma CONSULTA, como a régua: a área aparece só para quem está medindo,
 * fica até o próximo clique e nunca é gravada no mapa.
 */
export const AreaPanel = ({ style, onChange }: Props) => {
    // O campo livre só vira tamanho ao confirmar: digitar "3" a caminho de "30"
    // não pode criar uma área de 3 pés no meio do caminho.
    const [draft, setDraft] = useState(String(style.feet))
    const commitFeet = () => {
        const n = Math.round(Number(draft) / 5) * 5
        if (Number.isFinite(n) && n >= 5 && n <= 500) onChange({ ...style, feet: n })
        setDraft(String(Number.isFinite(n) && n >= 5 && n <= 500 ? n : style.feet))
    }

    return (
        <Paper
            elevation={6}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                p: 1.5,
                width: 340,
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
                onChange={(_, mode: AreaShape | null) => { if (mode) onChange({ ...style, mode }) }}
            >
                {SHAPES.map((shape) => (
                    <ToggleButton key={shape} value={shape} aria-label={AREA_LABELS[shape]} sx={{ px: 0.5 }}>
                        {AREA_LABELS[shape]}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                {AREA_FEET.map((feet) => (
                    <Chip
                        key={feet}
                        label={`${feet} ft`}
                        size="small"
                        color={style.feet === feet ? 'primary' : 'default'}
                        variant={style.feet === feet ? 'filled' : 'outlined'}
                        onClick={() => { onChange({ ...style, feet }); setDraft(String(feet)) }}
                    />
                ))}
                <TextField
                    size="small"
                    label="Pés"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitFeet}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitFeet() }}
                    slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': 'Tamanho em pés' } }}
                    sx={{ width: 72 }}
                />
            </Box>
            <ColorSwatches value={style.color} onChange={(color) => onChange({ ...style, color })} />

            <Typography variant="caption" sx={{ color: ink.secondary }}>
                {HOW_TO[style.mode]} Ela some no próximo clique ou ao trocar de ferramenta, e
                só você a vê.
            </Typography>
        </Paper>
    )
}
