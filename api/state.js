// Estado de jogo compartilhado da mesa. O despacho (e a regra de quem pode o quê) vive
// em api/_lib/state-router.js, compartilhado com server/index.mjs; a persistência, em
// api/_lib/table-store.js.
//
// Mora em api/state.js (um nível) de propósito: o glob "api/*.js" do
// vercel.json não alcança subpastas, então api/state/[char].js perderia o
// maxDuration configurado.
import { routeState } from './_lib/state-router.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  // Estado de jogo muda a todo momento: nunca servir de cache de borda.
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { status, body } = await routeState({
    req,
    method: req.method,
    query: req.query || {},
    body: req.body || {},
  })
  return res.status(status).json(body)
}
