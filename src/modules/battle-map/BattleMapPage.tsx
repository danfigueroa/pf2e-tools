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
    TouchApp as PingIcon,
    Casino as DiceIcon,
    Description as SheetIcon,
    VisibilityOff as HiddenIcon,
    Menu as MenuIcon,
} from '@mui/icons-material'
import { MapCanvas, type CanvasApi, type MapTool, type TokenView } from './components/MapCanvas'
import { MapListDrawer } from './components/MapListDrawer'
import { TokenPopover } from './components/TokenPopover'
import { SheetPanel } from './components/SheetPanel'
import { TokenFitEditor } from './components/TokenFitEditor'
import { sanitizeFit } from './tokenFit'
import { readSheetChoice, SHEET_OPEN_KEY, writeSheetChoice } from './sheetChoice'
import { ImagePanel } from './components/ImagePanel'
import { DrawPanel } from './components/DrawPanel'
import { AreaPanel } from './components/AreaPanel'
import { DicePanel } from './components/DicePanel'
import { TurnOrder } from './components/TurnOrder'
import { useLayoutMenu } from '../../layouts/menuContext'
import { postRoll } from '../../services/rolls'
import type { TableRoll } from '../../dice/tableRoll'
import { AREA_FEET, type AreaStyle } from './areas'
import { DRAW_WIDTHS, newDrawingId, type Drawing, type DrawStyle } from './drawing'
import type { TokenHp } from './hp'
import type { Cell, ImageRect } from './geometry'
import {
    clearDrawings,
    isMapStoreReady,
    listMaps,
    setMapVisibility,
    useMapData,
    withPcSizes,
    writeMapField,
    writePcHp,
    type MapData,
    type MapMeta,
} from '../../services/maps'
import { DRAW_COLORS, gold, green, ink, parchment } from '../../theme'
import { setCurrentMapId } from '../initiative-tracker/encounterStorage'
import { useRole } from '../../services/auth'

const GM_KEY = 'pf2e:map:gm'

