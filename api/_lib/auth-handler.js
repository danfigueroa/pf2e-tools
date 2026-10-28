// Conta, membros e convites. Mora no endpoint `state` pelo limite de 12 funções
// serverless do plano Hobby (ver CLAUDE.md) e vem ANTES do portão geral: quem ainda
// não é membro precisa conseguir resgatar o convite que o torna um.
//
//   GET  ?me=1                                    → { user, mesas: [{ id, name, role, displayName }] }
//   GET  ?members=1                               → { members: [...], invites: [...] }   (GM)
//   POST { action: 'invite-create', role?, maxUses?, days? } → { invite }               (GM)
//   POST { action: 'invite-revoke', code }                   → { ok }                  (GM)
//   POST { action: 'invite-accept', code }                   → { mesa, role }          (logado)
//   POST { action: 'member-set-role', user, role }           → { ok }                  (GM)
//   POST { action: 'member-remove', user }                   → { ok }                  (GM)
//   POST { action: 'member-set-name', name, user? }          → { ok }   (a própria / GM)
//   POST { action: 'sheet-assign', char, user|null }         → { ok }                  (GM)
//
// O convite vale para a mesa EM QUE FOI CRIADO, não para a `?mesa=` do pedido: quem abre
// o link de outra mesa entra nela.

import { randomInt } from 'node:crypto'
import { supabase, isSupabaseConfigured } from './supabase.js'
import { forbidden, forgetMember, forgetOwner, isGm, memberRole } from './access.js'
import { isValidSlug } from './table-store.js'

const ok = (body = {}) => ({ status: 200, body: { ok: true, ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })

const ACTIONS = new Set([
    'invite-create',
    'invite-revoke',
    'invite-accept',
    'member-set-role',
    'member-remove',
    'member-set-name',
    'sheet-assign',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Sem 0/O/1/I/L: o código é lido e digitado no celular.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ROLES = new Set(['player', 'gm'])

export function isAuthRequest(method, query, body) {
    if (method === 'GET') return !!query.me || !!query.members
    if (method === 'POST') return ACTIONS.has(body?.action)
    return false
}

function newCode() {
    let code = ''
    for (let i = 0; i < 12; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    return code
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
            .select('mesa, role, display_name, mesas(name)')
            .eq('user_id', access.userId),
    )
    return {
        user: { id: access.userId, email: access.email },
        mesas: (rows ?? []).map((r) => ({
            id: r.mesa,
            name: r.mesas?.name ?? r.mesa,
            role: r.role,
            displayName: r.display_name ?? null,
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
    // O e-mail mora no Auth, não em `mesa_members`. A mesa é pequena: uma listagem só.
    const emails = new Map()
    const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
    for (const u of data?.users ?? []) emails.set(u.id, u.email ?? null)

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
            email: emails.get(r.user_id) ?? null,
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
    if (!access.userId) return fail(401, 'Entre na sua conta para continuar')

    if (method === 'GET') {
        if (query.me) return ok(await readMe(db, access))
        // Lista de membros: GM da mesa (ou qualquer um, com a cobrança desligada — o ensaio do rollout).
        if (!isGm(access, true)) return forbidden()
        return ok(await readMembers(db, mesa))
    }

    const { action } = body

    if (action === 'invite-accept') {
        const code = String(body.code ?? '').trim().toUpperCase()
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
        if (!self && !isGm(access, true)) return forbidden()
        const name = String(body.name ?? '').trim()
        if (name.length < 1 || name.length > 40) return fail(400, 'O nome precisa ter de 1 a 40 caracteres')
        check(await db.from('mesa_members').update({ display_name: name }).eq('mesa', mesa).eq('user_id', target))
        return ok()
    }

    // Daqui em diante é tudo do GM.
    if (!isGm(access, true)) return forbidden()

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

    if (action === 'sheet-assign') {
        const slug = String(body.char ?? '')
        if (!isValidSlug(slug)) return fail(400, 'Campo "char" inválido')
        const user = body.user ?? null
        if (user !== null) {
            if (!UUID.test(String(user))) return fail(400, 'Campo "user" inválido')
            if (!(await memberRole(mesa, user))) return fail(404, 'Essa pessoa não está na mesa')
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
