import { useEffect, useRef } from 'react'
import { pulseAnimation, type PulseKind } from './motion'
import { useAnimatedNumber } from './useAnimatedNumber'
import { useValueDeltas } from './useValueDeltas'

/**
 * Tudo o que um bloco de PV precisa para reagir a dano e cura: o número atual
 * contando, os deltas flutuantes e o `animation` do contêiner.
 *
 * O delta olha PV + temporários: dano absorvido pelo temporário ainda é dano
 * que a mesa quer ver. Subida só de temporário é azul, não verde.
 */
export function useHpFeedback(current: number, temp: number) {
    // O `classify` roda no efeito de `useValueDeltas`, que é declarado ANTES do
    // efeito abaixo — então ainda enxerga o PV anterior no ref.
    const lastCurrent = useRef(current)
    const classify = (diff: number): PulseKind => {
        if (diff < 0) return 'hurt'
        return current > lastCurrent.current ? 'heal' : 'temp'
    }
    const { deltas, pulse, armed } = useValueDeltas(current + temp, classify)
    useEffect(() => { lastCurrent.current = current }, [current])

    const shown = useAnimatedNumber(current, { instant: !armed })
    return { shown, deltas, animation: pulseAnimation(pulse) }
}
