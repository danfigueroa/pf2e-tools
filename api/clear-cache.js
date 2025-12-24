import { clearCache } from './_lib/aon.js'

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }
  
  clearCache()
  return res.status(200).json({ status: 'ok', message: 'Cache limpo' })
}