const DRAW_KEY = 'pf2e:map:draw'
const AREA_KEY = 'pf2e:map:area'
/** Tempo até quem pingou apagar o ping — sobra para o poll dos outros (1,5 s) pegá-lo. */
const PING_LIFETIME_MS = 6000

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
            views.set(id, { id, hp, showNumbers: true, image: pc?.token?.url ?? null, fit: sanitizeFit(data.fit?.[id]) })
        } else {
            const raw = data.hp[id]
            const hp = raw ? { current: raw.current, max: raw.max, temp: raw.temp } : null
            // O `fit:` do GM no mapa vale por cima do que veio com o companheiro de combate.
            const fit = sanitizeFit(data.fit?.[id] ?? token.fit)
            // A imagem enviada no mapa (Modo GM) vale por cima da que o encontro mandou.
            views.set(id, { id, hp, showNumbers: gm, image: fit.url ?? token.image ?? null, fit })
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

    const menu = useLayoutMenu()
    // O papel vem da conta (membro GM da mesa); o interruptor "Modo GM" só liga ou desliga a
    // VISÃO de GM de quem já é GM — jogador não o vê, e o servidor decide pelo papel, nunca por ele.
    const { isGm } = useRole()
    const [gmView, setGmView] = useState(() => {
        try { return localStorage.getItem(GM_KEY) !== '0' } catch { return true }
    })
    const gm = isGm && gmView
    const [tool, setTool] = useState<MapTool>('select')
    const [diceOpen, setDiceOpen] = useState(false)
    const [zoom, setZoom] = useState(1)
    const [drawer, setDrawer] = useState(false)
    // Ficha ao lado do mapa: aberta/recolhida e o personagem lembrados neste aparelho.
    const [sheetOpen, setSheetOpenState] = useState(() => {
        try { return localStorage.getItem(SHEET_OPEN_KEY) !== '0' } catch { return true }
    })
    const setSheetOpen = useCallback((open: boolean) => {
        setSheetOpenState(open)
        try { localStorage.setItem(SHEET_OPEN_KEY, open ? '1' : '0') } catch { /* noop */ }
    }, [])
    const [sheetSlug, setSheetSlug] = useState<string | null>(readSheetChoice)
    // Modo GM: o token cuja imagem está sendo enquadrada.
    const [fitFor, setFitFor] = useState<string | null>(null)
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
        try { localStorage.setItem(AREA_KEY, JSON.stringify(next)) } catch { /* só nesta aba */ }
    }

    const changeDrawStyle = (next: DrawStyle) => {
        setDrawStyle(next)
        try { localStorage.setItem(DRAW_KEY, JSON.stringify(next)) } catch { /* só nesta aba */ }
    }

    // Fora do Modo GM, mapa privado chega como `hidden` — o servidor nem o entrega.
    const { data: rawData, error, activeId, hidden } = useMapData(id, gm)
    const [revealing, setRevealing] = useState(false)
    const reveal = () => {
        if (!id) return
        setRevealing(true)
        setMapVisibility(id, false).catch(() => {}).finally(() => setRevealing(false))
    }
    // Enlarge/Shrink ligado na Ficha Virtual muda o tamanho do token do personagem.
    const data = useMemo(() => (rawData ? withPcSizes(rawData) : null), [rawData])

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
        setGmView(on)
        if (!on && tool === 'image') setTool('select')
        try { localStorage.setItem(GM_KEY, on ? '1' : '0') } catch { /* sem storage, só nesta aba */ }
    }

    const views = useMemo(() => (data ? buildViews(data, gm) : new Map<string, TokenView>()), [data, gm])

    // Callbacks estáveis: o MapCanvas é memoizado e não pode repintar por causa
    // de uma função nova a cada render.
    const dataRef = useRef(data)
    dataRef.current = data

    const onMove = useCallback((tokenId: string, cell: Cell) => {
        if (id) writeMapField(id, `pos:${tokenId}`, cell, { now: true })
    }, [id])

    const onImageRect = useCallback((rect: ImageRect) => {
        const d = dataRef.current
        if (id && d) writeMapField(id, 'meta', { ...d.meta, imageRect: rect })
    }, [id])

    const onMeta = useCallback((meta: MapMeta) => {
        if (id) writeMapField(id, 'meta', meta)
    }, [id])

    const onDraw = useCallback((drawing: Drawing) => {
        if (id) writeMapField(id, `drw:${newDrawingId()}`, drawing)
    }, [id])

    /**
     * Ping: grava o ponto e apaga sozinho depois de alguns segundos. Quem
     * recebe decide se pisca pelo id (ver `PingLayer`), não pelo relógio.
     */
    const onPing = useCallback((x: number, y: number) => {
        if (!id) return
        const field = `ping:${newDrawingId()}`
        writeMapField(id, field, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }, { now: true })
        setTimeout(() => writeMapField(id, field, null), PING_LIFETIME_MS)
    }, [id])

    /** Rolagem: vai para o feed da mesa, o mesmo das rolagens da ficha. */
    const onRoll = useCallback((roll: TableRoll) => { void postRoll(roll) }, [])

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
        <Box sx={{ display: 'flex', height: '100dvh' }}>
        <Box
            sx={{
                // O MainLayout não põe moldura em /mapa (sem padding, sem
                // AppBar): o mapa ocupa a tela inteira, menos o painel da ficha.
                flex: 1,
                minWidth: 0,
                height: '100%',
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
                    onPing={onPing}
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
                    {menu && (
                        <Button
                            variant="contained"
                            onClick={menu.openMenu}
                            startIcon={<MenuIcon />}
                            aria-label="Abrir o menu de navegação"
                            sx={{
                                flex: '0 0 auto',
                                fontWeight: 700,
                                color: green.deepest,
                                backgroundColor: gold.bright,
                                '&:hover': { backgroundColor: gold.main },
                            }}
                        >
                            Menu
                        </Button>
                    )}
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

                    {/* Fora do seletor: abre um painel sem trocar a ferramenta ativa. */}
                    <Button
                        size="small"
                        aria-pressed={diceOpen}
                        onClick={() => setDiceOpen((o) => !o)}
                        startIcon={<DiceIcon fontSize="small" />}
                        sx={{
                            color: diceOpen ? green.deepest : parchment.page,
                            backgroundColor: diceOpen ? gold.bright : 'transparent',
                            border: `1px solid ${gold.main}66`,
                            '&:hover': { backgroundColor: diceOpen ? gold.bright : `${gold.main}33` },
                        }}
                    >
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Dados</Box>
                    </Button>

                    {/* Logo depois das ferramentas, onde o olho já está: no canto
                        oposto, junto do Modo GM, ninguém achava. */}
                    <Tooltip title="Clique duas vezes em qualquer ponto do mapa: um anel dourado pisca ali na tela de todos da mesa por alguns segundos. Vale em qualquer ferramenta (menos em cima de um token).">
                        <Box
                            sx={{
                                display: { xs: 'none', md: 'flex' },
                                alignItems: 'center',
                                gap: 0.5,
                                color: parchment.page,
                                fontSize: '0.8rem',
                                cursor: 'help',
                            }}
                        >
                            <PingIcon fontSize="small" sx={{ color: gold.bright }} />
                            Clique duplo: ping
                        </Box>
                    </Tooltip>

                    <Box sx={{ flex: 1 }} />

                    {isGm && (
                        <FormControlLabel
                            control={<Switch size="small" checked={gm} onChange={(e) => toggleGm(e.target.checked)} color="warning" />}
                            label="Modo GM"
                            sx={{ mr: 0.5, '& .MuiFormControlLabel-label': { fontSize: '0.85rem' } }}
                        />
                    )}
                </Paper>

                {data?.private && gm && (
                    <Alert
                        severity="warning"
                        icon={<HiddenIcon fontSize="inherit" />}
                        sx={{ width: 'min(520px, 100%)' }}
                        action={(
                            <Button color="inherit" size="small" disabled={revealing} onClick={reveal} sx={{ whiteSpace: 'nowrap' }}>
                                Revelar à mesa
                            </Button>
                        )}
                    >
                        Mapa privado: só quem está no Modo GM vê.
                    </Alert>
                )}
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

            {data && <TurnOrder tokens={data.tokens} turn={data.turn} />}

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
            {data && id && diceOpen && <DicePanel onRoll={onRoll} />}
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
            {(resolving || (id && !data && !error && !hidden)) && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                    <CircularProgress sx={{ color: gold.bright }} />
                </Box>
            )}
            {!resolving && (!id || error || hidden) && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2 }}>
                    <Card sx={{ maxWidth: 420 }}>
                        <CardContent sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                                {hidden ? 'Mapa ainda não revelado' : error ? 'Mapa não encontrado' : 'Mapa de Combate'}
                            </Typography>
                            <Typography sx={{ color: ink.secondary, mb: 2 }}>
                                {hidden
                                    ? 'O GM ainda está preparando este mapa. Ele aparece aqui sozinho quando for revelado.'
                                    : error
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
                onAdjustImage={gm && (tappedToken?.kind === 'npc' || tappedView?.image) ? () => { setFitFor(tapped?.id ?? null); setTapped(null) } : undefined}
                onOpenSheet={(slug) => { setSheetSlug(slug); writeSheetChoice(slug); setSheetOpen(true); setTapped(null) }}
            />

            {gm && fitFor && id && data && (
                <TokenFitEditor mapId={id} tokenId={fitFor} data={data} views={views} onClose={() => setFitFor(null)} />
            )}

            {!sheetOpen && (
                <Tooltip title="Abrir a ficha" placement="left">
                    <IconButton
                        aria-label="Abrir a ficha"
                        onClick={() => setSheetOpen(true)}
                        size="small"
                        sx={{
                            position: 'absolute',
                            right: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 2,
                            width: 24,
                            height: 64,
                            borderRadius: '8px 0 0 8px',
                            color: gold.bright,
                            backgroundColor: 'rgba(14, 36, 25, 0.7)',
                            '&:hover': { backgroundColor: green.deepest },
                        }}
                    >
                        <SheetIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            )}
        </Box>

        {sheetOpen && (
            <SheetPanel
                slug={sheetSlug}
                onSlugChange={setSheetSlug}
                onCollapse={() => setSheetOpen(false)}
            />
        )}
        </Box>
    )
}

export default BattleMapPage
