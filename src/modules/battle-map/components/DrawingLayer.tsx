import { memo, useMemo } from 'react'
import { pathOf, sanitizeDrawing } from '../drawing'
import { CELL_PX } from '../geometry'
import { mapChrome, status } from '../../../theme'

interface Props {
    drawings: Record<string, unknown>
    /** No modo Apagar cada desenho recebe toque; fora dele, o ponteiro atravessa. */
    erasing: boolean
    width: number
    height: number
}

/**
 * Tamanhos do modo Apagar, em px de TELA: multiplicados por `--inv-zoom` (que o
 * `MapCanvas` escreve no mundo), não encolhem com o zoom. Presos à escala do
 * mundo, o traço fino virava um alvo de 3 px no celular — e o "apagar um"
 * parecia não existir.
 */
const HIT_EXTRA = 'calc(28px * var(--inv-zoom, 1))'
/** Raio do "×", em px de tela (o grupo dele desfaz o zoom). */
const BADGE_R = 15

/**
 * Os desenhos, entre o grid e os tokens: o efeito fica SOBRE o mapa e SOB as
 * criaturas, como uma parede de fogo de verdade.
 *
 * Memoizado à parte do `MapCanvas`: mover um token não redesenha os traços.
 *
 * No modo Apagar, cada desenho ganha um "×" no início do traço. Tocar no
 * traço também apaga, mas o botão é o que se ENXERGA: sem ele, ninguém
 * descobria que dava para apagar um só.
 */
export const DrawingLayer = memo(function DrawingLayer({ drawings, erasing, width, height }: Props) {
    const list = useMemo(
        () => Object.entries(drawings).flatMap(([id, raw]) => {
            const d = sanitizeDrawing(raw)
            return d ? [{ id, d, path: pathOf(d.points) }] : []
        }),
        [drawings],
    )

    return (
        <svg
            width={width}
            height={height}
            style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}
        >
            {erasing && (
                <style>{`
                    .pf2e-drawing:hover .pf2e-drawing-stroke { stroke-opacity: 0.95; }
                    .pf2e-drawing:hover .pf2e-drawing-badge { transform: scale(1.15); }
                `}</style>
            )}
            {list.map(({ id, d, path }) => (
                <g
                    key={id}
                    className="pf2e-drawing"
                    data-drawing-id={id}
                    style={{ cursor: erasing ? 'pointer' : 'inherit' }}
                >
                    <path
                        className="pf2e-drawing-stroke"
                        d={path}
                        fill="none"
                        stroke={d.color}
                        strokeOpacity={0.6}
                        strokeWidth={d.width * CELL_PX}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {erasing && (
                        <>
                            <path
                                d={path}
                                fill="none"
                                stroke="transparent"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                    pointerEvents: 'stroke',
                                    strokeWidth: `calc(${d.width * CELL_PX}px + ${HIT_EXTRA})`,
                                }}
                            />
                            {/* Posição no mundo, tamanho na tela: o grupo de fora leva
                                ao ponto e desfaz o zoom; o de dentro só cresce no hover. */}
                            <g
                                style={{
                                    transform: `translate(${d.points[0] * CELL_PX}px, ${d.points[1] * CELL_PX}px) scale(var(--inv-zoom, 1))`,
                                }}
                            >
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
                        </>
                    )}
                </g>
            ))}
        </svg>
    )
})
