// Rotas de admin da base de regras (BASE-DE-REGRAS §7), no endpoint `state` (sem arquivo novo em `api/`).
//
//   GET  ?rulesSources=1          → { sources, version, job, jobs }      livros com estado, versão atual, job em andamento
//   GET  ?rulesJob=<id>           → { job }                              progresso e relatório
//   GET  ?rulesEntry=<aon_id>     → { entry, mechanics }                 para a correção manual
//   POST rules-check              → { sources }                          verifica novidades na AON (não baixa conteúdo)
//   POST rules-import { sources } → { job }                              cria o job dos livros escolhidos
//   POST rules-import-step { jobId } → { job }                           um passo (≤ ~45 s); o navegador repete
//   POST rules-import-cancel { jobId } → { job }
//   POST rules-mechanics-save { aonId, rules, unsupported, note } → { ok }
//   POST rules-publish            → { catalog }                          versão nova (depois de correções manuais)
//
// Só quem está em `platform_admins` (a base é de todas as mesas: não é papel de GM). Vem antes da ficha no despacho.

import { isPlatformAdmin, forbidden } from './access.js'
import {
    cancelRuleImport, checkRuleSources, finishRuleImport, listRuleSourcesWithState, publishRuleCatalog, runRuleImportStep,
    startRuleImport,
} from './rules-platform.js'
import {
    latestRuleCatalogVersion, readRuleEntryWithMechanics, readRuleImportJob, recentRuleImportJobs, releaseRuleLock,
    runningRuleImportJob, saveManualMechanics, tryRuleLock,
} from './rules-store.js'

const ACTIONS = new Set(['rules-check', 'rules-import', 'rules-import-step', 'rules-import-cancel', 'rules-mechanics-save', 'rules-publish'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const AON_ID_RE = /^[a-z][a-z-]{0,30}-[0-9]{1,7}$/
const SOURCE_RE = /^source-[0-9]{1,6}$/
/** Um passo lê páginas até aqui; o resto da chamada (60 s) fica para gravar o cursor e, no fim, publicar. */
const STEP_BUDGET_MS = 35_000
const PUBLISH_NEEDS_MS = 20_000
const LOCK_SECONDS = 58
const MAX_RULES_BYTES = 32 * 1024

const ok = (body) => ({ status: 200, body })
const fail = (status, error, extra = {}) => ({ status, body: { error, ...extra } })

export function isRulesAdminRequest(method, query, body) {
    if (method === 'GET') return query.rulesSources !== undefined || query.rulesJob !== undefined || query.rulesEntry !== undefined
    if (method === 'POST') return ACTIONS.has(body?.action)
    return false
}

/** O que o job mostra na tela (sem o `seen` do cursor, que tem milhares de ids). */
const jobView = (job) => job && {
    id: job.id, kind: job.kind, sources: job.sources, status: job.status, counts: job.counts, report: job.report,
    phase: job.cursor?.phase ?? null, index: job.cursor?.index ?? 0, startedAt: job.started_at, finishedAt: job.finished_at,
}

/** Rótulo `rules` do Foundry/manual: lista de objetos com `key`. */
const validRules = (rules) => Array.isArray(rules) && rules.length <= 100
    && rules.every((r) => r && typeof r === 'object' && !Array.isArray(r) && typeof r.key === 'string' && r.key.length <= 60)
    && JSON.stringify(rules).length <= MAX_RULES_BYTES

export async function handleRulesAdminRequest(method, query, body, ctx = {}) {
    const userId = ctx.access?.userId ?? null
    if (!(await isPlatformAdmin(userId))) return forbidden('Só a administração da plataforma mexe na base de regras')

    if (method === 'GET') {
        if (query.rulesJob !== undefined) {
            if (!UUID_RE.test(String(query.rulesJob))) return fail(400, 'Importação inválida')
            return ok({ job: jobView(await readRuleImportJob(query.rulesJob)) })
        }
        if (query.rulesEntry !== undefined) {
            if (!AON_ID_RE.test(String(query.rulesEntry))) return fail(400, 'Entrada inválida')
            const found = await readRuleEntryWithMechanics(query.rulesEntry)
            return found ? ok(found) : fail(404, 'Entrada não encontrada')
        }
        const [sources, version, job, jobs] = await Promise.all([
            listRuleSourcesWithState(), latestRuleCatalogVersion(), runningRuleImportJob(), recentRuleImportJobs(8),
        ])
        return ok({ sources, version, job: jobView(job), jobs: jobs.map(jobView) })
    }

    const { action } = body
    if (action === 'rules-check') return ok({ sources: await checkRuleSources() })

    if (action === 'rules-import') {
        const ids = Array.isArray(body.sources) ? body.sources.filter((id) => typeof id === 'string' && SOURCE_RE.test(id)) : []
        if (!ids.length || ids.length > 60) return fail(400, 'Escolha de 1 a 60 livros')
        if (await runningRuleImportJob()) return fail(409, 'Já há uma importação em andamento', { code: 'running' })
        const id = await startRuleImport(ids, userId)
        return ok({ job: jobView(await readRuleImportJob(id)) })
    }

    if (action === 'rules-publish') {
        if (await runningRuleImportJob()) return fail(409, 'Já há uma importação em andamento', { code: 'running' })
        return ok({ catalog: await publishRuleCatalog({ summary: { manual: true, by: userId } }) })
    }

    if (action === 'rules-mechanics-save') {
        if (!AON_ID_RE.test(String(body.aonId))) return fail(400, 'Entrada inválida')
        if (!validRules(body.rules)) return fail(400, 'Mecânica inválida')
        const unsupported = Array.isArray(body.unsupported) ? body.unsupported.filter((u) => typeof u === 'string' && u.length <= 80).slice(0, 50) : []
        const note = typeof body.note === 'string' ? body.note.trim() : ''
        // Nunca inventar regra: a correção diz de onde veio (livro e página na AON).
        if (note.length < 5 || note.length > 500) return fail(400, 'Diga de onde vem a correção (livro e página)')
        if (!(await readRuleEntryWithMechanics(body.aonId))) return fail(404, 'Entrada não encontrada')
        await saveManualMechanics(body.aonId, { rules: body.rules, unsupported, note }, userId)
        return ok({ ok: true })
    }

    if (!UUID_RE.test(String(body.jobId))) return fail(400, 'Importação inválida')

    if (action === 'rules-import-cancel') return ok({ job: jobView(await cancelRuleImport(body.jobId)) })

    // rules-import-step
    const started = Date.now()
    const key = `rules-import:${body.jobId}`
    if (!(await tryRuleLock(key, LOCK_SECONDS))) return ok({ job: jobView(await readRuleImportJob(body.jobId)), busy: true })
    try {
        let job = await runRuleImportStep(body.jobId, { deadline: started + STEP_BUDGET_MS })
        if (job.status === 'running' && job.cursor?.phase === 'publish' && Date.now() - started < 60_000 - PUBLISH_NEEDS_MS - 5_000) {
            job = await finishRuleImport(body.jobId)
        }
        return ok({ job: jobView(job) })
    } finally {
        await releaseRuleLock(key)
    }
}
