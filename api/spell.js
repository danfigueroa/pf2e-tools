// Endpoint single (GET ?name=...) — legado; usa o mesmo núcleo do batch.
import { resolveSpell } from './_lib/spells-core.js'

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
    const spellData = await resolveSpell(name, process.env.GROQ_API_KEY)
    if (!spellData.description) {
      return res.status(404).json({ error: 'Magia não encontrada' })
    }
    return res.status(200).json(spellData)
  } catch (error) {
    console.error('Spell API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar magia' })
  }
}
