// Estado de jogo compartilhado da mesa. Toda a persistência vive em
// api/_lib/table-store.js, compartilhado com server/index.mjs.
//
// Mora em api/state.js (um nível) de propósito: o glob "api/*.js" do
// vercel.json não alcança subpastas, então api/state/[char].js perderia o
// maxDuration configurado.
import {
  readCharacter,
  writeField,
  isValidSlug,
  isValidField,
  isStoreConfigured,
  MAX_FIELD_BYTES,
} from './_lib/table-store.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  // Estado de jogo muda a todo momento: nunca servir de cache de borda.
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    const char = req.query?.char
    if (!isValidSlug(char)) {
      return res.status(400).json({ error: 'Parâmetro "char" inválido' })
    }
    try {
      const fields = await readCharacter(char)
      // Personagem sem estado ainda não é erro — devolve o mapa vazio.
      return res.status(200).json({ char, fields, storeReady: isStoreConfigured() })
    } catch (error) {
      console.error('[/api/state] Erro ao ler:', error)
      return res.status(500).json({ error: 'Erro ao ler o estado da mesa' })
    }
  }

  if (req.method === 'POST') {
    const { char, field, data } = req.body || {}
    if (!isValidSlug(char)) {
      return res.status(400).json({ error: 'Campo "char" inválido' })
    }
    if (!isValidField(field)) {
      return res.status(400).json({ error: 'Campo "field" inválido' })
    }
    if (data === undefined) {
      return res.status(400).json({ error: 'Campo "data" ausente' })
    }
    // O endpoint é público: um teto por escrita evita encher o Redis.
    if (JSON.stringify(data).length > MAX_FIELD_BYTES) {
      return res.status(400).json({ error: 'Estado grande demais' })
    }
    try {
      const updatedAt = await writeField(char, field, data)
      return res.status(200).json({ ok: true, updatedAt, storeReady: isStoreConfigured() })
    } catch (error) {
      console.error('[/api/state] Erro ao gravar:', error)
      return res.status(500).json({ error: 'Erro ao gravar o estado da mesa' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
