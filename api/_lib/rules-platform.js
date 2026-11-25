// Atualização da base de regras pela plataforma (BASE-DE-REGRAS §6): verificar novidades na AON, importar livros em
// passos curtos (cada chamada da Vercel tem 60 s) e publicar uma versão nova do catálogo. O `scripts/import-rules.mjs`
// usa os mesmos passos sem prazo e acrescenta a mecânica do Foundry, que precisa do tarball e fica só no script.
//
// O job guarda onde parou em `rules_import_jobs.cursor` ({ phase, index, after, seen }), então fechar a aba ou a chamada
// cair não perde nada: o próximo passo continua do último cursor confirmado.

import { readRuleEntriesPage, readRuleSourcesPage, countRuleEntriesBySource } from './rules-import.js'
import { normalizeRuleEntry, normalizeRuleSource, RULE_CATEGORIES } from './rules-normalize.js'
import { buildRulePackages } from './rules-packages.js'
import {
    copyRulePackages, createRuleCatalogVersion, latestRuleCatalogVersion, listRuleSources, markRuleEntriesRemoved,
    readPublishedRuleFile, readRuleImportJob, ruleEntriesForPackages, ruleEntriesUpdatedSince, ruleEntryHashes,
    ruleMechanicsById, saveRuleEntries, saveRuleSources, startRuleImportJob, updateRuleImportJob, updateRuleSource,
    uploadRulePackages,
} from './rules-store.js'

/** Categorias cuja falta de mecânica estruturada vira aviso no Criador ("efeito não calculado"). */
const NEEDS_MECHANICS = new Set(['feat', 'class-feature', 'heritage', 'ancestry', 'background', 'class', 'spell'])

const emptyCounts = () => ({ new: 0, changed: 0, same: 0, removed: 0, invalid: 0 })

async function readAllAonSources() {
    const sources = []
    let after = null
    do {
        const page = await readRuleSourcesPage(after)
        for (const entry of page.entries) sources.push(normalizeRuleSource(entry))
        after = page.nextCursor
    } while (after)
    return sources
}

/**
 * Estado de um livro na tela: `new` (Remaster com conteúdo e não importado), `errata` (importado, mas a errata ou a
 * contagem na AON mudou), `imported`, `legacy` (pré-Remaster, só se uma mesa liberar) ou `empty` (sem entradas de jogador).
 */
export function sourceState(row) {
    if (row.status === 'outdated') return 'errata'
    if (row.status === 'imported') return 'imported'
    if (!row.aon_count) return 'empty'
    return row.remaster ? 'new' : 'legacy'
}

/**
 * Verificar novidades: lê os livros da AON e quantas entradas de jogador cada um tem (uma agregação), compara com a base e
 * marca erratas. Não baixa conteúdo. Devolve os livros já com `state`.
 */
export async function checkRuleSources() {
    const [aon, counts, stored] = await Promise.all([readAllAonSources(), countRuleEntriesBySource(RULE_CATEGORIES), listRuleSources()])
    const known = new Map(stored.map((row) => [row.aon_id, row]))
    const now = new Date().toISOString()
    const rows = aon.map((source) => {
        const before = known.get(source.aon_id)
        const aonCount = counts.get(source.name) ?? 0
        let status = before?.status ?? 'available'
        // Livro importado cuja errata mudou ou cuja contagem na AON não é mais a da importação: reimportar.
        if (status === 'imported' && ((source.errata ?? null) !== (before.errata ?? null) || (before.aon_count !== null && aonCount !== before.aon_count))) {
            status = 'outdated'
        }
        return { ...source, aon_count: status === 'imported' || status === 'outdated' ? before.aon_count ?? aonCount : aonCount, aon_now: aonCount, status, checked_at: now }
    })
    await saveRuleSources(rows.map(({ aon_now, ...row }) => row))
    return rows.map((row) => ({ ...row, state: sourceState(row) }))
}

/** Livros para a tela, com `state`. */
export async function listRuleSourcesWithState() {
    return (await listRuleSources()).map((row) => ({ ...row, state: sourceState(row) }))
}

/** Novidades pendentes (livros novos + erratas), para o aviso ao admin. */
export async function ruleNewsCount() {
    return (await listRuleSourcesWithState()).filter((row) => row.state === 'new' || row.state === 'errata').length
}

