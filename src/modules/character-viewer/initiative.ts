/**
 * O que a ficha soma a uma rolagem usada como INICIATIVA.
 *
 * - **Incredible Initiative** (talento geral): +2 de circunstância em qualquer
 *   rolagem de iniciativa.
 * - **Elven Instincts** (talento de elfo): +2 de circunstância na iniciativa
 *   feita com Percepção — e, num empate com um oponente, vai primeiro mesmo que
 *   a rolagem não tenha sido de Percepção.
 * - **Battlefield Surveyor** (guerreiro, nível 7): +2 de circunstância na
 *   iniciativa feita com Percepção.
 *
 * São bônus do MESMO tipo (circunstância), então não empilham: vale o maior, e
 * os três valem 2. O que a ficha não vê — o Scout's Warning de um aliado, ou o
 * Shadow Mark que penaliza o ALVO — o jogador soma no ajuste livre.
 */
import { parseFeatEntry, type BuildInfo } from '../character-sheet/types'

const norm = (s: string) => s.trim().toLowerCase()
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))
const hasSpecial = (b: BuildInfo, name: string) => (b.specials ?? []).some((s) => norm(s) === norm(name))

export interface InitiativeBonus {
    /** Valor do bônus que vale (o maior; circunstância não empilha). */
    value: number
    /** De onde vem, para o memorial. */
    from: string[]
    /** Elven Instincts: vai primeiro num empate com oponente. */
    winsTies: boolean
}

/** `checkEn` = nome do teste em inglês ("Perception", "Stealth"…). `null` = nada a somar. */
export function initiativeBonus(build: BuildInfo, checkEn: string): InitiativeBonus | null {
    const perception = checkEn === 'Perception'
    const sources: Array<{ name: string; value: number }> = []
    if (hasFeat(build, 'Incredible Initiative')) sources.push({ name: 'Incredible Initiative', value: 2 })
    if (perception && hasFeat(build, 'Elven Instincts')) sources.push({ name: 'Elven Instincts', value: 2 })
    if (perception && hasSpecial(build, 'Battlefield Surveyor')) sources.push({ name: 'Battlefield Surveyor', value: 2 })
    const winsTies = hasFeat(build, 'Elven Instincts')
    if (sources.length === 0) return winsTies ? { value: 0, from: [], winsTies } : null
    const value = Math.max(...sources.map((s) => s.value))
    return { value, from: sources.filter((s) => s.value === value).map((s) => s.name), winsTies }
}
