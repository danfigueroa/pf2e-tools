// Endpoint single (GET ?name=...) — legado; usa o mesmo núcleo do batch.
import { resolveFeat } from './_lib/feat-core.js'

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
    const feat = await resolveFeat(name, process.env.GROQ_API_KEY)
    if (!feat.description) {
      return res.status(404).json({ error: 'Talento não encontrado' })
    }
    return res.status(200).json(feat)
  } catch (error) {
    console.error('Feat API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar talento' })
  }
}
