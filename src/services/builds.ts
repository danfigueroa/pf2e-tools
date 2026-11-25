// Builds do Criador de Personagem (api/_lib/build-handler.js): o transporte. Ler é de qualquer membro da mesa;
// gravar, do dono do build e do GM. O `state` volta CRU daqui: quem o valida é `sanitizeBuildState`
// (`modules/character-builder/sanitize.ts`), também para o rascunho local.
import { stateApi } from './mesa'
import { authHeaderNow } from './supabase'
import { tr } from '../i18n'
import type { BuildHeader, BuildRecord, BuildState, MesaRules } from '../modules/character-builder/types'

export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string; code?: string; body?: unknown }

async function call<T>(init: { query?: string; body?: unknown }, pick: (body: Record<string, unknown>) => T | undefined): Promise<ApiResult<T>> {
    try {
        const r = await fetch(stateApi(init.query ?? ''), init.body === undefined ? undefined : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify(init.body),
        })
        const body = await r.json().catch(() => ({})) as Record<string, unknown>
        const value = r.ok ? pick(body) : undefined
        if (value === undefined) {
            const error = typeof body.error === 'string' ? body.error : tr('Não foi possível falar com o servidor', 'Could not reach the server')
            return { ok: false, status: r.status, error, code: typeof body.code === 'string' ? body.code : undefined, body }
        }
        return { ok: true, value }
    } catch {
        return { ok: false, status: 0, error: tr('Sem conexão', 'No connection') }
    }
}

const asBuild = (v: unknown) => (v && typeof v === 'object' ? v as BuildRecord : undefined)

export const listBuilds = () => call({ query: '?builds=1' }, (b) => (Array.isArray(b.builds) ? b.builds as BuildHeader[] : undefined))

export const fetchBuild = (id: string) =>
    call({ query: `?build=${encodeURIComponent(id)}` }, (b) => {
        const build = asBuild(b.build)
        return build ? { build, canEdit: b.canEdit === true } : undefined
    })

export const createBuild = (name: string, level = 1) =>
    call({ body: { action: 'build-create', name, state: { name, level } } }, (b) => asBuild(b.build))

/** Grava se o `rev` ainda for o visto. Conflito = `status: 409` com o build atual em `body.build`. */
export const saveBuild = (id: string, rev: number, state: BuildState, className?: string | null) =>
    call({ body: { action: 'build-save', id, rev, state, className: className ?? null } }, (b) => asBuild(b.build) as BuildHeader | undefined)

export const trashBuild = (id: string, deleted: boolean) =>
    call({ body: { action: deleted ? 'build-delete' : 'build-restore', id } }, (b) => asBuild(b.build) as BuildHeader | undefined)

export const fetchMesaRules = () =>
    call({ query: '?mesaRules=1' }, (b) => (b.rules && typeof b.rules === 'object' ? b.rules as MesaRules : undefined))

export const saveMesaRules = (rules: MesaRules) =>
    call({ body: { action: 'mesa-rules-save', rules } }, (b) => (b.rules && typeof b.rules === 'object' ? b.rules as MesaRules : undefined))

/**
 * "Aplicar na mesa": o retrato do Criador vira um rascunho de publicação com o slug do build (o preparo de sempre:
 * descrições pt/en, guia). Devolve o rascunho para `startPreparation`.
 */
export const applyBuild = (id: string, sheet: unknown, names: Record<'spell' | 'feat' | 'special' | 'item', string[]>, version: string, companions: string[]) =>
    call({ body: { action: 'build-apply', id, sheet, names, version, companions } }, (b) => (b.draft && typeof b.draft === 'object' ? b.draft as import('./sheets').SheetDraft : undefined))

export interface BuildVersion { id: number; level: number; rulesVersion: string; publishedAt: number; publishedBy: string | null }

export const fetchBuildVersions = (id: string) =>
    call({ query: `?buildVersions=${encodeURIComponent(id)}` }, (b) => (Array.isArray(b.versions) ? b.versions as BuildVersion[] : undefined))

export const restoreBuildVersion = (id: string, version: number, rev: number) =>
    call({ body: { action: 'build-version-restore', id, version, rev } }, (b) => asBuild(b.build) as BuildHeader | undefined)

/** Cria o build a partir de uma ficha publicada (importação): herda o slug dela. */
export const createBuildFromSheet = (slug: string, state: BuildState, className?: string | null) =>
    call({ body: { action: 'build-create', name: state.name, state, fromSheet: slug, className: className ?? null } }, (b) => asBuild(b.build))
