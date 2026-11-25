// Rotas do Criador de Personagem no endpoint `state` (sem arquivo novo em `api/`: limite de 12 funções).
//
//   GET  ?builds=1                                     → { builds: [cabeçalho] }             (membro)
//   GET  ?build=<id>                                   → { build, canEdit }                  (membro; edita dono e GM)
//   GET  ?mesaRules=1                                  → { rules, updatedAt }                (membro)
//   POST { action: 'build-create', name, state?, fromSheet? } → { build }                    (membro logado; fromSheet: dono da ficha ou GM)
//   POST { action: 'build-save', id, rev, state, className? } → { build } | 409 { build }    (dono, GM)
//   POST { action: 'build-delete' | 'build-restore', id }      → { build }                   (dono, GM)
//   POST { action: 'build-assign', id, user|null }     → { build }                           (GM)
//   POST { action: 'mesa-rules-save', rules }          → { rules, updatedAt }                (GM real, sempre)
//   POST { action: 'build-apply', id, sheet, names, version, companions?, baseGuide?, baseGuideEn? }
//                                                      → { draft }  "Aplicar na mesa": o preparo de sempre, com o slug do build
//   GET  ?buildVersions=<id>                           → { versions }                        (dono, GM)
//   POST { action: 'build-version-restore', id, version, rev } → { build }                   (dono, GM)
//   POST { action: 'build-copy', id, toMesa }          → { build, mesa }  cópia em outra mesa   (dono, GM; membro da outra)
//   GET  ?homebrew=1                                   → { homebrew: [{ id, kind, entry }] }  conteúdo da mesa (membro)
//   POST { action: 'homebrew-save', id?, kind, entry } → { homebrew }                          (GM real, sempre)
//   POST { action: 'homebrew-delete', id }             → { deleted }                           (GM real, sempre)
//
// Vem ANTES da ficha publicada no despacho: a rota da ficha aceita qualquer POST com `action`.
//
// Quem pode: o build tem dono desde o nascimento (quem criou), então a regra não depende do `AUTH_REQUIRED`:
// escrever é do dono ou do GM de verdade (`memberRole`), e criar exige estar logado. Com a cobrança desligada, ler
// segue aberto como o resto da mesa.

import { isSupabaseConfigured } from './supabase.js'
import { forbidden, memberRole, sheetOwner } from './access.js'
import { BUILD_SCHEMA, MAX_BUILD_BYTES, buildBytes, emptyBuildState, sanitizeBuildState } from './build-sanitize.js'
import {
    assignBuild, createBuild, freeBuildSlug, listBuilds, listBuildVersions, memberNames, readBuild, readBuildVersion, readMesaRules, saveBuild, trashBuild, writeMesaRules,
} from './build-store.js'
import { currentRulesVersion } from './rules-core.js'
import { MESA_IDS } from './mesas.js'
import { HOMEBREW_KINDS, deleteHomebrew, listHomebrew, saveHomebrew } from './homebrew-store.js'
import { createSheetDraftFor } from './sheet-handler.js'
import { recordFeat, safely } from './trophy-store.js'

/** "Arquiteto": o feito é de quem criou E é o dono (o GM criando para alguém não ganha o troféu do jogador). */
const builtFeat = (mesa, build, userId) => safely('personagem criado', async () => {
    if (build?.ownerId && build.ownerId === userId) await recordFeat(mesa, userId, 'build-created', { slug: build.slug })
})

const ACTIONS = new Set(['build-create', 'build-save', 'build-delete', 'build-restore', 'build-assign', 'mesa-rules-save', 'build-apply', 'build-version-restore', 'build-copy', 'homebrew-save', 'homebrew-delete'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } })

