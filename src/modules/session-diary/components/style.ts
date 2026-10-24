// Estilos do histórico: a cor de cada tom, a entrada escalonada e a barra que cresce.

import type { SxProps, Theme } from '@mui/material'
import { gold, green, MYTHIC_COLOR, status } from '../../../theme'
import type { AwardTone } from '../awards'

/** Texto (contraste ≥4,5:1 no pergaminho) e acento (filetes, barras) de cada tom. */
export const TONE: Record<AwardTone, { text: string; accent: string }> = {
    gold: { text: gold.deep, accent: gold.main },
    bad: { text: status.error, accent: status.error },
    mythic: { text: MYTHIC_COLOR, accent: MYTHIC_COLOR },
    green: { text: green.mid, accent: green.light },
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Entrada de um item da grade: sobe e aparece, um pouco depois do anterior.
 * Só `opacity` e `transform` — nada que force o navegador a refazer o layout.
 */
export const reveal = (shown: boolean, index = 0): SxProps<Theme> => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : 'translateY(14px) scale(0.98)',
    transition: `opacity 420ms ${EASE}, transform 520ms ${EASE}`,
    transitionDelay: shown ? `${Math.min(index, 12) * 55}ms` : '0ms',
})

/** Barra que cresce da esquerda (ou de baixo): `scale`, nunca `width`. */
export const grow = (shown: boolean, fraction: number, axis: 'x' | 'y', index = 0): SxProps<Theme> => ({
    transform: `scale${axis.toUpperCase()}(${shown ? Math.max(0, Math.min(1, fraction)) : 0})`,
    transformOrigin: axis === 'x' ? 'left center' : 'center bottom',
    transition: `transform 700ms ${EASE}`,
    transitionDelay: `${Math.min(index, 20) * 30}ms`,
})
