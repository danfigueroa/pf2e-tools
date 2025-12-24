import { searchAon, extractMainDescription, translateToPortuguese } from './_lib/aon.js'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  const { name } = req.query
  
  if (!name) {
    return res.status(400).json({ error: 'Nome do talento é obrigatório' })
  }
  
  try {
    const results = await searchAon(name, 'feat', 10)
    
    // Procura correspondência exata
    let bestMatch = results.find(r => {
      const source = r._source
      const hitName = (source.name || '').toLowerCase().trim()
      const searchName = name.toLowerCase().trim()
      return hitName === searchName
    })
    
    if (!bestMatch && results.length > 0) {
      bestMatch = results[0]
    }
    
    if (!bestMatch) {
      return res.status(404).json({ error: 'Talento não encontrado' })
    }
    
    const source = bestMatch._source
    let description = source.text || source.markdown || ''
    description = extractMainDescription(description, 800)
    
    // Traduz se tiver API key
    const apiKey = process.env.GROQ_API_KEY
    if (apiKey && description) {
      description = await translateToPortuguese(description, apiKey)
    }
    
    return res.status(200).json({
      name: source.name || name,
      description,
      level: source.level,
      traits: source.trait || []
    })
  } catch (error) {
    console.error('Feat API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar talento' })
  }
}