export function isBuildRequest(method, query, body) {
    if (method === 'GET') return query.builds !== undefined || query.build !== undefined || query.mesaRules !== undefined || query.buildVersions !== undefined || query.homebrew !== undefined
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
        if (query.homebrew !== undefined) {
            // Como o resto da mesa: com a cobrança ligada, só membro lê.
            if (access?.enforce && !(await realRole(mesa, access))) return forbidden('Você não faz parte desta mesa')
            return ok({ homebrew: await listHomebrew(mesa) })
        }
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
        if (query.buildVersions !== undefined) {
            const target = await readBuild(mesa, query.buildVersions)
            if (!target) return fail(404, 'Personagem não encontrado')
            if (!canEditBuild(target, access, await realRole(mesa, access))) return forbidden('Este personagem é de outra pessoa')
            return ok({ versions: await listBuildVersions(mesa, target.id) })
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

    // Conteúdo da mesa: como as regras de criação, só o GM de verdade escreve.
    if (action === 'homebrew-save' || action === 'homebrew-delete') {
        if ((await realRole(mesa, access)) !== 'gm') return forbidden()
        if (action === 'homebrew-delete') return ok({ deleted: await deleteHomebrew(mesa, body.id) })
        if (!HOMEBREW_KINDS.includes(body.kind)) return fail(400, 'Conteúdo inválido')
        const saved = await saveHomebrew(mesa, { id: body.id, kind: body.kind, entry: body.entry }, access.userId)
        if (!saved) return fail(404, 'Conteúdo não encontrado')
        if (saved.invalid) return fail(400, 'Conteúdo inválido')
        if (saved.full) return fail(409, 'A mesa já tem conteúdo caseiro demais')
        return ok({ homebrew: saved })
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
        // Importar de uma ficha publicada: o build herda o slug dela (o estado da mesa, o token e as anotações moram nele).
        if (typeof body.fromSheet === 'string') {
            if (!/^[a-z0-9-]{1,48}$/.test(body.fromSheet)) return fail(400, 'Personagem inválido')
            const sheetRow = await sheetOwner(mesa, body.fromSheet)
            if (!sheetRow.exists) return fail(404, 'Ficha não publicada')
            if (role !== 'gm' && sheetRow.owner !== access.userId) return forbidden('Este personagem é de outra pessoa')
            if ((await listBuilds(mesa)).some((b) => b.slug === body.fromSheet)) return fail(409, 'Já existe um personagem do Criador para esta ficha')
            const build = await createBuild(mesa, { slug: body.fromSheet, state, className: className(body.className), ownerId: sheetRow.owner ?? access.userId, by: access.userId })
            return build ? ok({ build }) : fail(409, 'Já existe um personagem do Criador para esta ficha')
        }
        // Duas criações ao mesmo tempo podem escolher o mesmo slug: o unique recusa e tenta o próximo.
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const slug = await freeBuildSlug(mesa, name)
            if (!slug) return fail(409, 'Já existem personagens demais com esse nome')
            const build = await createBuild(mesa, { slug, state, className: className(body.className), ownerId: access.userId, by: access.userId })
            if (build) {
                await builtFeat(mesa, build, access.userId)
                return ok({ build })
            }
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

    if (action === 'build-apply') {
        if (current.deletedAt) return fail(409, 'Personagem na lixeira', { code: 'trashed' })
        const sheet = body.sheet
        if (!sheet || typeof sheet !== 'object' || !sheet.build || typeof sheet.build !== 'object') return fail(400, 'Personagem inválido')
        // O vínculo com o build é do servidor: o cliente não escolhe a que build a ficha pertence.
        const json = { ...sheet, build: { ...sheet.build, covil: { ...(sheet.build.covil ?? {}), buildId: current.id } } }
        return createSheetDraftFor(mesa, current.slug, { ...body, sheet: json }, { ...ctx, access, userId: access.userId })
    }

    // Copiar para outra mesa: nasce lá com slug livre e dono = quem copiou. As regras e as exceções do GM ficam na mesa
    // de origem (são de `mesa_rules`); o retrato e o estado da mesa não vão junto. O motor avisa o que a outra não libera.
    if (action === 'build-copy') {
        const toMesa = body.toMesa
        if (typeof toMesa !== 'string' || !MESA_IDS.includes(toMesa) || toMesa === mesa) return fail(400, 'Mesa inválida')
        if (!localMode() && !(await memberRole(toMesa, access.userId))) return forbidden('Você não faz parte desta mesa')
        const state = sanitizeBuildState({ ...current.state, history: [] })
        if (!state) return fail(400, 'Personagem inválido')
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const slug = await freeBuildSlug(toMesa, state.name)
            if (!slug) return fail(409, 'Já existem personagens demais com esse nome')
            const build = await createBuild(toMesa, { slug, state, className: current.className, ownerId: access.userId, by: access.userId })
            if (build) return ok({ build: header(build), mesa: toMesa })
        }
        return fail(409, 'Já existem personagens demais com esse nome')
    }

    if (action === 'build-version-restore') {
        const versionId = Number(body.version)
        if (!Number.isInteger(versionId) || !Number.isInteger(body.rev)) return fail(400, 'Versão inválida')
        const old = await readBuildVersion(mesa, current.id, versionId)
        if (!old) return fail(404, 'Versão não encontrada')
        const state = sanitizeBuildState(old)
        if (!state) return fail(400, 'Personagem inválido')
        const saved = await saveBuild(mesa, current.id, body.rev, { state, className: current.className, by: access.userId })
        if (!saved) return { status: 409, body: { error: 'Editado em outro aparelho', code: 'conflict', build: await readBuild(mesa, current.id) } }
        return ok({ build: header(saved) })
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
