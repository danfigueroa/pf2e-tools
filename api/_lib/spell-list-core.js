// Lista de magias da AON, para escolher as magias de um monstro.
//
// Existe para o módulo de escalar monstro: quando o GM sobe o nível de um
// conjurador, a ficha ganha ranks e slots novos, e alguém precisa dizer QUAIS
// magias cabem ali. O índice já traz `tradition`, `level` (o rank) e
// `spell_type` estruturados, então — como `creature-core.js` e
// `affliction-core.js` — este núcleo **não passa pela cadeia de tradução**:
// traduzir 20 resultados a cada tecla estouraria o rate limit do tier gratuito.
//
// O nome da magia fica em INGLÊS de propósito, como no resto dos módulos: é a
// chave de busca na AON e o que o drawer de descrição consulta depois.

import { searchAonRaw } from './aon.js'
import { isLegacy, toArray } from './creature-core.js'

const AON_BASE = 'https://2e.aonprd.com'

/** O que o índice chama de `spell_type`. */
const KINDS = new Set(['spell', 'cantrip', 'focus'])

function normalize(hit) {
  const s = hit?._source
  if (!s || !s.name) return null
  const url = String(s.url || '')
  return {
    name: s.name,
    // `level` na categoria `spell` é o RANK da magia, não nível de personagem.
    rank: Number.isFinite(s.level) ? s.level : parseInt(s.level, 10) || 0,
    kind: String(s.spell_type || 'Spell').toLowerCase(),
    traditions: toArray(s.tradition).map((t) => String(t).toLowerCase()),
    traits: toArray(s.trait),
    rarity: s.rarity || 'common',
    url: url.startsWith('http') ? url : AON_BASE + url,
  }
}

/**
 * Magias de uma tradição até um rank.
 *
 * `maxRank` é TETO, não igualdade: uma magia de rank menor pode ocupar um slot
 * maior (é assim que se prepara uma magia elevada), e magia inata é escrita no
 * rank em que a criatura conjura. Filtrar por igualdade esconderia metade das
 * escolhas legítimas.
 *
 * A deduplicação e a paginação por cursor são as de `resolveCreatures`: o mesmo
 * nome aparece na entrada legacy e na reimpressão remaster, `total` é anterior
 * à deduplicação e quem acumula páginas deduplica por nome ao concatenar.
 *
 * @returns {Promise<{results: object[], total: number, nextOffset: number, hasMore: boolean}>}
 */
export async function resolveSpellList(
  query,
  limit = 20,
  { tradition = null, maxRank = null, minRank = null, kind = 'spell', offset = 0 } = {},
) {
  const size = Math.min(Math.max(limit, 1), 50)
  const from = Math.max(parseInt(offset, 10) || 0, 0)
  const term = String(query || '').trim()

  const filters = []
  const wanted = String(kind || 'spell').toLowerCase()
  if (KINDS.has(wanted)) filters.push({ term: { spell_type: wanted } })
  if (tradition) filters.push({ term: { tradition: String(tradition).toLowerCase() } })

  const range = {}
  if (Number.isFinite(maxRank)) range.lte = maxRank
  if (Number.isFinite(minRank)) range.gte = minRank
  if (Object.keys(range).length > 0) filters.push({ range: { level: range } })

  // Com termo manda a relevância; sem termo, a lista precisa de ordem explícita
  // ou o ES devolve uma ordem arbitrária que muda a cada busca. Rank DECRESCENTE
  // porque o slot novo quase sempre quer a magia mais alta que couber.
  const sort = term ? null : [{ level: 'desc' }, { 'name.keyword': 'asc' }]

  const fetchSize = size * 3
  const { hits, total } = await searchAonRaw({
    query: term,
    category: 'spell',
    limit: fetchSize,
    from,
    filters,
    sort,
  })

  const seen = new Set()
  const results = []
  let consumed = 0
  for (const hit of hits) {
    consumed += 1
    if (isLegacy(hit?._source)) continue
    const spell = normalize(hit)
    if (!spell) continue
    const key = spell.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(spell)
    if (results.length >= size) break
  }

  const exhausted = hits.length < fetchSize
  const hasMore = consumed < hits.length || (!exhausted && from + hits.length < total)

  return { results, total, nextOffset: from + consumed, hasMore }
}
