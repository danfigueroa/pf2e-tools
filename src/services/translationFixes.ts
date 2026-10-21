// Correções de tradução feitas pela mesa (api/_lib/fix-store.js): uma camada por
// cima da descrição traduzida, por (tipo, nome). Ela vale venha a descrição de onde
// vier — pacote estático, pacote da ficha publicada, API ou cache —, porque é
// aplicada na LEITURA (`applyFix`, chamado por `services/descriptions.ts`).
//
// A lista inteira é pequena e global: fica no `localStorage` para pintar já
// corrigido, é relida da API uma vez por sessão (e a cada reconexão do canal), e as
// mudanças de outro aparelho chegam pelo canal `fixes` da mesa.

import { useSyncExternalStore } from 'react'
import { stateApi } from './mesa'
import { authHeaderNow, listenMesaChannel } from './supabase'

export type FixKind = 'feat' | 'special' | 'item' | 'spell'

/** Os textos que a mesa pode corrigir — o mesmo `FIELDS` do servidor. */
export const FIX_FIELDS: Record<FixKind, readonly string[]> = {
    feat: ['description', 'prerequisites', 'trigger', 'requirements', 'frequency', 'cost', 'access'],
    special: ['description', 'prerequisites', 'trigger', 'requirements', 'frequency', 'cost', 'access'],
    item: ['description', 'prerequisites', 'trigger', 'requirements', 'frequency', 'cost', 'access'],
    spell: ['description'],
}

export type FixFields = Record<string, string>

export interface TranslationFix {
    kind: FixKind
    name: string
    /** Vazio = voltou à tradução automática. */
    fields: FixFields
    /** Como estava antes da última mudança: é o que o "Desfazer" devolve. */
    previous: FixFields | null
    updatedAt: number
}

const STORAGE_KEY = 'pf2e:fixes:v1'
const KINDS: FixKind[] = ['feat', 'special', 'item', 'spell']

const fixKey = (kind: FixKind, name: string) => `${kind}\n${name}`

function sanitizeFields(kind: FixKind, raw: unknown): FixFields {
    const out: FixFields = {}
    if (!raw || typeof raw !== 'object') return out
    for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
        if (FIX_FIELDS[kind].includes(field) && typeof value === 'string' && value.trim()) out[field] = value
    }
    return out
}

function sanitizeFix(raw: unknown): TranslationFix | null {
    const r = raw as Partial<TranslationFix> | null
    if (!r || !KINDS.includes(r.kind as FixKind) || typeof r.name !== 'string' || typeof r.updatedAt !== 'number') return null
    const kind = r.kind as FixKind
    return {
        kind,
        name: r.name,
        fields: sanitizeFields(kind, r.fields),
        previous: r.previous && typeof r.previous === 'object' ? sanitizeFields(kind, r.previous) : null,
        updatedAt: r.updatedAt,
    }
}

const fixes = new Map<string, TranslationFix>()
let version = 0
const listeners = new Set<() => void>()

function notify() {
    version++
    listeners.forEach((l) => l())
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...fixes.values()]))
    } catch {
        // sem storage: a lista vale nesta sessão
    }
}

/** Guarda a correção se for mais nova que a conhecida. */
function put(fix: TranslationFix): boolean {
    const k = fixKey(fix.kind, fix.name)
    const known = fixes.get(k)
    if (known && known.updatedAt >= fix.updatedAt) return false
    fixes.set(k, fix)
    return true
}

try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown[]
    if (Array.isArray(raw)) for (const item of raw) { const fix = sanitizeFix(item); if (fix) put(fix) }
} catch {
    // lista ausente ou quebrada: a API traz de novo
}

let started = false

async function refresh() {
    try {
        const r = await fetch(stateApi('?fixes=1'))
        if (!r.ok) return
        const body = await r.json() as { fixes?: unknown[]; storeReady?: boolean }
        if (!body.storeReady || !Array.isArray(body.fixes)) return
        let changed = false
        for (const item of body.fixes) { const fix = sanitizeFix(item); if (fix && put(fix)) changed = true }
        if (changed) { persist(); notify() }
    } catch {
        // sem rede: fica a lista guardada
    }
}

/** Lê a lista da API e passa a ouvir o canal. Uma vez por sessão; chamado na primeira leitura. */
function start() {
    if (started) return
    started = true
    void refresh()
    void listenMesaChannel('fixes', {
        fix: (payload) => {
            const fix = sanitizeFix(payload)
            if (fix && put(fix)) { persist(); notify() }
        },
    }, (live) => { if (live) void refresh() })
}

/** Muda a cada correção nova: para quem desenha a descrição repintar. */
export function subscribeFixes(listener: () => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

export function useFixesVersion(): number {
    return useSyncExternalStore(subscribeFixes, () => version)
}

/** A correção vigente (com texto) de uma descrição, ou `null`. */
export function getFix(kind: FixKind, name: string): TranslationFix | null {
    start()
    const fix = fixes.get(fixKey(kind, name))
    return fix && Object.keys(fix.fields).length > 0 ? fix : null
}

/** O texto como a tradução automática o deixou, sem a correção (para o editor). */
export function originalOf<T extends object>(payload: T): T {
    return (originals.get(payload) ?? payload) as T
}

/** Inclui a que voltou à tradução automática — o "Desfazer" dela ainda existe. */
export function getFixRecord(kind: FixKind, name: string): TranslationFix | null {
    start()
    return fixes.get(fixKey(kind, name)) ?? null
}

// A mesma descrição devolve sempre o mesmo objeto corrigido enquanto nem ela nem a
// correção mudam: as linhas da aba de Magias são `memo` e leem do cache no render.
const merged = new WeakMap<object, { at: number; value: object }>()
// O original de cada objeto corrigido: quem guardou o corrigido (o estado do drawer)
// reaplica sobre ele, e a correção desfeita tem de devolver o texto da tradução.
const originals = new WeakMap<object, object>()

/**
 * A descrição com os textos da mesa por cima; sem correção, a original. Aceita um
 * objeto já corrigido (parte do original dele), então reaplicar depois de uma
 * correção nova — ou desfeita — é sempre seguro.
 */
export function applyFix<T extends object>(kind: FixKind, name: string, payload: T): T
export function applyFix<T extends object>(kind: FixKind, name: string, payload: T | null): T | null
export function applyFix<T extends object>(kind: FixKind, name: string, payload: T | null): T | null {
    if (!payload) return payload
    const base = (originals.get(payload) ?? payload) as T
    const fix = getFix(kind, name)
    if (!fix) return base
    const hit = merged.get(base)
    if (hit && hit.at === fix.updatedAt) return hit.value as T
    const value = { ...base, ...fix.fields } as T
    merged.set(base, { at: fix.updatedAt, value })
    originals.set(value, base)
    return value
}

/**
 * Grava a correção (`{}` volta à tradução automática). Devolve a correção como o
 * servidor a gravou, ou `null` se não deu.
 */
export async function saveFix(kind: FixKind, name: string, fields: FixFields): Promise<TranslationFix | null> {
    try {
        const r = await fetch(stateApi(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaderNow() },
            body: JSON.stringify({ action: 'fix-save', kind, name, fields }),
        })
        if (!r.ok) return null
        const body = await r.json() as { fix?: unknown; storeReady?: boolean }
        const fix = sanitizeFix(body.fix)
        if (!fix || !body.storeReady) return null
        if (put(fix)) { persist(); notify() }
        return fix
    } catch {
        return null
    }
}
