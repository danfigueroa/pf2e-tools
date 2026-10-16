import { useState } from 'react'
import { Box, Button, IconButton, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Add as PlusIcon, Casino as DiceIcon, Remove as MinusIcon } from '@mui/icons-material'
import { DRAW_COLORS, ink } from '../../../theme'
import {
    DICE,
    MAX_BONUS,
    MAX_DICE,
    clampBonus,
    clampCount,
    formulaText,
    rollDice,
    type DieFaces,
    type SharedRoll,
} from '../dice'
import { ColorSwatches } from './ColorSwatches'

const KEY = 'pf2e:map:dice'

interface Prefs { faces: DieFaces; count: number; bonus: number; color: string; name: string }

function loadPrefs(): Prefs {
    const fallback: Prefs = { faces: 20, count: 1, bonus: 0, color: DRAW_COLORS[0].hex, name: '' }
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Prefs> | null
        if (!raw) return fallback
        return {
            faces: DICE.find((d) => d === raw.faces) ?? fallback.faces,
            count: clampCount(Number(raw.count)),
            bonus: clampBonus(Number(raw.bonus)),
            color: DRAW_COLORS.find((c) => c.hex === raw.color)?.hex ?? fallback.color,
            name: typeof raw.name === 'string' ? raw.name.slice(0, 24) : '',
        }
    } catch {
        return fallback
    }
}

interface Props {
    onRoll: (roll: SharedRoll) => void
}

/** Número inteiro com − / +, e rascunho só confirmado no blur/Enter (digitar "1" a caminho de "10"). */
const Stepper = ({ label, value, min, max, onChange }: {
    label: string
    value: number
    min: number
    max: number
    onChange: (n: number) => void
}) => {
    const [draft, setDraft] = useState<string | null>(null)
    const commit = () => {
        if (draft !== null) {
            const n = Number(draft)
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))))
        }
        setDraft(null)
    }
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
                <MinusIcon fontSize="small" />
            </IconButton>
            <TextField
                size="small"
                label={label}
                value={draft ?? String(value)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); commit() } }}
                slotProps={{ htmlInput: { inputMode: 'numeric', style: { textAlign: 'center' } } }}
                sx={{ width: 84 }}
            />
            <IconButton size="small" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
                <PlusIcon fontSize="small" />
            </IconButton>
        </Box>
    )
}

/**
 * Rolador de dados. Não é uma ferramenta do mapa — abre por um botão da barra
 * e não troca a ferramenta ativa, para poder rolar com a régua na mão.
 * O que se rola vai para a mesa inteira (`roll:<id>`, como o ping).
 */
export const DicePanel = ({ onRoll }: Props) => {
    const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
    const patch = (p: Partial<Prefs>) => {
        const next = { ...prefs, ...p }
        setPrefs(next)
        try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* só nesta aba */ }
    }
    const roll = () => onRoll(rollDice(prefs.count, prefs.faces, prefs.bonus, prefs.name.trim() || 'Jogador', prefs.color))

    return (
        <Paper
            elevation={6}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            sx={{
                position: 'absolute',
                right: 76,
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
                value={prefs.faces}
                onChange={(_, v: DieFaces | null) => { if (v) patch({ faces: v }) }}
            >
                {DICE.map((d) => (
                    <ToggleButton key={d} value={d} aria-label={`d${d}`} sx={{ px: 0.25, fontWeight: 700 }}>
                        d{d}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Stepper label="Dados" value={prefs.count} min={1} max={MAX_DICE} onChange={(count) => patch({ count })} />
                <Stepper label="Bônus" value={prefs.bonus} min={-MAX_BONUS} max={MAX_BONUS} onChange={(bonus) => patch({ bonus })} />
            </Box>

            <Box>
                <Typography variant="caption" sx={{ color: ink.secondary }}>Cor dos dados</Typography>
                <ColorSwatches value={prefs.color} onChange={(color) => patch({ color })} />
            </Box>

            <TextField
                size="small"
                label="Seu nome (aparece para a mesa)"
                value={prefs.name}
                onChange={(e) => patch({ name: e.target.value.slice(0, 24) })}
                onKeyDown={(e) => { if (e.key === 'Enter') roll() }}
            />

            <Button variant="contained" startIcon={<DiceIcon />} onClick={roll} sx={{ fontWeight: 700 }}>
                Rolar {formulaText(prefs.count, prefs.faces, prefs.bonus)}
            </Button>
        </Paper>
    )
}
