import { memo, useMemo } from 'react'
import { pathOf, sanitizeDrawing } from '../drawing'
import { CELL_PX } from '../geometry'

interface Props {
    drawings: Record<string, unknown>
    /** No modo Apagar cada desenho recebe toque; fora dele, o ponteiro atravessa. */
    erasing: boolean
    width: number
    height: number
}

/** Folga do alvo de toque do apagar, além da espessura do traço (px do mundo). */
const HIT_PADDING = 24

/**
 * Os desenhos, entre o grid e os tokens: o efeito fica SOBRE o mapa e SOB as
 * criaturas, como uma parede de fogo de verdade.
 *
 * Memoizado à parte do `MapCanvas`: mover um token não redesenha os traços.
 * Transparência no `<g>` e não em cada traço, para dois traços da mesma cor
 * que se cruzam não escurecerem no cruzamento.
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
            {list.map(({ id, d, path }) => (
                <g key={id} data-drawing-id={id} style={{ cursor: erasing ? 'pointer' : 'inherit' }}>
                    <path
                        d={path}
                        fill="none"
                        stroke={d.color}
                        strokeOpacity={0.6}
                        strokeWidth={d.width * CELL_PX}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {erasing && (
                        <path
                            d={path}
                            fill="none"
                            stroke="transparent"
                            strokeWidth={d.width * CELL_PX + HIT_PADDING}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ pointerEvents: 'stroke' }}
                        />
                    )}
                </g>
            ))}
        </svg>
    )
})
