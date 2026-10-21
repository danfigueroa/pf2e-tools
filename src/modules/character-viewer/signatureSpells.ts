/**
 * Magias de assinatura (Signature Spells) dos conjuradores espontâneos.
 *
 * O Pathbuilder **não exporta** quais são, e editar o JSON à mão seria perdido
 * no próximo export. Por isso o catálogo casa pelo NOME do personagem (como
 * `customRunes.ts`) e pelo bloco de conjuração. A regra: a magia de assinatura
 * pode ser conjurada em qualquer slot de rank igual ou maior que o dela, sem
 * precisar ser aprendida de novo naquele rank — a aba de Magias a repete nos
 * ranks acima, já elevada.
 *
 * Nomes de magia ficam em inglês (chave de busca na AON).
 */
import type { BuildInfo, SpellCaster } from '../../pathbuilder/types'

interface SignatureEntry {
    /** Casa pelo nome do personagem (`build.name` em minúsculas). */
    matches: (name: string) => boolean
    /** Nome do bloco de conjuração em que valem. */
    caster: string
    spells: string[]
}

const SIGNATURE_SPELLS: SignatureEntry[] = [
    {
        matches: (name) => name.startsWith('thalos'),
        caster: 'Psychic',
        spells: ['Breathe Fire', 'Blazing Bolt', 'Fireball', 'Ice Storm', 'Howling Blizzard'],
    },
]

/** Magias de assinatura do bloco, ou lista vazia (preparado e inato não têm). */
export function signatureSpellsFor(build: BuildInfo, caster: SpellCaster): string[] {
    if (caster.spellcastingType !== 'spontaneous') return []
    const name = (build.name || '').trim().toLowerCase()
    const entry = SIGNATURE_SPELLS.find((e) => e.caster === caster.name && e.matches(name))
    return entry ? entry.spells : []
}
