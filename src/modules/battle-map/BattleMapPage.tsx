import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    FormControlLabel,
    IconButton,
    Paper,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material'
import {
    Add as ZoomInIcon,
    CenterFocusStrong as FitIcon,
    Image as ImageIcon,
    Layers as MapsIcon,
    PanTool as SelectIcon,
    Remove as ZoomOutIcon,
    Straighten as RulerIcon,
    Brush as DrawIcon,
    BlurCircular as AreaIcon,
    Close as CloseIcon,
} from '@mui/icons-material'
import { MapCanvas, type CanvasApi, type MapTool, type TokenView } from './components/MapCanvas'
import { MapListDrawer } from './components/MapListDrawer'
import { TokenPopover } from './components/TokenPopover'
import { ImagePanel } from './components/ImagePanel'
import { DrawPanel } from './components/DrawPanel'
import { AreaPanel } from './components/AreaPanel'
import { AREA_FEET, type Area, type AreaStyle } from './areas'
import { DRAW_WIDTHS, newDrawingId, type Drawing, type DrawStyle } from './drawing'
import type { TokenHp } from './hp'
import type { Cell, ImageRect } from './geometry'
import {
    clearDrawings,
    isMapStoreReady,
    listMaps,
    useMapData,
    writeMapField,
    writePcHp,
    type MapData,
    type MapMeta,
} from '../../services/maps'
import { DRAW_COLORS, gold, green, ink, parchment } from '../../theme'
import { setCurrentMapId } from '../initiative-tracker/encounterStorage'

const GM_KEY = 'pf2e:map:gm'
const DRAW_KEY = 'pf2e:map:draw'
const AREA_KEY = 'pf2e:map:area'

/** Forma, tamanho e cor da Área, lembrados neste aparelho como os do Desenhar. */
function loadAreaStyle(): AreaStyle {
    const fallback: AreaStyle = { mode: 'burst', feet: AREA_FEET[3], color: DRAW_COLORS[0].hex }
    try {
        const raw = JSON.parse(localStorage.getItem(AREA_KEY) ?? 'null') as Partial<AreaStyle> | null
        if (!raw) return fallback
        const mode = (['burst', 'emanation', 'cone', 'line'] as const).find((m) => m === raw.mode) ?? fallback.mode
        const feet = typeof raw.feet === 'number' && raw.feet >= 5 && raw.feet <= 500 ? raw.feet : fallback.feet
        const color = DRAW_COLORS.find((c) => c.hex === raw.color)?.hex ?? fallback.color
        return { mode, feet, color }
    } catch {
        return fallback
    }
}

/** Cor e espessura ficam lembradas neste aparelho: quem é o mago do fogo desenha sempre em laranja. */
function loadDrawStyle(): DrawStyle {
    const fallback: DrawStyle = { mode: 'free', color: DRAW_COLORS[0].hex, width: DRAW_WIDTHS[1] }
    try {
        const raw = JSON.parse(localStorage.getItem(DRAW_KEY) ?? 'null') as Partial<DrawStyle> | null
        if (!raw) return fallback
        const color = DRAW_COLORS.find((c) => c.hex === raw.color)?.hex ?? fallback.color
        const width = DRAW_WIDTHS.find((w) => w === raw.width) ?? fallback.width
        return { mode: raw.mode === 'line' ? 'line' : 'free', color, width }
    } catch {
        return fallback
    }
}

/** PV de cada token, já com a regra de quem vê número. */
function buildViews(data: MapData, gm: boolean): Map<string, TokenView> {
    const views = new Map<string, TokenView>()
    for (const [id, token] of Object.entries(data.tokens)) {
        if (token.kind === 'pc' && token.slug) {
            const pc = data.pcs[token.slug]
            const max = Math.max(1, token.maxHp ?? 1)
            // `null` na mesa = ninguém mexeu = PV cheio (mesma regra do useHpTracker).
            const hp: TokenHp = {
                current: Math.min(max, Math.max(0, pc?.hp?.current ?? max)),
                max,
                temp: Math.max(0, pc?.hp?.temp ?? 0),
            }
            views.set(id, { id, hp, showNumbers: true, image: pc?.token?.url ?? null })
        } else {
            const raw = data.hp[id]
            const hp = raw ? { current: raw.current, max: raw.max, temp: raw.temp } : null
            views.set(id, { id, hp, showNumbers: gm, image: token.image ?? null })
        }
    }
    return views
}

