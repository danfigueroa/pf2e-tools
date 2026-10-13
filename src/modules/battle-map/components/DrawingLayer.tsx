import { memo, useMemo } from 'react'
import { pathOf, sanitizeDrawing } from '../drawing'
import { areaSquares, cellsPath, sanitizeArea } from '../areas'
import { CELL_PX, type Cell } from '../geometry'
import { mapChrome, status } from '../../../theme'

/** Espaço de um token no grid — a origem de uma emanação. */
export type TokenSpace = Cell & { size: number }

interface Props {
    drawings: Record<string, unknown>
    /** Onde cada token está AGORA: a emanação anda com o token dela. */
    spaces: Map<string, TokenSpace>
    /** No modo Apagar cada desenho recebe toque; fora dele, o ponteiro atravessa. */
    erasing: boolean
    width: number
    height: number
}

/**
 * Tamanhos do modo Apagar, em px de TELA: multiplicados por `--inv-zoom` (que o
 * `MapCanvas` escreve no mundo), não encolhem com o zoom. Presos à escala do
 * mundo, o traço fino virava um alvo de 3 px — e o "apagar um" parecia não
 * existir.
 */
const HIT_EXTRA = 'calc(28px * var(--inv-zoom, 1))'
/** Raio do "×", em px de tela (o grupo dele desfaz o zoom). */
const BADGE_R = 15

/** O "×" do modo Apagar, no ponto (px do mundo) e com tamanho fixo na tela. */
function EraseBadge({ x, y }: { x: number; y: number }) {
    return (
        <g style={{ transform: `translate(${x}px, ${y}px) scale(var(--inv-zoom, 1))` }}>
            <g
                className="pf2e-drawing-badge"
                role="button"
                aria-label="Apagar este desenho"
                style={{ pointerEvents: 'all', transition: 'transform 120ms' }}
            >
                <circle r={BADGE_R} fill={status.error} stroke={mapChrome.text} strokeWidth={2} />
                <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={mapChrome.text}
                    style={{ fontSize: 20, fontWeight: 700, userSelect: 'none' }}
                >
                    ×
                </text>
            </g>
        </g>
    )
}

type Item =
    | { id: string; kind: 'stroke'; path: string; color: string; width: number; badge: [number, number] }
    | { id: string; kind: 'area'; path: string; color: string; badge: [number, number] }

/**
 * Desenhos e áreas de efeito, entre o grid e os tokens: o efeito fica SOBRE o
 * mapa e SOB as criaturas, como uma parede de fogo de verdade.
 *
 * Memoizado à parte do `MapCanvas`. A emanação depende de onde o token dela
 * está, então `spaces` entra nas dependências — mas só a área recalcula, e
 * uma área é um `<path>` só, por mais quadrados que pegue.
 *
 * No modo Apagar, cada um ganha um "×". Tocar no traço/área também apaga, mas
 * o botão é o que se ENXERGA: sem ele, ninguém descobria que dava para apagar
 * um só.
 */
function useMarks(drawings: Record<string, unknown>, spaces: Map<string, TokenSpace>): Item[] {
    return useMemo(() => Object.entries(drawings).flatMap(([id, raw]): Item[] => {
        const area = sanitizeArea(raw)
        if (area) {
            const space = area.tokenId ? spaces.get(area.tokenId) : undefined
            const cells = areaSquares(area, space)
            if (cells.length === 0) return []
            const badge: [number, number] = space
                ? [(space.x + space.size / 2) * CELL_PX, (space.y + space.size / 2) * CELL_PX]
                : [area.x * CELL_PX, area.y * CELL_PX]
            return [{ id, kind: 'area', path: cellsPath(cells, CELL_PX), color: area.color, badge }]
        }
        const d = sanitizeDrawing(raw)
        if (!d) return []
        return [{
            id,
            kind: 'stroke',
            path: pathOf(d.points),
            color: d.color,
            width: d.width * CELL_PX,
            badge: [d.points[0] * CELL_PX, d.points[1] * CELL_PX],
        }]
    }), [drawings, spaces])
}

export const DrawingLayer = memo(function DrawingLayer({ drawings, spaces, erasing, width, height }: Props) {
    const items = useMarks(drawings, spaces)

    return (
        <svg
            width={width}
            height={height}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
            {erasing && (
                <style>{`
                    .pf2e-drawing:hover .pf2e-drawing-stroke { stroke-opacity: 0.95; }
                    .pf2e-drawing:hover .pf2e-drawing-area { fill-opacity: 0.5; }
                `}</style>
            )}
            {items.map((item) => (
                <g
                    key={item.id}
                    className="pf2e-drawing"
                    data-drawing-id={item.id}
                    style={{ cursor: erasing ? 'pointer' : 'inherit' }}
                >
                    {item.kind === 'area' ? (
                        <path
                            className="pf2e-drawing-area"
                            d={item.path}
                            fill={item.color}
                            fillOpacity={0.3}
                            stroke={item.color}
                            strokeOpacity={0.8}
                            strokeWidth={1.5}
                            vectorEffect="non-scaling-stroke"
                            // A área inteira é alvo do apagar (não só a borda).
                            style={erasing ? { pointerEvents: 'all' } : undefined}
                        />
                    ) : (
                        <>
                            <path
                                className="pf2e-drawing-stroke"
                                d={item.path}
                                fill="none"
                                stroke={item.color}
                                strokeOpacity={0.6}
                                strokeWidth={item.width}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {erasing && (
                                <path
                                    d={item.path}
                                    fill="none"
                                    stroke="transparent"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                        pointerEvents: 'stroke',
                                        strokeWidth: `calc(${item.width}px + ${HIT_EXTRA})`,
                                    }}
                                />
                            )}
                        </>
                    )}
                </g>
            ))}
        </svg>
    )
})

/**
 * Os "×" do modo Apagar, numa camada ACIMA dos tokens: o × de uma explosão
 * cai num cruzamento do grid, e com frequência há um token em cima dele — na
 * camada dos desenhos, o clique ia para o token e nada era apagado.
 */
export const EraseBadgeLayer = memo(function EraseBadgeLayer({ drawings, spaces, width, height }: Omit<Props, 'erasing'>) {
    const items = useMarks(drawings, spaces)
    return (
        <svg
            width={width}
            height={height}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
            <style>{'.pf2e-erase:hover .pf2e-drawing-badge { transform: scale(1.15); }'}</style>
            {items.map((item) => (
                <g key={item.id} className="pf2e-erase" data-drawing-id={item.id} style={{ cursor: 'pointer' }}>
                    <EraseBadge x={item.badge[0]} y={item.badge[1]} />
                </g>
            ))}
        </svg>
    )
})
