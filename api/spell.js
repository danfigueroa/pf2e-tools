import { searchAon, extractMainDescription, translateToPortuguese, cleanAonText } from './_lib/aon.js'

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
    return res.status(400).json({ error: 'Nome da magia é obrigatório' })
  }
  
  try {
    const results = await searchAon(name, 'spell', 10)
    
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
      return res.status(404).json({ error: 'Magia não encontrada' })
    }
    
    const source = bestMatch._source
    let description = source.text || source.markdown || ''
    description = extractMainDescription(description, 600)
    
    // Extrai informações da magia
    const spellData = {
      name: source.name || name,
      actions: source.actions || '',
      traits: source.trait || [],
      range: cleanAonText(source.range || ''),
      area: cleanAonText(source.area || ''),
      targets: cleanAonText(source.targets || ''),
      duration: cleanAonText(source.duration || ''),
      defense: cleanAonText(source.saving_throw || source.defense || ''),
      description: description,
      damage: '',
      damageType: '',
      heightened: ''
    }
    
    // Traduz se tiver API key
    const apiKey = process.env.GROQ_API_KEY
    if (apiKey && spellData.description) {
      spellData.description = await translateToPortuguese(spellData.description, apiKey)
    }
    
    return res.status(200).json(spellData)
  } catch (error) {
    console.error('Spell API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar magia' })
  }
}

