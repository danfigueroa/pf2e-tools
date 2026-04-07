import { searchAon, extractMainDescription, translateToPortuguese, cleanAonText, generateFallbackDescription } from './_lib/aon.js'

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
    const apiKey = process.env.GROQ_API_KEY

    // Tenta múltiplas categorias: spell → cantrip → focus
    let bestMatch = null
    for (const cat of ['spell', 'cantrip', 'focus']) {
      const results = await searchAon(name, cat, 10)
      const exact = results.find(r => r._source.name?.toLowerCase() === name.toLowerCase())
      if (exact) { bestMatch = exact; break }
      if (!bestMatch && results.length > 0) bestMatch = results[0]
    }

    if (!bestMatch) {
      // Fallback: gera descrição via Groq
      const fallback = await generateFallbackDescription(name, 'spell', apiKey)
      if (fallback) {
        return res.status(200).json({ name, actions: '', traits: [], range: '', area: '', targets: '', duration: '', defense: '', description: fallback, damage: '', damageType: '', heightened: '' })
      }
      return res.status(404).json({ error: 'Magia não encontrada' })
    }

    const source = bestMatch._source
    let description = extractMainDescription(source.text || source.markdown || '', 600)

    const spellData = {
      name: source.name || name,
      actions: source.actions || '',
      traits: source.trait || [],
      range: cleanAonText(source.range || ''),
      area: cleanAonText(source.area || ''),
      targets: cleanAonText(source.targets || ''),
      duration: cleanAonText(source.duration || ''),
      defense: cleanAonText(source.saving_throw || source.defense || ''),
      description,
      damage: '',
      damageType: '',
      heightened: ''
    }

    if (apiKey && spellData.description) {
      spellData.description = await translateToPortuguese(spellData.description, apiKey)
    }

    return res.status(200).json(spellData)
  } catch (error) {
    console.error('Spell API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar magia' })
  }
}

