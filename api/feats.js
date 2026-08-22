// Batch endpoint: busca múltiplos talentos. O núcleo fica em
// api/_lib/feat-core.js, compartilhado com api/feat.js e server/index.mjs.
import { resolveFeat, resolveMany } from './_lib/feat-core.js'
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

  try {
    const results = await resolveMany(names, hasTranslationKey(), resolveFeat)
    return res.status(200).json(results)
  } catch (error) {
    console.error('Feats batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar talentos' })
  }
}
