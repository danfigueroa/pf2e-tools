// Mesas: cada grupo de jogo enxerga só o que é dele (fichas publicadas, estado
// dos personagens, mapas, rolagens, regras compartilhadas).
//
// No banco a separação é a coluna `mesa` de cada tabela (com chave estrangeira
// para `mesas`). A mesa LEGADA (a que existia antes de haver mesas) é a padrão:
// um pedido sem `?mesa=` é dela — o mesmo contrato de antes, quando ela era a
// que tinha as chaves sem prefixo no Redis.
//
// A lista existe três vezes: aqui, em `src/services/mesa.ts` (o servidor é JS
// puro e não importa o TS) e na tabela `mesas` (as chaves estrangeiras). Mudou
// uma, muda as outras — mesa nova também é uma migration.

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
