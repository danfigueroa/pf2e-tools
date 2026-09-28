// Traços dos itens do inventário, DIRETO DO AON E SEM TRADUÇÃO.
//
// Serve ao Inventário da Ficha Virtual: saber quais itens são consumíveis (para
// ganharem o botão de usar) e, nos de cura, qual fórmula rolar. O Pathbuilder
// não ajuda — exporta poção e veneno com o status "Invested", igual a um anel.
//
// **Não passa pela cadeia de tradução**, pelo mesmo motivo de `creature-core.js`
// e `rule-core.js`: o índice já traz `trait`, `level` e `item_subcategory`
// estruturados, e a ficha inteira pediria uma tradução por item só para saber
// se ele é consumível. O inglês aqui é o resultado pretendido.

import { searchAonRaw } from './aon.js'
import { isLegacy, toArray } from './creature-core.js'

/** Teto por requisição: um inventário de verdade não chega perto disso. */
export const MAX_ITEM_NAMES = 60

// "The potion restores 2d8+5 Hit Points." / "The elixir restores 3d6+6 Hit Points".
// Só dado com modificador opcional — cura fixa ("restores 5 Hit Points") fica
// de fora, e aí o item é consumido sem cura automática.
const HEALING_RE = /restores?\s+(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)\s+Hit Points/i

const norm = (name) => String(name || '').trim().toLowerCase()

/** A fórmula de cura, só para item com o traço Healing. */
function healingFormula(source, traits) {
  if (!traits.some((t) => norm(t) === 'healing')) return null
  for (const text of [source.summary, source.text, source.markdown]) {
    const m = HEALING_RE.exec(String(text || ''))
    if (m) return m[1].replace(/\s+/g, '')
  }
  return null
}

/**
 * Um acerto por nome pedido. O nome vem EXATO do Pathbuilder, então o casamento
 * é por `name.keyword` numa busca só; entre a entrada remaster e a legacy de
 * mesmo nome, vale a remaster.
 *
 * @param {string[]} names
 * @returns {Promise<Record<string, object>>} chaveado pelo nome de ENTRADA
 */
export async function resolveItemTraits(names) {
  const wanted = [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))]
    .slice(0, MAX_ITEM_NAMES)
  if (wanted.length === 0) return {}

  const { hits } = await searchAonRaw({
    category: 'equipment',
    // Legacy e reimpressões repetem o nome: folga para todas caberem.
    limit: wanted.length * 4,
    filters: [{ terms: { 'name.keyword': wanted } }],
  })

  const byName = new Map()
  for (const hit of hits) {
    const s = hit?._source
    if (!s?.name) continue
    const key = norm(s.name)
    const current = byName.get(key)
    if (!current || (isLegacy(current) && !isLegacy(s))) byName.set(key, s)
  }

  const out = {}
  for (const name of wanted) {
    const s = byName.get(norm(name))
    if (!s) continue
    const traits = toArray(s.trait).map(String)
    out[name] = {
      name: s.name,
      level: typeof s.level === 'number' ? s.level : null,
      traits,
      subcategory: s.item_subcategory || null,
      consumable: traits.some((t) => norm(t) === 'consumable'),
      healing: healingFormula(s, traits),
    }
  }
  return out
}
