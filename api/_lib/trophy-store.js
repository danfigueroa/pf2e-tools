// Os Troféus do Covil no banco (migration `trofeus`): registrar feitos, abrir e fechar
// sessões, avaliar o que uma conta desbloqueou e montar o perfil e o ranking. O catálogo e as
// regras moram em `trophies.js`.
//
// **Troféu nunca derruba o que o jogador fez**: quem registra um feito chama `safely`, e um
// erro aqui só vai para o log. Sem banco não há troféu (nada a guardar): tudo vira no-op.

import { supabase } from './supabase.js'
import { sheetOwner } from './access.js'
import { catalogWire, deriveFacts, evaluateFacts, pointsOf, sessionHighlights, TROPHY_BY_ID } from './trophies.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUserId = (v) => typeof v === 'string' && UUID.test(v)

function check(result) {
    if (result.error) throw new Error(result.error.message)
    return result.data
}

/** Roda um registro de troféu sem deixar o erro subir (ele não pode falhar a ação de verdade). */
export async function safely(label, fn) {
    try {
        return await fn()
    } catch (error) {
        console.error(`[troféus] ${label}:`, error)
        return null
    }
}

/** Grava um feito e avalia a conta. Devolve os troféus que ele desbloqueou. */
export async function recordFeat(mesa, userId, kind, data = {}, evaluateAfter = true) {
    const db = supabase()
    if (!db || !isUserId(userId)) return []
    check(await db.from('trophy_feats').insert({ user_id: userId, mesa, kind, at: Date.now(), data }))
    return evaluateAfter ? evaluate(mesa, userId) : []
}

/**
 * Como `recordFeat`, mas junta num registro só o que acontece em rajada (o autosave das
 * anotações grava a cada 1,5 s): se já há um feito igual (`kind` + `data.slug`) nos últimos
 * `windowMs`, ele é atualizado em vez de ganhar irmão.
 */
export async function touchFeat(mesa, userId, kind, data, windowMs) {
    const db = supabase()
    if (!db || !isUserId(userId)) return []
    const since = Date.now() - windowMs
    const rows = check(await db.from('trophy_feats').select('id, data')
        .eq('user_id', userId).eq('mesa', mesa).eq('kind', kind).eq('data->>slug', data.slug ?? '')
        .gte('at', since).order('at', { ascending: false }).limit(1))
    if (rows?.length) {
        const prev = rows[0].data ?? {}
        const merged = { ...prev, ...data }
        // O que só sobe não desce num rascunho apagado no meio.
        if (typeof prev.length === 'number') merged.length = Math.max(prev.length, data.length ?? 0)
        if (prev.afterLevelUp === true) merged.afterLevelUp = true
        check(await db.from('trophy_feats').update({ data: merged, at: Date.now() }).eq('id', rows[0].id))
        // Só reavalia quando algo que o catálogo lê mudou (cada autosave passaria por aqui).
        const grew = (merged.length ?? 0) > (prev.length ?? 0) || (merged.afterLevelUp === true && prev.afterLevelUp !== true)
        return grew ? evaluate(mesa, userId) : []
    }
    return recordFeat(mesa, userId, kind, data)
}

/**
 * Feito de JOGADOR, que só vale para o dono da ficha: o GM mexendo na ficha de alguém não ganha
 * o troféu dele. `null` = quem fez não é o dono.
 */
export async function ownerOf(mesa, slug, userId) {
    if (!isUserId(userId)) return null
    const { owner } = await sheetOwner(mesa, slug)
    return owner === userId ? userId : null
}

/** O `at` do feito mais recente deste tipo e personagem, ou 0. */
export async function lastFeatAt(userId, kind, slug) {
    const db = supabase()
    if (!db || !isUserId(userId)) return 0
    const rows = check(await db.from('trophy_feats').select('at')
        .eq('user_id', userId).eq('kind', kind).eq('data->>slug', slug).order('at', { ascending: false }).limit(1))
    return rows?.length ? Number(rows[0].at) : 0
}

async function unlockedOf(db, userId) {
    const rows = check(await db.from('account_trophies').select('trophy_id, unlocked_at, mesa').eq('user_id', userId))
    return (rows ?? []).map((r) => ({ id: r.trophy_id, at: Number(r.unlocked_at), mesa: r.mesa }))
}

async function factsOf(db, userId) {
    return deriveFacts(check(await db.rpc('trophy_facts', { p_user: userId })) ?? {})
}

/**
 * Confere o que a conta já alcançou e grava o que é novo, com o aviso na mesa em que foi
 * (`mesa_events` `trophy-unlocked`, que o sino e o aviso ao vivo leem). Idempotente.
 */
