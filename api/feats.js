// Batch endpoint: busca múltiplos talentos em paralelo
import { searchAon, extractMainDescription, translateToPortuguese, generateFallbackDescription } from './_lib/aon.js'

async function resolveFeat(name, apiKey) {
  const results = await searchAon(name, 'feat', 10)
  const bestMatch = results.find(r => r._source.name?.toLowerCase() === name.toLowerCase()) || results[0]

  if (!bestMatch) {
    const fallback = await generateFallbackDescription(name, 'feat', apiKey)
    return { name, description: fallback || null, level: null, traits: [] }
  }

  const source = bestMatch._source
  let description = extractMainDescription(source.text || source.markdown || '', 800)
  if (apiKey && description) {
    description = await translateToPortuguese(description, apiKey)
  }

  return { name: source.name || name, description: description || null, level: source.level, traits: source.trait || [] }
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
    // Processa em paralelo com limite de concorrência para não sobrecarregar Groq
    const CONCURRENCY = 3
    const results = {}
    for (let i = 0; i < names.length; i += CONCURRENCY) {
      const batch = names.slice(i, i + CONCURRENCY)
      const resolved = await Promise.all(batch.map(n => resolveFeat(n, apiKey)))
      resolved.forEach(r => { results[r.name] = r })
    }
    return res.status(200).json(results)
  } catch (error) {
    console.error('Feats batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar talentos' })
  }
}
