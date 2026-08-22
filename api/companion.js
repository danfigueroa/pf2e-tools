// Endpoint single (GET ?name=...) — legado; usa o mesmo núcleo do batch.
import { resolveCompanion } from './_lib/companion-core.js'
import { hasTranslationKey } from './_lib/aon.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { name } = req.query
  if (!name) return res.status(400).json({ error: 'Nome do animal é obrigatório' })

  try {
    const stats = await resolveCompanion(name, hasTranslationKey())
    if (!stats) {
      return res.status(404).json({ error: `Companheiro "${name}" não encontrado no AON` })
    }
    return res.status(200).json(stats)
  } catch (error) {
    console.error('Companion API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar companheiro' })
  }
}
