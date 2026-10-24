// "O d20 é honesto?": o teste qui-quadrado da distribuição das faces contra a
// uniforme (5% cada). É para a mesa rir, mas a conta é de verdade — nunca acusa
// um dado com poucos testes, que é quando todo dado parece viciado.

/** Abaixo disso o esperado por face fica menor que 5 e o teste não vale. */
export const MIN_FAIR_CHECKS = 100

/** Valores críticos do qui-quadrado com 19 graus de liberdade (20 faces − 1). */
const CRITICAL_5 = 30.144
const CRITICAL_1 = 36.191

export type Verdict = 'few' | 'fair' | 'suspicious' | 'loaded'

export interface Fairness {
    checks: number
    chi2: number | null
    verdict: Verdict
    /** A face que mais saiu e a que menos saiu (empate: a menor face). */
    hot: number | null
    cold: number | null
}

export function fairness(hist: number[]): Fairness {
    const checks = hist.reduce((a, b) => a + b, 0)
    let hot = 0
    let cold = 0
    for (let i = 1; i < hist.length; i++) {
        if (hist[i] > hist[hot]) hot = i
        if (hist[i] < hist[cold]) cold = i
    }
    if (checks === 0) return { checks, chi2: null, verdict: 'few', hot: null, cold: null }
    const faces = { hot: hot + 1, cold: cold + 1 }
    if (checks < MIN_FAIR_CHECKS) return { checks, chi2: null, verdict: 'few', ...faces }
    const expected = checks / 20
    const chi2 = hist.reduce((s, n) => s + ((n - expected) ** 2) / expected, 0)
    const verdict: Verdict = chi2 >= CRITICAL_1 ? 'loaded' : chi2 >= CRITICAL_5 ? 'suspicious' : 'fair'
    return { checks, chi2: Math.round(chi2 * 10) / 10, verdict, ...faces }
}

export const VERDICT_TEXT: Record<Verdict, string> = {
    few: 'Poucos testes para julgar o dado — role mais (a partir de 100).',
    fair: 'O dado é honesto. A culpa é de quem rola.',
    suspicious: 'Hmm… o dado anda suspeito. Nada que um bom interrogatório não resolva.',
    loaded: 'Esse dado está viciado — ou o destino tem favoritos.',
}
