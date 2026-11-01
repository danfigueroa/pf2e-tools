// Batch endpoint: busca múltiplas habilidades especiais/itens. O núcleo fica em
// api/_lib/feat-core.js, compartilhado com api/search.js e server/index.mjs.
import { resolveItem, resolveSpecial, resolveMany } from './_lib/feat-core.js'
import { hasTranslationKey } from './_lib/aon.js'
import { apiLang } from './_lib/i18n.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  const lang = apiLang(req, res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const names = req.body?.names
  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'Campo "names" deve ser um array não-vazio' })
  }

  try {
    // `?kind=item`: item do inventário (o acerto parcial só vale se for item também).
    const resolver = req.query?.kind === 'item' ? resolveItem : resolveSpecial
    const results = await resolveMany(names, lang === 'en' ? false : hasTranslationKey(), resolver, 3, lang)
    return res.status(200).json(results)
  } catch (error) {
    console.error('Searches batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar habilidades' })
  }
}