/**
 * Mapa de Combate. A página só monta peças e decide permissões de interface;
 * desenho e gestos moram no `MapCanvas`, e a sincronia no `services/maps.ts`.
 *
 * Os tokens vêm do encontro da Iniciativa ligado a este mapa — aqui não se
 * cria nem apaga token, só se move e se aplica dano.
 */
export const BattleMapPage = () => {
    const { id: routeId } = useParams<{ id?: string }>()
    const navigate = useNavigate()
    const id = routeId ?? null

    const [gm, setGm] = useState(() => {
        try { return localStorage.getItem(GM_KEY) === '1' } catch { return false }
    })
    const [tool, setTool] = useState<MapTool>('select')
    const [zoom, setZoom] = useState(1)
    const [drawer, setDrawer] = useState(false)
    const [tapped, setTapped] = useState<{ id: string; anchor: HTMLElement } | null>(null)
    const [resolving, setResolving] = useState(!routeId)
    // O aviso "os tokens vêm da Iniciativa" cobre metade do mapa no celular:
    // fechado uma vez, fica fechado nesta aba.
    const [hintClosed, setHintClosed] = useState(false)
    const canvas = useRef<CanvasApi>(null)
    const [drawStyle, setDrawStyle] = useState<DrawStyle>(loadDrawStyle)
    const [areaStyle, setAreaStyle] = useState<AreaStyle>(loadAreaStyle)

    const changeAreaStyle = (next: AreaStyle) => {
        setAreaStyle(next)
        // O modo Apagar não fica lembrado: reabrir a ferramenta e só conseguir apagar confunde.
        if (next.mode === 'erase') return
        try { localStorage.setItem(AREA_KEY, JSON.stringify(next)) } catch { /* só nesta aba */ }
    }

    const changeDrawStyle = (next: DrawStyle) => {
        setDrawStyle(next)
        try { localStorage.setItem(DRAW_KEY, JSON.stringify(next)) } catch { /* só nesta aba */ }
    }

    const { data, error, activeId } = useMapData(id)

    // Sem mapa na URL: vai para onde a mesa está; sem mesa, abre a lista.
    useEffect(() => {
        if (routeId) return
        let alive = true
        setResolving(true)
        listMaps()
            .then((body) => {
                if (!alive) return
                if (body.activeId) navigate(`/mapa/${body.activeId}`, { replace: true })
                else setDrawer(true)
            })
            .catch(() => { if (alive) setDrawer(true) })
            .finally(() => { if (alive) setResolving(false) })
        return () => { alive = false }
    }, [routeId, navigate])

    const toggleGm = (on: boolean) => {
        setGm(on)
        if (!on && tool === 'image') setTool('select')
        try { localStorage.setItem(GM_KEY, on ? '1' : '0') } catch { /* sem storage, só nesta aba */ }
    }

    const views = useMemo(() => (data ? buildViews(data, gm) : new Map<string, TokenView>()), [data, gm])

    // Callbacks estáveis: o MapCanvas é memoizado e não pode repintar por causa
    // de uma função nova a cada render.
    const dataRef = useRef(data)
    dataRef.current = data

    const onMove = useCallback((tokenId: string, cell: Cell) => {
        if (id) writeMapField(id, `pos:${tokenId}`, cell)
    }, [id])

    const onImageRect = useCallback((rect: ImageRect) => {
        const d = dataRef.current
        if (id && d) writeMapField(id, 'meta', { ...d.meta, imageRect: rect })
    }, [id])

    const onMeta = useCallback((meta: MapMeta) => {
        if (id) writeMapField(id, 'meta', meta)
    }, [id])

    const onDraw = useCallback((mark: Drawing | Area) => {
        if (id) writeMapField(id, `drw:${newDrawingId()}`, mark)
    }, [id])

    const onErase = useCallback((drawingId: string) => {
        if (id) writeMapField(id, `drw:${drawingId}`, null)
    }, [id])

    const onTokenTap = useCallback((tokenId: string, anchor: HTMLElement) => {
        setTapped({ id: tokenId, anchor })
    }, [])

    const tappedToken = tapped && data ? data.tokens[tapped.id] ?? null : null
    const tappedView = tapped ? views.get(tapped.id) : undefined
    const canEditTapped = !!tappedToken && (tappedToken.kind === 'pc' || gm)

    const applyHp = (next: TokenHp) => {
        if (!id || !tapped || !tappedToken) return
        if (tappedToken.kind === 'pc' && tappedToken.slug) {
            writePcHp(id, tappedToken.slug, { current: next.current, temp: next.temp })
        } else {
            writeMapField(id, `hp:${tapped.id}`, { current: next.current, max: next.max, temp: next.temp })
        }
    }

    /**
     * Abre a Iniciativa já no encontro DESTE mapa. Grava a escolha onde a
     * página de Iniciativa a lê ao montar — ela não está montada agora, então
     * não há encontro em memória para sobrescrever.
     */
    const openEncounter = () => {
        if (!id) return
        setCurrentMapId(id)
        navigate('/iniciativa')
    }

    const openMap = (next: string | null) => {
        setTapped(null)
        navigate(next ? `/mapa/${next}` : '/mapa')
    }

    const tokenCount = data ? Object.keys(data.tokens).length : 0

    return (
        <Box
            sx={{
                // Sangra até a borda: o mapa é a página. Desfaz o padding do
                // MainLayout e ocupa a altura toda abaixo da AppBar do celular.
                mx: { xs: -1.5, sm: -3 },
                my: { xs: -2, sm: -3 },
                height: { xs: 'calc(100dvh - 56px)', sm: 'calc(100dvh - 64px)', md: '100dvh' },
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: green.deepest,
            }}
        >
            {data && (
                <MapCanvas
                    data={data}
                    tool={tool}
                    views={views}
                    onMove={onMove}
                    onImageRect={onImageRect}
                    onTokenTap={onTokenTap}
                    onZoomChange={setZoom}
                    drawStyle={drawStyle}
                    areaStyle={areaStyle}
                    onDraw={onDraw}
                    onErase={onErase}
                    apiRef={canvas}
                />
            )}

            {/* Barra superior e avisos numa coluna só: no celular a barra quebra
                em duas linhas, e um aviso com `top` fixo cobriria a segunda. */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    right: 8,
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    pointerEvents: 'none',
                    '& > *': { pointerEvents: 'auto' },
                }}
            >
                <Paper
                    elevation={4}
                    sx={{
                        alignSelf: 'stretch',
                        px: 1,
                        py: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1,
                        backgroundColor: green.main,
                        color: parchment.page,
                        borderBottom: `2px solid ${gold.main}`,
                    }}
                >
                    <Button
                        onClick={() => setDrawer(true)}
                        startIcon={<MapsIcon />}
                        sx={{ color: gold.bright, fontWeight: 700, minWidth: 0, maxWidth: { xs: 160, sm: 280 } }}
                    >
                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {data?.meta.name ?? 'Mapas'}
                        </Box>
                    </Button>

                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={tool}
                        onChange={(_, v: MapTool | null) => { if (v) setTool(v) }}
                        sx={{
                            '& .MuiToggleButton-root': {
                                color: parchment.page,
                                borderColor: `${gold.main}66`,
                                px: { xs: 1, sm: 1.5 },
                                '&.Mui-selected': { color: green.deepest, backgroundColor: gold.bright },
                                '&.Mui-selected:hover': { backgroundColor: gold.bright },
                            },
                        }}
                    >
                        <ToggleButton value="select" aria-label="Mover tokens">
                            <SelectIcon fontSize="small" />
                            <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>Mover</Box>
                        </ToggleButton>
                        <ToggleButton value="ruler" aria-label="Régua">
                            <RulerIcon fontSize="small" />
                            <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>Régua</Box>
                        </ToggleButton>
                        <ToggleButton value="draw" aria-label="Desenhar">
                            <DrawIcon fontSize="small" />
                            <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>Desenhar</Box>
                        </ToggleButton>
                        <ToggleButton value="area" aria-label="Área de efeito">
                            <AreaIcon fontSize="small" />
                            <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>Área</Box>
                        </ToggleButton>
                        {gm && (
                            <ToggleButton value="image" aria-label="Camada do mapa">
                                <ImageIcon fontSize="small" />
                                <Box component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>Mapa</Box>
                            </ToggleButton>
                        )}
                    </ToggleButtonGroup>

                    <Box sx={{ flex: 1 }} />

                    <FormControlLabel
                        control={<Switch size="small" checked={gm} onChange={(e) => toggleGm(e.target.checked)} color="warning" />}
                        label="Modo GM"
                        sx={{ mr: 0.5, '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}
                    />
                </Paper>

                {data && activeId && activeId !== id && (
                    <Alert
                        severity="info"
                        sx={{ width: 'min(520px, 100%)' }}
                        action={<Button color="inherit" size="small" onClick={() => openMap(activeId)}>Ir</Button>}
                    >
                        A mesa está em outro mapa.
                    </Alert>
                )}
                {data && tokenCount === 0 && !hintClosed && (
                    <Alert
                        severity="info"
                        sx={{ width: 'min(520px, 100%)' }}
                        // Com `action` o MUI esconde o × do `onClose`: os dois vão aqui.
                        action={(
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Button color="inherit" size="small" onClick={openEncounter} sx={{ whiteSpace: 'nowrap' }}>
                                    Montar encontro
                                </Button>
                                <IconButton color="inherit" size="small" aria-label="Fechar aviso" onClick={() => setHintClosed(true)}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        )}
                    >
                        Os tokens vêm da Iniciativa: cada combatente do encontro deste mapa vira um
                        token aqui.
                    </Alert>
                )}
                {data && !isMapStoreReady() && (
                    <Alert severity="warning" sx={{ width: 'min(520px, 100%)' }}>
                        Servidor sem Redis: o mapa não é compartilhado com a mesa.
                    </Alert>
                )}
            </Box>

            {/* Zoom */}
            {data && (
                <Paper
                    elevation={4}
                    sx={{
                        position: 'absolute',
                        right: 12,
                        bottom: 12,
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: green.main,
                        '& .MuiIconButton-root': { color: parchment.page, width: 44, height: 44 },
                    }}
                >
                    <IconButton aria-label="Aproximar" onClick={() => canvas.current?.zoomBy(1.25)}><ZoomInIcon /></IconButton>
                    <Typography variant="caption" sx={{ color: gold.bright, fontWeight: 700 }}>
                        {Math.round(zoom * 100)}%
                    </Typography>
                    <IconButton aria-label="Afastar" onClick={() => canvas.current?.zoomBy(0.8)}><ZoomOutIcon /></IconButton>
                    <Tooltip title="Enquadrar o mapa" placement="left">
                        <IconButton aria-label="Enquadrar o mapa" onClick={() => canvas.current?.fit()}><FitIcon /></IconButton>
                    </Tooltip>
                </Paper>
            )}

            {gm && tool === 'image' && data && <ImagePanel meta={data.meta} onChange={onMeta} />}
            {tool === 'area' && data && <AreaPanel style={areaStyle} onChange={changeAreaStyle} />}
            {tool === 'draw' && data && id && (
                <DrawPanel
                    style={drawStyle}
                    onChange={changeDrawStyle}
                    count={Object.keys(data.drawings ?? {}).length}
                    onClearAll={gm ? () => void clearDrawings(id) : undefined}
                />
            )}

            {/* Estados vazios */}
            {(resolving || (id && !data && !error)) && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <CircularProgress sx={{ color: gold.bright }} />
                </Box>
            )}
            {!resolving && (!id || error) && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2 }}>
                    <Card sx={{ maxWidth: 420 }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                                {error ? 'Mapa não encontrado' : 'Mapa de Combate'}
                            </Typography>
                            <Typography sx={{ color: ink.secondary, mb: 2 }}>
                                {error
                                    ? 'Ele pode ter sido apagado depois do jogo.'
                                    : 'Nenhum mapa aberto. Escolha um da sessão ou, no Modo GM, crie um novo.'}
                            </Typography>
                            <Button variant="contained" startIcon={<MapsIcon />} onClick={() => setDrawer(true)}>
                                Mapas da sessão
                            </Button>
                        </CardContent>
                    </Card>
                </Box>
            )}

            <MapListDrawer
                open={drawer}
                currentId={id}
                gm={gm}
                onClose={() => setDrawer(false)}
                onOpenMap={openMap}
            />

            <TokenPopover
                anchor={tapped?.anchor ?? null}
                token={tappedToken}
                hp={tappedView?.hp ?? null}
                canEdit={canEditTapped}
                onClose={() => setTapped(null)}
                onApply={applyHp}
            />
        </Box>
    )
}

export default BattleMapPage
