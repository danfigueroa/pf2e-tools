// Batch endpoint: busca stats de múltiplos companheiros animais. O núcleo fica
// em api/_lib/companion-core.js, compartilhado com api/companion.js e
// server/index.mjs.
import { resolveCompanion } from './_lib/companion-core.js'
import { hasTranslationKey } from './_lib/aon.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const names = req.body?.names
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'Campo "names" deve ser um array não-vazio' })
  }

  const translationEnabled = hasTranslationKey()

  try {
    // Um por vez: cada chamada já é pesada (busca no AON + extração via LLM).
    const results = {}
    for (const name of names) {
      const stats = await resolveCompanion(name, translationEnabled)
      if (stats) results[name] = stats
    }
    return res.status(200).json(results)
  } catch (error) {
    console.error('Companions batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar companheiros' })
  }
}
