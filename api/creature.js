// Busca de criaturas na AON para o gerenciador de iniciativa.
// Só dados estruturados — não passa pela cadeia de tradução (ver creature-core.js).
import { resolveCreatures } from './_lib/creature-core.js'

/** Nível aceita negativo (criaturas de nível -1); ausente e inválido viram null. */
function parseLevel(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { q, limit, minLevel, maxLevel } = req.query
  const term = q ? String(q).trim() : ''
  const min = parseLevel(minLevel)
  const max = parseLevel(maxLevel)

  // Sem nome E sem faixa de nível, a busca devolveria o bestiário inteiro.
  if (!term && min === null && max === null) {
    return res.status(400).json({ error: 'Informe um nome ou uma faixa de nível' })
  }

  try {
    const { results, total } = await resolveCreatures(term, parseInt(limit, 10) || 8, {
      minLevel: min,
      maxLevel: max,
    })
    return res.status(200).json({ results, total })
  } catch (error) {
    console.error('Creature API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar criatura' })
  }
}
