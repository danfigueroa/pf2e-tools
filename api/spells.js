// Batch endpoint: busca múltiplas magias em paralelo.
// Toda a resolução (busca AON + parse estrutural + tradução) vive em
// api/_lib/spells-core.js, compartilhado com api/spell.js e server/index.mjs.
import { resolveSpell } from './_lib/spells-core.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let names
  try {
    names = req.body?.names
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'Campo "names" deve ser um array não-vazio' })
    }
  } catch {
    return res.status(400).json({ error: 'Body inválido' })
  }

  const apiKey = process.env.GROQ_API_KEY

  try {
    const CONCURRENCY = 3
    const results = {}
    for (let i = 0; i < names.length; i += CONCURRENCY) {
      const batch = names.slice(i, i + CONCURRENCY)
      const resolved = await Promise.all(batch.map(n => resolveSpell(n, apiKey)))
      // Chavear pelo nome de INPUT (não pelo nome retornado do AON), assim o
      // frontend encontra a magia mesmo quando o AON normaliza capitalização/sufixo.
      resolved.forEach((r, idx) => { results[batch[idx]] = r })
    }
    return res.status(200).json(results)
  } catch (error) {
    console.error('Spells batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar magias' })
  }
}
