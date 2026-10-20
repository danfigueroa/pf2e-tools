import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { DescriptionContent, type DescriptionRequest } from '../modules/character-viewer/components/DescriptionContent'
import { gold, green, parchment } from '../theme'
import type { TableShare } from '../services/tableShare'

// O cartão de uma regra compartilhada: o mesmo conteúdo do drawer da ficha,
// buscado aqui pela referência que chegou da mesa. Carregado sob demanda
// (`SharedRuleLayer`): o drawer, o heightening e o cliente de descrições não
// entram no bundle principal.

function requestOf(s: TableShare): DescriptionRequest {
    if (s.type === 'spell') return { type: 'spell', name: s.name, level: s.level, caster: s.caster }
    if (s.type === 'feat') return { type: 'feat', name: s.name, level: s.level }
    return { type: s.type, name: s.name }
}

export default function SharedRuleCard({ share, onClose }: { share: TableShare; onClose: () => void }) {
    // As magias de um bastão trocam o conteúdo do próprio cartão, como no drawer.
    const [request, setRequest] = useState<DescriptionRequest>(() => requestOf(share))
    const who = share.by || 'Alguém'

    return (
        <Box
            role="region"
            aria-label={`Regra compartilhada por ${who}`}
            sx={{
                position: 'fixed',
                zIndex: 1240,
                // Celular: preso embaixo, sem cobrir o cartão de rolagem do topo.
                left: { xs: 8, md: 'auto' },
                right: { xs: 8, md: 16 },
                bottom: { xs: 8, md: 'auto' },
                top: { xs: 'auto', md: 16 },
                width: { md: 'min(460px, calc(100vw - 32px))' },
                maxHeight: { xs: '70vh', md: 'calc(100vh - 32px)' },
                display: 'flex',
                flexDirection: 'column',
                bgcolor: parchment.paper,
                border: `1px solid ${gold.main}`,
                borderRadius: 2,
                boxShadow: 8,
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 0.75,
                    bgcolor: green.main,
                    borderBottom: `2px solid ${gold.main}`,
                    flexShrink: 0,
                }}
            >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: share.color, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: parchment.paper, minWidth: 0 }}>
                    <Box component="strong" sx={{ color: gold.bright }}>{who}</Box> compartilhou com a mesa
                </Typography>
            </Box>
            <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <DescriptionContent request={request} onClose={onClose} onNavigate={setRequest} />
            </Box>
        </Box>
    )
}
