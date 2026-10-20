// Mesas: cada grupo de jogo enxerga só o que é dele (fichas publicadas, estado
// dos personagens, mapas, rolagens, regras compartilhadas).
//
// A separação é um namespace de chave: `pf2e:<resto>` vira `pf2e:m:<mesa>:<resto>`.
// A mesa LEGADA (a que existia antes de haver mesas) fica sem prefixo, com as
// chaves de sempre — nada migra, e um pedido sem `?mesa=` continua lendo e
// gravando exatamente onde lia antes.
//
// A lista existe duas vezes: aqui e em `src/services/mesa.ts` (o servidor é JS
// puro e não importa o TS). Mudou uma, muda a outra.

export const LEGACY_MESA = 'casa-do-gordo'
export const MESA_IDS = [LEGACY_MESA, 'arton-1515']

/**
 * A mesa do pedido, pelo `?mesa=` da query (também no POST). Ausente é a
 * legada; desconhecida é `null`, e quem chama responde 400 — um erro de
 * digitação no link não pode criar uma mesa fantasma.
 */
export function mesaFrom(query) {
    const id = query?.mesa
    if (id === undefined || id === '') return LEGACY_MESA
    return MESA_IDS.includes(id) ? id : null
}

/** A chave de `key` na mesa: idêntica na legada, com `m:<mesa>:` nas outras. */
export function scoped(mesa, key) {
    if (!mesa || mesa === LEGACY_MESA) return key
    return key.replace(/^pf2e:/, `pf2e:m:${mesa}:`)
}
