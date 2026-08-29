// Busca de aflições (venenos, doenças, maldições) no Archives of Nethys.
//
// Como `creature-core.js`, NÃO passa pela cadeia de tradução: o índice já traz
// `stage`, `saving_throw`, `onset_raw` e `duration_raw` estruturados, e traduzir
// a cada tecla estouraria o rate limit do tier gratuito.
//
// O que define uma aflição no índice é ter o campo `stage`. São ~230 não-legacy,
// espalhadas por `equipment` (venenos alquímicos) e `disease`.

import { searchAonRaw } from './aon.js'
import { isLegacy, normalizeAffliction } from './affliction-parse.js'

/**
 * @param {string} query termo em inglês (chave de busca no AON)
 * @param {number} limit quantas devolver
 * @returns {Promise<{results: object[]}>}
 */
export async function resolveAfflictions(query, limit = 10) {
  const term = String(query || '').trim()
  if (term.length < 2) return { results: [] }

  const size = Math.min(Math.max(limit, 1), 30)

  // Sem `category`: aflição vive em `equipment` e em `disease`. O filtro que
  // vale é ter estágio — é o que a torna rastreável.
  const { hits } = await searchAonRaw({
    query: term,
    limit: size * 3,
    filters: [{ exists: { field: 'stage' } }],
  })

  const seen = new Set()
  const results = []
  for (const hit of hits) {
    if (isLegacy(hit?._source)) continue
    const affliction = normalizeAffliction(hit)
    if (!affliction) continue
    // O índice repete o mesmo nome em reimpressões; uma linha por nome.
    const key = affliction.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(affliction)
    if (results.length >= size) break
  }

  return { results }
}
