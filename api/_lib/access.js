// Quem pode o quê. O servidor é o único que escreve no banco (chave secreta, passa por
// cima do RLS), então a autorização mora aqui e nos handlers — nunca no cliente, que só
// esconde botões.
//
// `AUTH_REQUIRED=1` liga a cobrança. Desligada (o padrão), o servidor se comporta como
// antes do login: ninguém é recusado e o `gm=1` da query continua valendo. É o interruptor
// do rollout — o servidor sobe antes do cliente novo e só vira a chave quando a mesa já
// entrou por convite. Sem Supabase configurado não há como autenticar, então também não cobra.

import { supabase, isSupabaseConfigured, requestIdentity } from './supabase.js'

export const authRequired = () => process.env.AUTH_REQUIRED === '1' && isSupabaseConfigured()

const MEMBER_TTL_MS = 30_000
const OWNER_TTL_MS = 15_000

const members = new Map() // `${mesa}:${userId}` → { role, at }
const owners = new Map() // `${mesa}:${slug}` → { exists, owner, at }

export function forgetMember(mesa, userId) {
    members.delete(`${mesa}:${userId}`)
}

export function forgetOwner(mesa, slug) {
    owners.delete(`${mesa}:${slug}`)
}

/** 'gm' | 'player' | null (não é membro). Guardado por 30 s: cada escrita de PV passaria por aqui. */
export async function memberRole(mesa, userId) {
    const db = supabase()
    if (!db || !userId) return null
    const key = `${mesa}:${userId}`
    const hit = members.get(key)
    if (hit && Date.now() - hit.at < MEMBER_TTL_MS) return hit.role
    const { data, error } = await db
        .from('mesa_members')
        .select('role')
        .eq('mesa', mesa)
        .eq('user_id', userId)
        .maybeSingle()
    // Banco fora do ar não pode virar "não é membro" guardado por 30 s.
    if (error) throw new Error(`mesa_members: ${error.message}`)
    const role = data?.role ?? null
    members.set(key, { role, at: Date.now() })
    return role
}

/**
 * O contexto de um pedido: `{ enforce, userId, email, role }`. Com a cobrança desligada,
 * `userId` ainda vem (autoria, como sempre) e `role` fica `null`.
 */
export async function resolveAccess(req, mesa) {
    const enforce = authRequired()
    const identity = await requestIdentity(req)
    // Sessão anônima é a de antes do login: com a cobrança ligada, não conta como usuário.
    const user = enforce && identity?.anonymous ? null : identity
    const role = enforce && user ? await memberRole(mesa, user.userId) : null
    return { enforce, userId: user?.userId ?? null, email: user?.email ?? null, role }
}

/** O portão geral: `null` deixa passar, senão `{ status, body }` pronto para responder. */
export function gate(access) {
    if (!access.enforce) return null
    if (!access.userId) return { status: 401, body: { error: 'Entre na sua conta para continuar', code: 'unauthenticated' } }
    if (!access.role) return { status: 403, body: { error: 'Você não faz parte desta mesa', code: 'not-member' } }
    return null
}

/** Só logado (sem exigir mesa): os endpoints da AON, que gastam a cota de tradução. */
export function gateLogin(access) {
    if (!access.enforce || access.userId) return null
    return { status: 401, body: { error: 'Entre na sua conta para continuar', code: 'unauthenticated' } }
}

/** GM de verdade; com a cobrança desligada vale o `legacy` (o `gm=1` da query). */
export const isGm = (access, legacy = false) => (access?.enforce ? access.role === 'gm' : legacy)

export const forbidden = (message = 'Só o GM pode fazer isso') => ({
    status: 403,
    body: { error: message, code: 'forbidden' },
})

/** Dono da ficha publicada. `exists: false` = nunca foi publicada; `owner: null` = sem dono. */
export async function sheetOwner(mesa, slug) {
    const db = supabase()
    if (!db) return { exists: false, owner: null }
    const key = `${mesa}:${slug}`
    const hit = owners.get(key)
    if (hit && Date.now() - hit.at < OWNER_TTL_MS) return hit
    const { data, error } = await db
        .from('sheets')
        .select('owner_id')
        .eq('mesa', mesa)
        .eq('slug', slug)
        .maybeSingle()
    if (error) throw new Error(`sheets: ${error.message}`)
    const entry = { exists: !!data, owner: data?.owner_id ?? null, at: Date.now() }
    owners.set(key, entry)
    return entry
}

/**
 * Pode mexer na ficha/estado deste personagem? O GM sempre; o dono da ficha publicada;
 * ninguém mais. Ficha sem dono (as já publicadas, até o GM atribuir) é só do GM.
 */
export async function canEditSheet(access, mesa, slug) {
    if (!access?.enforce || access.role === 'gm') return true
    if (!access.userId) return false
    const { owner } = await sheetOwner(mesa, slug)
    return owner !== null && owner === access.userId
}
