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
