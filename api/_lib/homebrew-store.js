// Conteúdo caseiro da mesa (Criador, 9.1): o GM cria talentos, itens, runas, backgrounds, heranças e magias, que entram
// no catálogo do Criador com o selo "Da mesa". Tabela `mesa_homebrew`; sem Supabase, memória (dev local).
//
// O `entry` é um RuleEntry do catálogo (a mesma forma que o motor lê), com id `mesa:<uuid>` — não `custom:`, que é o
// item caseiro de texto livre do inventário (F8.12). Só o que o motor usa passa no sanitizador; efeito que muda número e
// o motor não calcula vai em `unsupported` (vira aviso, nunca número).

import { supabase } from './supabase.js'

export const HOMEBREW_KINDS = ['feat', 'item', 'background', 'heritage', 'spell', 'rune']
export const MAX_HOMEBREW = 300
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const RARITIES = ['common', 'uncommon', 'rare', 'unique']
const ACTIONS = ['1', '2', '3', 'reaction', 'free']
const TRADITIONS = ['arcane', 'divine', 'occult', 'primal']
/** O `type` do RuleEntry por tipo de conteúdo (o que os seletores filtram). */
const ENTRY_TYPE = { feat: 'feat', item: 'equipment', rune: 'equipment', background: 'background', heritage: 'heritage', spell: 'spell' }

const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '')
const int = (v, min, max, fallback) => {
    const n = Math.round(Number(v))
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}
const strings = (v, maxItems, maxLen) => (Array.isArray(v) ? [...new Set(v.map((x) => text(x, maxLen)).filter(Boolean))].slice(0, maxItems) : [])

/**
 * O RuleEntry que o cliente mandou, só com o que vale para o `kind`. `null` = sem nome ou tipo desconhecido.
 * O id vem do servidor (`id` da linha), nunca do cliente.
 */
export function sanitizeHomebrewEntry(kind, input, id) {
    if (!HOMEBREW_KINDS.includes(kind) || !input || typeof input !== 'object') return null
    const name = text(input.name, 80)
    if (!name) return null
    const entry = {
        id: `mesa:${id}`,
        name,
        type: ENTRY_TYPE[kind],
        level: int(input.level, 0, 25, kind === 'feat' || kind === 'spell' ? 1 : 0),
        rarity: RARITIES.includes(input.rarity) ? input.rarity : 'common',
        traits: strings(input.traits, 12, 30),
        source: { id: 'mesa' },
        aon: { id: '' },
        remaster: true,
        homebrew: kind,
    }
    const summary = text(input.summary, 4000)
    if (summary) entry.summary = summary
    const unsupported = strings(input.unsupported, 4, 200)
    if (unsupported.length) entry.unsupported = unsupported
    if (kind === 'feat') {
        if (ACTIONS.includes(input.actions)) entry.actions = input.actions
        const pre = text(input.prerequisites?.text, 300)
        if (pre) entry.prerequisites = { text: pre }
    }
    if (kind === 'background') {
        const boosts = strings(input.background?.boosts, 2, 4).filter((a) => ATTRS.includes(a))
        entry.background = {
            boosts: [...boosts, 'free'],
            skills: strings(input.background?.skills, 2, 40),
            feats: strings(input.background?.feats, 1, 80),
        }
    }
    if (kind === 'heritage') {
        const ancestry = text(input.heritage?.ancestry, 60)
        entry.heritage = ancestry ? { ancestry } : {}
    }
    if (kind === 'spell') {
        const cantrip = input.spell?.cantrip === true
        entry.spell = {
            rank: cantrip ? 1 : int(input.spell?.rank ?? input.level, 1, 10, 1),
            traditions: strings(input.spell?.traditions, 4, 10).filter((t) => TRADITIONS.includes(t)),
            ...(cantrip ? { cantrip: true } : {}),
            ...(input.spell?.focus === true ? { focus: true } : {}),
        }
        entry.level = entry.spell.rank
    }
    if (kind === 'item' || kind === 'rune') {
        const gp = Number(input.item?.price?.gp)
        const bulk = input.item?.bulk === 'L' ? 'L' : Number(input.item?.bulk)
        entry.item = {
            category: kind === 'rune' ? 'rune' : text(input.item?.category, 30) || 'gear',
            ...(Number.isFinite(gp) && gp >= 0 ? { price: { gp: Math.min(1e7, Math.round(gp * 100) / 100) } } : {}),
            ...(bulk === 'L' || (Number.isFinite(bulk) && bulk >= 0) ? { bulk: bulk === 'L' ? 'L' : Math.min(100, bulk) } : {}),
            ...(text(input.item?.usage, 80) ? { usage: text(input.item?.usage, 80) } : {}),
        }
    }
    return entry
}

// ── Persistência ─────────────────────────────────────────────────────────────

const memory = new Map()
const mem = (mesa) => {
    if (!memory.has(mesa)) memory.set(mesa, new Map())
    return memory.get(mesa)
}

const row = (r) => ({ id: r.id, kind: r.kind, entry: r.entry, updatedAt: Date.parse(r.updated_at) || 0, updatedBy: r.updated_by ?? null })

/** Todo o conteúdo caseiro da mesa. */
export async function listHomebrew(mesa) {
    const db = supabase()
    if (!db) return [...mem(mesa).values()].map(row)
    const { data, error } = await db.from('mesa_homebrew').select('id, kind, entry, updated_at, updated_by').eq('mesa', mesa).order('updated_at', { ascending: false }).limit(MAX_HOMEBREW)
    if (error) throw new Error(error.message)
    return (data ?? []).map(row)
}

/** Cria (`id` ausente) ou troca uma entrada. `null` = a entrada não é desta mesa (ou não existe). */
export async function saveHomebrew(mesa, { id, kind, entry: input }, by) {
    const db = supabase()
    const rowId = id ?? crypto.randomUUID()
    if (id !== undefined && !UUID_RE.test(String(id))) return null
    const entry = sanitizeHomebrewEntry(kind, input, rowId)
    if (!entry) return { invalid: true }
    const now = new Date().toISOString()
    if (!db) {
        const prev = mem(mesa).get(rowId)
        if (id && !prev) return null
        const r = { id: rowId, kind, entry, updated_at: now, updated_by: by, created_by: prev?.created_by ?? by }
        mem(mesa).set(rowId, r)
        return row(r)
    }
    if (id) {
        const { data, error } = await db.from('mesa_homebrew').update({ kind, entry, updated_at: now, updated_by: by })
            .eq('mesa', mesa).eq('id', rowId).select('id, kind, entry, updated_at, updated_by').maybeSingle()
        if (error) throw new Error(error.message)
        return data ? row(data) : null
    }
    const { count } = await db.from('mesa_homebrew').select('id', { count: 'exact', head: true }).eq('mesa', mesa)
    if ((count ?? 0) >= MAX_HOMEBREW) return { full: true }
    const { data, error } = await db.from('mesa_homebrew').insert({ id: rowId, mesa, kind, entry, created_by: by, updated_by: by })
        .select('id, kind, entry, updated_at, updated_by').single()
    if (error) throw new Error(error.message)
    return row(data)
}

/** Apaga de vez (o build que usava fica com a escolha órfã, que o motor avisa). */
export async function deleteHomebrew(mesa, id) {
    if (!UUID_RE.test(String(id))) return false
    const db = supabase()
    if (!db) return mem(mesa).delete(id)
    const { data, error } = await db.from('mesa_homebrew').delete().eq('mesa', mesa).eq('id', id).select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
}
