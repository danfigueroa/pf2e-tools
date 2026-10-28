// Conta, membros e convites. Mora no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md) e vem ANTES do portão geral: quem ainda
// não é membro precisa conseguir resgatar o convite que o torna um.
//
// Login é USUÁRIO + SENHA, sem e-mail nenhum (decisão do usuário: nada de serviço externo).
// O Supabase Auth exige um e-mail, então cada conta tem um endereço fictício
// `<usuário>@covil.local` que nunca recebe mensagem. A conta é criada AQUI, com a chave
// secreta e já confirmada, no resgate do convite (`register`); esqueceu a senha, o GM gera
// outra (`member-reset-password`).
//
//   POST { action: 'register', code, username, password, name? } → { mesa, role, username }  (SEM sessão)
//   GET  ?me=1                                    → { user, mesas: [{ id, name, role, displayName,
//                                                     sessionStartedAt, nextSessionAt, members }] }
//   GET  ?members=1                               → { members: [...], invites: [...] }   (GM)
//   POST { action: 'invite-create', role?, maxUses?, days? } → { invite }               (GM)
//   POST { action: 'invite-revoke', code }                   → { ok }                  (GM)
//   POST { action: 'invite-accept', code }                   → { mesa, role }          (logado)
//   POST { action: 'member-set-role', user, role }           → { ok }                  (GM)
//   POST { action: 'member-remove', user }                   → { ok }                  (GM)
//   POST { action: 'member-set-name', name, user? }          → { ok }   (a própria / GM)
//   POST { action: 'member-reset-password', user }           → { password }            (GM)
//   POST { action: 'sheet-assign', char, user|null }         → { ok }                  (GM)
//   POST { action: 'mesa-settings', name?, session?: 'start'|'end', nextSessionAt?: ISO|null }
//                                                             → { name, sessionStartedAt, nextSessionAt } (GM)
//
// O convite vale para a mesa EM QUE FOI CRIADO, não para a `?mesa=` do pedido: quem abre
// o link de outra mesa entra nela.

import { randomInt } from 'node:crypto'
import { supabase, isSupabaseConfigured } from './supabase.js'
import { forbidden, forgetMember, forgetOwner, memberRole } from './access.js'
import { isValidSlug } from './table-store.js'

