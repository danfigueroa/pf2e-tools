// Busca de criaturas na AON para o gerenciador de iniciativa.
// Só dados estruturados — não passa pela cadeia de tradução (ver creature-core.js).
import { resolveCreatures } from './_lib/creature-core.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { q, limit } = req.query
  if (!q || !String(q).trim()) {
    return res.status(400).json({ error: 'Termo de busca é obrigatório' })
  }

  try {
    const results = await resolveCreatures(String(q).trim(), parseInt(limit, 10) || 8)
    return res.status(200).json({ results })
  } catch (error) {
    console.error('Creature API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar criatura' })
  }
}
