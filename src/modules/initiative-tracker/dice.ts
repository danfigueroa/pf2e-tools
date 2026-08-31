// Fórmulas de dano: leitura do texto da AON e rolagem.
//
// **O que este arquivo NÃO contradiz**: o módulo continua sem rolar iniciativa,
// salvaguarda nem teste plano. Essas são rolagens de quem está jogando, e
// seguem digitadas/informadas pelo GM. O que se rola aqui é o dano que o RAW
// manda cair sozinho — o do estágio de uma aflição e o do dano persistente ao
// fim do turno. Pedir esses dois ao GM seria um clique por turno por combatente
// afligido, que é exatamente o trabalho que o gerenciador existe para tirar da
// mesa. Em compensação, toda aplicação automática vem com desfazer.
//
// A leitura é feita no CLIENTE, e não em `api/_lib/affliction-parse.js` como o
// resto do parse de aflição, de propósito: o texto do estágio já está gravado
// no estado da mesa. Parsear aqui faz o dano valer também para os venenos que
// já estavam aplicados antes desta versão, sem migração de campo nenhuma.

import { DAMAGE_TYPES } from './defenses'

/** `2d6+3` → `{ count: 2, faces: 6, flat: 3 }`. `5` → `{ 0, 0, 5 }`. */
export interface Formula {
    count: number
    faces: number
    flat: number
}

/** Uma parcela de dano lida de uma prosa: "1d6 persistent fire damage". */
export interface DamageEntry {
    /** A fórmula como escrita, para exibir ("1d6", "2d8+4", "3"). */
    formula: string
    /** Tipo canônico em inglês, como o resto das defesas do módulo. */
    type: string
    /** Dano persistente vira uma entrada própria, não um golpe único. */
    persistent: boolean
}

const FORMULA_RE = /^\s*(?:(\d+)\s*d\s*(\d+))?\s*([+-]?\s*\d+)?\s*$/i

export function parseFormula(text: string): Formula | null {
    const m = FORMULA_RE.exec(String(text ?? ''))
    if (!m || (!m[1] && !m[3])) return null
    const count = m[1] ? parseInt(m[1], 10) : 0
    const faces = m[2] ? parseInt(m[2], 10) : 0
    const flat = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0
    if (count > 100 || faces > 1000) return null
    return { count, faces, flat }
}

/**
 * Rola a fórmula. Dano nunca é negativo (um `1d4-2` que sai 1 vira 0), pela
 * mesma regra do Player Core que já vale em `computeDamage`.
 */
export function rollFormula(text: string): number {
    const f = parseFormula(text)
    if (!f) return 0
    let total = f.flat
    for (let i = 0; i < f.count; i++) total += 1 + Math.floor(Math.random() * f.faces)
    return Math.max(0, total)
}

/** Média da fórmula, para a prévia do que vai cair. `1d6` → 3,5 → 4. */
export function averageFormula(text: string): number {
    const f = parseFormula(text)
    if (!f) return 0
    return Math.max(0, Math.round(f.count * ((f.faces + 1) / 2) + f.flat))
}

/**
 * Palavras de tipo aceitas. Os quatro alinhamentos e o par positivo/negativo são
 * nomes pré-Remaster que ainda aparecem em entrada antiga do índice — casam
 * para o tipo novo, senão o dano deles ficaria sem tipo e escaparia da
 * resistência certa.
 */
const TYPE_WORDS: Record<string, string> = {
    ...Object.fromEntries(DAMAGE_TYPES.map((t) => [t, t])),
    positive: 'vitality',
    negative: 'void',
    good: 'spirit',
    evil: 'spirit',
    lawful: 'spirit',
    chaotic: 'spirit',
}

const AMOUNT = String.raw`\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?|\d+`
const TYPE = Object.keys(TYPE_WORDS).join('|')

// "1d6 persistent fire damage", "2d8 poison", "3 bleed damage".
const TYPED_RE = new RegExp(String.raw`(${AMOUNT})\s+(persistent\s+)?(${TYPE})\b(?:\s+damage)?`, 'gi')
// "takes 2d6 damage" — sem tipo escrito. Só com a palavra `damage`, senão
// qualquer "clumsy 1" viraria dano.
const UNTYPED_RE = new RegExp(String.raw`(${AMOUNT})\s+(persistent\s+)?damage`, 'gi')

const norm = (formula: string) => formula.replace(/\s+/g, '')

/**
 * Extrai as parcelas de dano de uma prosa de estágio.
 *
 * A prosa vem já limpa do backend ("1d6 poison damage, clumsy 1, and fatigued
 * (1 round)"). Só vira dano o que tem um TIPO ou a palavra `damage` ao lado —
 * assim "clumsy 1" e "enfeebled 2" nunca entram na conta. O que a regra não
 * conseguir ler simplesmente não é aplicado: a ferramenta não inventa número
 * que o GM não conferiu (mesma política do escalar-monstro).
 */
export function parseDamageEntries(text: string): DamageEntry[] {
    const prose = String(text ?? '')
    const out: DamageEntry[] = []
    const claimed: Array<[number, number]> = []

    for (const m of prose.matchAll(TYPED_RE)) {
        claimed.push([m.index, m.index + m[0].length])
        out.push({
            formula: norm(m[1]),
            type: TYPE_WORDS[m[3].toLowerCase()],
            persistent: !!m[2],
        })
    }

    // O sem tipo só entra onde nenhuma parcela tipada já tomou o trecho, senão
    // "1d6 poison damage" contaria duas vezes.
    for (const m of prose.matchAll(UNTYPED_RE)) {
        const start = m.index
        if (claimed.some(([a, b]) => start < b && start + m[0].length > a)) continue
        out.push({ formula: norm(m[1]), type: 'untyped', persistent: !!m[2] })
    }

    return out.filter((e) => parseFormula(e.formula) !== null)
}

/** "1d6" + "fire" → "1d6 de fogo", para os avisos em pt-BR. */
export const formulaLabel = (entry: DamageEntry, typeLabel: string): string =>
    `${entry.formula} de ${typeLabel.toLowerCase()}`
