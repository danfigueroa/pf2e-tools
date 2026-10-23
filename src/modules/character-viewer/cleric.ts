// Clérigo: o que os talentos mudam nas magias de cura (o Woyd). Texto conferido na AON.
//  - **Healing Hands** (Player Core pg. 114): ao conjurar Heal, rola d10 em vez de d8.
//  - **Selective Energy** (Player Core pg. 117): no Heal/Harm em área, até 5 criaturas da área ficam de fora.

import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import type { VariantOptions } from './actionVariants'

const norm = (s: string) => s.trim().toLowerCase()

const hasFeat = (build: BuildInfo, name: string) =>
    (build.feats ?? []).some((f) => norm(parseFeatEntry(f).name) === norm(name))

export const hasHealingHands = (build: BuildInfo) => hasFeat(build, 'Healing Hands')
export const hasSelectiveEnergy = (build: BuildInfo) => hasFeat(build, 'Selective Energy')

/** As opções do catálogo de ação variável que vêm da ficha. */
export const variantOptionsFor = (build: BuildInfo): VariantOptions => ({
    healingHands: hasHealingHands(build),
    selectiveEnergy: hasSelectiveEnergy(build),
})