/** Cria o job de importação dos livros escolhidos (`source-N`). Erro se outro estiver rodando. */
export async function startRuleImport(sourceIds, startedBy = null) {
    const stored = new Map((await listRuleSources()).map((row) => [row.aon_id, row]))
    const ids = [...new Set(sourceIds)].filter((id) => stored.has(id))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    if (!ids.length) throw Object.assign(new Error('Nenhum livro válido para importar'), { status: 400 })
    const kind = ids.every((id) => ['imported', 'outdated'].includes(stored.get(id).status)) ? 'reimport' : 'import'
    const id = await startRuleImportJob(kind, ids, startedBy)
    await updateRuleImportJob(id, { cursor: { phase: 'import', index: 0, after: null, seen: [] }, counts: emptyCounts(), report: { sources: {} } })
    return id
}

/** Fecha um livro: o que estava na base e não apareceu na AON ganha `removed_at`; contagens e estado do livro. */
async function finishSource(source, known, seen, counts, partial) {
    const gone = partial ? [] : [...known].filter(([id, state]) => !seen.has(id) && !state.removed).map(([id]) => id)
    counts.removed += gone.length
    if (gone.length) await markRuleEntriesRemoved(gone)
    const now = new Date().toISOString()
    await updateRuleSource(source.aon_id, {
        aon_count: seen.size + counts.invalid,
        our_count: seen.size,
        status: 'imported',
        checked_at: now,
        imported_at: now,
    })
}

/**
 * Um passo do job: lê páginas da AON (100 entradas cada) até o prazo, grava o que mudou pelo `hash` e salva o cursor a
 * cada página. Ao terminar os livros, passa à fase `publish` (quem chama publica). Devolve o job atualizado.
 */
export async function runRuleImportStep(jobId, { deadline = Infinity, checkOnly = false, log = () => {} } = {}) {
    const job = await readRuleImportJob(jobId)
    if (job.status !== 'running') return job
    const cursor = { phase: 'import', index: 0, after: null, seen: [], ...(job.cursor ?? {}) }
    const counts = { ...emptyCounts(), ...(job.counts ?? {}) }
    const report = { sources: {}, ...(job.report ?? {}) }
    const sources = new Map((await listRuleSources()).map((row) => [row.aon_id, row]))
    let known = null

    while (cursor.phase === 'import' && Date.now() < deadline) {
        const sourceId = job.sources[cursor.index]
        if (!sourceId) {
            cursor.phase = 'publish'
            await updateRuleImportJob(jobId, { cursor, counts, report })
            break
        }
        const source = sources.get(sourceId)
        known ??= await ruleEntryHashes(sourceId)
        const per = report.sources[sourceId] ?? { name: source.name, ...emptyCounts() }
        const page = await readRuleEntriesPage(source.name, RULE_CATEGORIES, cursor.after)
        const changed = []
        const seen = new Set(cursor.seen)
        for (const entry of page.entries) {
            let row
            try {
                row = normalizeRuleEntry(entry, source)
            } catch (error) {
                per.invalid++
                counts.invalid++
                if ((per.examples ?? []).length < 10) per.examples = [...(per.examples ?? []), `${entry?.id}: ${error.message}`]
                continue
            }
            seen.add(row.aon_id)
            const previous = known.get(row.aon_id)
            const kind = previous && previous.hash === row.hash && !previous.removed ? 'same' : previous ? 'changed' : 'new'
            per[kind]++
            counts[kind]++
            if (kind !== 'same') changed.push(row)
        }
        if (!checkOnly && changed.length) await saveRuleEntries(changed)
        cursor.after = page.nextCursor
        cursor.seen = [...seen]
        if (!cursor.after) {
            const perCounts = { ...emptyCounts(), invalid: per.invalid }
            if (!checkOnly) await finishSource(source, known, seen, perCounts, Boolean(cursor.partial))
            per.removed = perCounts.removed
            counts.removed += perCounts.removed
            log(`${source.name}: ${per.new} novas, ${per.changed} alteradas, ${per.same} sem mudança, ${per.removed} removidas${per.invalid ? `, ${per.invalid} inválidas` : ''}`)
            cursor.index++
            cursor.after = null
            cursor.seen = []
            delete cursor.partial
            known = null
        }
        report.sources[sourceId] = per
        await updateRuleImportJob(jobId, { cursor, counts, report })
    }
    if (cursor.phase === 'publish' && checkOnly) {
        cursor.phase = 'done'
        await updateRuleImportJob(jobId, { cursor, counts, report, status: 'done', finished_at: new Date().toISOString() })
    }
    return { ...job, cursor, counts, report, status: checkOnly && cursor.phase === 'done' ? 'done' : job.status }
}

