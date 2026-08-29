// Ficha completa de uma criatura da AON, para o módulo de escalar monstro.
// Só dados estruturados e parse determinístico — não passa pela cadeia de
// tradução (ver monster-core.js).
import { resolveMonster } from './_lib/monster-core.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const name = req.query?.name ? String(req.query.name).trim() : ''
  if (!name) {
    return res.status(400).json({ error: 'Informe o nome da criatura' })
  }

  try {
    const monster = await resolveMonster(name)
    if (!monster) {
      return res.status(404).json({ error: 'Criatura não encontrada' })
    }
    return res.status(200).json(monster)
  } catch (error) {
    console.error('Monster API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar criatura' })
  }
}
