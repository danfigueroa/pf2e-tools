// Persistência da base de regras (BASE-DE-REGRAS §2). O catálogo é global, como `translations` e `descriptions`: não
// recebe `mesa`. Só o servidor e os scripts com a chave secreta escrevem.
import { supabase } from './supabase.js'

const BATCH = 200
const PAGE = 1000

function db() {
    const client = supabase()
    if (!client) throw new Error('Base de regras: Supabase não configurado')
    return client
}

function check({ error, data, count }) {
    if (error) throw new Error(`Base de regras: ${error.message}`)
    return count ?? data
}

async function upsertInBatches(table, rows, onConflict) {
    for (let i = 0; i < rows.length; i += BATCH) {
        check(await db().from(table).upsert(rows.slice(i, i + BATCH), { onConflict }))
    }
}

async function selectAll(build) {
    const rows = []
    for (let from = 0; ; from += PAGE) {
        const page = check(await build().range(from, from + PAGE - 1))
        rows.push(...page)
        if (page.length < PAGE) return rows
    }
}

/** Metadados dos livros; `status` e as contagens não vão no upsert, para não apagar o estado da importação. */
export function saveRuleSources(rows) {
    return upsertInBatches('rules_sources', rows, 'aon_id')
}

export function listRuleSources() {
    return selectAll(() => db().from('rules_sources').select('*').order('aon_id'))
}

export async function updateRuleSource(aonId, fields) {
    check(await db().from('rules_sources').update(fields).eq('aon_id', aonId))
}

/** `aon_id` → `{ hash, removed }` das entradas já importadas de um livro. */
export async function ruleEntryHashes(sourceId) {
    const rows = await selectAll(() => db().from('rules_entries').select('aon_id, hash, removed_at').eq('source_id', sourceId).order('aon_id'))
    return new Map(rows.map((row) => [row.aon_id, { hash: row.hash, removed: Boolean(row.removed_at) }]))
}

export function saveRuleEntries(rows) {
    const now = new Date().toISOString()
    return upsertInBatches('rules_entries', rows.map((row) => ({ ...row, updated_at: now, removed_at: null })), 'aon_id')
}

/** Sumiu da AON: marca, não apaga (builds podem usar a entrada). */
export async function markRuleEntriesRemoved(aonIds) {
    const now = new Date().toISOString()
    for (let i = 0; i < aonIds.length; i += BATCH) {
        check(await db().from('rules_entries').update({ removed_at: now }).in('aon_id', aonIds.slice(i, i + BATCH)))
    }
}

/** Campos que o casamento com o Foundry usa, sem o markdown (o markdown só da classe, para conferir a progressão). */
export async function ruleEntriesForMatching() {
    const rows = await selectAll(() => db().from('rules_entries')
        .select('aon_id, category, name, level, traits, remaster, legacy_names, replaced_by, class:data->class, item_parent_id:data->item_parent_id, release_date:data->release_date')
        .is('removed_at', null).order('aon_id'))
    const classes = await selectAll(() => db().from('rules_entries').select('aon_id, markdown').eq('category', 'class').is('removed_at', null).order('aon_id'))
    const markdown = new Map(classes.map((row) => [row.aon_id, row.markdown]))
    return rows.map(({ class: owner, item_parent_id, release_date, ...row }) => ({
        ...row,
        data: { class: owner ?? undefined, item_parent_id: item_parent_id ?? undefined, release_date: release_date ?? undefined },
        markdown: markdown.get(row.aon_id),
    }))
}

/** Grava a mecânica do Foundry sem passar por cima da curada à mão (`origin: manual`). */
export async function saveFoundryMechanics(rows) {
    const manual = new Set((await selectAll(() => db().from('rules_mechanics').select('aon_id').eq('origin', 'manual').order('aon_id')))
        .map((row) => row.aon_id))
    const now = new Date().toISOString()
    const kept = rows.filter((row) => !manual.has(row.aon_id)).map((row) => ({ ...row, updated_at: now }))
    await upsertInBatches('rules_mechanics', kept, 'aon_id')
    return { saved: kept.length, skippedManual: rows.length - kept.length }
}

/** Uma importação por vez (índice único parcial em `status = 'running'`). */
export async function startRuleImportJob(kind, sources, startedBy = null) {
    const result = await db().from('rules_import_jobs').insert({ kind, sources, started_by: startedBy }).select('id').single()
    if (result.error?.code === '23505') throw new Error('Base de regras: já há uma importação em andamento')
    return check(result).id
}

export async function readRuleImportJob(id) {
    return check(await db().from('rules_import_jobs').select('*').eq('id', id).single())
}

export async function updateRuleImportJob(id, fields) {
    check(await db().from('rules_import_jobs').update(fields).eq('id', id))
}

/** Versão `AAAA.MM.n`: n conta as versões do mês. */
export async function createRuleCatalogVersion(jobId, summary) {
    const now = new Date()
    const prefix = `${now.getUTCFullYear()}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.`
    const count = check(await db().from('rules_catalog_versions').select('version', { count: 'exact', head: true }).like('version', `${prefix}%`))
    const version = `${prefix}${count + 1}`
    check(await db().from('rules_catalog_versions').insert({ version, job_id: jobId, summary }))
    return version
}