/**
 * Publica uma versão nova do catálogo: monta todos os pacotes a partir do banco (~2 s), grava só as listas cujo hash
 * mudou e copia as outras da versão anterior. As tabelas curadas vêm da versão anterior, salvo se `tables` vier (script).
 * Devolve `{ version, changedLists, copiedLists, withoutMechanics }`.
 */
export async function publishRuleCatalog({ jobId = null, summary = {}, tables = null, since = null, log = () => {} } = {}) {
    const previous = await latestRuleCatalogVersion()
    const previousManifest = previous ? await readPublishedRuleFile(previous, 'manifest.json') : null
    const resolvedTables = tables ?? (previous ? await readPublishedRuleFile(previous, 'core/tables.json') : null)
    if (!resolvedTables) throw new Error('Base de regras: sem tabelas curadas (rode o script de importação)')
    const [entries, mechanics, sources] = await Promise.all([ruleEntriesForPackages(), ruleMechanicsById(), listRuleSources()])
    const version = await createRuleCatalogVersion(jobId, summary)
    const { files, manifest } = buildRulePackages({
        version, entries, mechanics, tables: resolvedTables,
        sources: sources.filter((source) => ['imported', 'outdated'].includes(source.status) && source.our_count > 0),
    })
    const same = (list) => previousManifest?.files?.[list]?.hash === manifest.files[list].hash
    const lists = Object.keys(manifest.files)
    const copied = lists.filter(same)
    const upload = Object.fromEntries(Object.entries(files).filter(([path]) => path === 'manifest.json' || !same(path.replace(/\.json$/, ''))))
    if (copied.length) await copyRulePackages(previous, version, copied.map((list) => `${list}.json`))
    // O manifesto sobe por último: quem lê a versão nova só a vê completa.
    const { 'manifest.json': manifestText, ...rest } = upload
    await uploadRulePackages(version, rest)
    await uploadRulePackages(version, { 'manifest.json': manifestText })
    let withoutMechanics = null
    if (since) {
        const touched = await ruleEntriesUpdatedSince(since)
        withoutMechanics = touched.filter((row) => NEEDS_MECHANICS.has(row.category) && !mechanics.has(row.aon_id)).length
    }
    log(`Catálogo ${version}: ${Object.keys(rest).length} listas gravadas, ${copied.length} copiadas da ${previous}`)
    return { version, changedLists: Object.keys(rest).length, copiedLists: copied.length, withoutMechanics }
}

/** Fim do job pela plataforma: publica se algo mudou e fecha o job com o relatório. */
export async function finishRuleImport(jobId, { log } = {}) {
    const job = await readRuleImportJob(jobId)
    if (job.status !== 'running' || job.cursor?.phase !== 'publish') return job
    const counts = job.counts ?? emptyCounts()
    const report = { ...(job.report ?? {}) }
    if (counts.new + counts.changed + counts.removed > 0) {
        report.catalog = await publishRuleCatalog({
            jobId,
            summary: { totals: counts, sources: job.sources.map((id) => report.sources?.[id]?.name ?? id) },
            since: job.started_at,
            log,
        })
    }
    const done = { cursor: { ...job.cursor, phase: 'done' }, report, status: 'done', finished_at: new Date().toISOString() }
    await updateRuleImportJob(jobId, done)
    return { ...job, ...done }
}

export async function cancelRuleImport(jobId) {
    const job = await readRuleImportJob(jobId)
    if (job.status !== 'running') return job
    const done = { status: 'cancelled', finished_at: new Date().toISOString() }
    await updateRuleImportJob(jobId, done)
    return { ...job, ...done }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Verificação semanal (cron diário do `/api/health`): se a última verificação tem mais de 7 dias, verifica de novo. Só
 * marca livros novos e erratas (o `?me=1` do admin mostra a contagem); nunca importa sozinho. Nunca derruba o health.
 */
export async function weeklyRuleCheck() {
    try {
        const sources = await listRuleSources()
        const last = Math.max(0, ...sources.map((row) => Date.parse(row.checked_at ?? '') || 0))
        if (Date.now() - last < WEEK_MS) return { checked: false }
        const rows = await checkRuleSources()
        return { checked: true, news: rows.filter((row) => row.state === 'new' || row.state === 'errata').length }
    } catch (error) {
        console.error('[rules] verificação semanal falhou:', error)
        return { checked: false, error: true }
    }
}
