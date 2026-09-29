// Animações compartilhadas: keyframes, durações e o gate de movimento reduzido.
//
// **O estado muda na hora; a animação só apresenta.** Nenhuma animação daqui
// segura uma escrita na mesa — quem anima recebe o antes e o depois já
// aplicados. Fechar a aba no meio de uma animação nunca perde nada.
//
// Keyframes do Emotion, sem biblioteca nova. Tudo fora do subtree que o
// `html2canvas` captura, mas as cores continuam vindo dos tokens hex da paleta.

import { useEffect, useState } from 'react'
import { keyframes } from '@emotion/react'
import { useMediaQuery } from '@mui/material'
import { gold, SHIELD_COLOR, status } from '../theme/palette'

export const DURATION = {
    /** Contagem de um número (PV subindo/descendo). */
    count: 600,
    /** Número flutuante "+12" até sumir. */
    float: 1200,
    /** Brilho/tremor do contêiner. */
    pulse: 650,
} as const

/** `prefers-reduced-motion: reduce` — sem tremor, giro nem contagem. */
export function useReducedMotion(): boolean {
    return useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true })
}

/**
 * Fica `true` só depois de `delay` ms montado. A primeira pintura nunca anima:
 * o PV vem do cache, depois do servidor, e o máximo do companheiro chega da AON
 * — nenhuma dessas acomodações é "alguém tomou dano".
 */
export function useArmed(delay = 1000): boolean {
    const [armed, setArmed] = useState(false)
    useEffect(() => {
        const t = window.setTimeout(() => setArmed(true), delay)
        return () => window.clearTimeout(t)
    }, [delay])
    return armed
}

/**
 * Keyframes em par, idênticos a não ser por uma propriedade inerte. Trocar o
 * nome da animação é o que faz o navegador reiniciá-la — dano duas vezes
 * seguidas tremeria uma vez só com um nome único, e trocar a `key` do cartão
 * remontaria o formulário com o foco dentro.
 */
function twin(frames: string) {
    return [
        keyframes`0% { --twin: a; } ${frames}`,
        keyframes`0% { --twin: b; } ${frames}`,
    ] as const
}

const SHAKE = twin(`
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-5px); }
    30% { transform: translateX(5px); }
    45% { transform: translateX(-4px); }
    60% { transform: translateX(3px); }
    75% { transform: translateX(-2px); }
`)
const GLOW_HURT = twin(`
    0% { box-shadow: 0 0 0 0 ${status.error}00; }
    25% { box-shadow: 0 0 0 4px ${status.error}66; }
    100% { box-shadow: 0 0 0 0 ${status.error}00; }
`)
const GLOW_HEAL = twin(`
    0% { box-shadow: 0 0 0 0 ${status.success}00; }
    30% { box-shadow: 0 0 0 5px ${status.success}55, 0 0 18px 2px ${status.success}44; }
    100% { box-shadow: 0 0 0 0 ${status.success}00; }
`)
const GLOW_TEMP = twin(`
    0% { box-shadow: 0 0 0 0 ${status.info}00; }
    30% { box-shadow: 0 0 0 4px ${status.info}55; }
    100% { box-shadow: 0 0 0 0 ${status.info}00; }
`)
const GLOW_GOLD = twin(`
    0% { box-shadow: 0 0 0 0 ${gold.main}00; }
    35% { box-shadow: 0 0 0 4px ${gold.main}88, 0 0 16px 2px ${gold.bright}66; }
    100% { box-shadow: 0 0 0 0 ${gold.main}00; }
`)

// Escudo: o bloqueio pisca em aço, a quebra treme forte e acende em vermelho,
// o conserto brilha em latão.
const GLOW_SHIELD = twin(`
    0% { box-shadow: 0 0 0 0 ${SHIELD_COLOR}00; }
    25% { box-shadow: 0 0 0 4px ${SHIELD_COLOR}77, 0 0 14px 2px ${SHIELD_COLOR}55; }
    100% { box-shadow: 0 0 0 0 ${SHIELD_COLOR}00; }
`)
const BIG_SHAKE = twin(`
    0%, 100% { transform: translateX(0) rotate(0deg); }
    10% { transform: translateX(-8px) rotate(-1deg); }
    25% { transform: translateX(8px) rotate(1deg); }
    40% { transform: translateX(-6px) rotate(-0.5deg); }
    55% { transform: translateX(5px); }
    70% { transform: translateX(-3px); }
    85% { transform: translateX(2px); }
`)
const GLOW_REPAIR = twin(`
    0% { box-shadow: 0 0 0 0 ${gold.main}00; }
    35% { box-shadow: 0 0 0 4px ${status.success}55, 0 0 16px 3px ${gold.bright}66; }
    100% { box-shadow: 0 0 0 0 ${gold.main}00; }
`)

