// Health check endpoint. Também é o keep-alive do Supabase: o cron do
// vercel.json chama esta rota todo dia (ver `pingDatabase`).
import { pingDatabase } from './_lib/supabase.js'

export default async function handler(req, res) {
  const database = await pingDatabase()
  res.status(200).json({ status: 'ok', message: 'API funcionando!', database })
}
