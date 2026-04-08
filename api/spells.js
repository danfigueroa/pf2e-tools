// Batch endpoint: busca múltiplas magias em paralelo
import { searchAon, extractMainDescription, translateToPortuguese, cleanAonText, generateFallbackDescription } from './_lib/aon.js'

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
    return { name, actions: '', traits: [], range: '', area: '', targets: '', duration: '', defense: '', description: fallback || null, damage: '', damageType: '', heightened: '' }
  }

  const source = bestMatch._source
  let description = extractMainDescription(source.text || source.markdown || '', 600)
  if (apiKey && description) {
    description = await translateToPortuguese(description, apiKey)
  }

  return {
    name: source.name || name,
    actions: source.actions || '',
    traits: source.trait || [],
    range: cleanAonText(source.range || ''),
    area: cleanAonText(source.area || ''),
    targets: cleanAonText(source.targets || ''),
    duration: cleanAonText(source.duration || ''),
    defense: cleanAonText(source.saving_throw || source.defense || ''),
    description: description || null,
    damage: '',
    damageType: '',
    heightened: ''
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
      resolved.forEach(r => { results[r.name] = r })
    }
    return res.status(200).json(results)
  } catch (error) {
    console.error('Spells batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar magias' })
  }
}
