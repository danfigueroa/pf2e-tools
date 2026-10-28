// Quem está usando o app: login por e-mail (código de 6 dígitos ou link, sem senha),
// as mesas de que a pessoa faz parte e o papel dela em cada uma.
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
          user: { id: string; email: string | null }
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

async function fetchMe(): Promise<{ user: { id: string; email: string | null }; mesas: Membership[] } | null> {
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

/** Pede o código/link por e-mail. Devolve o erro, ou `null` se saiu. */
export async function requestCode(email: string): Promise<string | null> {
    const client = await getAuthClient()
    if (!client) return 'Não foi possível falar com o servidor de login'
    const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/` },
    })
    if (!error) return null
    return error.status === 429 ? 'Muitos pedidos seguidos — espere um minuto e tente de novo' : 'Não foi possível enviar o e-mail'
}

/** Confere o código. Em caso de sucesso recarrega a página já logado. */
export async function verifyCode(email: string, code: string): Promise<string | null> {
    const client = await getAuthClient()
    if (!client) return 'Não foi possível falar com o servidor de login'
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error) return 'Código inválido ou vencido'
    window.location.reload()
    return null
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
    displayName: string | null
}

export function roleOf(auth: AuthState): RoleInfo {
    // Sem Supabase não há quem barre: dev local fica com todas as permissões.
    if (auth.status === 'local') return { role: 'gm', isGm: true, userId: null, email: null, displayName: null }
    if (auth.status !== 'in') return { role: null, isGm: false, userId: null, email: null, displayName: null }
    const member = auth.mesas.find((m) => m.id === currentMesa.id)
    return {
        role: member?.role ?? null,
        isGm: member?.role === 'gm',
        userId: auth.user.id,
        email: auth.user.email,
        displayName: member?.displayName ?? null,
    }
}

/** O papel de quem usa o app na mesa aberta. */
export const useRole = (): RoleInfo => roleOf(useAuth())

/** Pode mexer na ficha? O GM sempre; o dono da ficha publicada; ninguém mais. */
export const canEditSheet = (info: RoleInfo, ownerId: string | null | undefined): boolean =>
    info.isGm || (info.userId !== null && ownerId === info.userId)

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