/** Escudo sendo erguido: o ícone sobe e assenta um pouco acima. */
export const lift = keyframes`
    0% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-6px) scale(1.2); }
    100% { transform: translateY(-2px) scale(1.08); }
`

/** A rachadura do escudo quebrado sendo "desenhada". */
export const crack = keyframes`
    0% { clip-path: inset(0 100% 0 0); opacity: 0; }
    20% { opacity: 1; }
    100% { clip-path: inset(0 0 0 0); opacity: 1; }
`

/** Sobe e some — o "+12" ao lado do PV. */
export const floatUp = keyframes`
    0% { opacity: 0; transform: translateY(4px) scale(0.8); }
    15% { opacity: 1; transform: translateY(0) scale(1.1); }
    30% { transform: translateY(-4px) scale(1); }
    100% { opacity: 0; transform: translateY(-28px) scale(1); }
`

/** Entrada com um leve estouro — chip novo, pip recuperado, rodada nova. */
export const pop = keyframes`
    0% { transform: scale(0.6); opacity: 0; }
    60% { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); }
`

/** Dado rolando: gira e quica. */
export const tumble = keyframes`
    0% { transform: rotate(0deg) translateY(0); }
    25% { transform: rotate(90deg) translateY(-6px); }
    50% { transform: rotate(180deg) translateY(0); }
    75% { transform: rotate(270deg) translateY(-4px); }
    100% { transform: rotate(360deg) translateY(0); }
`

/** Bolha de cura subindo. */
export const bubble = keyframes`
    0% { opacity: 0; transform: translateY(0) scale(0.6); }
    20% { opacity: 0.9; }
    100% { opacity: 0; transform: translateY(-70px) scale(1.1); }
`

/** Frasco inclinando para beber. */
export const tilt = keyframes`
    0% { transform: rotate(0deg); }
    50% { transform: rotate(-35deg) translateY(-4px); }
    100% { transform: rotate(-20deg); }
`

/**
 * Encolher (gastar), estourar (recuperar) e anel, em gêmeos: o mesmo pip pode
 * ser gastado e recuperado seguidas vezes. Indexe pela paridade de um contador.
 */
export const SPEND = twin(`
    0% { transform: scale(1); }
    40% { transform: scale(0.6); }
    100% { transform: scale(1); }
`)
export const RECOVER = twin(`
    0% { transform: scale(0.6); }
    60% { transform: scale(1.2); }
    100% { transform: scale(1); }
`)
export const RIPPLE = twin(`
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(2.4); opacity: 0; }
`)

export type PulseKind = 'heal' | 'hurt' | 'temp' | 'turn' | 'block' | 'break' | 'repair'

export interface Pulse {
    kind: PulseKind
    /** Sequencial: a paridade escolhe o gêmeo do keyframe (ver `twin`). */
    id: number
}

/** O `animation` de um contêiner que acabou de mudar, ou `undefined`. */
export function pulseAnimation(pulse: Pulse | null): string | undefined {
    if (!pulse) return undefined
    const i = pulse.id % 2
    const ms = DURATION.pulse
    switch (pulse.kind) {
        case 'hurt':
            return `${SHAKE[i]} 420ms ease-in-out, ${GLOW_HURT[i]} ${ms}ms ease-out`
        case 'heal':
            return `${GLOW_HEAL[i]} ${ms + 250}ms ease-out`
        case 'temp':
            return `${GLOW_TEMP[i]} ${ms}ms ease-out`
        case 'turn':
            return `${GLOW_GOLD[i]} ${ms + 350}ms ease-out`
        case 'block':
            return `${SHAKE[i]} 320ms ease-in-out, ${GLOW_SHIELD[i]} ${ms}ms ease-out`
        case 'break':
            return `${BIG_SHAKE[i]} 600ms ease-in-out, ${GLOW_HURT[i]} ${ms + 400}ms ease-out`
        case 'repair':
            return `${GLOW_REPAIR[i]} ${ms + 350}ms ease-out`
    }
}
