// Quem está usando o app: login por USUÁRIO + SENHA (sem e-mail nenhum — decisão do
// usuário: nada de serviço externo), as mesas de que a pessoa faz parte e o papel dela.
// A conta nasce no resgate do primeiro convite (`register`); senha esquecida, o GM gera outra.
//
// Isto só DECIDE O QUE MOSTRAR. Quem barra de verdade é o servidor (`api/_lib/access.js`):
// esconder um botão aqui não protege nada, e um 403 do servidor volta como aviso
// (`pf2e:forbidden`). Por isso o papel vem do `GET ?me=1`, não de um interruptor local.
//
// Entrar, sair e resgatar um convite RECARREGAM a página: os serviços (Realtime, estado
// da mesa, presença) abrem no boot com a sessão que existir, como o `switchMesa` já faz.

import { useSyncExternalStore } from 'react'
import { currentMesa, stateApi, switchMesa } from './mesa'
import { authHeaders, getAuthClient, isSupabaseConfigured } from './supabase'

export type Role = 'player' | 'gm'

export interface Membership {
    id: string
    name: string
    role: Role
    displayName: string | null
    /** ISO; nulo = sem sessão em andamento (o GM inicia e encerra em /mesa). */
    sessionStartedAt: string | null
    /** ISO da próxima sessão marcada, ou nulo. */
    nextSessionAt: string | null
    /** Quantas contas a mesa tem (sem as sessões anônimas de antes do login). */
    members: number | null
}

export type AuthState =
    | { status: 'loading' }
    /** Sem Supabase configurado (dev local): não há login, tudo liberado. */
    | { status: 'local' }
    | { status: 'out' }
    /** Logado, mas o servidor não respondeu (fora do ar, sem rede): a tela oferece tentar de novo. */
    | { status: 'error' }
    | {
          status: 'in'
          user: { id: string; email: string | null; username: string | null }
          mesas: Membership[]
          /** Por que o convite do link não valeu, quando não valeu. */
          notice: string | null
      }

let state: AuthState = { status: 'loading' }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const setState = (next: AuthState) => {
    state = next
    emit()
}

export const getAuthState = (): AuthState => state
const subscribe = (cb: () => void) => {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
}

export const useAuth = (): AuthState => useSyncExternalStore(subscribe, getAuthState, getAuthState)

// --- Convite -------------------------------------------------------------------
//
// O link do convite é `/convite/<CÓDIGO>`. Fica em `localStorage` (e não em
// `sessionStorage`) porque o link do e-mail de login abre OUTRA aba: o código tem de
// sobreviver ao desvio por ali.

const INVITE_KEY = 'pf2e:invite'
const INVITE_RE = /^\/convite\/([A-Za-z0-9]{8,32})\/?$/

export const pendingInvite = (): string | null => {
    try { return localStorage.getItem(INVITE_KEY) } catch { return null }
}
const setPendingInvite = (code: string | null) => {
    try {
        if (code) localStorage.setItem(INVITE_KEY, code)
        else localStorage.removeItem(INVITE_KEY)
    } catch { /* sem armazenamento: o código manual ainda funciona */ }
}

// Antes do roteador ler a localização (mesmo truque do `?mesa=`): guarda o código e limpa a URL.
if (typeof window !== 'undefined') {
    const match = window.location.pathname.match(INVITE_RE)
    if (match) {
        setPendingInvite(match[1].toUpperCase())
        window.history.replaceState(null, '', `/${window.location.search}`)
    }
}

// --- Conta -----------------------------------------------------------------------
//
// O Supabase Auth exige um e-mail, então cada conta tem um endereço fictício que nunca
// recebe mensagem. Mesmo valor de `USER_DOMAIN` em api/_lib/auth-handler.js.

export const USER_DOMAIN = 'covil.local'
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/
export const cleanUsername = (raw: string) => raw.trim().toLowerCase()
const emailOf = (username: string) => `${cleanUsername(username)}@${USER_DOMAIN}`

// --- Chamadas ao servidor --------------------------------------------------------

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    try {
        const res = await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        return { ok: res.ok, data }
    } catch {
        return { ok: false, data: { error: 'Sem conexão com o servidor' } }
    }
}

const errorOf = (data: Record<string, unknown>, fallback: string) =>
    typeof data.error === 'string' ? data.error : fallback

/** Resgata um convite. Em caso de sucesso devolve a mesa e o papel; senão, o motivo. */
export async function acceptInvite(code: string): Promise<{ mesa: string; role: Role } | { error: string }> {
    const { ok, data } = await post({ action: 'invite-accept', code })
    if (!ok) return { error: errorOf(data, 'Não foi possível usar este convite') }
    return { mesa: String(data.mesa), role: data.role === 'gm' ? 'gm' : 'player' }
}

