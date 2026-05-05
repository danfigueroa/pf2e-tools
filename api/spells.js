// Batch endpoint: busca múltiplas magias em paralelo
import { searchAon, extractMainDescription, translateToPortuguese, cleanAonText, generateFallbackDescription } from './_lib/aon.js'

// Tradução determinística para strings curtas e padronizadas (ranges, durations, defesas).
// Evita gastar uma chamada Groq por campo e mantém vocabulário consistente entre PDFs.
const METADATA_DICTIONARY = [
  [/\bfeet\b/gi, 'pés'],
  [/\bfoot\b/gi, 'pé'],
  [/\bmile(s)?\b/gi, 'milha$1'],
  [/\bround(s)?\b/gi, 'rodada$1'],
  [/\bturn(s)?\b/gi, 'turno$1'],
  [/\bminute(s)?\b/gi, 'minuto$1'],
  [/\bhour(s)?\b/gi, 'hora$1'],
  [/\bday(s)?\b/gi, 'dia$1'],
  [/\btouch\b/gi, 'toque'],
  [/\bself\b/gi, 'próprio'],
  [/\bunlimited\b/gi, 'ilimitado'],
  [/\bsustained\b/gi, 'sustentada'],
  [/\bup to\b/gi, 'até'],
  [/\bcreature(s)?\b/gi, 'criatura$1'],
  [/\bwilling\b/gi, 'disposta'],
  [/\bally\b/gi, 'aliado'],
  [/\benemy\b/gi, 'inimigo'],
  [/\bemanation\b/gi, 'emanação'],
  [/\bburst\b/gi, 'estouro'],
  [/\bcone\b/gi, 'cone'],
  [/\bline\b/gi, 'linha'],
  [/\bcube\b/gi, 'cubo'],
  [/\bWill\b/g, 'Vontade'],
  [/\bReflex\b/g, 'Reflexos'],
  [/\bFortitude\b/g, 'Fortitude'],
  [/\bbasic\b/gi, 'básico'],
  [/\bsave\b/gi, 'salvamento'],
]

function translateMetadata(text) {
  if (!text) return ''
  let out = String(text)
  for (const [re, sub] of METADATA_DICTIONARY) {
    out = out.replace(re, sub)
  }
  return out
}

// Extrai info de heightened do source AON. AON pode expor isso como objeto
// (heightened.X = "texto") ou via campos heighten_x. Retorna {} quando não houver.
function extractHeightened(source) {
  const out = {}
  if (source.heightened && typeof source.heightened === 'object' && !Array.isArray(source.heightened)) {
    for (const [k, v] of Object.entries(source.heightened)) {
      if (typeof v === 'string' && v.trim()) out[k] = cleanAonText(v)
    }
  }
  // Variações comuns: heighten_1, heighten_plus_1, heighten_level
  for (const key of Object.keys(source)) {
    if (/^heighten(?:_|ed_)/i.test(key) && typeof source[key] === 'string' && source[key].trim()) {
      const label = key.replace(/^heighten(?:ed)?_/i, '').replace(/_/g, ' ')
      out[label] = cleanAonText(source[key])
    }
  }
  return out
}

async function resolveSpell(name, apiKey) {
  let bestMatch = null
  for (const cat of ['spell', 'cantrip', 'focus']) {
    const results = await searchAon(name, cat, 10)
    const exact = results.find(r => r._source.name?.toLowerCase() === name.toLowerCase())
    if (exact) { bestMatch = exact; break }
    if (!bestMatch && results.length > 0) bestMatch = results[0]
  }

  if (!bestMatch) {
    const fallback = await generateFallbackDescription(name, 'spell', apiKey)
    return { name, actions: '', traits: [], range: '', area: '', targets: '', duration: '', defense: '', description: fallback || null, damage: '', damageType: '', heightened: {} }
  }

  const source = bestMatch._source
  let description = extractMainDescription(source.text || source.markdown || '', 600)
  if (apiKey && description) {
    description = await translateToPortuguese(description, apiKey)
  }
  // Se a extração não trouxe nada (texto curto demais ou estrutura inesperada),
  // ainda assim entregar uma descrição curta gerada pela LLM — paridade com feats.
  if (!description || description.trim().length < 20) {
    const fallback = await generateFallbackDescription(name, 'spell', apiKey)
    if (fallback) description = fallback
  }

  return {
    name: source.name || name,
    actions: source.actions || '',
    traits: source.trait || [],
    range: translateMetadata(cleanAonText(source.range || '')),
    area: translateMetadata(cleanAonText(source.area || '')),
    targets: translateMetadata(cleanAonText(source.targets || '')),
    duration: translateMetadata(cleanAonText(source.duration || '')),
    defense: translateMetadata(cleanAonText(source.saving_throw || source.defense || '')),
    description: description || null,
    damage: cleanAonText(source.damage || ''),
    damageType: cleanAonText(source.damage_type || source.damageType || ''),
    heightened: extractHeightened(source)
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let names
  try {
    names = req.body?.names
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'Campo "names" deve ser um array não-vazio' })
    }
  } catch {
    return res.status(400).json({ error: 'Body inválido' })
  }

  const apiKey = process.env.GROQ_API_KEY

  try {
    const CONCURRENCY = 3
    const results = {}
    for (let i = 0; i < names.length; i += CONCURRENCY) {
      const batch = names.slice(i, i + CONCURRENCY)
      const resolved = await Promise.all(batch.map(n => resolveSpell(n, apiKey)))
      // Chavear pelo nome de INPUT (não pelo nome retornado do AON), assim o
      // frontend encontra a magia mesmo quando o AON normaliza capitalização/sufixo.
      resolved.forEach((r, idx) => { results[batch[idx]] = r })
    }
    return res.status(200).json(results)
  } catch (error) {
    console.error('Spells batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar magias' })
  }
}
