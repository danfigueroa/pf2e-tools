// Alcance de movimento de um token: o que o arrasto mostra, aqui e no aparelho
// de quem está vendo outro jogador arrastar (`LiveLayer`).

import { CELL_PX, formatDistance, squaresBetween, type Cell } from './geometry'
import { status } from '../../theme'

/** Cores das faixas de 1, 2 e 3 Andares. */
export const BAND_COLORS = [status.success, status.warning, status.error]

/**
 * Faixas de alcance de um token: as posições onde ele pode parar com 1, 2 e 3
 * Andares, pela distância PF2e (5-10-5) a partir de onde estava. Cada faixa é
 * um anel — o que a anterior não alcançava —, desenhado na posição do CENTRO
 * do token (um token Grande cai meio quadrado deslocado, como ele mesmo).
 * Sem terreno difícil nem condições: o mapa não sabe de parede nem de Lento.
 */
export function movementBands(from: Cell, size: number, speedFeet: number): string[] {
    const reach = Math.floor(speedFeet / 5)
    const out = ['', '', '']
    if (reach <= 0) return out
    const max = reach * 3
    const off = (size - 1) / 2
    for (let y = Math.max(0, from.y - max); y <= from.y + max; y++) {
        for (let x = Math.max(0, from.x - max); x <= from.x + max; x++) {
            const d = squaresBetween(from, { x, y })
            if (d === 0 || d > max) continue
            const band = Math.ceil(d / reach) - 1
            out[band] += `M${(x + off) * CELL_PX} ${(y + off) * CELL_PX}h${CELL_PX}v${CELL_PX}h${-CELL_PX}z`
        }
    }
    return out
}

/** O rótulo do arrasto: distância e, quando o token sabe o deslocamento, quantas ações. */
export function moveLabel(from: Cell, to: Cell, speed: number | undefined): string {
    const squares = squaresBetween(from, to)
    if (!speed) return formatDistance(squares)
    const steps = Math.ceil((squares * 5) / speed)
    const actions = steps === 0 ? '' : steps > 3 ? ' · fora de alcance' : ` · ${steps} ${steps === 1 ? 'ação' : 'ações'}`
    return formatDistance(squares) + actions
}