async function fetchMe(): Promise<{ user: { id: string; email: string | null; username: string | null }; mesas: Membership[] } | null> {
    try {
        const res = await fetch(stateApi('?me=1'))
        if (!res.ok) return null
        const data = await res.json()
        return { user: data.user, mesas: data.mesas ?? [] }
    } catch {
        return null
    }
}

// --- Ciclo de vida -----------------------------------------------------------------

let started: Promise<void> | null = null

/** Descobre quem é a pessoa. Idempotente: a página só chama uma vez; `refreshAuth` repete. */
export function initAuth(): Promise<void> {
    if (!started) started = load()
    return started
}

export function refreshAuth(): Promise<void> {
    started = load()
    return started
}

async function load(): Promise<void> {
    if (!isSupabaseConfigured) return setState({ status: 'local' })
    const client = await getAuthClient()
    if (!client) return setState({ status: 'out' })

    const { data } = await client.auth.getSession()
    // A sessão anônima de antes do login não vale mais: sai e pede o e-mail.
    if (data.session?.user.is_anonymous) {
        await client.auth.signOut().catch(() => {})
        return setState({ status: 'out' })
    }
    if (!data.session) return setState({ status: 'out' })

    const me = await fetchMe()
    if (!me) {
        // Sessão recusada (vencida, usuário apagado) volta ao login; servidor fora do ar, não.
        const valid = await client.auth.getUser().then((r) => !r.error).catch(() => false)
        return setState({ status: valid ? 'error' : 'out' })
    }

    let notice: string | null = null
    const code = pendingInvite()
    if (code) {
        const result = await acceptInvite(code)
        setPendingInvite(null)
        if ('error' in result) {
            notice = result.error
        } else if (result.mesa !== currentMesa.id) {
            // O convite era de outra mesa: vai para ela (recarrega).
            switchMesa(result.mesa)
            return
        } else {
            window.location.reload()
            return
        }
    }
    setState({ status: 'in', user: me.user, mesas: me.mesas, notice })
}

interface EnterOptions {
    /** Roda antes de recarregar — a tela de entrada mostra o "Bem-vindo" enquanto isso. */
    beforeReload?: () => Promise<void>
}

/** Entra com usuário e senha. Devolve o erro, ou recarrega a página já logado. */
export async function signIn(
    username: string,
    password: string,
    { reload = true, beforeReload }: EnterOptions & { reload?: boolean } = {},
): Promise<string | null> {
    const client = await getAuthClient()
    if (!client) return 'Não foi possível falar com o servidor de login'
    const { error } = await client.auth.signInWithPassword({ email: emailOf(username), password })
    if (error) {
        return error.status === 429 ? 'Muitas tentativas seguidas — espere um minuto' : 'Usuário ou senha incorretos'
    }
    if (!reload) return null
    await beforeReload?.()
    window.location.reload()
    return null
}

/**
 * Cria a conta com um convite e já entra. O convite pode ser de outra mesa: aí o app abre
 * nela. Devolve o erro (usuário já existe, convite vencido…) ou recarrega a página.
 */
export async function register(
    input: { code: string; username: string; password: string; name: string },
    { beforeReload }: EnterOptions = {},
): Promise<string | null> {
    const { ok, data } = await post({
        action: 'register',
        code: input.code.trim().toUpperCase(),
        username: cleanUsername(input.username),
        password: input.password,
        name: input.name.trim(),
    })
    if (!ok) return errorOf(data, 'Não foi possível criar a conta')
    setPendingInvite(null)
    const problem = await signIn(input.username, input.password, { reload: false })
    if (problem) return problem
    const mesa = String(data.mesa)
    await beforeReload?.()
    if (mesa !== currentMesa.id) switchMesa(mesa)
    else window.location.reload()
    return null
}

/** Troca a senha de quem está logado. Devolve o erro, ou `null`. */
export async function changePassword(password: string): Promise<string | null> {
    const client = await getAuthClient()
    if (!client) return 'Não foi possível falar com o servidor de login'
    const { error } = await client.auth.updateUser({ password })
    if (!error) return null
    return error.code === 'same_password' ? 'A senha nova é igual à atual' : 'Não foi possível trocar a senha'
}

export async function signOut(): Promise<void> {
    const client = await getAuthClient()
    await client?.auth.signOut().catch(() => {})
    window.location.reload()
}

// --- Papel -------------------------------------------------------------------------

