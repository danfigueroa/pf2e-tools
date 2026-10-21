// Cliente do Supabase no navegador: a sessão anônima deste aparelho e, nas
// próximas fases, o Realtime que substitui o polling.
//
// Só LÊ: quem escreve no banco continuam sendo as funções da Vercel, com a chave
// secreta e as validações de sempre. A única escrita daqui é o registro deste
// aparelho na mesa (`mesa_members`), que o RLS limita à própria sessão.
//
// O supabase-js (~60 kB gzip, chunk próprio) entra por `import()` com o app OCIOSO, como o
// cartão de regra compartilhada: o chunk principal não cresce, e quem só abre
// a ficha no celular não espera por ele para ver a primeira tela.

import type { SupabaseClient } from '@supabase/supabase-js'
import { currentMesa } from './mesa'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Sem as variáveis o app segue como antes: sem sessão, sem tempo real. */
export const isSupabaseConfigured = Boolean(URL && KEY)

let clientPromise: Promise<SupabaseClient | null> | null = null
let userId: string | null = null

/** O id da sessão anônima deste aparelho, quando ela já existe. */
export const currentUserId = (): string | null => userId

/**
 * O cliente, com a sessão anônima pronta e o aparelho registrado na mesa. A
 * primeira chamada baixa o SDK; as seguintes devolvem a mesma promessa. Falha
 * de rede ou de login vira `null` (e a próxima chamada tenta de novo) — nada no
 * app pode depender disso para funcionar.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
    if (!isSupabaseConfigured) return Promise.resolve(null)
    if (!clientPromise) {
        clientPromise = connect().then((client) => {
            if (!client) clientPromise = null
            return client
        })
    }
    return clientPromise
}

async function connect(): Promise<SupabaseClient | null> {
    try {
        const { createClient } = await import('@supabase/supabase-js')
        const client = createClient(URL!, KEY!, {
            auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pf2e:supabase:auth' },
        })
        const { data } = await client.auth.getSession()
        let id = data.session?.user.id ?? null
        if (!id) {
            const { data: created, error } = await client.auth.signInAnonymously()
            if (error) throw error
            id = created.user?.id ?? null
        }
        if (!id) return null
        userId = id
        await joinMesa(client, id)
        return client
    } catch (error) {
        console.warn('[supabase] Sem sessão neste aparelho:', error)
        return null
    }
}

/** Registra (ou renova o `last_seen` de) este aparelho na mesa aberta. */
async function joinMesa(client: SupabaseClient, id: string) {
    const { error } = await client
        .from('mesa_members')
        .upsert({ mesa: currentMesa.id, user_id: id, last_seen: new Date().toISOString() })
    if (error) console.warn('[supabase] Não registrou o aparelho na mesa:', error.message)
}

/**
 * `Authorization` com o JWT da sessão anônima, para o servidor saber QUEM fez o
 * pedido (autoria de uma publicação). Vazio sem sessão — nunca impede o pedido.
 * Na primeira chamada pode baixar o SDK, então só vale para ações raras.
 */
export async function authHeaders(): Promise<Record<string, string>> {
    try {
        const client = await getSupabase()
        const token = client ? (await client.auth.getSession()).data.session?.access_token : null
        return token ? { Authorization: `Bearer ${token}` } : {}
    } catch {
        return {}
    }
}

/** Abre a sessão com o app ocioso — chamado uma vez no boot (`main.tsx`). */
export function startSupabase() {
    if (!isSupabaseConfigured || typeof window === 'undefined') return
    const run = () => { void getSupabase() }
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 5000 })
    else setTimeout(run, 2000)
}
