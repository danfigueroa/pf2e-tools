/* i18n-ignore-file */
import type { Compiled, RulesIndex } from '../engine/types'
import type { CoreRules } from '../hooks/useRules'
import type { BuildState, MesaRules } from '../types'

/** O que toda aba do modo editar recebe. */
export interface SectionProps {
    state: BuildState
    update: (change: (state: BuildState) => BuildState) => void
    core: CoreRules
    index: RulesIndex
    mesaRules: MesaRules | null
    compiled: Compiled
    canEdit: boolean
}

/** Grava (ou apaga, se vazia) uma escolha de slot. */
export function setChoice(update: SectionProps['update'], key: string, value: BuildState['choices'][string] | null) {
    update((s) => {
        const choices = { ...s.choices }
        if (value === null) delete choices[key]
        else choices[key] = value
        return { ...s, choices }
    })
}