export interface RoleInfo {
    role: Role | null
    isGm: boolean
    userId: string | null
    email: string | null
    username: string | null
    displayName: string | null
}

export function roleOf(auth: AuthState): RoleInfo {
    // Sem Supabase não há quem barre: dev local fica com todas as permissões.
    if (auth.status === 'local') return { role: 'gm', isGm: true, userId: null, email: null, username: null, displayName: null }
    if (auth.status !== 'in') return { role: null, isGm: false, userId: null, email: null, username: null, displayName: null }
    const member = auth.mesas.find((m) => m.id === currentMesa.id)
    return {
        role: member?.role ?? null,
        isGm: member?.role === 'gm',
        userId: auth.user.id,
        email: auth.user.email,
        username: auth.user.username,
        displayName: member?.displayName ?? null,
    }
}

/** O papel de quem usa o app na mesa aberta. */
export const useRole = (): RoleInfo => roleOf(useAuth())

/** Pode mexer na ficha? O GM sempre; o dono da ficha publicada; ninguém mais. */
export const canEditSheet = (info: RoleInfo, ownerId: string | null | undefined): boolean =>
    info.isGm || (info.userId !== null && ownerId === info.userId)

// --- A mesa aberta ------------------------------------------------------------------

export interface MesaInfo {
    id: string
    name: string
    sessionStartedAt: string | null
    nextSessionAt: string | null
    members: number | null
}

export type MesaSettings = Pick<MesaInfo, 'name' | 'sessionStartedAt' | 'nextSessionAt'>

/** Nome, sessão e contagem da mesa aberta. Antes do `?me` (ou sem login), o nome fixo do código. */
export function mesaInfoOf(auth: AuthState): MesaInfo {
    const member = auth.status === 'in' ? auth.mesas.find((m) => m.id === currentMesa.id) : undefined
    return {
        id: currentMesa.id,
        name: member?.name ?? currentMesa.nome,
        sessionStartedAt: member?.sessionStartedAt ?? null,
        nextSessionAt: member?.nextSessionAt ?? null,
        members: member?.members ?? null,
    }
}

export const useMesaInfo = (): MesaInfo => mesaInfoOf(useAuth())

/** Nome de qualquer mesa da pessoa (o seletor), com o fixo do código como reserva. */
export const mesaName = (auth: AuthState, id: string, fallback: string): string =>
    (auth.status === 'in' ? auth.mesas.find((m) => m.id === id)?.name : undefined) ?? fallback

/**
 * Aplica nome/sessão novos da mesa aberta: a resposta do `mesa-settings` e o aviso
 * `settings` do canal de eventos (o GM mudou em outro aparelho).
 */
export function applyMesaSettings(next: Partial<MesaSettings>) {
    if (state.status !== 'in') return
    setState({
        ...state,
        mesas: state.mesas.map((m) => (m.id === currentMesa.id ? { ...m, ...next } : m)),
    })
}

// --- fetch com a sessão ----------------------------------------------------------------

const isApi = (url: string): boolean => {
    if (url.startsWith('/api/')) return true
    try {
        const parsed = new URL(url, window.location.origin)
        return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/')
    } catch {
        return false
    }
}

/**
 * Faz todo `fetch('/api/…')` levar o JWT de quem está logado. São mais de 30 pontos de
 * chamada, a maioria (os GETs de mapa, estado e ficha) nunca mandou cabeçalho nenhum — e
 * o servidor passou a exigir. Um lugar só em vez de um por chamada.
 *
 * Também avisa a página do que o servidor recusou: `pf2e:unauthenticated` (sessão
 * vencida → relê o login) e `pf2e:forbidden` (sem permissão → aviso na tela).
 */
export function installApiAuth() {
    if (typeof window === 'undefined' || (window as { __apiAuth?: boolean }).__apiAuth) return
    ;(window as { __apiAuth?: boolean }).__apiAuth = true
    const original = window.fetch.bind(window)

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        if (!isApi(url)) return original(input, init)

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
        if (!headers.has('Authorization')) {
            for (const [name, value] of Object.entries(await authHeaders())) headers.set(name, value)
        }
        const response = await original(input, { ...init, headers })

        if (response.status === 401) {
            window.dispatchEvent(new Event('pf2e:unauthenticated'))
        } else if (response.status === 403) {
            const body = await response.clone().json().catch(() => null)
            if (body?.code === 'forbidden') {
                window.dispatchEvent(new CustomEvent('pf2e:forbidden', { detail: String(body.error ?? 'Sem permissão') }))
            }
        }
        return response
    }
}
