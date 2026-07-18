// Parse determinístico do texto de magias do AON, feito sobre o INGLÊS
// canônico — dano e heightening nunca dependem da tradução.
//
// O campo _source.text do AON tem estrutura regular:
//   <nome + ações + Source + metadados> --- <prosa> [--- Heightened (+1) ...]
// com separadores " --- " (cercados de espaços, não de newlines).

// Escolhe o melhor hit do Elasticsearch para um nome de magia:
// - só matches exatos de nome quando existirem;
// - descarta docs legacy renomeados (têm remaster_name apontando o nome novo);
// - prefere a versão Remaster (primary_source "Player Core*"), senão a de
//   release_date mais recente;
// - sem match exato, devolve o primeiro hit (fuzzy).
export function pickBestSpellHit(hits, name) {
  if (!Array.isArray(hits) || hits.length === 0) return null
  const lower = String(name).toLowerCase()
  const exact = hits.filter(h => h._source?.name?.toLowerCase() === lower)
  if (exact.length === 0) return hits[0]

  const current = exact.filter(h => !(Array.isArray(h._source.remaster_name) && h._source.remaster_name.length > 0))
  const pool = current.length > 0 ? current : exact

  const remaster = pool.find(h => /^player core/i.test(h._source.primary_source || ''))
  if (remaster) return remaster

  return [...pool].sort((a, b) =>
    String(b._source.release_date || '').localeCompare(String(a._source.release_date || '')),
  )[0]
}

// Divide o _source.text em { sourceBook, proseEN, heightenedEntries }.
// Nunca trunca: se a estrutura não for reconhecida, o texto inteiro vira prosa.
export function parseSpellText(rawText) {
  const text = String(rawText || '').trim()
  if (!text) return { sourceBook: '', proseEN: '', heightenedEntries: [] }

  const parts = text.split(/\s*---\s*/).map(p => p.trim()).filter(Boolean)
  const heightenedEntries = []
  let metaBlock = ''
  const proseParts = []

  if (parts.length === 1) {
    proseParts.push(parts[0])
  } else {
    metaBlock = parts[0]
    for (const part of parts.slice(1)) {
      if (/^Heightened\s*\(/i.test(part)) {
        // Um bloco pode concatenar várias entradas "Heightened (...)".
        for (const chunk of part.split(/(?=Heightened\s*\()/i)) {
          const m = chunk.trim().match(/^Heightened\s*\(([^)]+)\)\s*(.*)$/is)
          if (m) heightenedEntries.push({ level: m[1].trim(), text: m[2].trim() })
        }
      } else {
        proseParts.push(part)
      }
    }
  }

  return {
    sourceBook: extractSourceBook(metaBlock || text),
    proseEN: proseParts.join('\n\n'),
    heightenedEntries,
  }
}

function extractSourceBook(block) {
  const m = String(block).match(/Source\s+(.+?)\s+pg\.\s*(\d+)/i)
  return m ? `${m[1].trim()}, p. ${m[2]}` : ''
}

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
