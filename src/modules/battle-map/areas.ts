// Áreas de efeito do PF2e no grid: explosão, emanação, cone e linha.
//
// A conta de distância é a mesma da régua e do movimento — diagonais
// alternadas, 5-10-5 (Player Core) —, contada como se a criatura andasse até o
// quadrado: o próprio quadrado conta. É o que faz uma explosão de 15 pés sair
// com o "círculo" 2-4-6-6-4-2 dos moldes do livro, e não um quadrado.

import type { Cell } from './geometry'
import { FEET_PER_SQUARE } from './geometry'

export type AreaShape = 'burst' | 'emanation' | 'cone' | 'line'

export interface Area {
    type: 'area'
    shape: AreaShape
    /** Origem em quadrados: cruzamento do grid (explosão, cone) ou ponto de ½ em ½ (linha). */
    x: number
    y: number
    /** Direção em graus (0 = leste, 90 = sul), só cone e linha. */
    angle: number
    feet: number
    color: string
    /** Emanação: o token de onde ela sai — a área ACOMPANHA o token quando ele anda. */
    tokenId?: string
}

export const AREA_LABELS: Record<AreaShape, string> = {
    burst: 'Explosão',
    emanation: 'Emanação',
    cone: 'Cone',
    line: 'Linha',
}

/** Distância PF2e para um deslocamento de (dx, dy) quadrados: o maior, mais metade do menor. */
const pf2e = (dx: number, dy: number) => Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2)

/**
 * Quantos quadrados até o quadrado `q`, saindo do cruzamento `o` — contando o
 * próprio quadrado (o primeiro passo já é 1).
 */
const fromCorner = (q: number, o: number) => (q >= o ? q - o + 1 : o - q)

/** Quantos quadrados até `q` saindo de um espaço [start, start + size) — 0 dentro dele. */
const fromSpace = (q: number, start: number, size: number) =>
    q < start ? start - q : q >= start + size ? q - (start + size) + 1 : 0

const EPS = 1e-6

/** Menor ângulo entre duas direções (0..π). `atan2` devolve -π..π; a direção vem em 0..2π. */
function angleBetween(a: number, b: number): number {
    const d = Math.abs(a - b) % (2 * Math.PI)
    return d > Math.PI ? 2 * Math.PI - d : d
}

/**
 * Os quadrados atingidos. `space` é o espaço do token de onde sai uma
 * emanação (posição e tamanho ATUAIS) — sem ele a emanação não tem origem.
 */
export function areaSquares(area: Area, space?: Cell & { size: number }): Cell[] {
    const reach = Math.floor(area.feet / FEET_PER_SQUARE)
    if (reach <= 0) return []
    const out: Cell[] = []

    if (area.shape === 'emanation') {
        if (!space) return []
        for (let y = space.y - reach; y < space.y + space.size + reach; y++) {
            for (let x = space.x - reach; x < space.x + space.size + reach; x++) {
                const d = pf2e(fromSpace(x, space.x, space.size), fromSpace(y, space.y, space.size))
                if (d <= reach) out.push({ x, y })
            }
        }
        return out
    }

    if (area.shape === 'line') {
        // Linha de 5 pés de largura: o centro do quadrado a até ½ quadrado do
        // segmento. No empate exato (linha correndo SOBRE uma linha do grid)
        // fica só um dos lados — senão a linha teria 10 pés de largura.
        const rad = (area.angle * Math.PI) / 180
        const ux = Math.cos(rad)
        const uy = Math.sin(rad)
        const lo = (v: number) => Math.floor(v - reach - 1)
        const hi = (v: number) => Math.ceil(v + reach + 1)
        for (let y = lo(area.y); y <= hi(area.y); y++) {
            for (let x = lo(area.x); x <= hi(area.x); x++) {
                const cx = x + 0.5 - area.x
                const cy = y + 0.5 - area.y
                const along = cx * ux + cy * uy
                const across = ux * cy - uy * cx
                if (along > 0 && along <= reach + EPS && across > -0.5 + EPS && across <= 0.5 + EPS) {
                    out.push({ x, y })
                }
            }
        }
        return out
    }

    // Explosão e cone saem de um cruzamento do grid.
    const ox = Math.round(area.x)
    const oy = Math.round(area.y)
    const rad = (area.angle * Math.PI) / 180
    for (let y = oy - reach; y < oy + reach; y++) {
        for (let x = ox - reach; x < ox + reach; x++) {
            if (pf2e(fromCorner(x, ox), fromCorner(y, oy)) > reach) continue
            if (area.shape === 'cone') {
                // Cone de 90°: o centro do quadrado a até 45° da direção.
                const cx = x + 0.5 - ox
                const cy = y + 0.5 - oy
                if (angleBetween(Math.atan2(cy, cx), rad) > Math.PI / 4 + EPS) continue
            }
            out.push({ x, y })
        }
    }
    return out
}

/** Direção encaixada em 45° — o cone do livro sai reto ou na diagonal. */
export const snapAngle45 = (deg: number) => ((Math.round(deg / 45) * 45) % 360 + 360) % 360

/** Tokens com algum quadrado da pegada dentro da área — quem faz a salvaguarda. */
export function tokensIn(cells: Cell[], tokens: Array<Cell & { size: number }>): number {
    const hit = new Set(cells.map((c) => `${c.x},${c.y}`))
    let n = 0
    for (const t of tokens) {
        outer: for (let dy = 0; dy < t.size; dy++) {
            for (let dx = 0; dx < t.size; dx++) {
                if (hit.has(`${t.x + dx},${t.y + dy}`)) { n++; break outer }
            }
        }
    }
    return n
}

/** `d` de um `<path>` com um retângulo por quadrado — um nó só, por mais quadrados que sejam. */
export function cellsPath(cells: Cell[], cellPx: number): string {
    let d = ''
    for (const c of cells) d += `M${c.x * cellPx} ${c.y * cellPx}h${cellPx}v${cellPx}h${-cellPx}z`
    return d
}
