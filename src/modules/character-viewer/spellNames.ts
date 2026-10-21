// Quais magias uma ficha tem — os nomes como o Pathbuilder os manda, que são a
// chave do cache de descrições e do pacote pré-traduzido (`public/spells/`).
//
// Mora fora da `SpellsSection` porque o gerador do pacote
// (`scripts/build-spell-bundle.mjs`) precisa da MESMA lista que o "Carregar
// todas" pede: uma cópia escrita à mão no script envelheceria em silêncio, e a
// magia que faltasse cairia na rede sem ninguém perceber.

import type { BuildInfo, FocusAbility, FocusTradition } from '../character-sheet/types'

export interface FocusSpellEntry {
    name: string
    tradition: string
    group: FocusAbility
    /** Truque de foco (psi cantrip, composição): conjurar não gasta ponto — só o amp gasta. */
    cantrip: boolean
}

export function collectFocusSpells(build: BuildInfo): FocusSpellEntry[] {
    const out: FocusSpellEntry[] = []
    const seen = new Set<string>()
    if (!build.focus) return out
    Object.entries(build.focus).forEach(([tradition, abilities]: [string, FocusTradition]) => {
        Object.values(abilities).forEach((group: FocusAbility) => {
            const cantrips = new Set(group.focusCantrips ?? [])
            for (const name of [...cantrips, ...(group.focusSpells ?? [])]) {
                if (seen.has(name)) continue
                seen.add(name)
                out.push({ name, tradition, group, cantrip: cantrips.has(name) })
            }
        })
    })
    return out
}

/** Todas as magias da ficha: dos blocos de conjuração e de foco, sem repetir. */
export function characterSpellNames(build: BuildInfo, focus = collectFocusSpells(build)): string[] {
    const names = new Set<string>()
    build.spellCasters?.forEach(c => c.spells.forEach(l => l.list.forEach(n => names.add(n))))
    focus.forEach(f => names.add(f.name))
    return Array.from(names)
}
