// Desenhos sobre o mapa: Wall of Fire, área de uma magia, uma marca qualquer.
//
// Cada desenho é um campo próprio do hash do mapa (`drw:<id>`), como a posição
// de cada token: apagar um nunca toca nos outros, e duas pessoas desenhando ao
// mesmo tempo não se sobrescrevem. Os pontos ficam em QUADRADOS, como todo o
// resto do mundo, para o desenho acompanhar o grid em qualquer zoom.

import { CELL_PX } from './geometry'
import { DRAW_COLORS } from '../../theme'

export type DrawMode = 'free' | 'line' | 'erase'

export interface Drawing {
    /** Pontos em quadrados, achatados: [x0, y0, x1, y1, …]. */
    points: number[]
    color: string
    /** Espessura em quadrados. */
    width: number
}

export interface DrawStyle { mode: DrawMode; color: string; width: number }

/** Espessuras oferecidas, em quadrados: traço, faixa, parede grossa. */
export const DRAW_WIDTHS = [0.08, 0.2, 0.5] as const

/**
 * Teto de pontos por desenho. O campo tem 8 KB no servidor; com duas casas
 * decimais cada ponto custa uns 12 bytes no JSON, então 500 sobra folga.
 */
const MAX_POINTS = 500

/** Tolerância da simplificação, em quadrados: abaixo disso o olho não vê diferença. */
const SIMPLIFY_EPSILON = 0.04

/**
 * Ramer–Douglas–Peucker: um traço à mão chega com um ponto por evento de
 * ponteiro (centenas); a maioria está em linha reta com os vizinhos. Sem isto
 * o desenho estouraria o campo e cada aparelho baixaria pontos inúteis.
 */
function simplify(pts: Array<[number, number]>, eps: number): Array<[number, number]> {
    if (pts.length < 3) return pts
    const [ax, ay] = pts[0]
    const [bx, by] = pts[pts.length - 1]
    const len = Math.hypot(bx - ax, by - ay) || 1
    let max = 0
    let at = 0
    for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i]
        const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len
        if (d > max) { max = d; at = i }
    }
    if (max <= eps) return [pts[0], pts[pts.length - 1]]
    const left = simplify(pts.slice(0, at + 1), eps)
    const right = simplify(pts.slice(at), eps)
    return [...left.slice(0, -1), ...right]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Pontos do traço (px do mundo) → desenho pronto para gravar. `null` quando
 * não sobrou traço (um toque sem arrastar).
 */
export function finishStroke(worldPts: Array<[number, number]>, color: string, width: number): Drawing | null {
    if (worldPts.length < 2) return null
    const squares = worldPts.map(([x, y]) => [x / CELL_PX, y / CELL_PX] as [number, number])
    let eps = SIMPLIFY_EPSILON
    let pts = simplify(squares, eps)
    // Traço longuíssimo: afrouxa até caber, em vez de cortar o desenho.
    while (pts.length > MAX_POINTS) {
        eps *= 2
        pts = simplify(squares, eps)
    }
    const flat = pts.flatMap(([x, y]) => [round2(x), round2(y)])
    if (flat.length === 4 && flat[0] === flat[2] && flat[1] === flat[3]) return null
    return { points: flat, color, width }
}

/** Ponta da linha reta: encaixa nos cantos E nos centros dos quadrados (passo de ½). */
export function snapHalf(worldX: number, worldY: number): [number, number] {
    return [
        (Math.round((worldX / CELL_PX) * 2) / 2) * CELL_PX,
        (Math.round((worldY / CELL_PX) * 2) / 2) * CELL_PX,
    ]
}

/** `d` do `<path>` em px do mundo. */
export function pathOf(points: number[]): string {
    let d = ''
    for (let i = 0; i < points.length; i += 2) {
        d += `${i === 0 ? 'M' : 'L'}${round2(points[i] * CELL_PX)} ${round2(points[i + 1] * CELL_PX)}`
    }
    return d
}

/** O que veio do servidor, validado — um campo malformado não derruba o mapa. */
export function sanitizeDrawing(raw: unknown): Drawing | null {
    if (!raw || typeof raw !== 'object') return null
    const d = raw as Partial<Drawing>
    if (!Array.isArray(d.points) || d.points.length < 4) return null
    if (!d.points.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
    return {
        points: d.points,
        color: typeof d.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.color) ? d.color : DRAW_COLORS[0].hex,
        width: typeof d.width === 'number' && d.width > 0 && d.width <= 2 ? d.width : DRAW_WIDTHS[1],
    }
}

export const newDrawingId = () => crypto.randomUUID()
