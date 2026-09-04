// Que pedaços do stat block são TERMO DE REGRA, e como perguntar por eles.
//
// A ficha do monstro é cheia de referência a regra que não está escrita nela:
// "Grab" aparece só como nome e ação, "frightened 2" no meio da prosa, "agile"
// como traço do golpe. Este arquivo acha esses termos; quem mostra a regra é o
// `RuleTip`.

import { CONDITIONS } from '../character-viewer/conditions'

/** As categorias do índice da AON que o endpoint `?rule=` conhece. */
export type RuleKind = 'creature-ability' | 'condition' | 'trait' | 'spell' | 'action'

export interface RuleSegment {
    text: string
    /** Quando presente, o trecho é um termo e vira caixinha de regra. */
    term?: string
    kind?: RuleKind
}

/**
 * Nomes de condição em inglês — a prosa da ficha é inglesa, e é contra ela que
 * o casamento acontece. `flat-footed` entra à mão: é o nome pré-Remaster de
 * off-guard e ainda aparece em entrada antiga do índice (mesma ressalva que
 * vale para as aflições).
 */
const CONDITION_NAMES = [...CONDITIONS.map((c) => c.en), 'Flat-Footed']

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

// Os mais longos primeiro: "Persistent Damage" tem que casar antes de "Damage"
// virar candidato em qualquer regra futura.
const CONDITION_RE = new RegExp(
    `\\b(${[...CONDITION_NAMES].sort((a, b) => b.length - a.length).map(escape).join('|')})\\b`,
    'gi',
)

/**
 * Quebra a prosa em texto comum e condições.
 *
 * Devolver segmentos (em vez de HTML pronto) mantém a decisão de estilo com
 * quem desenha — e o stat block é o subtree que o html2canvas rasteriza, onde
 * cor é hex literal.
 */
export function splitConditions(text: string): RuleSegment[] {
    const out: RuleSegment[] = []
    let last = 0
    for (const match of text.matchAll(CONDITION_RE)) {
        const start = match.index ?? 0
        if (start > last) out.push({ text: text.slice(last, start) })
        out.push({ text: match[0], term: match[0], kind: 'condition' })
        last = start + match[0].length
    }
    if (last < text.length) out.push({ text: text.slice(last) })
    return out
}

/**
 * O nome do traço como o AON o registra: "reach 15 feet" → "Reach",
 * "scent (imprecise) 30 feet" → "Scent".
 *
 * Mesma limpeza que `cleanSearchName` faz no backend, e pelo mesmo motivo: a
 * ficha anexa alcance e qualificador ao traço, o índice não.
 */
export function traitTerm(raw: string): string {
    return String(raw || '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\d+\s*(?:feet|foot|ft\.?)?/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}
