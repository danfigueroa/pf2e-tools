import { useState } from 'react'
import { Box, Button, Dialog, IconButton, Typography } from '@mui/material'
import { Campaign as ShareIcon, Close as CloseIcon } from '@mui/icons-material'
import { displayFont, gold, green, onFrame } from '../theme'
import { tr } from '../i18n'

// A imagem em tela cheia: para ler o retrato, o mapa ou o handout com calma. Tocar na imagem alterna
// entre "caber na tela" e tamanho real (rolável). Com `onShow` (o GM), "Mostrar à mesa" manda a imagem
// e o nome para a tela de todos. A `src` já vem resolvida pelo `useImageUrl`.

interface Props {
    src: string
    title: string
    alt?: string
    onClose: () => void
    onShow?: () => void
}

export function ImageLightbox({ src, title, alt, onClose, onShow }: Props) {
    const [zoom, setZoom] = useState(false)
    return (
        <Dialog
            open
            onClose={onClose}
            fullScreen
            aria-label={title}
            slotProps={{ paper: { sx: { bgcolor: green.main, backgroundImage: 'none' } } }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, flex: 'none' }}>
                <Typography component="h2" sx={{ flex: 1, minWidth: 0, fontFamily: displayFont, fontWeight: 700, fontSize: '1.15rem', color: onFrame.paper, overflowWrap: 'anywhere' }}>
                    {title}</Typography>
                {onShow && (
                    <Button
                        variant="contained"
                        startIcon={<ShareIcon />}
                        onClick={onShow}
                        sx={{ bgcolor: gold.bright, color: green.main, '&:hover': { bgcolor: gold.main } }}
                    >
                        {tr('Mostrar à mesa', 'Show the table')}</Button>
                )}
                <IconButton aria-label={tr('Fechar', 'Close')} onClick={onClose} sx={{ color: onFrame.paper }}><CloseIcon /></IconButton>
            </Box>
            <Box
                onClick={onClose}
                sx={{
                    flex: 1, minHeight: 0, display: 'flex', overflow: 'auto', p: { xs: 1, sm: 2 },
                    alignItems: zoom ? 'flex-start' : 'center', justifyContent: zoom ? 'flex-start' : 'center',
                }}
            >
                <Box
                    component="img"
                    src={src}
                    alt={alt ?? title}
                    onClick={(e) => { e.stopPropagation(); setZoom((z) => !z) }}
                    sx={{
                        display: 'block', m: 'auto', borderRadius: 1, boxShadow: '0 12px 40px rgba(0,0,0,.45)',
                        cursor: zoom ? 'zoom-out' : 'zoom-in',
                        ...(zoom ? { maxWidth: 'none' } : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }),
                    }}
                />
            </Box>
            <Typography variant="caption" sx={{ textAlign: 'center', pb: 1, color: onFrame.paper, opacity: 0.8 }}>
                {zoom ? tr('Toque na imagem para caber na tela', 'Tap the image to fit the screen') : tr('Toque na imagem para ver em tamanho real', 'Tap the image for full size')}
            </Typography>
        </Dialog>
    )
}
