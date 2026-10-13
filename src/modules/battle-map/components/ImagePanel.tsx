import { useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, TextField, Typography } from '@mui/material'
import { Image as ImageIcon } from '@mui/icons-material'
import { MAP_MAX_SIDE, deleteImage, imageErrorText, isLocalImage, shrinkImage, uploadImage } from '../../../services/images'
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
            const shrunk = await shrinkImage(file, MAP_MAX_SIDE)
            const url = await uploadImage(shrunk.blob, 'maps', meta.name)
            const old = meta.image?.url
            const w = Math.max(1, Math.round(shrunk.sourceWidth / ASSUMED_PX_PER_SQUARE))
            onChange({
                ...meta,
                image: { url, w: shrunk.width, h: shrunk.height },
                imageRect: { x: 0, y: 0, w, h: w * (shrunk.height / shrunk.width) },
            })
            if (old) void deleteImage(old)
        } catch (e) {
            setError(imageErrorText(e))
        } finally {
            setBusy(false)
            if (input.current) input.current.value = ''
        }
    }

    /**
     * Escala pelo número de quadrados: o GM conta os quadrados desenhados na
     * imagem (ou decide quantos quer) e digita a largura OU a altura — a outra
     * segue a proporção da imagem.
     */
    const setSide = (side: 'w' | 'h', raw: string) => {
        const n = Number(raw.replace(',', '.'))
        if (!rect || !Number.isFinite(n) || n < 1) return
        const ratio = rect.h / rect.w
        const w = side === 'w' ? n : n / ratio
        onChange({ ...meta, imageRect: { ...rect, w, h: w * ratio } })
    }

    const sideField = (side: 'w' | 'h', label: string) => rect && (
        <TextField
            key={`${side}-${rect[side].toFixed(2)}`}
            size="small"
            label={label}
            defaultValue={Number(rect[side].toFixed(1))}
            onBlur={(e) => setSide(side, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSide(side, (e.target as HTMLInputElement).value) }}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        />
    )

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
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    {sideField('w', 'Largura')}
                    {sideField('h', 'Altura')}
                </Box>
            )}

            <Typography variant="caption" sx={{ color: ink.secondary }}>
                Largura e altura em quadrados (cada um = 5 ft). Digite quantos quadrados o mapa
                tem, ou puxe uma das alças
                douradas. Arraste a imagem para alinhar as linhas dela com o grid.
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
