import type { RuleEntry } from '../rules/types'

/** Rank em que a magia é lançada: o do espaço ou, em truque e foco, metade do nível para cima (`auto`). */
export interface SpellCast { rank: number; auto?: boolean }

const ITEM_TYPES = new Set(['equipment', 'weapon', 'armor', 'shield'])

/** A categoria da AON pelo id da entrada ("grim-fascination-1" → "grim-fascination"); nada para conteúdo da mesa. */
const aonCategory = (e: RuleEntry) => /^([a-z][a-z-]*)-\d+(?:-\d+)?$/.exec(e.aon?.id ?? '')?.[1]

/**
 * O pedido de descrição de uma entrada do catálogo (o mesmo pipeline da Ficha). Opção de classe, origem, divindade…
 * vão com a categoria no nome ("Bone [grim-fascination]"): só pelo nome, a busca casava outra coisa (o material Bone).
 * A carga do banco (`warm-catalog-descriptions.mjs`) usa esta mesma função, para a chave no banco ser a do clique.
 */
export function descriptionRequest(e: RuleEntry, cast?: SpellCast):
    | { type: 'spell'; name: string; level?: number; autoHeightened?: boolean } | { type: 'feat'; name: string; level?: number } | { type: 'item'; name: string } | { type: 'special'; name: string } {
    // Com o rank conjurado, a descrição já vem elevada: dados trocados e destacados (o mesmo cálculo da Ficha).
    if (e.type === 'spell') return cast ? { type: 'spell', name: e.name, level: cast.rank, ...(cast.auto ? { autoHeightened: true } : {}) } : { type: 'spell', name: e.name }
    if (e.type === 'feat') return { type: 'feat', name: e.name, level: e.level }
    if (ITEM_TYPES.has(e.type)) return { type: 'item', name: e.name }
    const cat = e.homebrew ? undefined : aonCategory(e)
    return { type: 'special', name: cat ? `${e.name} [${cat}]` : e.name }
}
