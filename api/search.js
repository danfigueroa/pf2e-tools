// Endpoint single (GET ?name=...) — legado; usa o mesmo núcleo do batch.
import { resolveSpecial } from './_lib/feat-core.js'
import { hasTranslationKey } from './_lib/aon.js'

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
    return res.status(400).json({ error: 'Nome é obrigatório' })
  }

  try {
    const entry = await resolveSpecial(name, hasTranslationKey())
    if (!entry.description) {
      return res.status(404).json({ error: 'Item não encontrado' })
    }
    return res.status(200).json(entry)
  } catch (error) {
    console.error('Search API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar item' })
  }
}
