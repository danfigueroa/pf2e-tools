/**
 * O que o Investigador faz com os Golpes.
 *
 * - **Devise a Stratagem** (Player Core 2 pg. 103, ação livre ou 1 ação, uma vez por
 *   rodada): escolhe-se uma criatura e rola-se um d20. O PRIMEIRO Golpe nela antes do
 *   próximo turno usa esse d20 no lugar da rolagem (traço *fortune*) e pode somar INT em
 *   vez de FOR/DES — mas só com arma corpo a corpo ágil ou de acuidade, desarmado ágil ou
 *   de acuidade, ou arma à distância. É ação livre se a criatura é parte de uma investigação
 *   ativa (Pursue a Lead). O Golpe e o estratagema saem no mesmo clique, então o d20 da
 *   rolagem JÁ É o do estratagema; o que o diálogo precisa fazer é cobrar a ação, trocar o
 *   atributo e somar o Strategic Strike.
 * - **Strategic Strike**: 1d6 de dano de precisão no Golpe que soma INT por causa do Devise
 *   a Stratagem, +1 dado nos níveis 5, 9, 13 e 17. Dobra no crítico, como toda precisão.
 *   Vale quando a arma PODE somar INT, mesmo que INT e DES empatem.
 * - **Known Weaknesses** e **Shared Stratagem** dependem do alvo e de um aliado, que a ficha
 *   não vê: viram anotação da rolagem.
 *
 * O app não conta a "uma vez por rodada": o chip vem desligado em todo Golpe e é do jogador.
 */
import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { WeaponTraits } from './strikes'

const norm = (s: string) => s.trim().toLowerCase()
const hasSpecial = (b: BuildInfo, name: string) => (b.specials ?? []).some((s) => norm(s) === norm(name))
const hasFeat = (b: BuildInfo, name: string) => (b.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

export const hasDeviseAStratagem = (b: BuildInfo) => hasSpecial(b, 'Devise a Stratagem')
export const hasStrategicStrike = (b: BuildInfo) => hasSpecial(b, 'Strategic Strike')
export const hasKnownWeaknesses = (b: BuildInfo) => hasFeat(b, 'Known Weaknesses')
export const hasSharedStratagem = (b: BuildInfo) => hasFeat(b, 'Shared Stratagem')

/** Chaves das escolhas por Golpe, guardadas junto dos chips de dano extra (não ficam lembradas). */
export const STRATAGEM_KEY = 'stratagem'
/** A criatura é parte de uma investigação ativa: o Devise a Stratagem é ação livre. */
export const LEAD_KEY = 'stratagem-lead'
export const KNOWN_WEAKNESSES_KEY = 'known-weaknesses'
export const SHARED_STRATAGEM_KEY = 'shared-stratagem'

/** Dados do Strategic Strike: 1, e mais 1 nos níveis 5, 9, 13 e 17. */
export const strategicStrikeDice = (level: number): number =>
    1 + [5, 9, 13, 17].filter((l) => level >= l).length

/**
 * A arma pode somar INT pelo Devise a Stratagem: à distância sempre; corpo a corpo, desarmado
 * e arremesso só com ágil ou acuidade. Sem os traços da arma (caseira) não dá para afirmar.
 */
export const stratagemQualifies = (traits: Pick<WeaponTraits, 'known' | 'ranged' | 'agile' | 'finesse'>): boolean =>
    traits.known && (traits.ranged || traits.agile || traits.finesse)

/** O estratagema de ataque está ligado neste Golpe. */
export const stratagemOn = (build: BuildInfo, on: Record<string, boolean>): boolean =>
    hasDeviseAStratagem(build) && on[STRATAGEM_KEY] === true

/** Ações que o Devise a Stratagem cobra: 1, ou 0 com uma investigação ativa sobre a criatura. */
export const stratagemCost = (on: Record<string, boolean>): number => (on[LEAD_KEY] === true ? 0 : 1)
