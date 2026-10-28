import { useEffect, useState } from 'react'
import { Box, Skeleton, Stack, Typography } from '@mui/material'
import { DescriptionContent, type DescriptionRequest } from '../modules/character-viewer/components/DescriptionContent'
import { hasCachedDescription, loadDescriptionBundle, readSheetDescriptions } from '../services/descriptions'
import { gold, green, parchment } from '../theme'
import type { TableShare } from '../services/tableShare'

// O cartão de uma regra compartilhada: o mesmo conteúdo do drawer da ficha,
// buscado aqui pela referência que chegou da mesa. Carregado sob demanda
// (`SharedRuleLayer`): o drawer, o heightening e o cliente de descrições não
// entram no bundle principal.
//
// Antes de buscar, lê as descrições JÁ TRADUZIDAS do personagem que
// compartilhou — o pacote estático e o da ficha publicada, os mesmos que a
// ficha dele carrega. Sem isso, quem não estava com aquela ficha aberta caía na
// API: busca na AON e tradução pelo LLM do zero, dezenas de segundos para um
// texto que a mesa já tem pronto.

/** Teto da espera pelos pacotes: com a rede ruim, segue pela API como antes. */
const SEED_TIMEOUT_MS = 4000

function requestOf(s: TableShare): DescriptionRequest {
    if (s.type === 'spell') return { type: 'spell', name: s.name, level: s.level, caster: s.caster }
    if (s.type === 'feat') return { type: 'feat', name: s.name, level: s.level }
    return { type: s.type, name: s.name }
}

export default function SharedRuleCard({ share, onClose }: { share: TableShare; onClose: () => void }) {
    // As magias de um bastão trocam o conteúdo do próprio cartão, como no drawer.
    const [request, setRequest] = useState<DescriptionRequest>(() => requestOf(share))
    // Já no cache deste aparelho (a ficha de quem compartilhou estava aberta aqui): nada a esperar.
    const [seeded, setSeeded] = useState(() => !share.slug || hasCachedDescription(share.type, share.name))
    const who = share.by || 'Alguém'

    useEffect(() => {
        const slug = share.slug
        if (!slug || seeded) return
        let alive = true
        const done = () => { if (alive) setSeeded(true) }
        // O primeiro pacote que trouxer a descrição já basta; o outro termina em segundo plano.
        const packs = [loadDescriptionBundle(slug), readSheetDescriptions(slug)]
        packs.forEach((p) => void p.then(() => { if (hasCachedDescription(share.type, share.name)) done() }))
        const timeout = new Promise((resolve) => setTimeout(resolve, SEED_TIMEOUT_MS))
        void Promise.race([Promise.allSettled(packs), timeout]).then(done)
        return () => { alive = false }
        // `seeded` só vale na montagem: virar `true` é o fim da espera, não um novo pedido.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [share.slug, share.type, share.name])

    return (
        <Box
            role="region"
            aria-label={`Regra compartilhada por ${who}`}
            sx={{
                position: 'fixed',
                zIndex: 1240,
                // Celular: preso embaixo (acima da barra de abas), sem cobrir o cartão de rolagem do topo.
                left: { xs: 8, md: 'auto' },
                right: { xs: 8, md: 16 },
                bottom: { xs: 'calc(var(--tabbar-h, 0px) + 8px)', md: 'auto' },
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
                {seeded ? (
                    <DescriptionContent request={request} onClose={onClose} onNavigate={setRequest} />
                ) : (
                    <Stack spacing={1.5} sx={{ p: { xs: 2.5, md: 3 } }}>
                        <Skeleton variant="text" width="40%" height={32} />
                        <Skeleton variant="text" width="92%" />
                        <Skeleton variant="text" width="88%" />
                        <Skeleton variant="text" width="60%" />
                    </Stack>
                )}
            </Box>
        </Box>
    )
}
