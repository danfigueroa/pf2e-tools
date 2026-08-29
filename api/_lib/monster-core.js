// Criatura COMPLETA da AON, para o módulo de escalar monstro.
//
// Diferente de `creature-core.js`, que devolve o resumo de que o gerenciador de
// iniciativa precisa, aqui interessa a ficha inteira — e, principalmente, o
// DEGRAU DE BENCHMARK de cada estatística.
//
// A descoberta que sustenta o módulo: o índice da AON não guarda só os números,
// guarda em que coluna da tabela de construção de criaturas cada um cai
// (`ac_scale: "High"`, `strike_damage_scale: ["Low"]`, …). Numa amostra de 300
// criaturas, CA/PV/percepção/salvamentos/atributos têm degrau em 100% delas e
// os golpes em 98%. Sem isso, reescalar exigiria adivinhar a intenção do
// designer a partir do número.
//
// ATENÇÃO: o degrau é o mais PRÓXIMO, não um valor exato. O Bugbear Tormentor
// é "CA Alta" com CA 20, enquanto a tabela diz 19 no nível 3. Quem reescala
// precisa preservar essa diferença — ver `scaling.ts`.
//
// Como `creature-core.js`, NÃO passa pela cadeia de tradução: a prosa fica em
// inglês (decisão de produto) e os rótulos são traduzidos no cliente.

import { searchAonRaw } from './aon.js'
import { firstNumber, isLegacy, splitDefense, toArray } from './creature-core.js'
import { parseCreatureStatblock } from './creature-parse.js'

const AON_BASE = 'https://2e.aonprd.com'

/** Os únicos degraus que as tabelas do GM Core conhecem. */
const COLUMNS = new Set(['extreme', 'high', 'moderate', 'low', 'terrible'])

/**
 * Rótulo de degrau do AON ("High") → chave das tabelas ("high").
 *
 * Valida contra a lista porque a AON guarda a STRING "undefined" (não o valor
 * `undefined`) para criaturas fora da faixa das tabelas — a Tarrasque, nível 25,
 * é uma delas. Só minúsculas, `"undefined"` viraria um degrau que não existe em
 * tabela nenhuma, toda consulta falharia e a ficha voltaria intacta sem que
 * nada avisasse o motivo.
 */
function scale(value) {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const key = raw.toLowerCase()
  return COLUMNS.has(key) ? key : null
}

/** Degrau por golpe. A AON COLAPSA repetições: quase sempre vem um item só. */
function scaleList(value) {
  return toArray(value)
    .map((v) => scale(v))
    .filter((v) => v !== null)
}

function numberList(value) {
  return toArray(value)
    .map((v) => firstNumber(v, NaN))
    .filter((n) => Number.isFinite(n))
}

/** Modificadores de atributo com o degrau ao lado. */
function attributes(s) {
  const keys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
  const out = {}
  for (const key of keys) {
    out[key] = {
      value: firstNumber(s[key], 0),
      scale: scale(s[`${key}_scale`]),
    }
  }
  return out
}

/** `skill_mod` já vem estruturado: { acrobatics: 8, athletics: 9, … }. */
function skills(s) {
  const raw = s.skill_mod
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const [name, value] of Object.entries(raw)) {
    const n = firstNumber(value, NaN)
    if (Number.isFinite(n)) out[name.toLowerCase()] = n
  }
  return out
}

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

    // --- números com o degrau de benchmark ao lado ---
    ac: { value: firstNumber(s.ac, 0), scale: scale(s.ac_scale) },
    hp: { value: firstNumber(s.hp ?? s.hp_raw, 0), scale: scale(s.hp_scale) },
    perception: { value: firstNumber(s.perception, 0), scale: scale(s.perception_scale) },
    saves: {
      fort: { value: firstNumber(s.fortitude_save, 0), scale: scale(s.fortitude_save_scale) },
      ref: { value: firstNumber(s.reflex_save, 0), scale: scale(s.reflex_save_scale) },
      will: { value: firstNumber(s.will_save, 0), scale: scale(s.will_save_scale) },
    },
    attributes: attributes(s),
    skills: skills(s),

    // Um item por Strike, na ordem em que aparecem na ficha.
    attackBonuses: numberList(s.attack_bonus),
    attackScales: scaleList(s.attack_bonus_scale),
    damageAverages: numberList(s.strike_damage_average),
    damageScales: scaleList(s.strike_damage_scale),

    spellDc: firstNumber(s.spell_dc, 0) || null,
    spellDcScale: scale(s.spell_dc_scale),
    spellAttack: firstNumber(s.spell_attack_bonus, 0) || null,
    spellAttackScale: scale(s.spell_attack_bonus_scale),

    // --- passam intactos pela escala ---
    traits: toArray(s.trait),
    size: toArray(s.size)[0] || null,
    rarity: s.rarity || null,
    family: s.creature_family || null,
    languages: toArray(s.language),
    items: toArray(s.item),
    speed: s.speed && typeof s.speed === 'object' ? s.speed : {},
    sensesRaw: typeof s.sense === 'string' ? s.sense.replace(/\s+/g, ' ').trim() : null,
    resistances,
    weaknesses,
    immunities: toArray(s.immunity).map((i) => String(i).toLowerCase()),
    defenseNotes,

    source: s.primary_source || null,
    url: url.startsWith('http') ? url : AON_BASE + url,

    // Golpes, habilidades e conjuração, do markdown. `null` quando o documento
    // não tem ficha legível — aí o cliente mostra só os números estruturados.
    statblock: parseCreatureStatblock(s.markdown),
  }
}

/**
 * Escolhe o documento certo para um nome.
 *
 * Nome exato ganha de relevância: buscar "Badger" traz "Badger", "Giant Badger"
 * e "Badger Swarm", e o melhor `_score` nem sempre é o que se pediu.
 *
 * E o nome exato ganha TAMBÉM do filtro de legacy — nesta ordem, não na
 * inversa. Filtrar legacy primeiro e só depois procurar o nome faz "Adult Red
 * Dragon", que só existe como entrada do Bestiary, cair no melhor acerto
 * remaster que sobrou: o Adult Sea Dragon. Devolver a criatura errada é muito
 * pior do que devolver a versão pré-Remaster da criatura certa. Mesma regra de
 * `pickBestHit` em `aon-parse.js`.
 */
function pickHit(hits, name) {
  const wanted = String(name || '').trim().toLowerCase()
  const usable = hits.filter((h) => h?._source?.name)
  if (usable.length === 0) return null

  const exact = usable.filter((h) => h._source.name.toLowerCase() === wanted)
  const pool = exact.length > 0 ? exact : usable

  // Dentro do que sobrou, a reimpressão remaster tem preferência.
  return pool.find((h) => !isLegacy(h._source)) || pool[0]
}

/**
 * @param {string} name nome da criatura, em inglês (chave de busca no AON)
 * @returns {Promise<object|null>} ficha completa, ou `null` se não achou
 */
export async function resolveMonster(name) {
  const term = String(name || '').trim()
  if (!term) return null

  const { hits } = await searchAonRaw({ query: term, category: 'creature', limit: 12 })
  const hit = pickHit(hits, term)
  return hit ? normalize(hit) : null
}
