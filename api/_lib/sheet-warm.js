// Ao publicar, as consultas da ficha à AON (traços de arma e armadura, consumíveis, escudos) já ficam
// no banco: quem abrir depois — e a rolagem, o Inventário, a aba de Combate — lê dali, sem AON.
// É um dos passos do preparo da publicação (`sheet-draft.js`), que espera tudo terminar e repete
// enquanto alguma regra de traço não sair traduzida (`pendingTraits`).

import { resolveGear, MAX_GEAR_NAMES } from './gear-core.js'
import { resolveItemTraits, MAX_ITEM_NAMES } from './item-traits-core.js'
import { resolveShields, MAX_SHIELD_NAMES } from './shield-core.js'
import { resolveTraitRules } from './rule-core.js'

// Traços dos ataques desarmados e das armas caseiras (`unarmed.ts`, `homebrewGear.ts`): não passam pelo `search?gear=`.
const UNARMED_TRAITS = ['Agile', 'Finesse', 'Nonlethal', 'Unarmed', 'Trip']

const names = (list, pick) => (Array.isArray(list) ? list : []).map(pick).filter((n) => typeof n === 'string' && n.trim())

/** @returns `{ pendingTraits }`: regras de traço que voltaram sem tradução (não foram ao banco). */
export async function warmSheetLookups(json) {
  const build = json?.build
  if (!build || typeof build !== 'object') return { pendingTraits: 0 }
  const weapons = names(build.weapons, (w) => w?.name)
  const armor = Array.isArray(build.armor) ? build.armor : []
  const shields = names(armor.filter((a) => a?.prof === 'shield'), (a) => a?.name)
  const worn = names(armor.filter((a) => a?.prof !== 'shield'), (a) => a?.name)
  const equipment = names(build.equipment, (e) => (Array.isArray(e) ? e[0] : null))
  // As regras dos traços das armas também ficam no banco: tocar no chip na ficha lê dali, sem esperar a AON.
  const gear = resolveGear([...weapons, ...worn].slice(0, MAX_GEAR_NAMES)).then(async (found) => {
    const traits = Object.values(found).flatMap((g) => (g?.kind === 'weapon' ? g.traits : []))
    // Os dois idiomas: quem abrir em inglês também lê do banco.
    const [pt] = await Promise.all([resolveTraitRules([...traits, ...UNARMED_TRAITS]), resolveTraitRules([...traits, ...UNARMED_TRAITS], 'en')])
    return Object.values(pt).filter((rule) => rule?.translationPending).length
  })
  // Falha de rede/AON sobe: o preparo tenta de novo.
  const [pendingTraits] = await Promise.all([
    gear,
    resolveItemTraits(equipment.slice(0, MAX_ITEM_NAMES)),
    resolveShields(shields.slice(0, MAX_SHIELD_NAMES)),
  ])
  return { pendingTraits }
}
