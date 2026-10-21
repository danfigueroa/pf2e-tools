// Cliente do Supabase no servidor (Postgres + Realtime + Storage), que vai
// substituindo o Upstash e o Vercel Blob domínio a domínio.
//
// Usa a chave SECRETA (`sb_secret_…`), que passa por cima do RLS: as funções
// continuam sendo as únicas que escrevem no banco, com as validações de sempre
// (`sanitizeRoll`, `FIELD_RE`, tetos de bytes). Nunca vai para o frontend — lá
// vale a chave publicável (src/services/supabase.ts).

import { createClient } from '@supabase/supabase-js'

// As credenciais são lidas do env na hora do uso, e sem elas o app segue
// funcionando com o que já tinha (cada store cai num Map de processo).
function credentials() {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    return url && key ? { url, key } : null
}

export const isSupabaseConfigured = () => credentials() !== null

let client = null
export function supabase() {
    if (!client) {
        const creds = credentials()
        if (!creds) return null
        client = createClient(creds.url, creds.key, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
    }
    return client
}

/**
 * Uma consulta mínima, para o `health` — chamado todo dia pelo cron da Vercel.
 * O plano gratuito PAUSA o projeto depois de 7 dias sem atividade, e a mesa joga
 * uma ou duas vezes por mês: sem isso, a sessão seguinte abriria com o banco
 * parado. Devolve `null` sem credenciais, `true`/`false` conforme o banco respondeu.
 */
export async function pingDatabase() {
    const db = supabase()
    if (!db) return null
    const { error } = await db.from('mesas').select('id').limit(1)
    if (error) console.error('[supabase] Ping falhou:', error.message)
    return !error
}

/**
 * A sessão anônima de quem fez o pedido (`Authorization: Bearer <jwt>`), ou
 * `null`. O JWT é conferido LOCALMENTE, contra as chaves públicas do projeto
 * (ES256, guardadas em cache pelo SDK) — nenhuma ida ao Auth por pedido. Serve
 * para registrar autoria; nunca para barrar alguém: sem sessão o pedido segue,
 * como antes de haver sessão.
 */
export async function requestUserId(req) {
    const header = req?.headers?.authorization
    const token = typeof header === 'string' ? header.match(/^Bearer\s+(\S+)$/)?.[1] : null
    const db = token ? supabase() : null
    if (!db) return null
    try {
        const { data, error } = await db.auth.getClaims(token)
        return error ? null : (data?.claims?.sub ?? null)
    } catch {
        return null
    }
}
