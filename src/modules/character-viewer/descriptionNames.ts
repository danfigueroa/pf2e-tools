// Tudo o que a ficha descreve ao toque, por tipo — os nomes exatos que cada aba
// manda ao `DescriptionDrawer`, que são a chave do cache de descrições.
//
// É a lista dos pacotes pré-traduzidos: o estático (`public/descriptions/`,
// gerado por `scripts/build-description-bundle.mjs`) e o da ficha publicada
// (`api/_lib/sheet-descriptions.js`). Usa as MESMAS funções das abas — uma
// cópia aqui envelheceria em silêncio, e o item que faltasse cairia na rede
// sem ninguém perceber.

import { parseFeatEntry, type BuildInfo } from '../../pathbuilder/types'
import { characterSpellNames } from './spellNames'
import { inventoryRows } from './inventory'
import { relicsOf } from './relics'

/** Os tipos do cache de descrições (`services/descriptions.ts`), menos companheiro. */
export type DescriptionKind = 'spell' | 'feat' | 'special' | 'item'

export type DescriptionNames = Record<DescriptionKind, string[]>

const unique = (names: string[]) => [...new Set(names.map((n) => n.trim()).filter(Boolean))]

/** As dádivas das relíquias que a AON descreve (as com texto no catálogo não precisam): poder é habilidade, runa é item. */
const relicGiftNames = (build: BuildInfo, kind: 'rune' | 'power'): string[] =>
    relicsOf(build).flatMap((r) => r.gifts)
        .filter((g) => !g.description && (g.kind === 'rune') === (kind === 'rune'))
        .map((g) => g.name)

export function characterDescriptionNames(build: BuildInfo): DescriptionNames {
    return {
        spell: characterSpellNames(build),
        // Aba de Talentos.
        feat: unique((build.feats ?? []).map((f) => parseFeatEntry(f).name)),
        // Aba de Habilidades.
        special: unique([...(build.specials ?? []).map((s) => String(s)), ...relicGiftNames(build, 'power')]),
        // Aba de Inventário (armas e armaduras inclusas).
        item: unique([...inventoryRows(build).map((row) => row.name), ...relicGiftNames(build, 'rune')]),
    }
}
