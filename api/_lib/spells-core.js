// Resolução de magia única e compartilhada entre as funções serverless
// (api/spells.js, api/spell.js) e o servidor de dev (server/index.mjs).
// Busca no AON, parseia a estrutura em EN (aon-parse.js), traduz SÓ a prosa
// com validação anti-truncamento e devolve payload estruturado.

import { searchAon, cleanAonText, translateSegments, generateFallbackDescription } from './aon.js'
import { translateMetadata } from './metadata-i18n.js'
import { pickBestHit, parseAonText } from './aon-parse.js'
import { extractDamage, translateDamageType, translateHeightenedText } from './spell-parse.js'
import { buildScaling } from './spell-scaling.js'

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

/** Busca no AON e parseia em EN — a parte barata, sem LLM. */
async function prepareSpell(name, translationEnabled) {
  let best = null
  for (const cat of ['spell', 'cantrip', 'focus']) {
    const results = await searchAon(name, cat, 10)
    const pick = pickBestHit(results, name)
    if (pick && pick._source?.name?.toLowerCase() === String(name).toLowerCase()) { best = pick; break }
    if (!best && pick) best = pick
  }

  if (!best) {
    const fallback = await generateFallbackDescription(name, 'spell', translationEnabled)
    return { name, done: emptySpell(name, fallback) }
  }

  const source = best._source
  const parsed = parseAonText(source.text || '', source.markdown)
  let proseEN = parsed.proseEN
  if (!proseEN) proseEN = cleanAonText(source.markdown || '')

  // Entradas de heightening: o dicionário determinístico resolve a maioria; o
  // que sobra vai para o LLM junto com a prosa.
  const heightened = parsed.heightenedEntries.map((entry) => ({
    level: entry.level,
    en: entry.text,
    text: translateHeightenedText(entry.text),
  }))

  // Trechos que precisam do LLM, na ordem: prosa primeiro, depois heightening.
  const segments = []
  if (translationEnabled && proseEN) segments.push(proseEN)
  if (translationEnabled) for (const h of heightened) if (!h.text && h.en) segments.push(h.en)

  return { name, source, parsed, proseEN, heightened, segments }
}

/** Monta o payload a partir do que `prepareSpell` achou e das traduções (na ordem de `segments`). */
async function finishSpell(prep, translated, translationEnabled) {
  const { name, source, parsed, proseEN, heightened } = prep
  const { damage, damageTypeEN } = extractDamage(proseEN)
  // Números da prosa e como o heightening mexe em cada um — sobre o EN, antes
  // da tradução. O cliente aplica no rank conjurado (heightening.ts).
  const scaling = buildScaling(proseEN, parsed.heightenedEntries)

  // Se o resultado vier vazio ou suspeito de truncamento, mantém o EN completo —
  // nunca truncar. translationPending marca payloads que ficaram em EN por falha
  // (ex.: 429): server e client NÃO devem cachear, para retraduzirem depois.
  let next = 0
  let translationPending = false
  let description = proseEN
  if (translationEnabled && proseEN) {
    const t = translated[next++]
    if (t && t !== proseEN && t.trim().length >= proseEN.length * 0.4) description = t
    else translationPending = true
  }
  if (!description || description.trim().length < 20) {
    const fallback = await generateFallbackDescription(name, 'spell', translationEnabled)
    if (fallback) description = fallback
  }

  const heightenedEntries = heightened.map((h) => {
    let text = h.text
    if (!text && translationEnabled && h.en) {
      const t = translated[next++]
      if (t && t !== h.en && t.trim().length >= h.en.length * 0.4) text = t
      else translationPending = true
    }
    return { level: h.level, text: text || h.en }
  })

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
    ...(scaling ? { scaling } : {}),
    ...(translationPending ? { translationPending: true } : {}),
  }
}

/**
 * Várias magias de uma vez. A busca no AON roda em paralelo e a tradução de
 * TODAS vai numa chamada só (marcadores <<N>>, `translateSegments`): o gargalo
 * do "Carregar todas" era o espaço de 4,2 s entre chamadas do Gemini, e uma
 * chamada por magia (mais uma por heightening) custava ~10 s cada.
 * Devolve os payloads na ordem de `names`.
 */
export async function resolveSpells(names, translationEnabled) {
  const preps = await Promise.all(names.map((n) => prepareSpell(n, translationEnabled)))
  const owners = []
  const segments = []
  preps.forEach((prep, i) => {
    for (const seg of prep.segments ?? []) { owners.push(i); segments.push(seg) }
  })
  const translated = segments.length > 0 ? await translateSegments(segments, translationEnabled) : []
  const perSpell = preps.map(() => [])
  translated.forEach((t, k) => perSpell[owners[k]].push(t))
  return Promise.all(preps.map((prep, i) =>
    prep.done ? prep.done : finishSpell(prep, perSpell[i], translationEnabled)))
}

export async function resolveSpell(name, translationEnabled) {
  const [spell] = await resolveSpells([name], translationEnabled)
  return spell
}
