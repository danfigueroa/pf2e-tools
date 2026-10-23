// Ao publicar, as consultas da ficha à AON (traços de arma e armadura, consumíveis, escudos) já ficam
// no banco: quem abrir depois — e a rolagem, o Inventário, a aba de Combate — lê dali, sem AON.
// O que falhar aqui só deixa a consulta para a primeira abertura; nunca impede a publicação.

import { resolveGear, MAX_GEAR_NAMES } from './gear-core.js'
import { resolveItemTraits, MAX_ITEM_NAMES } from './item-traits-core.js'
import { resolveShields, MAX_SHIELD_NAMES } from './shield-core.js'

const names = (list, pick) => (Array.isArray(list) ? list : []).map(pick).filter((n) => typeof n === 'string' && n.trim())

export async function warmSheetLookups(json) {
  const build = json?.build
  if (!build || typeof build !== 'object') return
  const weapons = names(build.weapons, (w) => w?.name)
  const armor = Array.isArray(build.armor) ? build.armor : []
  const shields = names(armor.filter((a) => a?.prof === 'shield'), (a) => a?.name)
  const worn = names(armor.filter((a) => a?.prof !== 'shield'), (a) => a?.name)
  const equipment = names(build.equipment, (e) => (Array.isArray(e) ? e[0] : null))
  await Promise.allSettled([
    resolveGear([...weapons, ...worn].slice(0, MAX_GEAR_NAMES)),
    resolveItemTraits(equipment.slice(0, MAX_ITEM_NAMES)),
    resolveShields(shields.slice(0, MAX_SHIELD_NAMES)),
  ])
}
