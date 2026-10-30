// As animações dos Troféus do Covil. Mesma regra do resto do app (`src/motion/`): o troféu já
// está gravado quando qualquer coisa daqui roda — a animação só apresenta — e só se anima
// `transform`/`opacity`. Movimento reduzido: tudo direto, sem giro nem faísca.

import type { SxProps, Theme } from '@mui/material'
import { keyframes } from '@emotion/react'

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Passa um pouco do ponto e volta (a taça "assenta"). */
export const EASE_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

/** Entrada de um item da grade: sobe e aparece, um pouco depois do anterior. */
export const reveal = (shown: boolean, index = 0): SxProps<Theme> => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : 'translateY(16px) scale(0.97)',
    transition: `opacity 420ms ${EASE}, transform 560ms ${EASE}`,
    transitionDelay: shown ? `${Math.min(index, 16) * 45}ms` : '0ms',
})

/** Barra que cresce da esquerda: `scaleX`, nunca `width`. */
export const grow = (shown: boolean, fraction: number, delay = 0): SxProps<Theme> => ({
    transform: `scaleX(${shown ? Math.max(0, Math.min(1, fraction)) : 0})`,
    transformOrigin: 'left center',
    transition: `transform 900ms ${EASE}`,
    transitionDelay: `${delay}ms`,
})

/** O cartão do desbloqueio desce do topo. */
export const drop = keyframes`
    0% { transform: translate(-50%, -32px) scale(0.96); opacity: 0; }
    60% { transform: translate(-50%, 4px) scale(1.01); opacity: 1; }
    100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
`

/** E sobe de volta ao sair. */
export const rise = keyframes`
    from { transform: translate(-50%, 0); opacity: 1; }
    to { transform: translate(-50%, -24px); opacity: 0; }
`

/** A taça entra girando no próprio eixo e assenta. */
export const spinIn = keyframes`
    0% { transform: perspective(240px) rotateY(-720deg) scale(0.2); opacity: 0; }
    55% { opacity: 1; }
    80% { transform: perspective(240px) rotateY(12deg) scale(1.12); }
    100% { transform: perspective(240px) rotateY(0deg) scale(1); }
`

/** O brilho que atravessa a medalha. */
export const shine = keyframes`
    0% { transform: translateX(-130%) skewX(-20deg); opacity: 0; }
    20% { opacity: 0.9; }
    100% { transform: translateX(130%) skewX(-20deg); opacity: 0; }
`

/** O anel que se abre atrás da taça (platina). */
export const ringOut = keyframes`
    0% { transform: scale(0.4); opacity: 0.9; }
    100% { transform: scale(2.6); opacity: 0; }
`

/** "+90 pts" sobe e some. */
export const pointsUp = keyframes`
    0% { transform: translateY(8px); opacity: 0; }
    20% { transform: translateY(0); opacity: 1; }
    80% { transform: translateY(-4px); opacity: 1; }
    100% { transform: translateY(-14px); opacity: 0; }
`

/** O troféu ganho desde a última visita respira devagar, duas vezes. */
export const glowNew = keyframes`
    0%, 100% { box-shadow: 0 0 0 0 rgba(200, 169, 81, 0); }
    50% { box-shadow: 0 0 0 6px rgba(200, 169, 81, 0.35); }
`

/** A linha do ranking que acabou de ganhar pontos. */
export const flash = keyframes`
    0% { background-color: rgba(200, 169, 81, 0.45); }
    100% { background-color: rgba(200, 169, 81, 0); }
`
