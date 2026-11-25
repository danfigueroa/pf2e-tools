// Health check endpoint. Também é o keep-alive do Supabase: o cron do
// vercel.json chama esta rota todo dia (ver `pingDatabase`). Uma vez por semana, também verifica livros novos e
// erratas na AON para a base de regras do Criador (`weeklyRuleCheck`; nunca importa sozinho).
import { isSupabaseConfigured, pingDatabase } from './_lib/supabase.js'
import { weeklyRuleCheck } from './_lib/rules-platform.js'

export default async function handler(req, res) {
  const database = await pingDatabase()
  const rules = isSupabaseConfigured() ? await weeklyRuleCheck() : null
  res.status(200).json({ status: 'ok', message: 'API funcionando!', database, rules })
}
