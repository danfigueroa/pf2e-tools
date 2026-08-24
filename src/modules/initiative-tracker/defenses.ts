// Resistência, fraqueza e imunidade por tipo de dano.
//
// Os tipos ficam CANÔNICOS EM INGLÊS, como o resto dos dados mecânicos do
// projeto (é o que a AON devolve e o que `translateDamageType` traduz no
// render). Aqui só entra o casamento por tipo.

import { translateDamageType } from '../transformation-statblock/i18n'

/** Tipos que o diálogo de dano oferece, na ordem em que aparecem. */
export const DAMAGE_TYPES = [
    'bludgeoning', 'piercing', 'slashing',
    'acid', 'cold', 'electricity', 'fire', 'sonic', 'force',
    'vitality', 'void', 'spirit', 'mental', 'poison', 'bleed', 'precision', 'untyped',
] as const

export type DamageType = (typeof DAMAGE_TYPES)[number]

/**
 * Guarda-chuvas: uma resistência a "physical" cobre contundente, perfurante e
 * cortante; "all" cobre tudo. Sem isso, "resistance physical 5" do stat block
 * nunca casaria com um golpe cortante.
 */
const UMBRELLAS: Record<string, string[]> = {
    physical: ['bludgeoning', 'piercing', 'slashing'],
    energy: ['acid', 'cold', 'electricity', 'fire', 'sonic', 'vitality', 'void'],
}

/** As chaves de defesa que se aplicam a um tipo de dano, da mais específica à mais ampla. */
function keysFor(type: string): string[] {
    const t = type.toLowerCase()
    const keys = [t, 'all']
    for (const [umbrella, members] of Object.entries(UMBRELLAS)) {
        if (members.includes(t)) keys.push(umbrella)
    }
    return keys
}

/**
 * O maior valor aplicável — resistências e fraquezas do mesmo alvo **não
 * somam** entre si (RAW: vale a que der o melhor resultado para o defensor no
 * caso de resistência, e nunca se acumulam por serem de fontes diferentes).
 */
export function defenseValue(map: Record<string, number>, type: string): number {
    let best = 0
    for (const key of keysFor(type)) {
        const value = map[key]
        if (typeof value === 'number' && value > best) best = value
    }
    return best
}

export function isImmune(immunities: string[], type: string): boolean {
    const keys = keysFor(type)
    return immunities.some((i) => keys.includes(i.toLowerCase()))
}

/**
 * As resistências do Pathbuilder são strings livres ("fire 5", "physical 10").
 * O que casa com `<tipo> <número>` vira número; o resto vira nota, para o GM
 * decidir — a ferramenta nunca inventa um valor que ninguém conferiu.
 */
export function parseResistanceStrings(entries: string[]): {
    values: Record<string, number>
    notes: string[]
} {
    const values: Record<string, number> = {}
    const notes: string[] = []
    for (const entry of entries) {
        const text = String(entry).trim()
        if (!text) continue
        const m = text.match(/^([a-zA-Z-]+)\s+(\d+)$/)
        if (m) values[m[1].toLowerCase()] = parseInt(m[2], 10)
        else notes.push(text)
    }
    return { values, notes }
}

/**
 * Rótulo em pt-BR, capitalizado. `untyped` não existe no dicionário do módulo
 * de transformação (lá todo dano tem tipo), então entra aqui.
 */
export function damageTypeLabel(type: string): string {
    const label = type === 'untyped' ? 'sem tipo' : translateDamageType(type)
    return label.charAt(0).toUpperCase() + label.slice(1)
}
