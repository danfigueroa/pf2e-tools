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
