// Cálculo de heightening (Conjurada com Nível Mais Alto) no client.
// O backend fornece o rank base da magia (spell.level, vindo do AON); as
// entradas de heightening vêm do parser de descrição (format-description.ts),
// que preserva expressões de dado ("2d6") mesmo após a tradução.

import type { HeightenedEntry } from './format-description'
import type { SpellDescription } from '../character-sheet/types'

/** Rank efetivo de conjuração: truques e focus spells (slot 0) elevam
 *  automaticamente para ceil(nível/2) (regra Remaster); slots normais usam o
 *  próprio nível do slot. Arquétipos com progressão de conjuração atrasada não
 *  são distinguíveis no JSON do Pathbuilder — assumimos a progressão padrão. */
export function castRankForSlot(slotLevel: number, characterLevel: number): number {
    return slotLevel === 0 ? Math.ceil(characterLevel / 2) : slotLevel
}

export interface AppliedHeightened extends HeightenedEntry {
    applies: boolean   // esta entrada vale para o rank conjurado?
    times: number      // "+N": quantas aplicações; rank fixo: 1
}

/** Normaliza o "level" textual de uma entrada de heightening:
 *  "+1" → {plus:1}; "3rd"/"3º"/"Nível 3"/"3" → {fixed:3}; senão null. */
export function parseHeightenedLevel(level: string): { plus: number } | { fixed: number } | null {
    const t = level.trim()
    const plus = t.match(/^\+\s*(\d+)$/)
    if (plus) return { plus: Number(plus[1]) }
    const fixed = t.match(/^(?:Nível|Level)?\s*(\d+)\s*(?:st|nd|rd|th|[º°ª])?\.?$/i)
    if (fixed) return { fixed: Number(fixed[1]) }
    return null
}

/** Marca cada entrada como aplicável (com multiplicidade) para baseRank→castRank.
 *  - "+N": times = floor((castRank - baseRank) / N), acumula;
 *  - rank fixo: entradas fixas substituem, não acumulam — só a MAIOR ≤ castRank aplica;
 *  - baseRank null/undefined → tudo applies=false (sem dado para calcular). */
export function applyHeightening(
    entries: HeightenedEntry[],
    baseRank: number | null | undefined,
    castRank: number,
): AppliedHeightened[] {
    let bestFixed = -1
    if (baseRank != null) {
        for (const e of entries) {
            const p = parseHeightenedLevel(e.level)
            if (p && 'fixed' in p && p.fixed <= castRank && p.fixed > bestFixed) bestFixed = p.fixed
        }
    }
    return entries.map((e) => {
        if (baseRank == null) return { ...e, applies: false, times: 0 }
        const p = parseHeightenedLevel(e.level)
        if (!p) return { ...e, applies: false, times: 0 }
        if ('plus' in p) {
            const times = p.plus > 0 ? Math.floor((castRank - baseRank) / p.plus) : 0
            return { ...e, applies: times >= 1, times: Math.max(times, 0) }
        }
        const applies = p.fixed === bestFixed
        return { ...e, applies, times: applies ? 1 : 0 }
    })
}

const DICE_RE = /(\d+)d(\d+)(?:\s*\+\s*(\d+))?/

/** Dano final no rank conjurado, ou null quando não parseável com segurança.
 *  Estratégia conservadora — melhor não calcular do que mostrar número errado:
 *  1. dado base: spell.damage ("1d8") ou a 1ª expressão NdS(+F)? da descrição;
 *  2. exige exatamente UMA entrada "+N" aplicável contendo exatamente UMA
 *     expressão de dado com o MESMO número de faces do dado base;
 *  3. resultado = (base + incremento×times)d faces (+ flat somado). */
export function computeHeightenedDamage(
    spell: Pick<SpellDescription, 'damage' | 'description'>,
    applied: AppliedHeightened[],
): string | null {
    const baseSrc = spell.damage && DICE_RE.test(spell.damage) ? spell.damage : spell.description
    const baseMatch = baseSrc?.match(DICE_RE)
    if (!baseMatch) return null
    const baseCount = Number(baseMatch[1])
    const faces = Number(baseMatch[2])
    const baseFlat = baseMatch[3] ? Number(baseMatch[3]) : 0

    const plusApplied = applied.filter((e) => {
        const p = parseHeightenedLevel(e.level)
        return e.applies && p != null && 'plus' in p
    })
    if (plusApplied.length !== 1) return null
    const entry = plusApplied[0]

    const diceInEntry = entry.text.match(new RegExp(DICE_RE.source, 'g'))
    if (!diceInEntry || diceInEntry.length !== 1) return null
    const incMatch = diceInEntry[0].match(DICE_RE)
    if (!incMatch) return null
    const incCount = Number(incMatch[1])
    const incFaces = Number(incMatch[2])
    const incFlat = incMatch[3] ? Number(incMatch[3]) : 0
    if (incFaces !== faces) return null

    const totalCount = baseCount + incCount * entry.times
    const totalFlat = baseFlat + incFlat * entry.times
    return totalFlat > 0 ? `${totalCount}d${faces}+${totalFlat}` : `${totalCount}d${faces}`
}
