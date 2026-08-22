// Helpers específicos de MAGIA sobre o inglês canônico do AON (dano e
// heightening). A escolha do hit e o split do texto são genéricos e vivem em
// aon-parse.js, compartilhados com talentos/habilidades.

// Dano estruturado a partir da prosa EN (primeira ocorrência; conservador).
export function extractDamage(proseEN) {
  const text = String(proseEN || '')
  const dmg = text.match(/(\d+d\d+(?:[+-]\d+)?)\s+(?:persistent\s+)?([a-z]+)\s+damage/i)
  if (dmg) return { damage: dmg[1], damageTypeEN: dmg[2].toLowerCase() }
  const heal = text.match(/restor(?:e|es|ing)\s+(?:up to\s+)?(\d+d\d+(?:[+-]\d+)?)\s+(?:\w+\s+)?Hit Points/i)
  if (heal) return { damage: heal[1], damageTypeEN: 'healing' }
  return { damage: '', damageTypeEN: '' }
}

const DAMAGE_TYPES = {
  fire: 'fogo',
  cold: 'frio',
  electricity: 'eletricidade',
  acid: 'ácido',
  sonic: 'sônico',
  force: 'força',
  vitality: 'vitalidade',
  positive: 'vitalidade',
  void: 'vácuo',
  negative: 'vácuo',
  mental: 'mental',
  poison: 'veneno',
  bludgeoning: 'contundente',
  piercing: 'perfurante',
  slashing: 'cortante',
  spirit: 'espiritual',
  bleed: 'sangramento',
  chaotic: 'caótico',
  evil: 'maligno',
  good: 'benigno',
  lawful: 'leal',
  healing: 'cura',
}

export function translateDamageType(typeEN) {
  const t = String(typeEN || '').toLowerCase()
  return DAMAGE_TYPES[t] ?? String(typeEN || '')
}

// Tradução determinística dos textos de heightening mais comuns. A captura é
// restrita a expressões de dado/número — frases compostas ("... and the
// weakness increases by 1") NÃO casam de propósito e caem no Groq/EN, para
// nunca produzir tradução parcial. Retorna null quando o padrão não casa.
const DICE_OR_NUM = String.raw`((?:\d+d\d+|\d+)(?:\s*[+-]\s*\d+)?)`
const HEIGHTEN_PATTERNS = [
  [new RegExp(`^The damage increases by ${DICE_OR_NUM}\\.?$`, 'i'), 'O dano aumenta em $1.'],
  [new RegExp(`^The damage increases to ${DICE_OR_NUM}\\.?$`, 'i'), 'O dano passa a ser $1.'],
  [new RegExp(`^The amount of healing or damage increases by ${DICE_OR_NUM}\\.?$`, 'i'), 'A quantidade de cura ou dano aumenta em $1.'],
  [new RegExp(`^The amount of healing increases by ${DICE_OR_NUM}\\.?$`, 'i'), 'A quantidade de cura aumenta em $1.'],
  [new RegExp(`^The initial damage increases by ${DICE_OR_NUM}\\.?$`, 'i'), 'O dano inicial aumenta em $1.'],
  [new RegExp(`^The persistent damage increases by ${DICE_OR_NUM}\\.?$`, 'i'), 'O dano persistente aumenta em $1.'],
  [new RegExp(`^The healing increases by ${DICE_OR_NUM}\\.?$`, 'i'), 'A cura aumenta em $1.'],
  [new RegExp(`^The temporary Hit Points increase by ${DICE_OR_NUM}\\.?$`, 'i'), 'Os Pontos de Vida temporários aumentam em $1.'],
]

export function translateHeightenedText(textEN) {
  const t = String(textEN || '').trim()
  for (const [re, sub] of HEIGHTEN_PATTERNS) {
    if (re.test(t)) return t.replace(re, sub)
  }
  return null
}
