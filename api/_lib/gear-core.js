// Traços das armas e números das armaduras, DIRETO DO AON E SEM TRADUÇÃO.
//
// O Pathbuilder exporta a arma já somada (ataque, dados, bônus de dano), mas não
// os TRAÇOS — e a rolagem depende deles: ágil muda o MAP (−4/−8), acuidade e
// "à distância" dizem se o ataque é de FOR ou DES (e, com isso, qual condição
// pesa), propulsiva/arremesso dizem se Enfraquecido baixa o dano, e deadly/fatal
// mudam o crítico. Da armadura, a penalidade nas perícias e a FOR que a zera.
//
// Duas fontes no índice, como em `shield-core.js`:
// - **Base** (categoria `weapon`/`armor`): `trait_raw` ("Deadly d10",
//   "Fatal 1d10", "Thrown 20 ft."), `weapon_type` (Melee/Ranged),
//   `check_penalty` e `strength` estruturados.
// - **Específico** (categoria `equipment`: Gloom Blade, Hero's Plate): os
//   traços de arma são os do `base_item`, mais os do próprio item.
//
// Não passa pela tradução, pelo mesmo motivo de `item-traits-core.js`: são
// palavras de regra, lidas por código, não por gente.

import { searchAonRaw } from './aon.js'
import { isLegacy, toArray } from './creature-core.js'

export const MAX_GEAR_NAMES = 20

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

/** "[Shortsword](/Weapons.aspx?ID=43)" ou "Shortsword" → "Shortsword". */
function baseItemName(s) {
  const raw = toArray(s.base_item)[0] || ''
  const link = /\[([^\]]+)\]/.exec(String(raw))
  return (link ? link[1] : String(raw)).trim()
}

const traitsOf = (s) => toArray(s.trait_raw ?? s.trait).map((t) => String(t).trim()).filter(Boolean)

function weaponEntry(name, base, own = []) {
  const type = String(base.weapon_type || '').toLowerCase()
  return {
    kind: 'weapon',
    name,
    base: base.name,
    // Os do item específico entram depois dos da base, sem repetir.
    traits: [...new Set([...traitsOf(base), ...own])],
    weaponType: type === 'melee' || type === 'ranged' ? type : null,
    // Grupo da arma ("Knife", "Hammer"): decide a especialização crítica.
    group: base.weapon_group ? String(base.weapon_group).trim() : null,
  }
}

const num = (v) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function armorEntry(name, base) {
  return {
    kind: 'armor',
    name,
    base: base.name,
    // O índice guarda a penalidade já negativa ("-2"); zero quando não há.
    checkPenalty: Math.min(0, num(base.check_penalty) ?? 0),
    strength: num(base.strength),
    category: base.armor_category ? String(base.armor_category).toLowerCase() : null,
  }
}

/**
 * Os traços de cada arma e os números de cada armadura pedidos, chaveados pelo
 * nome de ENTRADA. O que o AON não tem fica de fora — quem chama trata a
 * ausência (e avisa), a ferramenta não inventa traço.
 *
 * @param {string[]} names
 * @returns {Promise<Record<string, object>>}
 */
export async function resolveGear(names) {
  const wanted = [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))]
    .slice(0, MAX_GEAR_NAMES)
  if (wanted.length === 0) return {}

  const [weapons, armors] = await Promise.all([byNames('weapon', wanted), byNames('armor', wanted)])
  const out = {}
  const missing = []
  for (const name of wanted) {
    const w = weapons.get(norm(name))
    const a = armors.get(norm(name))
    if (w) out[name] = weaponEntry(name, w)
    else if (a) out[name] = armorEntry(name, a)
    else missing.push(name)
  }
  if (missing.length === 0) return out

  // Item específico: segue o `base_item` até a arma ou armadura de que é feito.
  const specifics = await byNames('equipment', missing)
  const linked = []
  for (const name of missing) {
    const s = specifics.get(norm(name))
    const base = s && baseItemName(s)
    if (base) linked.push({ name, s, base })
  }
  const baseNames = [...new Set(linked.map((l) => l.base))]
  const [baseWeapons, baseArmors] = await Promise.all([byNames('weapon', baseNames), byNames('armor', baseNames)])
  for (const { name, s, base } of linked) {
    const w = baseWeapons.get(norm(base))
    const a = baseArmors.get(norm(base))
    if (w) out[name] = weaponEntry(name, w, traitsOf(s))
    else if (a) out[name] = armorEntry(name, a)
  }
  return out
}