export async function evaluate(mesa, userId) {
    const db = supabase()
    if (!db || !isUserId(userId)) return []
    const before = await unlockedOf(db, userId)
    const had = new Set(before.map((u) => u.id))
    const { earned } = evaluateFacts(await factsOf(db, userId), had)
    const fresh = [...earned].filter((id) => !had.has(id))
    if (fresh.length === 0) return []
    const at = Date.now()
    const inserted = check(await db.from('account_trophies')
        .upsert(fresh.map((id) => ({ user_id: userId, trophy_id: id, unlocked_at: at, mesa })), { onConflict: 'user_id,trophy_id', ignoreDuplicates: true })
        .select('trophy_id')) ?? []
    const ids = inserted.map((r) => r.trophy_id)
    if (ids.length === 0) return []
    const member = check(await db.from('mesa_members').select('display_name').eq('mesa', mesa).eq('user_id', userId).maybeSingle())
    check(await db.from('mesa_events').insert(ids.map((id) => {
        const x = TROPHY_BY_ID.get(id)
        return {
            mesa,
            kind: 'trophy-unlocked',
            data: { user: userId, name: member?.display_name ?? null, trophy: id, title: x?.title ?? id, tier: x?.tier ?? 'bronze' },
        }
    })))
    return ids
}

/** O perfil de troféus de uma conta: catálogo, desbloqueados, progresso e pontos. */
export async function trophyProfile(userId) {
    const db = supabase()
    const catalog = catalogWire()
    if (!db || !isUserId(userId)) return { catalog, unlocked: [], progress: {}, points: { player: 0, gm: 0 } }
    const unlocked = await unlockedOf(db, userId)
    const { progress } = evaluateFacts(await factsOf(db, userId), new Set(unlocked.map((u) => u.id)))
    return { catalog, unlocked, progress, points: pointsOf(unlocked.map((u) => u.id)) }
}

/**
 * O resumo leve (sidebar e Início): pontos, quantos e os últimos desbloqueados, sem avaliar
 * nem calcular progresso — uma consulta só, a cada abertura do app.
 */
export async function trophySummary(userId) {
    const db = supabase()
    if (!db || !isUserId(userId)) return { points: { player: 0, gm: 0 }, count: 0, total: TROPHY_BY_ID.size, recent: [] }
    const unlocked = (await unlockedOf(db, userId)).sort((a, b) => b.at - a.at)
    return {
        points: pointsOf(unlocked.map((u) => u.id)),
        count: unlocked.length,
        total: TROPHY_BY_ID.size,
        recent: unlocked.slice(0, 4).map((u) => {
            const x = TROPHY_BY_ID.get(u.id)
            return { id: u.id, at: u.at, title: x?.title ?? u.id, tier: x?.tier ?? 'bronze' }
        }),
    }
}

/** Os membros da mesa (com conta) com os pontos de jogador e de GM. */
export async function trophyRanking(mesa) {
    const db = supabase()
    if (!db) return []
    const rows = check(await db.rpc('trophy_ranking', { p_mesa: mesa })) ?? []
    return rows.map((r) => {
        const trophies = Array.isArray(r.trophies) ? r.trophies : []
        const ids = trophies.map((x) => x.id)
        const last = trophies[trophies.length - 1] ?? null
        return {
            userId: r.userId,
            role: r.role,
            name: r.displayName || r.username || 'Membro',
            username: r.username ?? null,
            points: pointsOf(ids),
            count: ids.length,
            platinum: ids.filter((id) => TROPHY_BY_ID.get(id)?.tier === 'platina').length,
            last: last ? { id: last.id, at: Number(last.at), title: TROPHY_BY_ID.get(last.id)?.title ?? last.id } : null,
        }
    })
}

/** O GM iniciou a sessão: fecha alguma esquecida aberta e abre a nova. */
export async function startSession(mesa, userId) {
    const db = supabase()
    if (!db) return
    const now = Date.now()
    check(await db.from('mesa_sessions').update({ ended_at: now }).eq('mesa', mesa).is('ended_at', null))
    check(await db.from('mesa_sessions').insert({ mesa, started_at: now, started_by: isUserId(userId) ? userId : null }))
    if (isUserId(userId)) await recordFeat(mesa, userId, 'gm-session', {})
}

/**
 * O GM encerrou a sessão: fecha a linha (ou a cria, para a sessão iniciada antes de haver
 * histórico, a partir de `startedIso`), elege os destaques e avalia quem estava na mesa.
 */
export async function endSession(mesa, userId, startedIso) {
    const db = supabase()
    if (!db) return
    const now = Date.now()
    let rows = check(await db.from('mesa_sessions').update({ ended_at: now })
        .eq('mesa', mesa).is('ended_at', null).select('id, started_at'))
    if (!rows?.length) {
        const started = startedIso ? Date.parse(startedIso) : NaN
        if (!Number.isFinite(started)) return
        rows = check(await db.from('mesa_sessions')
            .insert({ mesa, started_at: started, ended_at: now, started_by: isUserId(userId) ? userId : null })
            .select('id, started_at'))
        if (isUserId(userId)) await recordFeat(mesa, userId, 'gm-session', {}, false)
    }
    const session = rows[0]
    const rollup = check(await db.rpc('session_rollup', { p_mesa: mesa, p_from: Number(session.started_at), p_to: now })) ?? []
    const highlights = sessionHighlights(rollup)
    for (const [kind, owner] of Object.entries(highlights)) {
        if (owner) await recordFeat(mesa, owner, kind, { session: Number(session.id) }, false)
    }
    const members = check(await db.from('mesa_members').select('user_id').eq('mesa', mesa)) ?? []
    for (const m of members) await safely('avaliar ao encerrar', () => evaluate(mesa, m.user_id))
}
