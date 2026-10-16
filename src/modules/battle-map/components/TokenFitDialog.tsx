import { useRef, useState } from 'react'
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Slider,
    Typography,
} from '@mui/material'
import { MAP_BACKDROP, TOKEN_NPC, TOKEN_PC } from '../../../theme'
import { DEFAULT_FIT, MAX_ZOOM, MIN_ZOOM, clampFit, coverSize, fitStyle, type TokenFit } from '../tokenFit'

interface Props {
    name: string
    /** URL já resolvida da imagem (`useImageUrl`). */
    src: string
    initial: TokenFit
    /** Quantos outros tokens do mapa usam a mesma imagem (as "cópias"). */
    copies: number
    pc: boolean
    onSave: (fit: TokenFit, applyToCopies: boolean) => void
    onClose: () => void
}

const SIZE = 280
/** O círculo ocupa 80% do quadro; o resto é a margem onde a imagem esmaecida aparece. */
const CIRCLE = SIZE * 0.8

/**
 * O GM escolhe qual parte da imagem fica no CENTRO do círculo do token e quanto
 * ela é ampliada. Arrastar a imagem move o ponto; o controle de ampliação
 * aproxima. A imagem inteira aparece esmaecida atrás do círculo, para ver o que
 * está sendo deixado de fora.
 *
 * Só ao salvar vai para o mapa: arrastar não pode inundar a mesa de escritas.
 */
export const TokenFitDialog = ({ name, src, initial, copies, pc, onSave, onClose }: Props) => {
    const [fit, setFit] = useState<TokenFit>(initial)
    const [aspect, setAspect] = useState(1)
    const [applyToCopies, setApplyToCopies] = useState(true)
    const drag = useRef<{ x: number; y: number; fit: TokenFit } | null>(null)

    const { w, h } = coverSize(aspect, fit.z)
    const shown = clampFit(fit, aspect)
    const style = fitStyle(fit, aspect)

    const onDown = (e: React.PointerEvent) => {
        drag.current = { x: e.clientX, y: e.clientY, fit: shown }
        e.currentTarget.setPointerCapture(e.pointerId)
    }
    const onMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d) return
        // Arrastar a imagem para a direita traz para o centro um ponto mais à ESQUERDA dela.
        const dx = (e.clientX - d.x) / CIRCLE
        const dy = (e.clientY - d.y) / CIRCLE
        setFit(clampFit({ z: d.fit.z, x: d.fit.x - dx / (w / 100), y: d.fit.y - dy / (h / 100) }, aspect))
    }
    const onUp = () => { drag.current = null }

    const setZoom = (z: number) => setFit(clampFit({ ...shown, z }, aspect))

    const ring = pc ? TOKEN_PC : TOKEN_NPC
    const imgBase = { position: 'absolute' as const, maxWidth: 'none', userSelect: 'none' as const, pointerEvents: 'none' as const }

    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>Enquadrar o token — {name}</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Arraste a imagem para escolher o que fica no centro do círculo.
                </Typography>

                <Box
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    sx={{
                        position: 'relative',
                        width: SIZE,
                        height: SIZE,
                        maxWidth: '100%',
                        mx: 'auto',
                        backgroundColor: MAP_BACKDROP,
                        overflow: 'hidden',
                        borderRadius: 1,
                        cursor: 'grab',
                        touchAction: 'none',
                        '&:active': { cursor: 'grabbing' },
                    }}
                >
                    {/* A caixa do círculo: a imagem esmaecida (inteira) e, por cima, o recorte do token. */}
                    <Box sx={{ position: 'absolute', inset: SIZE * 0.1, pointerEvents: 'none' }}>
                        <img
                            src={src}
                            alt=""
                            draggable={false}
                            onLoad={(e) => {
                                const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget
                                if (nw > 0 && nh > 0) setAspect(nw / nh)
                            }}
                            style={{ ...imgBase, ...style, opacity: 0.35 }}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                boxShadow: `0 0 0 4px ${ring}`,
                            }}
                        >
                            <img src={src} alt="" draggable={false} style={{ ...imgBase, ...style }} />
                        </Box>
                    </Box>
                    {/* Mira no centro. */}
                    <Box sx={{ position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, ml: '-7px', mt: '-7px', pointerEvents: 'none',
                        '&::before, &::after': { content: '""', position: 'absolute', background: '#FFFFFF', boxShadow: '0 0 2px #000' },
                        '&::before': { left: 6, top: 0, width: 2, height: 14 },
                        '&::after': { top: 6, left: 0, height: 2, width: 14 },
                    }} />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    Ampliação · {fit.z.toFixed(2)}×
                </Typography>
                <Slider
                    value={fit.z}
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.05}
                    onChange={(_, v) => setZoom(v as number)}
                    aria-label="Ampliação do token"
                />

                {copies > 0 && (
                    <FormControlLabel
                        control={<Checkbox checked={applyToCopies} onChange={(e) => setApplyToCopies(e.target.checked)} />}
                        label={`Aplicar também às ${copies} cópia${copies === 1 ? '' : 's'} com a mesma imagem`}
                    />
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button color="inherit" onClick={() => setFit(DEFAULT_FIT)}>Centralizar</Button>
                <Box sx={{ flex: 1 }} />
                <Button color="inherit" onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={() => onSave(shown, applyToCopies && copies > 0)}>Salvar</Button>
            </DialogActions>
        </Dialog>
    )
}
