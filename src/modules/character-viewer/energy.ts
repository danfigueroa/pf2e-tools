/**
 * Conservation of Energy da Oscillating Wave (conscious mind do Psíquico).
 *
 * "A primeira vez no encontro que você conjura uma magia concedida ou um psi
 * cantrip padrão da sua mente, decide se está ADICIONANDO energia (a habilidade
 * ganha o traço fogo, e todo dano seu vira fogo) ou REMOVENDO (frio). Depois de
 * adicionar, a próxima conjuração dessas magias tem de remover, e vice-versa.
 * Ao Refocus você volta ao neutro." (Dark Archive pg. 19)
 *
 * O estado é da MESA (campo `energy`): `last` é a última escolha, ausente =
 * neutro. A ficha não vê o fim do encontro, então voltar ao neutro é um botão.
 * Escreve só a tradição de uma ficha, por NOME de característica
 * ("The Oscillating Wave" nas `specials`), como `rage.ts` e `customRunes.ts`.
 */
import type { BuildInfo } from '../character-sheet/types'
import { baseSpellName } from './psiAmps'

export type EnergyMode = 'add' | 'remove'

export interface EnergyStored {
    last?: EnergyMode
}

export const NO_ENERGY: EnergyStored = {}

export function sanitizeEnergy(raw: unknown): EnergyStored {
    const last = (raw as EnergyStored | null)?.last
    return last === 'add' || last === 'remove' ? { last } : NO_ENERGY
}

export const isEnergyEmpty = (s: EnergyStored) => !s.last

export const hasConservation = (build: BuildInfo): boolean =>
    (build.specials ?? []).some((s) => s.toLowerCase() === 'the oscillating wave')

/** As magias concedidas (1º ao 9º) e os psi cantrips padrão da Oscillating Wave. */
const ELIGIBLE = new Set([
    'burning hands', 'heat metal', 'fireball', 'fire shield', 'cone of cold',
    'flame vortex', 'fiery body', 'polar ray', 'meteor swarm',
    'frostbite', 'ignition',
].map((n) => n))

export const isEnergySpell = (name: string): boolean => ELIGIBLE.has(baseSpellName(name).toLowerCase())

/** Depois de adicionar tem de remover, e vice-versa; neutro aceita os dois. */
export function allowedModes(stored: EnergyStored): EnergyMode[] {
    if (stored.last === 'add') return ['remove']
    if (stored.last === 'remove') return ['add']
    return ['add', 'remove']
}

export const energyType = (mode: EnergyMode): 'fire' | 'cold' => (mode === 'add' ? 'fire' : 'cold')

/** Todo dano da habilidade passa a ser do tipo da energia escolhida. */
export const convertTypes = (types: string[], mode: EnergyMode): string[] =>
    types.length === 0 ? types : [energyType(mode)]
