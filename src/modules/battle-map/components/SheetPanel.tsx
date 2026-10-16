import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Box, CircularProgress, IconButton, MenuItem, Select, Tooltip, Typography } from '@mui/material'
import { ChevronRight as CollapseIcon } from '@mui/icons-material'
import { green, gold, parchment } from '../../../theme'
import { parseCharacterJson, type BuildInfo } from '../../character-sheet/types'
import { CAMPAIGN_PRESETS, loadPresetJson } from '../../character-viewer/campaignPresets'
import { charSlugFromName } from '../../character-viewer/charId'
import { EmbedContext } from '../../character-viewer/embedContext'
import { usePublication } from '../../character-viewer/components/usePublication'
import { usePublishedSheets } from '../../character-viewer/usePublishedSheets'
import { fetchPublished } from '../../../services/sheets'
import { writeSheetChoice } from '../sheetChoice'

// A ficha é um chunk à parte: só baixa quando o painel abre.
const CharacterSheetView = lazy(() =>
    import('../../character-viewer/CharacterSheetView').then((m) => ({ default: m.CharacterSheetView })),
)

const PANEL_WIDTH = 420

interface Props {
    /** Slug da ficha a mostrar; mudar de fora (token tocado) troca a ficha. */
    slug: string | null
    onSlugChange: (slug: string | null) => void
    onCollapse: () => void
}

/** Ficha compacta ao lado do mapa: o jogador acompanha o mapa e rola sem trocar de aba. */
export const SheetPanel = ({ slug, onSlugChange, onCollapse }: Props) => {
    const { published: sheets } = usePublishedSheets()
    const publication = usePublication()
    const { attach } = publication
    const [build, setBuild] = useState<BuildInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [failed, setFailed] = useState(false)
    // Os overlays da ficha se prendem a este elemento (ver `embedContext`).
    const [host, setHost] = useState<HTMLElement | null>(null)

    useEffect(() => {
        if (!slug) { setBuild(null); attach(null); return }
        let cancelled = false
        setLoading(true)
        setFailed(false)
        ;(async () => {
            try {
                const preset = CAMPAIGN_PRESETS.find((p) => charSlugFromName(p.sheetName) === slug)
                // A versão da mesa vence; o preset fixo é o plano B (e o único sem publicação).
                const sheet = await fetchPublished(slug)
                const res = sheet
                    ? { json: sheet.json, published: sheet }
                    : preset ? await loadPresetJson(preset) : null
                if (cancelled) return
                if (!res) { setFailed(true); setBuild(null); attach(null); return }
                setBuild(parseCharacterJson(res.json))
                attach(res.published)
            } catch {
                if (!cancelled) { setFailed(true); setBuild(null) }
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [slug, attach])

    const choose = useCallback((next: string) => {
        const value = next || null
        writeSheetChoice(value)
        onSlugChange(value)
    }, [onSlugChange])

    // Presets primeiro, depois quem foi publicado e não é da campanha.
    const options = [
        ...CAMPAIGN_PRESETS.map((p) => ({ slug: charSlugFromName(p.sheetName), label: p.name })),
        ...sheets
            .filter((s) => !CAMPAIGN_PRESETS.some((p) => charSlugFromName(p.sheetName) === s.slug))
            .map((s) => ({ slug: s.slug, label: s.name })),
    ]

    return (
        <Box
            ref={setHost}
            sx={{
                position: 'relative',
                width: PANEL_WIDTH,
                maxWidth: '45vw',
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                backgroundColor: 'background.default',
                borderLeft: `2px solid ${gold.main}`,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.75,
                    backgroundColor: green.deepest,
                    borderBottom: `2px solid ${gold.main}`,
                    flexShrink: 0,
                }}
            >
                <Tooltip title="Recolher a ficha">
                    <IconButton size="small" onClick={onCollapse} aria-label="Recolher a ficha" sx={{ color: gold.bright }}>
                        <CollapseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Select
                    size="small"
                    displayEmpty
                    value={slug ?? ''}
                    onChange={(e) => choose(e.target.value)}
                    inputProps={{ 'aria-label': 'Personagem' }}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        color: parchment.page,
                        '& .MuiSelect-icon': { color: gold.bright },
                        '& fieldset': { borderColor: 'rgba(200, 169, 81, 0.5)' },
                    }}
                >
                    <MenuItem value="">
                        <em>Escolha o personagem…</em>
                    </MenuItem>
                    {options.map((o) => (
                        <MenuItem key={o.slug} value={o.slug}>{o.label}</MenuItem>
                    ))}
                </Select>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5 }}>
                {!slug && (
                    <Typography sx={{ color: 'text.secondary', textAlign: 'center', mt: 4 }}>
                        Escolha seu personagem para ver a ficha ao lado do mapa.
                    </Typography>
                )}
                {slug && loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
                )}
                {slug && failed && !loading && (
                    <Typography sx={{ color: 'error.main', textAlign: 'center', mt: 4 }}>
                        Não achei a ficha desse personagem.
                    </Typography>
                )}
                {slug && build && !loading && (
                    <EmbedContext.Provider value={host}>
                        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}>
                            <CharacterSheetView
                                key={slug}
                                build={build}
                                publication={publication}
                                onReset={() => choose('')}
                                compact
                            />
                        </Suspense>
                    </EmbedContext.Provider>
                )}
            </Box>
        </Box>
    )
}
