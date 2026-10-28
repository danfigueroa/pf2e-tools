// Cliente do Supabase no navegador: a sessão de quem entrou (e-mail, sem senha) e o
// Realtime que mantém a mesa em sincronia.
//
// Só LÊ: quem escreve no banco são as funções da Vercel, com a chave secreta e as
// validações de sempre. Entrar numa mesa também não passa por aqui: é o servidor que
// registra o membro, quando ele resgata um convite (`auth.ts` → `invite-accept`).
//
// O supabase-js (~60 kB gzip, chunk próprio) entra por `import()`: o chunk principal
// não cresce. Antes ele esperava o app ocioso; com login obrigatório a primeira tela
// já depende da sessão, então hoje ele é pedido logo no boot.

import type { SupabaseClient } from '@supabase/supabase-js'
import { currentMesa } from './mesa'

// Fora do Vite (os scripts de conferência carregam estes módulos no Node) não
// há `import.meta.env`: aí o Supabase simplesmente não está configurado.
const env = (import.meta.env ?? {}) as Partial<ImportMetaEnv>
const URL = env.VITE_SUPABASE_URL as string | undefined
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Sem as variáveis o app segue como antes: sem login, sem tempo real. */
export const isSupabaseConfigured = Boolean(URL && KEY)

let authClientPromise: Promise<SupabaseClient | null> | null = null
let readyPromise: Promise<SupabaseClient | null> | null = null
let userId: string | null = null
// O JWT de agora, renovado pelo próprio SDK: as escritas do estado da mesa o
// mandam sem esperar nada (`authHeaderNow`).
let accessToken: string | null = null

/** O id de quem está logado neste aparelho, quando a sessão já abriu. */
export const currentUserId = (): string | null => userId

/**
 * O cliente do Supabase, com ou sem sessão — é o que a tela de login usa para pedir
 * o código. A primeira chamada baixa o SDK. Falha ao carregar vira `null` (e a próxima
 * chamada tenta de novo).
 */
export function getAuthClient(): Promise<SupabaseClient | null> {
    if (!isSupabaseConfigured) return Promise.resolve(null)
    if (!authClientPromise) {
        authClientPromise = createAuthClient().then((client) => {
            if (!client) authClientPromise = null
            return client
        })
    }
    return authClientPromise
}

async function createAuthClient(): Promise<SupabaseClient | null> {
    try {
        const { createClient } = await import('@supabase/supabase-js')
        const client = createClient(URL!, KEY!, {
            auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pf2e:supabase:auth' },
        })
        client.auth.onAuthStateChange((_event, session) => {
            accessToken = session?.access_token ?? null
            userId = session?.user.id ?? null
        })
        return client
    } catch (error) {
        console.warn('[supabase] Não carregou o SDK:', error)
        return null
    }
}

/**
 * O cliente, com a sessão de quem entrou pronta. `null` sem login (ou com a sessão
 * anônima de antes do login, que não vale mais): quem chamou segue sem tempo real, e a
 * tela de login é que leva a pessoa a entrar. Com sessão, a promessa é guardada.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
    if (!isSupabaseConfigured) return Promise.resolve(null)
    if (!readyPromise) {
        readyPromise = openSession().then((client) => {
            if (!client) readyPromise = null
            return client
        })
    }
    return readyPromise
}

async function openSession(): Promise<SupabaseClient | null> {
    const client = await getAuthClient()
    if (!client) return null
    try {
        const { data } = await client.auth.getSession()
        const session = data.session
        if (!session || session.user.is_anonymous) return null
        userId = session.user.id
        accessToken = session.access_token
        // Os canais privados do Realtime conferem o JWT na entrada.
        await client.realtime.setAuth(accessToken)
        return client
    } catch (error) {
        console.warn('[supabase] Sem sessão neste aparelho:', error)
        return null
    }
}

/** Como `authHeaders`, mas sem esperar: vazio se a sessão ainda não abriu. */
export const authHeaderNow = (): Record<string, string> =>
    accessToken ? { Authorization: `Bearer ${accessToken}` } : {}

/**
 * `Authorization` com o JWT de quem está logado, para o servidor saber QUEM fez o
 * pedido (e o que ele pode). Vazio sem sessão — o servidor responde 401 e a tela de
 * login assume. Na primeira chamada pode baixar o SDK.
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
 * transmite o que mudou (triggers). Só quem é membro da mesa entra (RLS em
 * `realtime.messages`). `onLive` avisa a cada troca: aberto (SUBSCRIBED,
 * inclusive em cada reconexão — hora de reler o que pode ter passado) ou não.
 * Devolve a função que SAI do canal, ou `null` quando não há sessão (quem
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

/** Abre a sessão no boot (`main.tsx`) para o Realtime já estar de pé quando a tela pedir. */
export function startSupabase() {
    if (!isSupabaseConfigured || typeof window === 'undefined') return
    void getSupabase()
}
