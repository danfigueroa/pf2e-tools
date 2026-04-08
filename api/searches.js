// Batch endpoint: busca múltiplas habilidades especiais em paralelo
import { searchAon, extractMainDescription, translateToPortuguese, generateFallbackDescription } from './_lib/aon.js'

async function resolveSpecial(name, apiKey) {
  const cleanedName = name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\d+\s*feet?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  let bestMatch = null
  for (const cat of ['class-feature', 'feat', 'action', null]) {
    const results = await searchAon(cleanedName, cat, 10)
    const exact = results.find(r => r._source.name?.toLowerCase() === cleanedName.toLowerCase())
    if (exact) { bestMatch = exact; break }
    if (!bestMatch && results.length > 0) bestMatch = results[0]
  }

  if (bestMatch) {
    const source = bestMatch._source
    let description = extractMainDescription(source.text || source.markdown || '', 600)
    if (apiKey && description) {
      description = await translateToPortuguese(description, apiKey)
    }
    return { name, description: description || null, category: source.category, traits: source.trait || [] }
  }

  const fallback = await generateFallbackDescription(cleanedName, 'special', apiKey)
  return { name, description: fallback || null, category: 'unknown', traits: [] }
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
      const resolved = await Promise.all(batch.map(n => resolveSpecial(n, apiKey)))
      resolved.forEach(r => { results[r.name] = r })
    }
    return res.status(200).json(results)
  } catch (error) {
    console.error('Searches batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar habilidades' })
  }
}
