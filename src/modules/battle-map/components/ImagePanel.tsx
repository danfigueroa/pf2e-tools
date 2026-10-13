import { useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material'
import { Image as ImageIcon } from '@mui/icons-material'
import { MAP_MAX_SIDE, deleteImage, isLocalImage, shrinkImage, uploadImage } from '../../../services/images'
import { ink } from '../../../theme'
import type { MapMeta } from '../../../services/maps'

interface Props {
    meta: MapMeta
    onChange: (meta: MapMeta) => void
}

/**
 * Pixels por quadrado que o app SUPÕE ao receber uma imagem. É o padrão do
 * Roll20 (70 px), de onde vem boa parte dos mapas; para os outros, o GM ajusta
 * a largura em quadrados aqui ou pela alça.
 */
const ASSUMED_PX_PER_SQUARE = 70

/** Camada do mapa (Modo GM): enviar a imagem e dimensioná-la no grid. */
export const ImagePanel = ({ meta, onChange }: Props) => {
    const input = useRef<HTMLInputElement>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const rect = meta.imageRect

    const upload = async (file: File) => {
        setBusy(true)
        setError(null)
        try {
            const source = await createImageBitmap(file)
            const sourceWidth = source.width
            source.close()
            const shrunk = await shrinkImage(file, MAP_MAX_SIDE)
            const url = await uploadImage(shrunk.blob, 'maps', meta.name)
            const old = meta.image?.url
            const w = Math.max(1, Math.round(sourceWidth / ASSUMED_PX_PER_SQUARE))
            onChange({
                ...meta,
                image: { url, w: shrunk.width, h: shrunk.height },
                imageRect: { x: 0, y: 0, w, h: w * (shrunk.height / shrunk.width) },
            })
            if (old) void deleteImage(old)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Não foi possível enviar a imagem')
        } finally {
            setBusy(false)
            if (input.current) input.current.value = ''
        }
    }

    const setWidth = (raw: string) => {
        const w = Number(raw.replace(',', '.'))
        if (!rect || !Number.isFinite(w) || w < 1) return
        onChange({ ...meta, imageRect: { ...rect, w, h: w * (rect.h / rect.w) } })
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
                width: 280,
                maxWidth: 'calc(100% - 88px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                zIndex: 3,
            }}
        >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Imagem do mapa</Typography>
            <input
                ref={input}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f) }}
            />
            <Button
                variant="contained"
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ImageIcon />}
                disabled={busy}
                onClick={() => input.current?.click()}
            >
                {meta.image ? 'Trocar imagem' : 'Enviar imagem'}
            </Button>

            {rect && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                        key={rect.w}
                        size="small"
                        label="Largura (quadrados)"
                        defaultValue={Number(rect.w.toFixed(2))}
                        onBlur={(e) => setWidth(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setWidth((e.target as HTMLInputElement).value) }}
                        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                        sx={{ flex: 1 }}
                    />
                    <Typography variant="caption" sx={{ color: ink.secondary, whiteSpace: 'nowrap' }}>
                        × {rect.h.toFixed(1)}
                    </Typography>
                </Box>
            )}

            <Typography variant="caption" sx={{ color: ink.secondary }}>
                Arraste a imagem para alinhar com o grid e a alça dourada para redimensionar
                (cada quadrado = 5 ft). Imagem de {ASSUMED_PX_PER_SQUARE} px por quadrado já entra no tamanho certo.
            </Typography>

            {isLocalImage(meta.image?.url) && (
                <Alert severity="warning" sx={{ py: 0 }}>
                    Imagem só neste aparelho: o servidor não tem armazenamento de imagens.
                </Alert>
            )}
            {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
        </Paper>
    )
}
