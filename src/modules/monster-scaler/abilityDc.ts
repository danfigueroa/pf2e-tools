// CDs escritas na PROSA das habilidades especiais.
//
// A CD de conjuração já vinha estruturada do índice (`spell_dc`), mas a CD de
// "Breath Weapon (DC 36 basic Reflex save)" e a de "Frightful Presence … DC 33"
// existem só como texto dentro da habilidade. Numa amostra de 400 criaturas do
// índice, 329 (82%) têm pelo menos uma — deixá-las intactas devolvia um monstro
// de nível 16 pedindo a salvaguarda de um de nível 3, que é o número que mais
// importa na mesa depois da CA.
//
// A prosa continua em inglês e intocada no resto (decisão de produto): o que se
// reescreve aqui são os DÍGITOS da CD, nada mais.

import type { ParsedAbility } from './types'

/**
 * `DC 27` na prosa.
 *
 * O TESTE PLANO fica de fora: "DC 15 flat check" e "DC 5 flat check" são CDs
 * fixas do sistema (Player Core), não benchmarks de criatura — subi-las com o
 * nível transformaria uma regra geral em número inventado.
 *
 * O `\b` depois de `\d+` não é enfeite: sem ele o motor faz backtracking em
 * "DC 15 flat check", casa só o "1" (aí o lookahead passa, porque depois vem
 * "5 flat check") e a CD do teste plano viraria "DC 275".
 */
const DC_RE = /(\bDC\s*)(\d+)\b(?!\s+flat check)/g

export interface AbilityDcGroup {
    value: number
    /** Habilidades em que essa CD aparece, na ordem da ficha. */
    abilities: string[]
}

/**
 * As CDs distintas da ficha, agrupadas pelo valor.
 *
 * Agrupar por VALOR, e não por ocorrência, é o que mantém o painel de ajuste
 * legível: das 400 criaturas da amostra, nenhuma passa de quatro CDs distintas,
 * enquanto as ocorrências chegam a dez. E CDs iguais são iguais de propósito —
 * a Breath Weapon e a Frightful Presence de um dragão saem do mesmo benchmark,
 * então têm que continuar iguais depois da escala.
 */
export function collectAbilityDcs(abilities: ParsedAbility[]): AbilityDcGroup[] {
    const byValue = new Map<number, AbilityDcGroup>()
    for (const ability of abilities) {
        for (const match of ability.text.matchAll(DC_RE)) {
            const value = parseInt(match[2], 10)
            if (!Number.isFinite(value)) continue
            const group = byValue.get(value) ?? { value, abilities: [] }
            if (!group.abilities.includes(ability.name)) group.abilities.push(ability.name)
            byValue.set(value, group)
        }
    }
    return [...byValue.values()].sort((a, b) => b.value - a.value)
}

/** Troca as CDs da prosa pelas do nível-alvo. Valor sem entrada no mapa fica como está. */
export function rewriteAbilityDcs(text: string, scaled: Map<number, number>): string {
    return text.replace(DC_RE, (whole, prefix: string, digits: string) => {
        const to = scaled.get(parseInt(digits, 10))
        return to === undefined ? whole : `${prefix}${to}`
    })
}
