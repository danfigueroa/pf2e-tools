// Busca de criaturas no Archives of Nethys para o gerenciador de iniciativa.
//
// TUDO aqui vem dos campos ESTRUTURADOS do índice (`hp`, `ac`, `perception`,
// `resistance`, `weakness`, `immunity`, `trait`…) — a categoria `creature` do
// Elasticsearch já expõe os números prontos. Por isso este núcleo **não passa
// pela cadeia de tradução**: o Gemini free é limitado a 15 RPM e o Groq a 8.000
// TPM, e uma busca que traduzisse 8 resultados a cada tecla travaria a mesa
// inteira. O vocabulário curto (traços, tamanho, raridade, tipos de dano) é
// traduzido no cliente, por src/modules/transformation-statblock/i18n.ts.

import { searchAon } from './aon.js'

const AON_BASE = 'https://2e.aonprd.com'

/** Criaturas com variantes trazem arrays (`hp: [40, 55]`). Vale a primeira. */
function firstNumber(value, fallback = 0) {
  const raw = Array.isArray(value) ? value[0] : value
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw
  return Number.isFinite(n) ? n : fallback
}

/**
 * `resistance`/`weakness` são objetos `{ tipo: valor }`, mas o valor às vezes é
 * texto com ressalva ("5 (except cold iron)"). O que não vira número puro sai
 * como nota — a ferramenta nunca inventa um número que o GM não conferiu.
 */
function splitDefense(raw, label, notes) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [type, value] of Object.entries(raw)) {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10)
    const clean = String(value).trim()
    if (Number.isFinite(n) && /^\d+$/.test(clean)) {
      out[type.toLowerCase()] = n
    } else {
      notes.push(`${label} ${type} ${clean}`)
    }
  }
  return out
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

/** Entradas pré-Remaster apontam para a versão nova por `remaster_id`. */
const isLegacy = (source) =>
  (Array.isArray(source?.remaster_id) && source.remaster_id.length > 0)
  || (Array.isArray(source?.remaster_name) && source.remaster_name.length > 0)

function normalize(hit) {
  const s = hit?._source
  if (!s || !s.name) return null

  const defenseNotes = []
  const resistances = splitDefense(s.resistance, 'resistência', defenseNotes)
  const weaknesses = splitDefense(s.weakness, 'fraqueza', defenseNotes)

  const url = String(s.url || '')

  return {
    name: s.name,
    level: firstNumber(s.level, 0),
    hp: firstNumber(s.hp ?? s.hp_raw, 0),
    ac: firstNumber(s.ac, 0),
    perception: firstNumber(s.perception, 0),
    saves: {
      fort: firstNumber(s.fortitude_save, 0),
      ref: firstNumber(s.reflex_save, 0),
      will: firstNumber(s.will_save, 0),
    },
    traits: toArray(s.trait),
    size: toArray(s.size)[0] || null,
    rarity: s.rarity || null,
    family: s.creature_family || null,
    resistances,
    weaknesses,
    immunities: toArray(s.immunity).map(i => String(i).toLowerCase()),
    defenseNotes,
    speed: s.speed && typeof s.speed === 'object' ? s.speed : {},
    source: s.primary_source || null,
    url: url.startsWith('http') ? url : AON_BASE + url,
  }
}

/**
 * Até `limit` criaturas que casam com `query`, já normalizadas.
 *
 * A mesma criatura aparece várias vezes no índice: a versão legacy (Bestiary) e
 * as reimpressões remaster. Descarta a legacy e mantém só a primeira ocorrência
 * de cada nome — o GM procurando "goblin warrior" quer uma linha, não três.
 * Busca mais hits do que devolve, porque a deduplicação come parte deles.
 */
export async function resolveCreatures(query, limit = 8) {
  const size = Math.min(Math.max(limit, 1), 20)
  const hits = await searchAon(query, 'creature', size * 3)
  const seen = new Set()
  const out = []
  for (const hit of hits) {
    if (isLegacy(hit?._source)) continue
    const creature = normalize(hit)
    if (!creature) continue
    const key = creature.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(creature)
    if (out.length >= size) break
  }
  return out
}