const ok = (body = {}) => ({ status: 200, body: { ok: true, ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

const ACTIONS = new Set([
    'register',
    'member-reset-password',
    'invite-create',
    'invite-revoke',
    'invite-accept',
    'member-set-role',
    'member-remove',
    'member-set-name',
    'sheet-assign',
    'mesa-settings',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Sem 0/O/1/I/L: o código é lido e digitado no celular.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ROLES = new Set(['player', 'gm'])

// O "e-mail" de cada conta. Mesmo valor de `USER_DOMAIN` em src/services/auth.ts.
export const USER_DOMAIN = 'covil.local'
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/
const emailOf = (username) => `${username}@${USER_DOMAIN}`
/** O nome de usuário de uma conta, a partir do e-mail fictício (`null` se não for um). */
export const usernameOf = (email) =>
    typeof email === 'string' && email.endsWith(`@${USER_DOMAIN}`) ? email.slice(0, -USER_DOMAIN.length - 1) : null

export function isAuthRequest(method, query, body) {
    if (method === 'GET') return !!query.me || !!query.members
    if (method === 'POST') return ACTIONS.has(body?.action)
    return false
}

function randomText(length) {
    let out = ''
    for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    return out
}

const newCode = () => randomText(12)
// Senha provisória que o GM passa à pessoa: fácil de ditar na mesa, sem 0/O/1/I/L.
const newPassword = () => `${randomText(4)}-${randomText(4)}`.toLowerCase()

const cleanCode = (code) => String(code ?? '').trim().toUpperCase()
const validPassword = (password) => typeof password === 'string' && password.length >= 6 && password.length <= 72

/**
 * Cria a conta a partir de um convite: confere o convite (sem consumir), cria o usuário já
 * confirmado e só então o resgata — o consumo é atômico no `accept_invite`. Se o resgate
 * falhar no meio (outro usou a última vaga), a conta recém-criada é apagada: nada de conta
 * órfã sem mesa.
 */
async function register(db, body) {
    const code = cleanCode(body.code)
    if (!/^[A-Z0-9]{8,32}$/.test(code)) return fail(400, 'Convite inválido')
    const username = String(body.username ?? '').trim().toLowerCase()
    if (!USERNAME.test(username)) {
        return fail(400, 'Usuário: de 3 a 30 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado')
    }
    if (!validPassword(body.password)) return fail(400, 'A senha precisa ter pelo menos 6 caracteres')
    const name = String(body.name ?? '').trim().slice(0, 40)

    const invite = check(
        await db.from('mesa_invites').select('expires_at, max_uses, uses, revoked').eq('code', code).maybeSingle(),
    )
    if (!invite || invite.revoked || new Date(invite.expires_at) < new Date() || invite.uses >= invite.max_uses) {
        return fail(404, 'Convite inválido, vencido ou já usado')
    }

    const created = await db.auth.admin.createUser({
        email: emailOf(username),
        password: body.password,
        email_confirm: true,
        user_metadata: { username },
    })
    if (created.error) {
        if (created.error.code === 'email_exists') return fail(409, 'Esse nome de usuário já existe — escolha outro')
        throw new Error(created.error.message)
    }
    const userId = created.data.user.id

    const rows = check(await db.rpc('accept_invite', { p_code: code, p_user: userId }))
    const joined = Array.isArray(rows) ? rows[0] : rows
    if (!joined) {
        await db.auth.admin.deleteUser(userId)
        return fail(404, 'Convite inválido, vencido ou já usado')
    }
    if (name) {
        check(await db.from('mesa_members').update({ display_name: name }).eq('mesa', joined.o_mesa).eq('user_id', userId))
    }
    return ok({ mesa: joined.o_mesa, role: joined.o_role, username })
}

function check(result) {
    if (result.error) throw new Error(result.error.message)
    return result.data
}

/** Quantos GMs a mesa tem — para nunca ficar sem nenhum. */
async function gmCount(db, mesa) {
    const { count, error } = await db
        .from('mesa_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('mesa', mesa)
        .eq('role', 'gm')
    if (error) throw new Error(error.message)
    return count ?? 0
}

async function readMe(db, access) {
    const rows = check(
        await db
            .from('mesa_members')
            .select('mesa, role, display_name, mesas(name, session_started_at, next_session_at)')
            .eq('user_id', access.userId),
    )
    const counts = new Map(
        (check(await db.rpc('mesa_account_counts', { p_user: access.userId })) ?? [])
            .map((c) => [c.o_mesa, Number(c.o_accounts)]),
    )
    return {
        user: { id: access.userId, email: access.email, username: usernameOf(access.email) },
        mesas: (rows ?? []).map((r) => ({
            id: r.mesa,
            name: r.mesas?.name ?? r.mesa,
            role: r.role,
            displayName: r.display_name ?? null,
            sessionStartedAt: r.mesas?.session_started_at ?? null,
            nextSessionAt: r.mesas?.next_session_at ?? null,
            members: counts.get(r.mesa) ?? null,
        })),
    }
}

async function readMembers(db, mesa) {
    const rows = check(
        await db
            .from('mesa_members')
            .select('user_id, role, display_name, joined_at, last_seen')
            .eq('mesa', mesa)
            .order('joined_at'),
    )
    // O e-mail mora no Auth, não em `mesa_members`. Paginado: as sessões anônimas de antes do
    // login são centenas, e a primeira página deixava de fora justamente as contas novas.
    const users = new Map()
    for (let page = 1; page <= 20; page += 1) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) throw new Error(error.message)
        for (const u of data?.users ?? []) users.set(u.id, u)
        if ((data?.users?.length ?? 0) < 1000) break
    }

    const sheets = check(await db.from('sheets').select('slug, name, owner_id').eq('mesa', mesa)) ?? []
    const invites = check(
        await db
            .from('mesa_invites')
            .select('code, role, created_at, expires_at, max_uses, uses, revoked')
            .eq('mesa', mesa)
            .order('created_at', { ascending: false })
            .limit(50),
    )
    return {
        members: (rows ?? []).map((r) => ({
            userId: r.user_id,
            email: users.get(r.user_id)?.email || null,
            username: usernameOf(users.get(r.user_id)?.email),
            // Aparelho do app antigo (sessão anônima, sem conta): sai no cutover.
            anonymous: users.get(r.user_id)?.is_anonymous === true,
            role: r.role,
            displayName: r.display_name ?? null,
            joinedAt: r.joined_at,
            lastSeen: r.last_seen,
        })),
        sheets: sheets.map((s) => ({ slug: s.slug, name: s.name, ownerId: s.owner_id ?? null })),
        invites: (invites ?? []).map((i) => ({
            code: i.code,
            role: i.role,
            createdAt: i.created_at,
            expiresAt: i.expires_at,
            maxUses: i.max_uses,
            uses: i.uses,
            revoked: i.revoked,
        })),
    }
}

/** `access`: o que `resolveAccess` devolveu (`userId`, `email`, `role`, `enforce`). */
export async function handleAuthRequest(mesa, method, query, body, access) {
    const db = supabase()
    if (!db) return fail(503, 'O login precisa do Supabase configurado no servidor')
    // Criar a conta é o único pedido sem sessão: o convite é a credencial.
    if (method === 'POST' && body.action === 'register') return register(db, body)
    if (!access.userId) return fail(401, 'Entre na sua conta para continuar')
    // Gestão de conta exige GM DE VERDADE mesmo com a cobrança desligada: ali `access.role` vem
    // nulo, e liberar geral deixaria qualquer um se promover ou trocar a senha de um GM antes do
    // cutover. Por isso o papel é lido aqui, e não pelo `isGm(access, legado)` dos outros handlers.
    const gm = (access.role ?? (await memberRole(mesa, access.userId))) === 'gm'

    if (method === 'GET') {
        if (query.me) return ok(await readMe(db, access))
        if (!gm) return forbidden()
        return ok(await readMembers(db, mesa))
    }

    const { action } = body

    if (action === 'invite-accept') {
        const code = cleanCode(body.code)
        if (!/^[A-Z0-9]{8,32}$/.test(code)) return fail(400, 'Convite inválido')
        const rows = check(await db.rpc('accept_invite', { p_code: code, p_user: access.userId }))
        const joined = Array.isArray(rows) ? rows[0] : rows
        if (!joined) return fail(404, 'Convite inválido, vencido ou já usado')
        forgetMember(joined.o_mesa, access.userId)
        return ok({ mesa: joined.o_mesa, role: joined.o_role })
    }

    if (action === 'member-set-name') {
        const target = body.user ?? access.userId
        if (!UUID.test(String(target))) return fail(400, 'Campo "user" inválido')
        const self = target === access.userId
        if (!self && !gm) return forbidden()
        const name = String(body.name ?? '').trim()
        if (name.length < 1 || name.length > 40) return fail(400, 'O nome precisa ter de 1 a 40 caracteres')
        check(await db.from('mesa_members').update({ display_name: name }).eq('mesa', mesa).eq('user_id', target))
        return ok()
    }

    // Daqui em diante é tudo do GM.
    if (!gm) return forbidden()

    if (action === 'invite-create') {
        const role = body.role ?? 'player'
        if (!ROLES.has(role)) return fail(400, 'Campo "role" inválido')
        const maxUses = body.maxUses == null ? 1 : Number(body.maxUses)
        if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 50) return fail(400, 'Campo "maxUses" inválido (1 a 50)')
        const days = body.days == null ? 7 : Number(body.days)
        if (!Number.isInteger(days) || days < 1 || days > 30) return fail(400, 'Campo "days" inválido (1 a 30)')
        const row = {
            code: newCode(),
            mesa,
            role,
            created_by: access.userId,
            expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
            max_uses: maxUses,
        }
        check(await db.from('mesa_invites').insert(row))
        return ok({ invite: { code: row.code, role, expiresAt: row.expires_at, maxUses, uses: 0, revoked: false } })
    }

    if (action === 'invite-revoke') {
        const code = String(body.code ?? '').toUpperCase()
        if (!/^[A-Z0-9]{8,32}$/.test(code)) return fail(400, 'Campo "code" inválido')
        check(await db.from('mesa_invites').update({ revoked: true }).eq('mesa', mesa).eq('code', code))
        return ok()
    }

    if (action === 'member-set-role' || action === 'member-remove') {
        const user = String(body.user ?? '')
        if (!UUID.test(user)) return fail(400, 'Campo "user" inválido')
        const current = await memberRole(mesa, user)
        if (!current) return fail(404, 'Essa pessoa não está na mesa')

        const losesGm = current === 'gm' && (action === 'member-remove' || body.role !== 'gm')
        if (losesGm && (await gmCount(db, mesa)) <= 1) {
            return fail(409, 'A mesa precisa de pelo menos um GM — promova outra pessoa antes')
        }

        if (action === 'member-set-role') {
            if (!ROLES.has(body.role)) return fail(400, 'Campo "role" inválido')
            check(await db.from('mesa_members').update({ role: body.role }).eq('mesa', mesa).eq('user_id', user))
        } else {
            check(await db.from('mesa_members').delete().eq('mesa', mesa).eq('user_id', user))
        }
        forgetMember(mesa, user)
        return ok()
    }

    if (action === 'member-reset-password') {
        const user = String(body.user ?? '')
        if (!UUID.test(user)) return fail(400, 'Campo "user" inválido')
        if (!(await memberRole(mesa, user))) return fail(404, 'Essa pessoa não está na mesa')
        const password = newPassword()
        const { error } = await db.auth.admin.updateUserById(user, { password })
        if (error) throw new Error(error.message)
        return ok({ password })
    }

    if (action === 'mesa-settings') {
        const patch = {}
        if (body.name !== undefined) {
            const name = String(body.name ?? '').trim()
            if (name.length < 2 || name.length > 40) return fail(400, 'O nome da mesa precisa ter de 2 a 40 caracteres')
            patch.name = name
        }
        if (body.session !== undefined) {
            if (body.session === 'start') patch.session_started_at = new Date().toISOString()
            else if (body.session === 'end') patch.session_started_at = null
            else return fail(400, 'Campo "session" inválido')
        }
        if (body.nextSessionAt !== undefined) {
            if (body.nextSessionAt === null) patch.next_session_at = null
            else {
                const at = Date.parse(String(body.nextSessionAt))
                if (!Number.isFinite(at)) return fail(400, 'Campo "nextSessionAt" inválido')
                patch.next_session_at = new Date(at).toISOString()
            }
        }
        if (Object.keys(patch).length === 0) return fail(400, 'Nada para mudar')
        const rows = check(
            await db.from('mesas').update(patch).eq('id', mesa).select('name, session_started_at, next_session_at'),
        )
        const row = rows?.[0]
        return ok({
            name: row?.name ?? null,
            sessionStartedAt: row?.session_started_at ?? null,
            nextSessionAt: row?.next_session_at ?? null,
        })
    }

    if (action === 'sheet-assign') {
        const slug = String(body.char ?? '')
        if (!isValidSlug(slug)) return fail(400, 'Campo "char" inválido')
        const user = body.user ?? null
        if (user !== null) {
            if (!UUID.test(String(user))) return fail(400, 'Campo "user" inválido')
            if (!(await memberRole(mesa, user))) return fail(404, 'Essa pessoa não está na mesa')
            const { data: found } = await db.auth.admin.getUserById(user)
            if (!found?.user || found.user.is_anonymous) return fail(400, 'Dono de ficha precisa ter conta')
        }
        const rows = check(
            await db.from('sheets').update({ owner_id: user }).eq('mesa', mesa).eq('slug', slug).select('slug'),
        )
        if (!rows?.length) return fail(404, 'Ficha não publicada')
        forgetOwner(mesa, slug)
        return ok()
    }

    return fail(400, 'Ação desconhecida')
}
