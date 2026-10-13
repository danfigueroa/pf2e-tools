import { useState } from 'react'
import { Box, Button, LinearProgress, Popover, TextField, Typography, useTheme } from '@mui/material'
import { hpBarColor } from '../../character-viewer/components/useHpTracker'
import { ink } from '../../../theme'
import type { TokenDescriptor } from '../../../services/maps'
import { damageHp, healHp, type TokenHp } from '../hp'

interface Props {
    anchor: HTMLElement | null
    token: TokenDescriptor | null
    hp: TokenHp | null
    /** Pode ver número e mexer no PV (personagem sempre; monstro só no Modo GM). */
    canEdit: boolean
    onClose: () => void
    onApply: (next: TokenHp) => void
}

/**
 * Para o jogador, o monstro mostra uma palavra no lugar do número — dá para
 * saber que o golpe pegou sem entregar a ficha do GM.
 */
function woundLabel(hp: TokenHp): string {
    if (hp.current <= 0) return 'Caído'
    const ratio = hp.current / hp.max
    if (ratio >= 1) return 'Ileso'
    if (ratio > 0.5) return 'Ferido'
    if (ratio > 0.25) return 'Muito ferido'
    return 'À beira da morte'
}

export const TokenPopover = ({ anchor, token, hp, canEdit, onClose, onApply }: Props) => {
    const theme = useTheme()
    const [value, setValue] = useState('')
    const amount = Math.max(0, Math.floor(Number(value) || 0))

    const apply = (kind: 'damage' | 'heal') => {
        if (!hp || amount <= 0) return
        onApply(kind === 'damage' ? damageHp(hp, amount) : healHp(hp, amount))
        setValue('')
    }

    return (
        <Popover
            open={!!anchor && !!token}
            anchorEl={anchor}
            onClose={() => { setValue(''); onClose() }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            slotProps={{ paper: { sx: { p: 2, width: 260, maxWidth: 'calc(100vw - 32px)' } } }}
        >
            {token && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    <Typography variant="h6" component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {token.name}
                    </Typography>

                    {hp && (
                        <Box>
                            <LinearProgress
                                variant="determinate"
                                value={hp.max > 0 ? Math.min(100, (hp.current / hp.max) * 100) : 0}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    '& .MuiLinearProgress-bar': { backgroundColor: hpBarColor(hp.current, hp.max, theme.palette) },
                                }}
                            />
                            <Typography variant="body2" sx={{ mt: 0.5, color: ink.secondary }}>
                                {canEdit
                                    ? `PV ${hp.current}/${hp.max}${hp.temp > 0 ? ` · +${hp.temp} temporários` : ''}`
                                    : woundLabel(hp)}
                            </Typography>
                        </Box>
                    )}

                    {hp && canEdit && (
                        <>
                            <TextField
                                size="small"
                                type="number"
                                label="Quantidade"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') apply('damage') }}
                                slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
                                autoFocus
                            />
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={() => apply('damage')}
                                    aria-label={`Dano em ${token.name}`}
                                >
                                    Dano
                                </Button>
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={() => apply('heal')}
                                    aria-label={`Cura em ${token.name}`}
                                >
                                    Cura
                                </Button>
                            </Box>
                        </>
                    )}

                    {hp && !canEdit && (
                        <Typography variant="caption" sx={{ color: ink.secondary }}>
                            O PV do monstro só aparece no Modo GM.
                        </Typography>
                    )}
                </Box>
            )}
        </Popover>
    )
}
