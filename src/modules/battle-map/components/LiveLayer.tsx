import { memo, useMemo } from 'react'
import { CELL_PX, formatDistance, squaresBetween, type Cell } from '../geometry'
import { AREA_LABELS, areaSquares, cellsPath, tokensIn } from '../areas'
import { BAND_COLORS, movementBands, moveLabel } from '../movement'
import type { TokenSpace } from './DrawingLayer'
import { useMapLive, type LivePeer } from '../../../services/mapLive'
import { DRAW_COLORS, mapChrome } from '../../../theme'
import type { MapData } from '../../../services/maps'

/**
 * Cor de quem mede: a régua e o arrasto de cada um numa cor própria, para não
 * se confundirem com os daqui (dourados) nem entre si. A área usa a cor dela.
 */
const PEER_COLORS = ['cold', 'arcane', 'fire', 'electricity', 'acid']
    .map((id) => DRAW_COLORS.find((c) => c.id === id)?.hex ?? DRAW_COLORS[0].hex)

function peerColor(id: string): string {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
    return PEER_COLORS[Math.abs(h) % PEER_COLORS.length]
}

const center = (c: Cell, size: number) => ({ x: (c.x + size / 2) * CELL_PX, y: (c.y + size / 2) * CELL_PX })

interface Props {
    data: MapData
    spaces: Map<string, TokenSpace>
    width: number
    height: number
}

/**
 * O que os OUTROS estão medindo ou arrastando neste mapa (`services/mapLive.ts`):
 * régua, área com a contagem de criaturas e arrasto de token com as faixas de
 * alcance, cada um com o nome de quem faz. Desenhado pelo React, ao contrário
 * do gesto daqui — chega no máximo 10 vezes por segundo por pessoa, e só esta
 * camada repinta.
 */
export const LiveLayer = memo(function LiveLayer({ data, spaces, width, height }: Props) {
    const peers = useMapLive(data.id)
    if (peers.length === 0) return null
    return (
        <>
            {peers.map((peer) => (
                <PeerGesture key={peer.from} peer={peer} data={data} spaces={spaces} width={width} height={height} />
            ))}
        </>
    )
})

interface DrawnGesture {
    label: string
    at: { wx: number; wy: number }
}

function PeerGesture({ peer, data, spaces, width, height }: Props & { peer: LivePeer }) {
    const color = peerColor(peer.from)
    const g = peer.gesture
    const moving = g.kind === 'move' ? g : null
    const token = moving ? data.tokens[moving.tokenId] : undefined
    const size = token?.size ?? 1
    const speed = token?.speed
    // As faixas só mudam quando o arrasto começa de outro lugar.
    const fx = moving?.from.x
    const fy = moving?.from.y
    const bands = useMemo(
        () => (fx !== undefined && fy !== undefined && speed ? movementBands({ x: fx, y: fy }, size, speed) : null),
        [fx, fy, size, speed],
    )

    let shape: React.ReactNode = null
    let drawn: DrawnGesture
    if (g.kind === 'area') {
        const space = g.area.tokenId ? spaces.get(g.area.tokenId) : undefined
        // Emanação de um token que não está neste mapa: não há de onde sair.
        if (g.area.shape === 'emanation' && !space) return null
        const hit = areaSquares(g.area, space)
        const others = [...spaces.entries()].filter(([id]) => id !== g.area.tokenId).map(([, s]) => s)
        const n = tokensIn(hit, others)
        shape = (
            <path
                d={cellsPath(hit, CELL_PX)}
                fill={g.area.color}
                stroke={g.area.color}
                fillOpacity={0.35}
                strokeOpacity={0.9}
                strokeWidth={2}
                strokeDasharray="8 4"
                vectorEffect="non-scaling-stroke"
            />
        )
        drawn = {
            label: `${AREA_LABELS[g.area.shape]} ${g.area.feet} ft · ${n} ${n === 1 ? 'criatura' : 'criaturas'}`,
            at: space
                ? { wx: (space.x + space.size) * CELL_PX, wy: space.y * CELL_PX }
                : { wx: g.area.x * CELL_PX, wy: g.area.y * CELL_PX },
        }
    } else {
        const lineSize = g.kind === 'move' ? size : 1
        const a = center(g.from, lineSize)
        const b = center(g.to, lineSize)
        shape = (
            <>
                {bands?.map((d, i) => (
                    <path
                        key={i}
                        d={d}
                        fill={BAND_COLORS[i]}
                        fillOpacity={0.12}
                        stroke={BAND_COLORS[i]}
                        strokeOpacity={0.3}
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
                {g.kind === 'move' && (
                    <rect
                        x={g.to.x * CELL_PX}
                        y={g.to.y * CELL_PX}
                        width={size * CELL_PX}
                        height={size * CELL_PX}
                        fill={`${color}33`}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
                <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray="10 6"
                    vectorEffect="non-scaling-stroke"
                />
            </>
        )
        drawn = {
            label: g.kind === 'move'
                ? `${token?.name ?? 'Token'} · ${moveLabel(g.from, g.to, speed)}`
                : formatDistance(squaresBetween(g.from, g.to)),
            at: { wx: b.x, wy: b.y },
        }
    }

    return (
        <>
            <svg
                width={width}
                height={height}
                style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
            >
                {shape}
            </svg>
            {/* Dentro do mundo, mas no tamanho da TELA: escala pelo inverso do zoom. */}
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    left: drawn.at.wx,
                    top: drawn.at.wy,
                    transformOrigin: '0 0',
                    transform: 'scale(var(--inv-zoom, 1)) translate(14px, -34px)',
                    padding: '3px 9px',
                    borderRadius: 6,
                    background: mapChrome.label,
                    color: mapChrome.text,
                    border: `2px solid ${g.kind === 'area' ? g.area.color : color}`,
                    fontWeight: 700,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 6,
                }}
            >
                <span style={{ color, marginRight: 6 }}>{peer.name || 'Alguém'}</span>
                {drawn.label}
            </div>
        </>
    )
}
