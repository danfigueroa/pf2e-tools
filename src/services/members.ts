// Membros, convites e dono das fichas da mesa — a tela do GM (`modules/account/MembersPage`).
// Fala com as ações de `api/_lib/auth-handler.js`; o servidor confere que quem pede é GM.

import { stateApi } from './mesa'
import { applyMesaSettings, type Role } from './auth'

export interface MemberRow {
    userId: string
    email: string | null
    username: string | null
    /** Aparelho do app de antes do login (sessão anônima, sem conta). */
    anonymous: boolean
    role: Role
    displayName: string | null
    joinedAt: string
    lastSeen: string
}

export interface InviteRow {
    code: string
    role: Role
    createdAt?: string
    expiresAt: string
    maxUses: number
    uses: number
    revoked: boolean
}

export interface SheetOwnerRow {
    slug: string
    name: string
    ownerId: string | null
}

export interface MembersData {
    members: MemberRow[]
    invites: InviteRow[]
    sheets: SheetOwnerRow[]
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function call<T>(init: RequestInit, query = ''): Promise<Result<T>> {
    try {
        const res = await fetch(stateApi(query), init)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return { ok: false, error: typeof data.error === 'string' ? data.error : 'Não deu certo' }
        return { ok: true, data: data as T }
    } catch {
        return { ok: false, error: 'Sem conexão com o servidor' }
    }
}

const post = <T = Record<string, never>>(body: Record<string, unknown>) =>
    call<T>({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const fetchMembers = () => call<MembersData>({}, '?members=1')

export const createInvite = (role: Role, maxUses: number, days: number) =>
    post<{ invite: InviteRow }>({ action: 'invite-create', role, maxUses, days })

export const revokeInvite = (code: string) => post({ action: 'invite-revoke', code })
export const setMemberRole = (user: string, role: Role) => post({ action: 'member-set-role', user, role })
export const removeMember = (user: string) => post({ action: 'member-remove', user })
export const setMemberName = (name: string, user?: string) => post({ action: 'member-set-name', name, user })
/** Gera uma senha provisória para quem esqueceu a dele; o GM a passa adiante. */
export const resetPassword = (user: string) => post<{ password: string }>({ action: 'member-reset-password', user })

export const assignSheet = (char: string, user: string | null) => post({ action: 'sheet-assign', char, user })

export const inviteLink = (code: string) => `${window.location.origin}/convite/${code}`

export interface MesaSettingsResult { name: string; sessionStartedAt: string | null; nextSessionAt: string | null }

/** Nome, sessão em andamento e próxima sessão da mesa (GM). A resposta já entra no estado da conta. */
export async function saveMesaSettings(patch: { name?: string; session?: 'start' | 'end'; nextSessionAt?: string | null }) {
    const result = await post<MesaSettingsResult>({ action: 'mesa-settings', ...patch })
    if (result.ok) applyMesaSettings(result.data)
    return result
}
