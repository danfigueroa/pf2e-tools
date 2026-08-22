// Resolução de companheiro animal, compartilhada entre as funções serverless
// (api/companion.js, api/companions.js) e o servidor de dev (server/index.mjs).
//
// TUDO que é número vem dos campos ESTRUTURADOS do AON (strength, hp, size,
// speed, skill…) ou de um parse determinístico do texto — nunca de LLM. O
// modelo só traduz prosa (o resumo e o benefício de apoio). Antes os stats eram
// extraídos por LLM e vinham errados: o exemplo do prompt vazava para a saída
// (todo companheiro virava "Pequeno") e os dados dependiam do humor do modelo.
//
// O payload é a base CANÔNICA do companheiro jovem (young). A progressão
// (mature / nimble / savage) e o nível são aplicados no frontend, em
// src/modules/character-viewer/companionStats.ts, porque dependem da ficha.

import { searchAon, cleanAonText, translateSegments } from './aon.js'
import { pickBestHit } from './aon-parse.js'

// No AON, companheiros animais ficam na categoria 'animal-companion' (ex.:
// "Bear", "Wolf"). Sem o filtro, a busca por "Bear" cai na creature-family ou
// no feat genérico "Animal Companion".
async function findCompanion(name) {
  const byCategory = await searchAon(name, 'animal-companion', 10)
  const pick = pickBestHit(byCategory, name)
  if (pick?._source?.name?.toLowerCase() === String(name).toLowerCase()) return pick
  return pick || null
}

// Ataques no _source.text seguem um formato regular:
//   "Melee Single Action\njaws, Damage 1d8 piercing"
//   "Melee Single Action\nclaw (Agile), Damage 1d6 slashing"
// O bloco termina no primeiro "Str +N" (início dos modificadores de atributo).
const ATTACK_RE = /(Melee|Ranged)\s+((?:Single|Two|Three)\s+Actions?|Free\s+Action|Reaction)\s*([^,(]+?)\s*(?:\(([^)]*)\))?\s*,\s*Damage\s+(\d+d\d+)\s+(\w+)/gi

function parseAttacks(text) {
  const attacks = []
  const cut = text.split(/\bStr\s*[+-]\d/)[0] || text
  let m
  ATTACK_RE.lastIndex = 0
  while ((m = ATTACK_RE.exec(cut)) !== null) {
    attacks.push({
      category: m[1].toLowerCase(),          // melee | ranged
      actions: m[2].replace(/\s+/g, ' ').trim(),
      name: m[3].replace(/\s+/g, ' ').trim(),
      traits: m[4] ? m[4].split(',').map(t => t.trim()).filter(Boolean) : [],
      damageDice: m[5],                      // "1d8" — dado BASE (young)
      damageType: m[6].toLowerCase(),        // canônico EN; traduzido no render
    })
  }
  return attacks
}

// "… Support Benefit <prosa> Advanced Maneuver <Nome>" no fim do texto.
function parseTail(text) {
  const support = text.match(/Support Benefit\s+([\s\S]*?)(?=\s*Advanced Maneuver\s|$)/i)
  const maneuver = text.match(/Advanced Maneuver\s+([^\n]+?)\s*$/i)
  return {
    supportBenefitEN: support ? support[1].replace(/\s+/g, ' ').trim() : '',
    // Nome próprio de uma ação ("Bear Hug") — fica em INGLÊS, como os demais
    // nomes canônicos do projeto, para casar com a busca no AON.
    advancedManeuver: maneuver ? maneuver[1].trim() : null,
  }
}

export async function resolveCompanion(name, translationEnabled) {
  const best = await findCompanion(name)
  if (!best) return null

  const s = best._source
  const text = cleanAonText(s.text || s.markdown || '')
  if (!text) return null

  const { supportBenefitEN, advancedManeuver } = parseTail(text)
  const summaryEN = String(s.summary || '').trim()
  // O campo `sense` do AON vem com espaçamento sujo dos links removidos:
  // " low-light vision ,  scent  ( imprecise , 30 feet)".
  const sensesEN = String(s.sense || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim()

  const [summary, supportBenefit] = await translateSegments(
    [summaryEN, supportBenefitEN],
    translationEnabled,
  )

  const speeds = {}
  if (s.speed && typeof s.speed === 'object') {
    for (const [k, v] of Object.entries(s.speed)) {
      if (k !== 'max' && typeof v === 'number') speeds[k] = v
    }
  }

  return {
    name: s.name || name,
    summary: summary || summaryEN || '',
    sourceBook: (text.match(/Source\s+(.+?)\s+pg\.\s*(\d+)/i) || []).slice(1, 3).join(', p. ') || undefined,

    // Base canônica do companheiro JOVEM. Tamanho em inglês (traduzido no
    // render), como o resto do vocabulário mecânico do projeto.
    size: Array.isArray(s.size) ? s.size[0] : (s.size || 'Medium'),
    speed: speeds.land ?? s.speed?.land ?? 25,
    speeds,
    ancestryHp: Number(s.hp) || 0,
    abilities: {
      str: Number(s.strength) || 0,
      dex: Number(s.dexterity) || 0,
      con: Number(s.constitution) || 0,
      int: Number(s.intelligence) || 0,
      wis: Number(s.wisdom) || 0,
      cha: Number(s.charisma) || 0,
    },
    // Perícia extra treinada que vem do tipo do animal.
    skills: Array.isArray(s.skill) ? s.skill : (s.skill ? [s.skill] : []),
    senses: sensesEN,
    attacks: parseAttacks(text),
    supportBenefit: supportBenefit || supportBenefitEN || '',
    advancedManeuver,
    mount: Boolean(s.mount),
    ...(supportBenefitEN && !supportBenefit && translationEnabled ? { translationPending: true } : {}),
  }
}
