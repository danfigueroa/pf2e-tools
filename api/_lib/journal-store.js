// Diário de Campanha: as sessões e o catálogo da campanha (NPCs, locais, itens,
// facções, ganchos) que o GM prepara, e o que ele mostrou à mesa.
//
// No Postgres (migration `diario_de_campanha`):
//   journal_docs     um documento por linha, o `data` inteiro, como o encontro
//                    da Iniciativa. Cada escrita é transmitida (só o aviso, sem
//                    título) no canal `mesa:<mesa>:journal`.
//   journal_reveals  o trecho ou a imagem que o GM mostrou: é o que o cartão
//                    dos jogadores lê (o `shares` leva só a referência).
//
// A escrita é CONDICIONAL: o cliente manda o `updatedAt` que viu (`base`) e a
// linha só muda se ainda for aquela — o GM com o computador e o tablet abertos
// não apaga, sem saber, o que escreveu no outro aparelho.
//
// Quem valida o CONTEÚDO é o cliente, ao ler (`sanitize.ts` do módulo); aqui só
// a forma e o tamanho. Sem banco, cai num Map de processo por mesa.

import { supabase } from './supabase.js'

export const MAX_DOC_BYTES = 256 * 1024
export const MAX_REVEAL_BYTES = 16 * 1024
export const DOC_KINDS = ['session', 'npc', 'location', 'item', 'faction', 'other', 'thread']
export const ID_RE = /^[a-z0-9-]{1,64}$/

const validTitle = (v, max) =>
    typeof v === 'string' && v.length <= max && !!v.trim() && ![...v].some((c) => c.charCodeAt(0) < 32)

/** Um documento reconhecível e dentro do teto, ou `null`. */
export function cleanDoc(doc) {
    if (!doc || typeof doc !== 'object') return null
    if (typeof doc.id !== 'string' || !ID_RE.test(doc.id)) return null
    if (!DOC_KINDS.includes(doc.kind)) return null
    if (!validTitle(doc.title, 200)) return null
    if (!doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) return null
    if (JSON.stringify(doc.data).length > MAX_DOC_BYTES) return null
    const sort = Number.isInteger(doc.sort) && Math.abs(doc.sort) <= 1e6 ? doc.sort : 0
    return { id: doc.id, kind: doc.kind, title: doc.title.trim(), sort, data: doc.data }
}

/** O que o GM mostra: título, e texto e/ou imagem. `image` já conferida por quem chama. */
export function cleanReveal(r) {
    if (!r || typeof r !== 'object') return null
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return null
    if (!validTitle(r.title, 120)) return null
    const markdown = typeof r.markdown === 'string' ? r.markdown : ''
    if (new TextEncoder().encode(markdown).length > MAX_REVEAL_BYTES) return null
    const image = typeof r.image === 'string' && r.image.length <= 500 ? r.image : null
    if (!markdown.trim() && !image) return null
    const source = typeof r.source === 'string' && ID_RE.test(r.source) ? r.source : null
    return { id: r.id, title: r.title.trim(), markdown, image, source }
}

const memoryDocs = new Map()
const memoryReveals = new Map()
const mem = (map, mesa) => {
    if (!map.has(mesa)) map.set(mesa, new Map())
    return map.get(mesa)
}

const summaryOf = (doc) => ({
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    sort: doc.sort,
    updatedAt: doc.updatedAt,
    image: typeof doc.data?.image === 'string' ? doc.data.image : null,
    status: typeof doc.data?.status === 'string' ? doc.data.status : null,
})

