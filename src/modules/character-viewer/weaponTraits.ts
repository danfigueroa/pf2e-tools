import { isEn } from '../../i18n'
/**
 * O traço de arma como a AON o registra: "Deadly d10" → "Deadly", "Fatal 1d10" → "Fatal",
 * "Volley 30 ft." → "Volley", "Versatile S" → "Versatile", "Twin (Sheath)" → "Twin".
 * (`weaponTraitName` em `api/_lib/rule-core.js` é a mesma conta — mudou uma, muda a outra.)
 *
 * Não use o `traitTerm` do stat block de monstro aqui: ele tira os dígitos e deixa "Deadly d".
 */
export function traitName(raw: string): string {
    return String(raw || '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\b\d*d\d+\b/gi, ' ')
        .replace(/\d+\s*(?:feet|foot|ft\.?)?/gi, ' ')
        .replace(/^(versatile|modular)\b.*$/i, '$1')
        .replace(/\s+/g, ' ')
        .trim()
}

/** O vocabulário da ficha (igual a `TRAIT_PT` de `api/_lib/rule-core.js` — mudou uma, muda a outra). Só do português. */
/* i18n-ignore-file */
export const TRAIT_PT: Record<string, string> = {
    agile: 'ágil',
    finesse: 'acuidade',
    deadly: 'letal',
    versatile: 'versátil',
    forceful: 'impetuoso',
    sweep: 'amplo',
    shove: 'empurrar',
    backswing: 'contragolpe',
    thrown: 'arremesso',
    unarmed: 'desarmado',
    trip: 'derrubar',
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const meters = (ft: number) => `${String(Math.round(ft * 0.3 * 10) / 10).replace('.', ',')} m`

/**
 * O que vem depois do nome do traço, em português: "30 ft." → "9 m" (a ficha é em metros), "Versatile S"
 * → "C" (cortante), "d10" e "(Sheath)" ficam.
 */
function restPt(base: string, rest: string): string {
    let out = rest.replace(/(\d+(?:[.,]\d+)?)\s*(?:feet|foot|ft\.?)/gi, (_, n: string) => meters(parseFloat(n.replace(',', '.'))))
    if (/^(versatile|modular)$/i.test(base)) out = out.replace(/\bS\b/g, 'C')
    return out
}

/**
 * O chip do traço em português: "Deadly d10" → "Letal d10", "Volley 30 ft." → "Salva 9 m". `label` é o
 * nome em português que o servidor guardou (para o que não está no vocabulário da ficha); sem nenhum
 * dos dois, fica o nome da AON.
 */
export function traitLabel(raw: string, label?: string | null): string {
    const text = raw.trim()
    const base = traitName(text)
    if (!base) return text
    const at = text.toLowerCase().indexOf(base.toLowerCase())
    const rest = at >= 0 ? text.slice(at + base.length) : ''
    // Em inglês o chip mostra o traço como a AON escreve (o `label` do servidor também vem em inglês).
    if (isEn) return capitalize(text)
    const name = TRAIT_PT[base.toLowerCase()] ?? label ?? base
    return capitalize(`${name}${restPt(base, rest)}`.trim())
}
