// Anotações do personagem: o background e as notas de cada ficha, um documento
// por (mesa, slug) na tabela `character_notes` (migration
// `anotacoes_do_personagem`). Cada escrita é transmitida (só o aviso, sem o
// texto) no canal `mesa:<mesa>:notes`.
//
// A escrita é CONDICIONAL, como a do diário: o cliente manda o `updatedAt` que
// viu (`base`) e a linha só muda se ainda for aquela — o jogador com o celular e
// o computador abertos não apaga, sem saber, o que escreveu no outro.
//
// Sem banco, cai num Map de processo por mesa.

import { supabase } from './supabase.js'

export const MAX_NOTES_BYTES = 128 * 1024
export const MAX_TEXT = 20000
export const MAX_NOTES = 200
export const NOTE_TAGS = ['npc', 'item', 'local', 'evento', 'outro']
const ID_RE = /^[a-z0-9-]{1,64}$/

const text = (v, max) => (typeof v === 'string' && v.length <= max ? v : null)
const time = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

/** O documento reconhecível e dentro dos tetos, ou `null`. */
export function cleanNotes(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const background = text(data.background ?? '', MAX_TEXT)
    if (background === null) return null
    if (!Array.isArray(data.notes) || data.notes.length > MAX_NOTES) return null
    const seen = new Set()
    const notes = []
    for (const n of data.notes) {
        if (!n || typeof n !== 'object') return null
        if (typeof n.id !== 'string' || !ID_RE.test(n.id) || seen.has(n.id)) return null
        seen.add(n.id)
        const title = text(n.title ?? '', 200)
        const body = text(n.body ?? '', MAX_TEXT)
        if (title === null || body === null) return null
        notes.push({
            id: n.id,
            title,
            tag: NOTE_TAGS.includes(n.tag) ? n.tag : 'outro',
            body,
            createdAt: time(n.createdAt),
            updatedAt: time(n.updatedAt),
            ...(n.pinned === true ? { pinned: true } : {}),
        })
    }
    const clean = { background, notes }
    if (JSON.stringify(clean).length > MAX_NOTES_BYTES) return null
    return clean
}

const memory = new Map()
const mem = (mesa) => {
    if (!memory.has(mesa)) memory.set(mesa, new Map())
    return memory.get(mesa)
}

const dbStore = (db) => {
    const check = ({ data, error }) => {
        if (error) throw error
        return data
    }
    return {
        read: async (mesa, slug) => {
            const r = check(await db.from('character_notes').select('data, updated_at')
                .eq('mesa', mesa).eq('slug', slug).maybeSingle())
            return r ? { data: r.data, updatedAt: Number(r.updated_at) } : null
        },
        insert: async (mesa, slug, data, updatedAt, by) => {
            const { error } = await db.from('character_notes')
                .insert({ mesa, slug, data, updated_at: updatedAt, updated_by: by })
            if (error?.code === '23505') return false
            if (error) throw error
            return true
        },
        update: async (mesa, slug, data, base, updatedAt, by) => {
            const rows = check(await db.from('character_notes')
                .update({ data, updated_at: updatedAt, updated_by: by })
                .eq('mesa', mesa).eq('slug', slug).eq('updated_at', base)
                .select('slug'))
            return rows.length > 0
        },
    }
}

const memoryStore = {
    read: async (mesa, slug) => mem(mesa).get(slug) ?? null,
    insert: async (mesa, slug, data, updatedAt) => {
        const docs = mem(mesa)
        if (docs.has(slug)) return false
        docs.set(slug, { data, updatedAt })
        return true
    },
    update: async (mesa, slug, data, base, updatedAt) => {
        const docs = mem(mesa)
        if (docs.get(slug)?.updatedAt !== base) return false
        docs.set(slug, { data, updatedAt })
        return true
    },
}

const store = () => {
    const db = supabase()
    return db ? dbStore(db) : memoryStore
}

/** `{ data, updatedAt }`, ou `null` quando o personagem ainda não tem anotações. */
export const readNotes = (mesa, slug) => store().read(mesa, slug)

/**
 * Grava se o documento ainda for o que o cliente viu (`base`; `null` = primeiro
 * salvamento). `{ updatedAt }` gravou; `{ conflict: true }` alguém mudou antes.
 */
export async function writeNotes(mesa, slug, data, base, by = null) {
    const db = store()
    const updatedAt = Date.now()
    const done = base === null
        ? await db.insert(mesa, slug, data, updatedAt, by)
        : await db.update(mesa, slug, data, base, updatedAt, by)
    return done ? { updatedAt } : { conflict: true }
}
