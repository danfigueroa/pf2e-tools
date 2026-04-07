import { searchAon, extractMainDescription, translateToPortuguese, generateFallbackDescription } from './_lib/aon.js'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { name, category } = req.query

  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório' })
  }

  // Limpa o nome para busca: remove "(imprecise) 30 feet" e similares
  const cleanedName = name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\d+\s*feet?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  try {
    const apiKey = process.env.GROQ_API_KEY

    // Se categoria foi especificada, usa diretamente
    if (category) {
      const results = await searchAon(cleanedName, category, 10)
      const bestMatch = results.find(r => r._source.name?.toLowerCase() === cleanedName.toLowerCase()) || results[0]
      if (bestMatch) {
        const source = bestMatch._source
        let description = extractMainDescription(source.text || source.markdown || '', 600)
        if (apiKey && description) description = await translateToPortuguese(description, apiKey)
        return res.status(200).json({ name: source.name || name, description, category: source.category, traits: source.trait || [] })
      }
    }

    // Busca em cascata por categoria para habilidades especiais
    const categoriesToTry = ['class-feature', 'feat', 'action', null]
    let bestMatch = null

    for (const cat of categoriesToTry) {
      const results = await searchAon(cleanedName, cat, 10)
      const exact = results.find(r => r._source.name?.toLowerCase() === cleanedName.toLowerCase())
      if (exact) { bestMatch = exact; break }
      if (!bestMatch && results.length > 0) bestMatch = results[0]
    }

    if (bestMatch) {
      const source = bestMatch._source
      let description = extractMainDescription(source.text || source.markdown || '', 600)
      if (apiKey && description) description = await translateToPortuguese(description, apiKey)
      return res.status(200).json({ name: source.name || name, description, category: source.category, traits: source.trait || [] })
    }

    // Fallback: gera descrição via Groq se item não está no AON
    const fallback = await generateFallbackDescription(cleanedName, 'special', apiKey)
    if (fallback) {
      return res.status(200).json({ name, description: fallback, category: 'unknown', traits: [] })
    }

    return res.status(404).json({ error: 'Item não encontrado' })
  } catch (error) {
    console.error('Search API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar item' })
  }
}

