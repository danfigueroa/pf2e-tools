import { useEffect, useState } from 'react'
import { Box, Button, Dialog, IconButton, Skeleton, Stack, Typography } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { Markdown } from './markdown/Markdown'
import { fetchReveal, type Reveal } from '../services/journal'
import { useImageUrl } from '../services/images'
import { displayFont, gold, green, parchment } from '../theme'
import type { TableShare } from '../services/tableShare'

// O que o GM mostrou à mesa pelo Diário de Campanha: um trecho `:::jogadores`
// ou uma imagem (retrato de NPC, local, item). Chega pelo feed como a regra
// compartilhada (`SharedRuleLayer`), mas o share leva só a referência: o texto e
// a imagem vêm de `?reveal=`. Carregado sob demanda, com o Markdown junto.

export default function HandoutCard({ share, onClose }: { share: TableShare; onClose: () => void }) {
    const [reveal, setReveal] = useState<Reveal | null | undefined>(undefined)
    const [zoom, setZoom] = useState(false)
    const image = useImageUrl(reveal?.image)
    const who = share.by || 'O GM'

    useEffect(() => {
        let alive = true
        if (share.ref) void fetchReveal(share.ref).then((r) => { if (alive) setReveal(r) })
        else setReveal(null)
        return () => { alive = false }
    }, [share.ref])

    return (
        <Box
            role="region"
            aria-label={`${who} mostrou à mesa: ${share.name}`}
            sx={{
                position: 'fixed',
                zIndex: 1240,
                left: { xs: 8, md: 'auto' },
                right: { xs: 8, md: 16 },
                bottom: { xs: 'calc(var(--tabbar-h, 0px) + 8px)', md: 'auto' },
                top: { xs: 'auto', md: 16 },
                width: { md: 'min(520px, calc(100vw - 32px))' },
                maxHeight: { xs: '75vh', md: 'calc(100vh - 32px)' },
                display: 'flex',
                flexDirection: 'column',
                bgcolor: parchment.paper,
                border: `1px solid ${gold.main}`,
                borderRadius: 2,
                boxShadow: 8,
                overflow: 'hidden',
            }}
        >
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, pl: 2, pr: 0.5, py: 0.25,
                bgcolor: green.main, borderBottom: `2px solid ${gold.main}`, flexShrink: 0,
            }}>
                <Typography variant="body2" sx={{ color: parchment.paper, minWidth: 0, flex: 1 }}>
                    <Box component="strong" sx={{ color: gold.bright }}>{who}</Box> mostrou à mesa
                </Typography>
                <IconButton aria-label="Fechar" onClick={onClose} sx={{ color: parchment.paper }}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ overflowY: 'auto', p: { xs: 2, md: 2.5 } }}>
                <Typography component="h2" sx={{ fontFamily: displayFont, fontWeight: 700, fontSize: '1.3rem', color: green.main, mb: 1.5 }}>
                    {reveal?.title ?? share.name}
                </Typography>
                {reveal === undefined && (
                    <Stack spacing={1}>
                        <Skeleton variant="rectangular" height={160} />
                        <Skeleton variant="text" width="90%" />
                        <Skeleton variant="text" width="70%" />
                    </Stack>
                )}
                {reveal === null && <Typography color="text.secondary">Não foi possível abrir o que o GM mostrou.</Typography>}
                {reveal && image && (
                    <Button onClick={() => setZoom(true)} aria-label="Ampliar a imagem" sx={{ p: 0, display: 'block', width: '100%', mb: reveal.markdown ? 2 : 0 }}>
                        <Box component="img" src={image} alt={reveal.title} sx={{ display: 'block', width: '100%', maxHeight: '45vh', objectFit: 'contain', borderRadius: 1 }} />
                    </Button>
                )}
                {reveal?.markdown && <Markdown source={reveal.markdown} dense />}
            </Box>
            {zoom && image && (
                <Dialog open fullScreen onClose={() => setZoom(false)} slotProps={{ paper: { sx: { bgcolor: green.deepest } } }}>
                    <IconButton aria-label="Fechar a imagem" onClick={() => setZoom(false)} sx={{ position: 'absolute', top: 8, right: 8, color: parchment.paper, zIndex: 1 }}>
                        <CloseIcon />
                    </IconButton>
                    <Box onClick={() => setZoom(false)} sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                        <Box component="img" src={image} alt={reveal?.title ?? share.name} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </Box>
                </Dialog>
            )}
        </Box>
    )
}
