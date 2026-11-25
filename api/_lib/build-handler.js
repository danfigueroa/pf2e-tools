// Rotas do Criador de Personagem no endpoint `state` (sem arquivo novo em `api/`: limite de 12 funções).
//
//   GET  ?builds=1                                     → { builds: [cabeçalho] }             (membro)
//   GET  ?build=<id>                                   → { build, canEdit }                  (membro; edita dono e GM)
//   GET  ?mesaRules=1                                  → { rules, updatedAt }                (membro)
//   POST { action: 'build-create', name, state? }      → { build }                           (membro logado)
//   POST { action: 'build-save', id, rev, state, className? } → { build } | 409 { build }    (dono, GM)
//   POST { action: 'build-delete' | 'build-restore', id }      → { build }                   (dono, GM)
//   POST { action: 'build-assign', id, user|null }     → { build }                           (GM)
//   POST { action: 'mesa-rules-save', rules }          → { rules, updatedAt }                (GM real, sempre)
//
// Vem ANTES da ficha publicada no despacho: a rota da ficha aceita qualquer POST com `action`.
//
// Quem pode: o build tem dono desde o nascimento (quem criou), então a regra não depende do `AUTH_REQUIRED`:
// escrever é do dono ou do GM de verdade (`memberRole`), e criar exige estar logado. Com a cobrança desligada, ler
// segue aberto como o resto da mesa.

import { isSupabaseConfigured } from './supabase.js'
import { forbidden, memberRole } from './access.js'
import { BUILD_SCHEMA, MAX_BUILD_BYTES, buildBytes, emptyBuildState, sanitizeBuildState } from './build-sanitize.js'
import {
    assignBuild, createBuild, freeBuildSlug, listBuilds, memberNames, readBuild, readMesaRules, saveBuild, trashBuild, writeMesaRules,
} from './build-store.js'
import { currentRulesVersion } from './rules-core.js'

const ACTIONS = new Set(['build-create', 'build-save', 'build-delete', 'build-restore', 'build-assign', 'mesa-rules-save'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } })

export function isBuildRequest(method, query, body) {
    if (method === 'GET') return query.builds !== undefined || query.build !== undefined || query.mesaRules !== undefined
    if (method === 'POST') return ACTIONS.has(body?.action)
    return false
}

/** Sem Supabase (dev local, modo memória) não há login: quem usa é um GM local, como no cliente. */
const LOCAL_USER = 'local'
const localMode = () => !isSupabaseConfigured()

/** Papel de verdade na mesa, mesmo com a cobrança desligada (o `access.role` só vem com ela ligada). */
async function realRole(mesa, access) {
    if (localMode()) return 'gm'
    if (access?.role) return access.role
    if (!access?.userId) return null
    return memberRole(mesa, access.userId)
}

const canEditBuild = (build, access, role) => role === 'gm' || (!!access?.userId && build.ownerId === access.userId)

/** Cabeçalho que vai para a lista: sem o `state`, para ninguém ler escolhas alheias pela lista. */
const header = ({ state, ...rest }) => rest

const className = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : null)

export async function handleBuildRequest(mesa, method, query, body, ctx = {}) {
    const access = localMode() ? { ...ctx.access, userId: ctx.access?.userId ?? LOCAL_USER } : ctx.access

    if (method === 'GET') {
        if (query.mesaRules !== undefined) return ok(await readMesaRules(mesa))
        if (query.builds !== undefined) {
            const role = await realRole(mesa, access)
            const all = await listBuilds(mesa)
            const names = await memberNames(mesa, all.map((b) => b.ownerId))
            const builds = all
                // Lixeira: só quem pode restaurar a vê.
                .filter((b) => !b.deletedAt || canEditBuild(b, access, role))
                .map((b) => ({ ...b, ownerName: (b.ownerId && names[b.ownerId]) || null, canEdit: canEditBuild(b, access, role) }))
            return ok({ builds })
        }
        const build = await readBuild(mesa, query.build)
        if (!build) return fail(404, 'Personagem não encontrado')
        const role = await realRole(mesa, access)
        const canEdit = canEditBuild(build, access, role)
        if (build.deletedAt && !canEdit) return fail(404, 'Personagem não encontrado')
        return ok({ build, canEdit })
    }

    const { action } = body

    if (action === 'mesa-rules-save') {
        if ((await realRole(mesa, access)) !== 'gm') return forbidden()
        return ok(await writeMesaRules(mesa, body.rules, access.userId))
    }

    if (!access?.userId) return { status: 401, body: { error: 'Entre na sua conta para continuar', code: 'unauthenticated' } }
    const role = await realRole(mesa, access)
    if (!role && access.enforce) return forbidden('Você não faz parte desta mesa')

    if (action === 'build-create') {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (!name || name.length > 80) return fail(400, 'Nome inválido')
        const version = await currentRulesVersion().catch(() => null)
        const state = sanitizeBuildState({ ...(body.state && typeof body.state === 'object' ? body.state : emptyBuildState(name, '')), name })
        if (!state.rulesVersion && version) state.rulesVersion = version
        if (buildBytes(state) > MAX_BUILD_BYTES) return fail(413, 'Personagem grande demais')
        // Duas criações ao mesmo tempo podem escolher o mesmo slug: o unique recusa e tenta o próximo.
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const slug = await freeBuildSlug(mesa, name)
            if (!slug) return fail(409, 'Já existem personagens demais com esse nome')
            const build = await createBuild(mesa, { slug, state, className: className(body.className), ownerId: access.userId, by: access.userId })
            if (build) return ok({ build })
        }
        return fail(409, 'Já existem personagens demais com esse nome')
    }

    if (typeof body.id !== 'string' || !UUID_RE.test(body.id)) return fail(400, 'Personagem inválido')
    const current = await readBuild(mesa, body.id)
    if (!current) return fail(404, 'Personagem não encontrado')

    if (action === 'build-assign') {
        if (role !== 'gm') return forbidden()
        const user = body.user ?? null
        if (user !== null && (typeof user !== 'string' || !UUID_RE.test(user))) return fail(400, 'Usuário inválido')
        if (user !== null && !(await memberRole(mesa, user))) return fail(404, 'Essa pessoa não está na mesa')
        return ok({ build: await assignBuild(mesa, body.id, user, access.userId) })
    }

    if (!canEditBuild(current, access, role)) return forbidden('Este personagem é de outra pessoa')

    if (action === 'build-delete' || action === 'build-restore') {
        return ok({ build: await trashBuild(mesa, body.id, action === 'build-delete', access.userId) })
    }

    // build-save
    if (current.deletedAt) return fail(409, 'Personagem na lixeira', { code: 'trashed' })
    if (!Number.isInteger(body.rev) || body.rev < 1) return fail(400, 'Versão inválida')
    const state = sanitizeBuildState(body.state)
    if (!state) return fail(400, 'Personagem inválido')
    if (state.schema !== BUILD_SCHEMA) return fail(400, 'Personagem inválido')
    if (buildBytes(state) > MAX_BUILD_BYTES) return fail(413, 'Personagem grande demais')
    const saved = await saveBuild(mesa, body.id, body.rev, { state, className: className(body.className), by: access.userId })
    if (!saved) {
        return { status: 409, body: { error: 'Editado em outro aparelho', code: 'conflict', build: await readBuild(mesa, body.id) } }
    }
    return ok({ build: header(saved) })
}
