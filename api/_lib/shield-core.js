// Números dos escudos (bônus na CA, Dureza, PV, BT), DIRETO DO AON E SEM TRADUÇÃO.
//
// O Pathbuilder exporta o escudo em `build.armor` só com nome, runas e o bônus
// na CA — nada de Dureza nem PV, que é o que o Bloqueio com Escudo precisa.
//
// Duas fontes no índice:
// - **Escudo base** (categoria `shield`): `ac`, `hardness`, `hp` e `hp_raw`
//   ("24 (12)", o BT entre parênteses) estruturados.
// - **Escudo específico** (categoria `equipment`, Clockwork Shield…): os números
//   só existem na prosa — "(Hardness 12, HP 90, BT 45)" — e o bônus na CA é o do
//   escudo base de que ele é feito (`base_item`).
//
// Não passa pela tradução, pelo mesmo motivo de `item-traits-core.js`.

import { searchAonRaw } from './aon.js'
import { isLegacy, toArray } from './creature-core.js'
import { parseShieldStats } from './shield-parse.js'

export const MAX_SHIELD_NAMES = 10

const norm = (name) => String(name || '').trim().toLowerCase()

/** Entre reimpressões de mesmo nome, vale a remaster. */
function bestByName(hits) {
  const byName = new Map()
  for (const hit of hits) {
    const s = hit?._source
    if (!s?.name) continue
    const key = norm(s.name)
    const current = byName.get(key)
    if (!current || (isLegacy(current) && !isLegacy(s))) byName.set(key, s)
  }
  return byName
}

async function byNames(category, names) {
  if (names.length === 0) return new Map()
  const { hits } = await searchAonRaw({
    category,
    limit: names.length * 4,
    filters: [{ terms: { 'name.keyword': names } }],
  })
  return bestByName(hits)
}

function baseStats(s) {
  const hp = typeof s.hp === 'number' ? s.hp : parseInt(s.hp, 10)
  const btMatch = /\((\d+)\)/.exec(String(s.hp_raw || ''))
  if (!Number.isFinite(hp)) return null
  return {
    bonus: typeof s.ac === 'number' ? s.ac : parseInt(s.ac, 10) || 2,
    hardness: typeof s.hardness === 'number' ? s.hardness : parseInt(s.hardness, 10) || 0,
    hp,
    bt: btMatch ? parseInt(btMatch[1], 10) : Math.floor(hp / 2),
  }
}

/** "[Steel Shield](/Shields.aspx?ID=19)" ou "Steel Shield" → "Steel Shield". */
function baseItemName(s) {
  const raw = toArray(s.base_item)[0] || ''
  const link = /\[([^\]]+)\]/.exec(String(raw))
  return (link ? link[1] : String(raw)).trim()
}

/**
 * Os números de cada escudo pedido, chaveados pelo nome de ENTRADA. Escudo que
 * o AON não tem (ou específico sem números legíveis) fica de fora — quem chama
 * trata a ausência, a ferramenta não inventa dureza.
 *
 * @param {string[]} names
 * @returns {Promise<Record<string, {name: string, bonus: number, hardness: number, hp: number, bt: number, specific: boolean}>>}
 */
export async function resolveShields(names) {
  const wanted = [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))]
    .slice(0, MAX_SHIELD_NAMES)
  if (wanted.length === 0) return {}

  const out = {}
  const bases = await byNames('shield', wanted)
  const missing = []
  for (const name of wanted) {
    const s = bases.get(norm(name))
    const stats = s && baseStats(s)
    if (stats) out[name] = { name: s.name, ...stats, specific: false }
    else missing.push(name)
  }
  if (missing.length === 0) return out

  const specifics = await byNames('equipment', missing)
  const parsed = []
  for (const name of missing) {
    const s = specifics.get(norm(name))
    const stats = s && (parseShieldStats(s.text) || parseShieldStats(s.markdown))
    if (stats) parsed.push({ name, s, stats, base: baseItemName(s) })
  }
  // O bônus na CA do específico é o do escudo base de que ele é feito.
  const baseOf = await byNames('shield', [...new Set(parsed.map((p) => p.base).filter(Boolean))])
  for (const { name, s, stats, base } of parsed) {
    const b = baseOf.get(norm(base))
    const bonus = b ? (typeof b.ac === 'number' ? b.ac : parseInt(b.ac, 10) || 2) : 2
    out[name] = { name: s.name, bonus, ...stats, specific: true }
  }
  return out
}
