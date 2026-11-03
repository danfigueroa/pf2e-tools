// Batch endpoint: busca stats de múltiplos companheiros animais. O núcleo fica
// em api/_lib/companion-core.js, compartilhado com api/companion.js e
// server/index.mjs.
import { resolveCompanions } from './_lib/companion-core.js'
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
    // Do banco quando já resolvidos (a publicação os deixa prontos); o resto, um por vez, pela AON.
    const clean = names.filter((n) => typeof n === 'string' && n.trim()).slice(0, 12)
    return res.status(200).json(await resolveCompanions(clean, lang))
  } catch (error) {
    console.error('Companions batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar companheiros' })
  }
}
