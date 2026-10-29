import { createContext, useContext, useEffect, useState } from 'react';
import { useReducedMotion } from '../../../motion/motion';

/** Se a vitrine está tocando: parada com o mouse em cima, com a aba oculta ou fora da tela. */
export const ScenePlaying = createContext(true);

/**
 * O passo atual de uma cena em loop. `steps` é quanto cada passo dura (ms) e tem de ser
 * estável (constante do módulo). Avança por `setTimeout`, um render por passo — nunca por
 * quadro: o movimento entre passos é CSS. Com movimento reduzido, a cena fica no último
 * passo, que é o quadro "completo".
 */
export function useSceneClock(steps: readonly number[]): number {
  const reduced = useReducedMotion();
  const playing = useContext(ScenePlaying);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced || !playing) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % steps.length), steps[step]);
    return () => window.clearTimeout(timer);
  }, [step, playing, reduced, steps]);

  return reduced ? steps.length - 1 : step;
}
