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

// Fora do Vite (os scripts de conferência carregam estes módulos no Node) não
// há `import.meta.env`: aí o Supabase simplesmente não está configurado.
const env = (import.meta.env ?? {}) as Partial<ImportMetaEnv>
const URL = env.VITE_SUPABASE_URL as string | undefined
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Sem as variáveis o app segue como antes: sem sessão, sem tempo real. */
export const isSupabaseConfigured = Boolean(URL && KEY)

let clientPromise: Promise<SupabaseClient | null> | null = null
let userId: string | null = null
// O JWT de agora, renovado pelo próprio SDK: as escritas do estado da mesa o
// mandam sem esperar nada (`authHeaderNow`).
let accessToken: string | null = null

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
        client.auth.onAuthStateChange((_event, session) => { accessToken = session?.access_token ?? null })
        const { data } = await client.auth.getSession()
        let session = data.session
        if (!session) {
            const { data: created, error } = await client.auth.signInAnonymously()
            if (error) throw error
            session = created.session
        }
        const id = session?.user.id ?? null
        if (!id) return null
        userId = id
        accessToken = session?.access_token ?? null
        // Os canais privados do Realtime conferem o JWT na entrada.
        await client.realtime.setAuth(accessToken)
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

/** Como `authHeaders`, mas sem esperar: vazio se a sessão ainda não abriu. */
export const authHeaderNow = (): Record<string, string> =>
    accessToken ? { Authorization: `Bearer ${accessToken}` } : {}

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

/**
 * Ouve um canal PRIVADO da mesa aberta (`mesa:<mesa>:<nome>`), por onde o banco
 * transmite o que mudou (triggers). Só quem se registrou na mesa entra (RLS em
 * `realtime.messages`). `onLive` avisa a cada troca: aberto (SUBSCRIBED,
 * inclusive em cada reconexão — hora de reler o que pode ter passado) ou não.
 * Devolve a função que SAI do canal, ou `null` quando não há Supabase (quem
 * chamou segue sem tempo real).
 */
export async function listenMesaChannel(
    name: string,
    handlers: Record<string, (payload: unknown) => void>,
    onLive: (live: boolean) => void,
): Promise<(() => void) | null> {
    const client = await getSupabase()
    if (!client) return null
    const channel = client.channel(`mesa:${currentMesa.id}:${name}`, { config: { private: true } })
    for (const [event, handler] of Object.entries(handlers)) {
        channel.on('broadcast', { event }, ({ payload }) => handler(payload))
    }
    channel.subscribe((state) => onLive(state === 'SUBSCRIBED'))
    return () => { void client.removeChannel(channel) }
}

/** Abre a sessão com o app ocioso — chamado uma vez no boot (`main.tsx`). */
export function startSupabase() {
    if (!isSupabaseConfigured || typeof window === 'undefined') return
    const run = () => { void getSupabase() }
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 5000 })
    else setTimeout(run, 2000)
}
