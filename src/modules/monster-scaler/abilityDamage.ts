// Dano escrito na PROSA das habilidades: a baforada, a aura, o dano de área.
//
// O dano dos golpes já era reescalado (`shiftDamage` em `scaling.ts`, pela
// tabela de Strike Damage), mas "deals 15d6 fire damage in a 50-foot cone" é
// texto solto dentro da habilidade — e é o outro número que a mesa rola de
// verdade. Um dragão adulto levado para o nível 24 saía com CA, CD e golpes de
// nível 24 e uma baforada de nível 14.
//
// A tabela é a de Dano em Área do GM Core (pg. 124, `AREA_DAMAGE_TABLE`), com
// as colunas de uso ilimitado (à vontade) e uso limitado — a baforada é o
// exemplo que o próprio livro dá de uso limitado.
//
// SÓ VIRA DANO O QUE TEM UM TIPO AO LADO OU A PALAVRA `damage`. É a mesma regra
// de `initiative-tracker/dice.ts`, pelo mesmo motivo: sem ela, o "1d4 rounds"
// da recarga da baforada e o "1d4 rounds" de duração de condição entrariam na
// conta como se fossem dano.

import { DAMAGE_TYPES } from '../initiative-tracker/defenses'
import type { ParsedAbility } from './types'

/**
 * Nomes pré-Remaster que ainda aparecem em entrada antiga do índice. Só
 * precisam ser RECONHECIDOS como tipo de dano — nada aqui traduz nem
 * reescreve o tipo, apenas os dados.
 */
const LEGACY_TYPES = ['positive', 'negative', 'good', 'evil', 'lawful', 'chaotic']

const TYPE = [...DAMAGE_TYPES, ...LEGACY_TYPES].join('|')

/**
 * `15d6`, `2d8+4` — sempre com dado. Dano fixo escrito na prosa ("takes 3 fire
 * damage") fica de fora: sem dado não há o que reescalar sem inventar, e a
 * tabela do livro é toda em dados.
 */
const AMOUNT = String.raw`\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?`

// "15d6 fire damage", "2d6 persistent bleed", "4d6 damage".
const DAMAGE_RE = new RegExp(
    String.raw`(${AMOUNT})(\s+(?:persistent\s+)?(?:(?:${TYPE})\b(?:\s+damage)?|damage))`,
    'gi',
)

export interface AbilityDamageGroup {
    /** A fórmula como aparece na prosa, sem espaços: `15d6`, `2d8+4`. */
    formula: string
    /** Habilidades em que essa fórmula aparece, na ordem da ficha. */
    abilities: string[]
}

const norm = (formula: string) => formula.replace(/\s+/g, '')

/**
 * As fórmulas de dano distintas da prosa, agrupadas pelo texto da fórmula —
 * mesma escolha das CDs em `abilityDc.ts`, e pelo mesmo motivo: mantém o painel
 * curto e faz duas habilidades que batiam igual continuarem batendo igual.
 */
export function collectAbilityDamage(abilities: ParsedAbility[]): AbilityDamageGroup[] {
    const byFormula = new Map<string, AbilityDamageGroup>()
    for (const ability of abilities) {
        for (const match of ability.text.matchAll(DAMAGE_RE)) {
            const formula = norm(match[1])
            const group = byFormula.get(formula) ?? { formula, abilities: [] }
            if (!group.abilities.includes(ability.name)) group.abilities.push(ability.name)
            byFormula.set(formula, group)
        }
    }
    return [...byFormula.values()]
}

/** Troca as fórmulas da prosa pelas do nível-alvo. O que não estiver no mapa fica como está. */
export function rewriteAbilityDamage(text: string, scaled: Map<string, string>): string {
    return text.replace(DAMAGE_RE, (whole, formula: string, tail: string) => {
        const to = scaled.get(norm(formula))
        return to === undefined ? whole : `${to}${tail}`
    })
}
