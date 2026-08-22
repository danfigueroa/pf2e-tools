// Resolução de magia única e compartilhada entre as funções serverless
// (api/spells.js, api/spell.js) e o servidor de dev (server/index.mjs).
// Busca no AON, parseia a estrutura em EN (aon-parse.js), traduz SÓ a prosa
// com validação anti-truncamento e devolve payload estruturado.

import { searchAon, cleanAonText, translateToPortuguese, generateFallbackDescription } from './aon.js'
import { translateMetadata } from './metadata-i18n.js'
import { pickBestHit, parseAonText } from './aon-parse.js'
import { extractDamage, translateDamageType, translateHeightenedText } from './spell-parse.js'

const TRADITION_KEYWORDS = ['arcane', 'divine', 'occult', 'primal']

function emptySpell(name, description) {
  return {
    name,
    level: null,
    actions: '',
    traits: [],
    range: '',
    area: '',
    targets: '',
    duration: '',
    defense: '',
    description: description || null,
    damage: '',
    damageType: '',
    heightened: {},
    heightenedEntries: [],
  }
}

export async function resolveSpell(name, translationEnabled) {
  let best = null
  for (const cat of ['spell', 'cantrip', 'focus']) {
    const results = await searchAon(name, cat, 10)
    const pick = pickBestHit(results, name)
    if (pick && pick._source?.name?.toLowerCase() === String(name).toLowerCase()) { best = pick; break }
    if (!best && pick) best = pick
  }

  if (!best) {
    const fallback = await generateFallbackDescription(name, 'spell', translationEnabled)
    return emptySpell(name, fallback)
  }

  const source = best._source
  const parsed = parseAonText(source.text || '')
  let proseEN = parsed.proseEN
  if (!proseEN) proseEN = cleanAonText(source.markdown || '')

  const { damage, damageTypeEN } = extractDamage(proseEN)

  // Tradução robusta: só a prosa passa pelo Groq; se o resultado vier vazio ou
  // suspeito de truncamento (< 40% do EN), mantém o EN completo — nunca truncar.
  // translationPending marca payloads que ficaram em EN por falha (ex.: 429 do
  // Groq): server e client NÃO devem cachear, para retraduzirem depois.
  let translationPending = false
  let description = proseEN
  if (translationEnabled && proseEN) {
    const translated = await translateToPortuguese(proseEN, translationEnabled)
    if (translated && translated !== proseEN && translated.trim().length >= proseEN.length * 0.4) {
      description = translated
    } else {
      translationPending = true
    }
  }
  if (!description || description.trim().length < 20) {
    const fallback = await generateFallbackDescription(name, 'spell', translationEnabled)
    if (fallback) description = fallback
  }

  // Entradas de heightening: dicionário determinístico → Groq → EN.
  const heightenedEntries = []
  for (const entry of parsed.heightenedEntries) {
    let text = translateHeightenedText(entry.text)
    if (!text && translationEnabled && entry.text) {
      const translated = await translateToPortuguese(entry.text, translationEnabled)
      if (translated && translated !== entry.text && translated.trim().length >= entry.text.length * 0.4) {
        text = translated
      } else {
        translationPending = true
      }
    }
    heightenedEntries.push({ level: entry.level, text: text || entry.text })
  }

  // Prefere os campos *_raw do AON (ex.: "30 feet" em vez de só "30").
  const rangeStr = source.range_raw || (source.range != null ? String(source.range) : '')
  const areaStr = source.area_raw || (Array.isArray(source.area) ? source.area.join(', ') : (source.area || ''))
  const targetsStr = source.targets_raw || source.targets || source.target || ''
  const durationStr = source.duration_raw || (source.duration != null ? String(source.duration) : '')
  const defenseStr = source.saving_throw || source.defense || ''

  const allTraits = source.trait || []
  const traditions = source.tradition && source.tradition.length > 0
    ? source.tradition
    : allTraits.filter(t => TRADITION_KEYWORDS.includes((t || '').toLowerCase()))
  const traits = allTraits.filter(t => !TRADITION_KEYWORDS.includes((t || '').toLowerCase()))

  return {
    name: source.name || name,
    // Rank base da magia no AON — o client usa para calcular heightening.
    level: typeof source.level === 'number' ? source.level : null,
    // Padrão de heighten do AON (ex. ["+1"]), quando o texto não for parseável.
    heighten: Array.isArray(source.heighten) && source.heighten.length > 0 ? source.heighten : undefined,
    sourceBook: parsed.sourceBook || undefined,
    actions: source.actions || '',
    traits: traits.length > 0 ? traits : (traditions.length === 0 ? allTraits : []),
    traditions: traditions.length > 0 ? traditions : undefined,
    castComponents: cleanAonText(source.cast_components || source.components || ''),
    range: translateMetadata(cleanAonText(rangeStr)),
    area: translateMetadata(cleanAonText(areaStr)),
    targets: translateMetadata(cleanAonText(targetsStr)),
    duration: translateMetadata(cleanAonText(durationStr)),
    defense: translateMetadata(cleanAonText(defenseStr)),
    description: description || null,
    damage,
    damageType: translateDamageType(damageTypeEN),
    heightened: {},
    heightenedEntries,
    ...(translationPending ? { translationPending: true } : {}),
  }
}