const dbStore = (db) => {
    const check = ({ data, error }) => {
        if (error) throw error
        return data
    }
    return {
        list: async (mesa) => {
            const rows = check(await db.from('journal_docs')
                .select('id, kind, title, sort, updated_at, image:data->>image, status:data->>status')
                .eq('mesa', mesa))
            return rows.map((r) => ({
                id: r.id, kind: r.kind, title: r.title, sort: r.sort,
                updatedAt: Number(r.updated_at), image: r.image ?? null, status: r.status ?? null,
            }))
        },
        read: async (mesa, id) => {
            const r = check(await db.from('journal_docs').select('id, kind, title, sort, data, updated_at')
                .eq('mesa', mesa).eq('id', id).maybeSingle())
            return r ? { id: r.id, kind: r.kind, title: r.title, sort: r.sort, data: r.data, updatedAt: Number(r.updated_at) } : null
        },
        insert: async (mesa, doc, updatedAt, by) => {
            const { error } = await db.from('journal_docs')
                .insert({ mesa, ...doc, updated_at: updatedAt, updated_by: by })
            if (error?.code === '23505') return false
            if (error) throw error
            return true
        },
        update: async (mesa, doc, base, updatedAt, by) => {
            const rows = check(await db.from('journal_docs')
                .update({ kind: doc.kind, title: doc.title, sort: doc.sort, data: doc.data, updated_at: updatedAt, updated_by: by })
                .eq('mesa', mesa).eq('id', doc.id).eq('updated_at', base)
                .select('id'))
            return rows.length > 0
        },
        remove: async (mesa, id) => {
            check(await db.from('journal_docs').delete().eq('mesa', mesa).eq('id', id))
        },
        addReveal: async (mesa, reveal, by) => {
            const { error } = await db.from('journal_reveals').insert({ mesa, ...reveal, by })
            // Reenvio do mesmo pedido: já está lá.
            if (error && error.code !== '23505') throw error
        },
        readReveal: async (mesa, id) => {
            const r = check(await db.from('journal_reveals').select('id, at, title, markdown, image')
                .eq('mesa', mesa).eq('id', id).maybeSingle())
            return r ? { id: r.id, at: Date.parse(r.at), title: r.title, markdown: r.markdown, image: r.image } : null
        },
    }
}

const memoryStore = {
    list: async (mesa) => [...mem(memoryDocs, mesa).values()].map(summaryOf),
    read: async (mesa, id) => mem(memoryDocs, mesa).get(id) ?? null,
    insert: async (mesa, doc, updatedAt) => {
        const docs = mem(memoryDocs, mesa)
        if (docs.has(doc.id)) return false
        docs.set(doc.id, { ...doc, updatedAt })
        return true
    },
    update: async (mesa, doc, base, updatedAt) => {
        const docs = mem(memoryDocs, mesa)
        if (docs.get(doc.id)?.updatedAt !== base) return false
        docs.set(doc.id, { ...doc, updatedAt })
        return true
    },
    remove: async (mesa, id) => { mem(memoryDocs, mesa).delete(id) },
    addReveal: async (mesa, reveal) => { mem(memoryReveals, mesa).set(reveal.id, { ...reveal, at: Date.now() }) },
    readReveal: async (mesa, id) => {
        const r = mem(memoryReveals, mesa).get(id)
        return r ? { id: r.id, at: r.at, title: r.title, markdown: r.markdown, image: r.image } : null
    },
}

const store = () => {
    const db = supabase()
    return db ? dbStore(db) : memoryStore
}

/** O resumo de todos os documentos da mesa (sem o `data`): a lista do diário. */
export const listDocs = (mesa) => store().list(mesa)

/** `{ id, kind, title, sort, data, updatedAt }`, ou `null`. */
export const readDoc = (mesa, id) => store().read(mesa, id)

/**
 * Grava o documento se ele ainda for o que o cliente viu (`base`; `null` =
 * documento novo). `{ updatedAt }` gravou; `{ conflict: true }` alguém mudou antes.
 */
export async function writeDoc(mesa, doc, base, by = null) {
    const db = store()
    const updatedAt = Date.now()
    const done = base === null
        ? await db.insert(mesa, doc, updatedAt, by)
        : await db.update(mesa, doc, base, updatedAt, by)
    return done ? { updatedAt } : { conflict: true }
}

export const deleteDoc = (mesa, id) => store().remove(mesa, id)

export const addReveal = (mesa, reveal, by = null) => store().addReveal(mesa, reveal, by)

/** `{ id, at, title, markdown, image }`, ou `null`. */
export const readReveal = (mesa, id) => store().readReveal(mesa, id)
