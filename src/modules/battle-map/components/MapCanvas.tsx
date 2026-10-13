import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import type { Ref } from 'react'
import {
    CELL_PX,
    GRID_MIN_ZOOM,
    MAX_ZOOM,
    MIN_ZOOM,
    cellAt,
    clamp,
    formatDistance,
    gridBounds,
    snapToken,
    squaresBetween,
    type Cell,
    type ImageRect,
} from '../geometry'
import { Token } from './Token'
import type { TokenHp } from '../hp'
import { useImageUrl } from '../../../services/images'
import { MAP_BACKDROP, gold, mapChrome } from '../../../theme'
import type { MapData } from '../../../services/maps'

export type MapTool = 'select' | 'ruler' | 'image'

export interface CanvasApi {
    zoomBy: (factor: number) => void
    fit: () => void
}

export interface TokenView {
    id: string
    hp: TokenHp | null
    showNumbers: boolean
    image: string | null
}

interface Props {
    data: MapData
    tool: MapTool
    /** PV e imagem já resolvidos por token (a página sabe do Modo GM e dos PCs). */
    views: Map<string, TokenView>
    onMove: (tokenId: string, cell: Cell) => void
    onImageRect: (rect: ImageRect) => void
    onTokenTap: (tokenId: string, anchor: HTMLElement) => void
    onZoomChange: (zoom: number) => void
    apiRef: Ref<CanvasApi>
}

interface Transform { x: number; y: number; z: number }

type Gesture =
    | { kind: 'pan'; sx: number; sy: number; tx: number; ty: number }
    | { kind: 'pinch'; d0: number; z0: number; wx: number; wy: number }
    | {
        kind: 'token'; id: string; el: HTMLElement; size: number; from: Cell
        ox: number; oy: number; sx: number; sy: number; moved: boolean; to: Cell
    }
    | { kind: 'ruler'; from: Cell }
    | { kind: 'image'; corner: Corner | null; sx: number; sy: number; start: ImageRect; rect: ImageRect }

/** Canto da imagem sendo arrastado; `null` = mover a imagem inteira. */
type Corner = 'nw' | 'ne' | 'sw' | 'se'
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

/** Alça de redimensionar: 36 px na tela em qualquer zoom (ver `--inv-zoom`). */
const HANDLE_SIZE = 'calc(36px * var(--inv-zoom, 1))'
const HANDLE_OFFSET = 'calc(-18px * var(--inv-zoom, 1))'

/**
 * Redimensiona pela alça de um canto, com a proporção travada e o canto
 * OPOSTO parado — é o que o dedo espera ao puxar qualquer um dos quatro.
 * `dx` é o deslocamento horizontal em quadrados; a altura segue a proporção.
 */
function resizeFrom(s: ImageRect, corner: Corner, dx: number): ImageRect {
    const east = corner[1] === 'e'
    const south = corner[0] === 's'
    const w = Math.max(1, s.w + (east ? dx : -dx))
    const h = w * (s.h / s.w)
    return {
        w,
        h,
        x: east ? s.x : s.x + s.w - w,
        y: south ? s.y : s.y + s.h - h,
    }
}

/**
 * Onde o grid é desenhado. Com o mapa já dimensionado, só sobre a imagem —
 * a área vazia em volta não serve a ninguém. Na camada do mapa volta a área
 * inteira: é ela que mostra até onde a imagem pode crescer.
 *
 * A folga de ¼ de quadrado evita que uma imagem 0,05 quadrado fora do lugar
 * ganhe uma coluna inteira de grid sobrando.
 */
function visibleGrid(rect: ImageRect | null, editing: boolean, cols: number, rows: number) {
    if (!rect || editing) return { x: 0, y: 0, cols, rows }
    const x = Math.floor(rect.x + 0.25)
    const y = Math.floor(rect.y + 0.25)
    return {
        x,
        y,
        cols: Math.max(1, Math.ceil(rect.x + rect.w - 0.25) - x),
        rows: Math.max(1, Math.ceil(rect.y + rect.h - 0.25) - y),
    }
}

