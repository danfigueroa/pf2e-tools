// Geometria do mapa de combate. O mundo é medido em QUADRADOS; pixel só
// existe na hora de desenhar (quadrado × CELL_PX), e o zoom é uma escala CSS
// por cima disso.

/** Lado de um quadrado, em px do mundo (antes do zoom). */
export const CELL_PX = 70

/** Player Core: cada quadrado tem 5 pés (1,5 m). */
export const FEET_PER_SQUARE = 5
export const METERS_PER_SQUARE = 1.5

/** 10%: um mapa de 40 quadrados precisa disso para caber inteiro na largura de um celular. */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

/** Abaixo deste zoom o grid vira ruído (e custa pintura): some. */
export const GRID_MIN_ZOOM = 0.35

/** Área mínima do grid quando o mapa ainda não tem imagem. */
export const DEFAULT_COLS = 40
export const DEFAULT_ROWS = 30

export interface Cell { x: number; y: number }

export interface ImageRect { x: number; y: number; w: number; h: number }

/**
 * Distância em quadrados pela regra das diagonais alternadas (Player Core):
 * a 1ª diagonal custa 1 quadrado, a 2ª custa 2, a 3ª 1… — ou seja, 5-10-5 pés.
 */
export function squaresBetween(a: Cell, b: Cell): number {
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)
    const diagonal = Math.min(dx, dy)
    const straight = Math.max(dx, dy) - diagonal
    return straight + diagonal + Math.floor(diagonal / 2)
}

/** "25 ft · 7,5 m" */
export function formatDistance(squares: number): string {
    const feet = squares * FEET_PER_SQUARE
    const meters = (squares * METERS_PER_SQUARE).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    return `${feet} ft · ${meters} m`
}

/**
 * Quantos quadrados a criatura ocupa de lado. Minúsculo ocupa ¼ de quadrado
 * pelas regras, mas um token menor que o quadrado só atrapalha o toque — fica 1.
 */
export function sizeSquares(size: string | null | undefined): number {
    switch ((size ?? '').toLowerCase()) {
        case 'large': return 2
        case 'huge': return 3
        case 'gargantuan': return 4
        default: return 1
    }
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Quadrado sob um ponto do mundo (px). */
export const cellAt = (wx: number, wy: number): Cell => ({
    x: Math.floor(wx / CELL_PX),
    y: Math.floor(wy / CELL_PX),
})

/**
 * Canto superior esquerdo de um token de `size` quadrados cujo CENTRO está em
 * (wx, wy) — o snap de quem arrasta pelo meio do token. Um token 2×2 encaixa
 * nas linhas do grid, não no meio de um quadrado.
 */
export function snapToken(wx: number, wy: number, size: number): Cell {
    return {
        x: Math.round(wx / CELL_PX - size / 2),
        y: Math.round(wy / CELL_PX - size / 2),
    }
}

/**
 * Até onde o grid vai: a imagem, os tokens e uma área mínima. Sempre começa
 * em (0,0) — coordenada negativa não existe no mapa.
 */
export function gridBounds(rect: ImageRect | null, cells: Array<Cell & { size: number }>): { cols: number; rows: number } {
    let cols = DEFAULT_COLS
    let rows = DEFAULT_ROWS
    if (rect) {
        cols = Math.max(cols, Math.ceil(rect.x + rect.w))
        rows = Math.max(rows, Math.ceil(rect.y + rect.h))
    }
    for (const c of cells) {
        cols = Math.max(cols, c.x + c.size + 2)
        rows = Math.max(rows, c.y + c.size + 2)
    }
    return { cols, rows }
}

/** Iniciais do nome para o token sem imagem: "Ghan Buri" → "GB", "Goblin Warrior 2" → "GW2". */
export function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    const number = words.length > 1 && /^\d+$/.test(words[words.length - 1]) ? words.pop() : ''
    const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
    return (letters || '?') + (number ?? '')
}
