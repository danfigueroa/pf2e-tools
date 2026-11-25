// Base de regras pela plataforma (api/_lib/rules-handler.js): o transporte. Só quem está em `platform_admins`; o
// servidor confere. A importação anda em passos que o navegador do admin conduz (`runImport`).
import { stateApi } from './mesa'
import { authHeaderNow } from './supabase'
import { tr } from '../i18n'

export type SourceState = 'new' | 'errata' | 'imported' | 'legacy' | 'empty'

export interface RuleSourceRow {
    aon_id: string
    name: string
    product_line: string | null
    release_date: string | null
    errata: string | null
    remaster: boolean
    aon_count: number | null
    our_count: number | null
    status: string
    checked_at: string | null
    imported_at: string | null
    state: SourceState
}

export interface ImportCounts { new: number; changed: number; same: number; removed: number; invalid: number }

export interface ImportJob {
    id: string
    kind: string
    sources: string[]
    status: 'running' | 'done' | 'failed' | 'cancelled'
    counts: Partial<ImportCounts>
    report: {
        sources?: Record<string, Partial<ImportCounts> & { name: string; examples?: string[] }>
        catalog?: { version: string; changedLists: number; copiedLists: number; withoutMechanics: number | null }
    } | null
    phase: 'import' | 'publish' | 'done' | null
    index: number
    startedAt: string
    finishedAt: string | null
}

export interface RulesOverview { sources: RuleSourceRow[]; version: string | null; job: ImportJob | null; jobs: ImportJob[] }

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string; code?: string }

async function call<T>(query: string, body?: unknown): Promise<Result<T>> {
    try {
        const r = await fetch(stateApi(query), body === undefined ? undefined : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify(body),
        })
        const data = await r.json().catch(() => ({})) as Record<string, unknown>
        if (!r.ok) {
            return {
                ok: false, status: r.status,
                error: typeof data.error === 'string' ? data.error : tr('Não foi possível falar com o servidor', 'Could not reach the server'),
                code: typeof data.code === 'string' ? data.code : undefined,
            }
        }
        return { ok: true, value: data as T }
    } catch {
        return { ok: false, status: 0, error: tr('Sem conexão', 'No connection') }
    }
}

export const fetchRulesOverview = () => call<RulesOverview>('?rulesSources=1')
export const checkRuleNews = () => call<{ sources: RuleSourceRow[] }>('', { action: 'rules-check' })
export const startImport = (sources: string[]) => call<{ job: ImportJob }>('', { action: 'rules-import', sources })
export const importStep = (jobId: string) => call<{ job: ImportJob; busy?: boolean }>('', { action: 'rules-import-step', jobId })
export const cancelImport = (jobId: string) => call<{ job: ImportJob }>('', { action: 'rules-import-cancel', jobId })
export const publishCatalog = () => call<{ catalog: NonNullable<NonNullable<ImportJob['report']>['catalog']> }>('', { action: 'rules-publish' })

export interface EntryMechanics {
    entry: { aon_id: string; id: string; category: string; name: string; level: number | null; source_id: string | null }
    mechanics: { origin: string; rules: unknown[]; unsupported: string[]; reviewed: boolean; note: string | null; updated_at: string } | null
}
export const fetchEntryMechanics = (aonId: string) => call<EntryMechanics>(`?rulesEntry=${encodeURIComponent(aonId)}`)
export const saveEntryMechanics = (aonId: string, rules: unknown[], unsupported: string[], note: string) =>
    call<{ ok: true }>('', { action: 'rules-mechanics-save', aonId, rules, unsupported, note })

export interface RuleSearchHit { id: string; name: string; type: string; level: number | null; remaster: boolean }
export async function searchRuleEntries(q: string): Promise<RuleSearchHit[]> {
    try {
        const r = await fetch(`/api/search?rules=search&q=${encodeURIComponent(q)}`)
        if (!r.ok) return []
        return ((await r.json()) as { results?: RuleSearchHit[] }).results ?? []
    } catch {
        return []
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Conduz o job até o fim: um passo atrás do outro. Falha da AON (502) ou da rede espera e tenta de novo (o cursor está
 * salvo no servidor); outra aba no mesmo passo (`busy`) espera. `stop()` interrompe o laço (o job continua salvo).
 */
export function runImport(jobId: string, onJob: (job: ImportJob) => void, onError: (message: string) => void) {
    let stopped = false
    void (async () => {
        let failures = 0
        while (!stopped) {
            const out = await importStep(jobId)
            if (stopped) return
            if (!out.ok) {
                failures += 1
                if (failures > 5 || (out.status !== 502 && out.status !== 0 && out.status < 500)) {
                    onError(out.error)
                    return
                }
                await sleep(5000 * failures)
                continue
            }
            failures = 0
            onJob(out.value.job)
            if (out.value.job.status !== 'running') return
            if (out.value.busy) await sleep(3000)
        }
    })()
    return { stop: () => { stopped = true } }
}