/** Posição do token, em px do mundo — `left/top`, como o `Token` desenha (ver lá o porquê). */
function placeToken(el: HTMLElement, left: number, top: number) {
    el.style.left = `${left}px`
    el.style.top = `${top}px`
}

/** Arrasto menor que isto é toque (abre o token), não movimento. */
const TAP_SLOP_PX = 6

/**
 * O mapa: grid, imagem, tokens e régua num único "mundo" com uma só
 * transformação CSS.
 *
 * Desempenho é o requisito que molda o componente inteiro:
 * - pan, zoom e pinça escrevem a `transform` direto no DOM, dentro de um
 *   `requestAnimationFrame`. O React não renderiza nada durante o gesto — o
 *   zoom só vira estado (para o rótulo "80%") quando o gesto acaba;
 * - arrastar um token move o elemento dele pelo DOM e só no soltar vira escrita;
 * - o grid é UM `<svg>` com `<pattern>`, não um elemento por quadrado;
 * - `will-change: transform` só durante o gesto: deixado ligado, o navegador
 *   congela a rasterização na escala inicial e o mapa fica borrado ao aproximar.
 */
export const MapCanvas = memo(function MapCanvas({
    data, tool, views, onMove, onImageRect, onTokenTap, onZoomChange, apiRef,
}: Props) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const worldRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<SVGSVGElement>(null)
    const imageRef = useRef<HTMLDivElement>(null)
    const pathRef = useRef<SVGLineElement>(null)
    const ghostRef = useRef<SVGRectElement>(null)
    const labelRef = useRef<HTMLDivElement>(null)

    const tf = useRef<Transform>({ x: 0, y: 0, z: 1 })
    const frame = useRef<number | null>(null)
    const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pointers = useRef(new Map<number, { x: number; y: number }>())
    const gesture = useRef<Gesture | null>(null)
    /** Ponta da linha da régua/arrasto, em px do mundo — para reposicionar o rótulo no zoom. */
    const labelAt = useRef<{ wx: number; wy: number } | null>(null)

    // Os handlers leem o estado mais recente por refs: recriá-los a cada poll
    // não muda nada e só faria o React trocar listeners.
    const dataRef = useRef(data)
    dataRef.current = data
    const toolRef = useRef(tool)
    toolRef.current = tool
    const cb = useRef({ onMove, onImageRect, onTokenTap, onZoomChange })
    cb.current = { onMove, onImageRect, onTokenTap, onZoomChange }

    const rect = data.meta.imageRect
    const cells = useMemo(
        () => Object.entries(data.pos).map(([id, p]) => ({ ...p, size: data.tokens[id]?.size ?? 1 })),
        [data.pos, data.tokens],
    )
    const { cols, rows } = gridBounds(rect, cells)
    const grid = visibleGrid(rect, tool === 'image', cols, rows)

    // --- Transformação ------------------------------------------------------

    const placeLabel = useCallback(() => {
        const label = labelRef.current
        const at = labelAt.current
        if (!label) return
        if (!at) { label.style.display = 'none'; return }
        const t = tf.current
        label.style.display = 'block'
        label.style.transform = `translate(${at.wx * t.z + t.x + 14}px, ${at.wy * t.z + t.y - 34}px)`
    }, [])

    const apply = useCallback(() => {
        frame.current = null
        const t = tf.current
        const world = worldRef.current
        if (!world) return
        world.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.z})`
        // Alças e contornos de edição usam o inverso do zoom para ter sempre o
        // mesmo tamanho na TELA: a 40% uma alça de 28 px virava um alvo de 11 px.
        world.style.setProperty('--inv-zoom', String(1 / t.z))
        // Afastado, o grid vira ruído e some — menos na camada do mapa, onde ele
        // é justamente a régua para alinhar a imagem.
        const hideGrid = t.z < GRID_MIN_ZOOM && toolRef.current !== 'image'
        if (gridRef.current) gridRef.current.style.display = hideGrid ? 'none' : 'block'
        placeLabel()
    }, [placeLabel])

    const schedule = useCallback(() => {
        const world = worldRef.current
        if (world) world.style.willChange = 'transform'
        if (frame.current === null) frame.current = requestAnimationFrame(apply)
        if (settle.current) clearTimeout(settle.current)
        settle.current = setTimeout(() => {
            if (worldRef.current) worldRef.current.style.willChange = 'auto'
            cb.current.onZoomChange(tf.current.z)
        }, 180)
    }, [apply])

    /** Zoom mantendo fixo o ponto da tela (sx, sy) — o cursor ou o meio da pinça. */
    const zoomAt = useCallback((z: number, sx: number, sy: number) => {
        const t = tf.current
        const next = clamp(z, MIN_ZOOM, MAX_ZOOM)
        const wx = (sx - t.x) / t.z
        const wy = (sy - t.y) / t.z
        tf.current = { z: next, x: sx - wx * next, y: sy - wy * next }
        schedule()
    }, [schedule])

    /** @param fill fração da tela que o enquadramento ocupa (sobra margem em volta). */
    const fit = useCallback((fill = 0.95) => {
        const vp = viewportRef.current
        if (!vp) return
        const d = dataRef.current
        const r = d.meta.imageRect
        // Enquadra a imagem; sem imagem, os tokens; sem nada, o canto do grid.
        let box = r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null
        if (!box) {
            const ps = Object.entries(d.pos)
            if (ps.length > 0) {
                const xs = ps.map(([, p]) => p.x)
                const ys = ps.map(([, p]) => p.y)
                const x = Math.min(...xs) - 2
                const y = Math.min(...ys) - 2
                box = { x, y, w: Math.max(...xs) + 4 - x, h: Math.max(...ys) + 4 - y }
            } else {
                box = { x: 0, y: 0, w: 16, h: 12 }
            }
        }
        const w = box.w * CELL_PX
        const h = box.h * CELL_PX
        const z = clamp(Math.min(vp.clientWidth / w, vp.clientHeight / h) * fill, MIN_ZOOM, MAX_ZOOM)
        tf.current = {
            z,
            x: (vp.clientWidth - w * z) / 2 - box.x * CELL_PX * z,
            y: (vp.clientHeight - h * z) / 2 - box.y * CELL_PX * z,
        }
        schedule()
    }, [schedule])

    useImperativeHandle(apiRef, () => ({
        zoomBy: (factor) => {
            const vp = viewportRef.current
            if (!vp) return
            zoomAt(tf.current.z * factor, vp.clientWidth / 2, vp.clientHeight / 2)
        },
        fit: () => fit(),
    }), [zoomAt, fit])

    // Enquadra ao abrir cada mapa (não a cada poll).
    useLayoutEffect(() => { fit() }, [data.id, fit])

    // Roda do mouse. Listener nativo porque o do React é passivo e não deixa
    // impedir a rolagem da página.
    useEffect(() => {
        const vp = viewportRef.current
        if (!vp) return
        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            const box = vp.getBoundingClientRect()
            // Trackpad em pinça manda ctrlKey com deltas pequenos: mais sensível.
            const k = e.ctrlKey ? 0.01 : 0.0015
            zoomAt(tf.current.z * Math.exp(-e.deltaY * k), e.clientX - box.left, e.clientY - box.top)
        }
        vp.addEventListener('wheel', onWheel, { passive: false })
        return () => vp.removeEventListener('wheel', onWheel)
    }, [zoomAt])

    // Zera os refs junto: no StrictMode o efeito desmonta e remonta, e um
    // `frame` cancelado mas não zerado faria `schedule` nunca mais pedir quadro.
    useEffect(() => () => {
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        if (settle.current) clearTimeout(settle.current)
        frame.current = null
        settle.current = null
    }, [])

    // --- Overlay (régua e arrasto) ----------------------------------------------

    const center = (c: Cell, size = 1) => ({
        x: (c.x + size / 2) * CELL_PX,
        y: (c.y + size / 2) * CELL_PX,
    })

    const drawLine = (from: Cell, to: Cell, size: number) => {
        const a = center(from, size)
        const b = center(to, size)
        const line = pathRef.current
        if (line) {
            line.setAttribute('x1', String(a.x))
            line.setAttribute('y1', String(a.y))
            line.setAttribute('x2', String(b.x))
            line.setAttribute('y2', String(b.y))
            line.style.display = 'block'
        }
        if (labelRef.current) labelRef.current.textContent = formatDistance(squaresBetween(from, to))
        labelAt.current = { wx: b.x, wy: b.y }
        placeLabel()
    }

    const drawGhost = (cell: Cell | null, size: number) => {
        const g = ghostRef.current
        if (!g) return
        if (!cell) { g.style.display = 'none'; return }
        g.setAttribute('x', String(cell.x * CELL_PX))
        g.setAttribute('y', String(cell.y * CELL_PX))
        g.setAttribute('width', String(size * CELL_PX))
        g.setAttribute('height', String(size * CELL_PX))
        g.style.display = 'block'
    }

    const clearOverlay = () => {
        if (pathRef.current) pathRef.current.style.display = 'none'
        drawGhost(null, 1)
        labelAt.current = null
        placeLabel()
    }

    // --- Ponteiros ------------------------------------------------------------

    const local = (e: React.PointerEvent) => {
        const box = viewportRef.current!.getBoundingClientRect()
        return { x: e.clientX - box.left, y: e.clientY - box.top }
    }
    const toWorld = (p: { x: number; y: number }) => {
        const t = tf.current
        return { x: (p.x - t.x) / t.z, y: (p.y - t.y) / t.z }
    }

    const startPinch = () => {
        const [a, b] = [...pointers.current.values()]
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const w = toWorld(mid)
        // Pinça no meio de um arrasto: o token volta para onde estava.
        const g = gesture.current
        if (g?.kind === 'token') {
            placeToken(g.el, g.from.x * CELL_PX, g.from.y * CELL_PX)
            clearOverlay()
        }
        gesture.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: tf.current.z, wx: w.x, wy: w.y }
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return
        const vp = viewportRef.current!
        vp.setPointerCapture(e.pointerId)
        const p = local(e)
        pointers.current.set(e.pointerId, p)

        if (pointers.current.size === 2) { startPinch(); return }
        if (pointers.current.size > 2) return

        const target = e.target as HTMLElement
        const w = toWorld(p)
        const current = toolRef.current
        const d = dataRef.current

        if (current === 'ruler') {
            clearOverlay()
            gesture.current = { kind: 'ruler', from: cellAt(w.x, w.y) }
            return
        }

        if (current === 'image' && d.meta.imageRect && target.closest('[data-map-image]')) {
            const r = d.meta.imageRect
            const handle = target.closest<HTMLElement>('[data-image-handle]')?.dataset.imageHandle as Corner | undefined
            gesture.current = { kind: 'image', corner: handle ?? null, sx: w.x, sy: w.y, start: r, rect: r }
            return
        }

        const tokenEl = current === 'select' ? target.closest<HTMLElement>('[data-token-id]') : null
        const id = tokenEl?.dataset.tokenId
        const pos = id ? d.pos[id] : undefined
        if (tokenEl && id && pos) {
            const size = d.tokens[id]?.size ?? 1
            clearOverlay()
            gesture.current = {
                kind: 'token', id, el: tokenEl, size, from: pos, to: pos,
                ox: w.x - pos.x * CELL_PX, oy: w.y - pos.y * CELL_PX,
                sx: p.x, sy: p.y, moved: false,
            }
            return
        }

        gesture.current = { kind: 'pan', sx: p.x, sy: p.y, tx: tf.current.x, ty: tf.current.y }
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(e.pointerId)) return
        const p = local(e)
        pointers.current.set(e.pointerId, p)
        const g = gesture.current
        if (!g) return

        if (g.kind === 'pinch') {
            const [a, b] = [...pointers.current.values()]
            if (!a || !b) return
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
            const z = clamp(g.z0 * (Math.hypot(a.x - b.x, a.y - b.y) / g.d0), MIN_ZOOM, MAX_ZOOM)
            // O ponto do mundo que estava entre os dedos continua entre eles.
            tf.current = { z, x: mid.x - g.wx * z, y: mid.y - g.wy * z }
            schedule()
            return
        }

        if (g.kind === 'pan') {
            tf.current = { ...tf.current, x: g.tx + p.x - g.sx, y: g.ty + p.y - g.sy }
            schedule()
            return
        }

        const w = toWorld(p)

        if (g.kind === 'ruler') {
            drawLine(g.from, cellAt(w.x, w.y), 1)
            return
        }

        if (g.kind === 'token') {
            if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) < TAP_SLOP_PX) return
            g.moved = true
            const left = w.x - g.ox
            const top = w.y - g.oy
            placeToken(g.el, left, top)
            g.el.style.zIndex = '5'
            const snapped = snapToken(left + (g.size * CELL_PX) / 2, top + (g.size * CELL_PX) / 2, g.size)
            g.to = { x: Math.max(0, snapped.x), y: Math.max(0, snapped.y) }
            drawGhost(g.to, g.size)
            drawLine(g.from, g.to, g.size)
            return
        }

        if (g.kind === 'image') {
            const dx = (w.x - g.sx) / CELL_PX
            const dy = (w.y - g.sy) / CELL_PX
            g.rect = g.corner ? resizeFrom(g.start, g.corner, dx) : { ...g.start, x: g.start.x + dx, y: g.start.y + dy }
            const el = imageRef.current
            if (el) {
                el.style.transform = `translate(${g.rect.x * CELL_PX}px, ${g.rect.y * CELL_PX}px)`
                el.style.width = `${g.rect.w * CELL_PX}px`
                el.style.height = `${g.rect.h * CELL_PX}px`
            }
        }
    }

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.delete(e.pointerId)) return
        const g = gesture.current

        // Saiu um dedo da pinça: o que sobrou vira pan, sem pulo.
        if (g?.kind === 'pinch') {
            const rest = [...pointers.current.values()][0]
            gesture.current = rest ? { kind: 'pan', sx: rest.x, sy: rest.y, tx: tf.current.x, ty: tf.current.y } : null
            return
        }
        if (pointers.current.size > 0) return
        gesture.current = null
        if (!g) return

        if (g.kind === 'token') {
            g.el.style.zIndex = ''
            if (!g.moved) {
                cb.current.onTokenTap(g.id, g.el)
                return
            }
            clearOverlay()
            // Fixa no quadrado já: se o token cair no MESMO quadrado, o React
            // não tem o que mudar e o elemento ficaria onde o dedo soltou.
            placeToken(g.el, g.to.x * CELL_PX, g.to.y * CELL_PX)
            if (g.to.x !== g.from.x || g.to.y !== g.from.y) cb.current.onMove(g.id, g.to)
            return
        }

        if (g.kind === 'image' && g.rect !== g.start) {
            cb.current.onImageRect(g.rect)
        }
        // A régua fica na tela depois de soltar: no celular é o único jeito de
        // ler o número. Some no próximo toque.
    }

    // Trocar de ferramenta apaga a régua que ficou. Entrar na camada do mapa
    // reenquadra com folga: com a imagem ocupando a tela toda, as alças de
    // baixo caíam sob o painel e os botões de zoom.
    useEffect(() => {
        clearOverlay()
        if (tool === 'image' && dataRef.current.meta.imageRect) fit(0.6)
        else schedule()
    }, [tool]) // eslint-disable-line react-hooks/exhaustive-deps

    const imageUrl = useImageUrl(data.meta.image?.url)
    const editingImage = tool === 'image'

    return (
        <div
            ref={viewportRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                background: MAP_BACKDROP,
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                cursor: tool === 'ruler' ? 'crosshair' : 'default',
            }}
        >
            <div
                ref={worldRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: cols * CELL_PX,
                    height: rows * CELL_PX,
                    transformOrigin: '0 0',
                }}
            >
                {rect && (
                    <div
                        ref={imageRef}
                        data-map-image
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: rect.w * CELL_PX,
                            height: rect.h * CELL_PX,
                            transform: `translate(${rect.x * CELL_PX}px, ${rect.y * CELL_PX}px)`,
                            outline: editingImage ? `calc(2px * var(--inv-zoom, 1)) dashed ${gold.bright}` : 'none',
                            cursor: editingImage ? 'move' : 'inherit',
                        }}
                    >
                        {imageUrl && (
                            <img
                                src={imageUrl}
                                alt=""
                                draggable={false}
                                decoding="async"
                                style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
                            />
                        )}
                        {editingImage && CORNERS.map((corner) => (
                            <div
                                key={corner}
                                data-image-handle={corner}
                                style={{
                                    position: 'absolute',
                                    [corner[0] === 'n' ? 'top' : 'bottom']: HANDLE_OFFSET,
                                    [corner[1] === 'w' ? 'left' : 'right']: HANDLE_OFFSET,
                                    width: HANDLE_SIZE,
                                    height: HANDLE_SIZE,
                                    borderRadius: '50%',
                                    background: gold.bright,
                                    border: `calc(3px * var(--inv-zoom, 1)) solid ${mapChrome.outline}`,
                                    boxSizing: 'border-box',
                                    cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                                }}
                            />
                        ))}
                    </div>
                )}

                <svg
                    ref={gridRef}
                    width={grid.cols * CELL_PX}
                    height={grid.rows * CELL_PX}
                    style={{
                        position: 'absolute',
                        left: grid.x * CELL_PX,
                        top: grid.y * CELL_PX,
                        pointerEvents: 'none',
                    }}
                >
                    <defs>
                        <pattern id="pf2e-grid" width={CELL_PX} height={CELL_PX} patternUnits="userSpaceOnUse">
                            <path
                                d={`M ${CELL_PX} 0 L 0 0 0 ${CELL_PX}`}
                                fill="none"
                                stroke={mapChrome.grid}
                                strokeOpacity={0.35}
                                strokeWidth={1}
                            />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#pf2e-grid)" />
                    <rect
                        width="100%"
                        height="100%"
                        fill="none"
                        stroke={mapChrome.grid}
                        strokeOpacity={0.5}
                        strokeWidth={2}
                    />
                </svg>

                {Object.entries(data.tokens).map(([id, token]) => {
                    const pos = data.pos[id]
                    if (!pos) return null
                    const view = views.get(id)
                    return (
                        <Token
                            key={id}
                            id={id}
                            token={token}
                            x={pos.x}
                            y={pos.y}
                            hp={view?.hp ?? null}
                            showNumbers={view?.showNumbers ?? false}
                            image={view?.image ?? null}
                            active={data.turn === id}
                        />
                    )
                })}

                <svg
                    width={cols * CELL_PX}
                    height={rows * CELL_PX}
                    style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
                >
                    <rect
                        ref={ghostRef}
                        fill={`${gold.bright}33`}
                        stroke={gold.bright}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        vectorEffect="non-scaling-stroke"
                        style={{ display: 'none' }}
                    />
                    <line
                        ref={pathRef}
                        stroke={gold.bright}
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeDasharray="10 6"
                        vectorEffect="non-scaling-stroke"
                        style={{ display: 'none' }}
                    />
                </svg>
            </div>

            {/* Fora do mundo: o número tem o mesmo tamanho em qualquer zoom. */}
            <div
                ref={labelRef}
                aria-live="polite"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    display: 'none',
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: mapChrome.label,
                    color: mapChrome.text,
                    border: `1px solid ${gold.bright}`,
                    fontWeight: 700,
                    fontSize: 15,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                }}
            />
        </div>
    )
})
