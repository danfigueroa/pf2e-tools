// Wiki da Mesa: as páginas, o histórico e a busca (migration `wiki_da_mesa`).
//
//   wiki_pages      uma página por linha: o Markdown completo (`body`, com os trechos `:::mestre`) e o
//                   mesmo texto sem eles (`body_public`), os links citados (já dobrados), autoria e a
//                   versão (`updated_at`, a base da escrita condicional).
//   wiki_revisions  o histórico, até 50 versões por página (aparadas no `wiki_save`).
//
// Quem decide o que cada um vê e pode fazer é o handler (`wiki-handler.js`); aqui só se lê e grava. Sem
// banco, cai num Map de processo por mesa, como os outros stores.

import { supabase } from './supabase.js'
import { fold } from './wiki-secrets.js'

export const PAGE_KINDS = ['npc', 'location', 'item', 'creature', 'faction', 'deity', 'event', 'lore', 'other']
export const PAGE_ID_RE = /^w-[a-z0-9]{6,32}$/
export const MAX_BODY_BYTES = 128 * 1024
export const MAX_REVISIONS = 50
/** Salvamentos seguidos da mesma pessoa dentro disto viram uma versão só. */
export const REVISION_WINDOW_MS = 10 * 60 * 1000

const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9]{0,30}$/
const MAX_FIELDS = 30
const bytes = (s) => new TextEncoder().encode(s).length

const oneLine = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max) : '')

const list = (v, maxItems, maxLen) => {
    if (!Array.isArray(v)) return []
    const out = []
    const seen = new Set()
    for (const x of v) {
        const s = oneLine(x, maxLen)
        if (!s || seen.has(s.toLowerCase())) continue
        seen.add(s.toLowerCase())
        out.push(s)
        if (out.length >= maxItems) break
    }
    return out
}

/** A criatura da AON ligada a uma página de criatura: só o que a ficha mostra e o que acha a criatura de novo. */
function cleanAon(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    const name = oneLine(v.name, 120)
    if (!name) return null
    const level = Number.isInteger(v.level) && v.level >= -1 && v.level <= 30 ? v.level : null
    const url = typeof v.url === 'string' && /^https:\/\/2e\.aonprd\.com\/[\w./?=&%-]{1,280}$/.test(v.url) ? v.url : null
    return { name, level, url, traits: list(v.traits, 16, 40) }
}

/** A infobox: texto curto por campo (aceita `[[ ]]`); `aon` é a criatura ligada. */
export function cleanFields(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out = {}
    let n = 0
    for (const [key, value] of Object.entries(v)) {
        if (n >= MAX_FIELDS || !FIELD_KEY_RE.test(key)) continue
        if (key === 'aon') {
            const aon = cleanAon(value)
            if (aon) { out.aon = aon; n++ }
            continue
        }
        const s = oneLine(value, 300)
        if (s) { out[key] = s; n++ }
    }
    return out
}

/** A página como o cliente manda (sem autoria nem visibilidade), ou `null`. `image` é conferida por quem chama. */
export function cleanPage(raw) {
    if (!raw || typeof raw !== 'object') return null
    if (typeof raw.id !== 'string' || !PAGE_ID_RE.test(raw.id)) return null
    if (!PAGE_KINDS.includes(raw.kind)) return null
    const title = oneLine(raw.title, 120)
    if (!title) return null
    const body = typeof raw.body === 'string' ? raw.body.replace(/\r\n?/g, '\n') : ''
    if (bytes(body) > MAX_BODY_BYTES) return null
    const parent = typeof raw.parent === 'string' && PAGE_ID_RE.test(raw.parent) && raw.parent !== raw.id ? raw.parent : null
    return {
        id: raw.id,
        kind: raw.kind,
        title,
        aliases: list(raw.aliases, 10, 120).filter((a) => fold(a) !== fold(title)),
        tags: list(raw.tags, 12, 30),
        summary: oneLine(raw.summary, 300),
        image: typeof raw.image === 'string' && raw.image.length <= 500 ? raw.image : null,
        parent,
        fields: cleanFields(raw.fields),
        body,
    }
}

/** Os textos da infobox, para os links dela contarem nos backlinks. */
export const fieldTexts = (fields) => Object.entries(fields ?? {}).filter(([k, v]) => k !== 'aon' && typeof v === 'string').map(([, v]) => v)

const fromRow = (r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    aliases: r.aliases ?? [],
    tags: r.tags ?? [],
    summary: r.summary ?? '',
    image: r.image ?? null,
    parent: r.parent ?? null,
    fields: r.fields ?? {},
    body: r.body ?? '',
    bodyPublic: r.body_public ?? '',
    linksAll: r.links_all ?? [],
    linksPublic: r.links_public ?? [],
    visibility: r.visibility,
    locked: !!r.locked,
    rev: r.rev,
    createdBy: r.created_by ?? null,
    createdAt: Number(r.created_at),
    updatedBy: r.updated_by ?? null,
    updatedAt: Number(r.updated_at),
    deletedAt: r.deleted_at === null || r.deleted_at === undefined ? null : Number(r.deleted_at),
})

const SUMMARY_COLS = 'id, kind, title, aliases, tags, summary, image, parent, visibility, locked, rev, created_by, created_at, updated_by, updated_at, deleted_at'

/** O resumo da lista: tudo menos o texto e os links. */
export const summaryOf = (p) => ({
    id: p.id, kind: p.kind, title: p.title, aliases: p.aliases, tags: p.tags, summary: p.summary, image: p.image,
    parent: p.parent, visibility: p.visibility, locked: p.locked, rev: p.rev,
    createdBy: p.createdBy, createdAt: p.createdAt, updatedBy: p.updatedBy, updatedAt: p.updatedAt, deletedAt: p.deletedAt,
})

const metaOf = (p) => ({
    kind: p.kind, title: p.title, aliases: p.aliases, tags: p.tags, summary: p.summary, image: p.image,
    parent: p.parent, fields: p.fields,
})

// ── Banco ────────────────────────────────────────────────────────────────────

const dbStore = (db) => {
    const check = ({ data, error }) => {
        if (error) throw error
        return data
    }
    return {
        list: async (mesa, { gm, trash }) => {
            let q = db.from('wiki_pages').select(SUMMARY_COLS).eq('mesa', mesa)
            q = trash ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null)
            if (!gm) q = q.eq('visibility', 'public')
            return check(await q).map((r) => summaryOf(fromRow(r)))
        },
        read: async (mesa, id) => {
            const r = check(await db.from('wiki_pages').select('*').eq('mesa', mesa).eq('id', id).maybeSingle())
            return r ? fromRow(r) : null
        },
        save: async (mesa, page, base, by, now, window) => check(await db.rpc('wiki_save', {
            p_mesa: mesa,
            p_page: page,
            p_base: base,
            p_by: by,
            p_now: now,
            p_coalesce_ms: window,
        })),
        setFlags: async (mesa, id, flags) => {
            const patch = {}
            if (flags.visibility) patch.visibility = flags.visibility
            if (typeof flags.locked === 'boolean') patch.locked = flags.locked
            check(await db.from('wiki_pages').update(patch).eq('mesa', mesa).eq('id', id))
        },
        setDeleted: async (mesa, id, at) => {
            check(await db.from('wiki_pages').update({ deleted_at: at }).eq('mesa', mesa).eq('id', id))
        },
        purge: async (mesa, id) => {
            check(await db.from('wiki_pages').delete().eq('mesa', mesa).eq('id', id))
        },
        history: async (mesa, id) => check(await db.from('wiki_revisions')
            .select('rev, edited_by, edited_at, title:meta->>title')
            .eq('mesa', mesa).eq('page', id).order('rev', { ascending: false }))
            .map((r) => ({ rev: r.rev, by: r.edited_by ?? null, at: Number(r.edited_at), title: r.title ?? '' })),
        revision: async (mesa, id, rev) => {
            const r = check(await db.from('wiki_revisions').select('rev, meta, body, body_public, edited_by, edited_at')
                .eq('mesa', mesa).eq('page', id).eq('rev', rev).maybeSingle())
            return r ? { rev: r.rev, meta: r.meta ?? {}, body: r.body, bodyPublic: r.body_public, by: r.edited_by ?? null, at: Number(r.edited_at) } : null
        },
        backlinks: async (mesa, names, { gm, except }) => {
            if (!names.length) return []
            let q = db.from('wiki_pages').select('id, kind, title').eq('mesa', mesa).is('deleted_at', null)
                .overlaps(gm ? 'links_all' : 'links_public', names).neq('id', except)
            if (!gm) q = q.eq('visibility', 'public')
            return check(await q.order('title').limit(200))
        },
        recent: async (mesa, limit) => check(await db.from('wiki_revisions')
            .select('page, rev, edited_by, edited_at, title:meta->>title')
            .eq('mesa', mesa).order('edited_at', { ascending: false }).limit(limit))
            .map((r) => ({ page: r.page, rev: r.rev, by: r.edited_by ?? null, at: Number(r.edited_at), title: r.title ?? '' })),
        search: async (mesa, q, gm) => check(await db.rpc('wiki_search', { p_mesa: mesa, p_q: q, p_gm: gm })) ?? [],
        names: async (mesa, ids) => (ids.length ? check(await db.rpc('member_names', { p_mesa: mesa, p_ids: ids })) ?? {} : {}),
    }
}

// ── Memória (sem banco) ──────────────────────────────────────────────────────

const memPages = new Map()
const memRevs = new Map()
const bucket = (map, mesa) => {
    if (!map.has(mesa)) map.set(mesa, new Map())
    return map.get(mesa)
}

const memoryStore = {
    list: async (mesa, { gm, trash }) => [...bucket(memPages, mesa).values()]
        .filter((p) => (trash ? p.deletedAt !== null : p.deletedAt === null) && (gm || p.visibility === 'public'))
        .map(summaryOf),
    read: async (mesa, id) => bucket(memPages, mesa).get(id) ?? null,
    save: async (mesa, page, base, by, now, window) => {
        const pages = bucket(memPages, mesa)
        const revs = bucket(memRevs, mesa)
        const row = {
            id: page.id, kind: page.kind, title: page.title, aliases: page.aliases, tags: page.tags, summary: page.summary,
            image: page.image, parent: page.parent, fields: page.fields, body: page.body, bodyPublic: page.body_public,
            linksAll: page.links_all, linksPublic: page.links_public,
        }
        if (base === null) {
            if (pages.has(page.id)) return { conflict: true }
            pages.set(page.id, {
                ...row, visibility: page.visibility ?? 'public', locked: false, rev: 1,
                createdBy: by, createdAt: now, updatedBy: by, updatedAt: now, deletedAt: null,
            })
            revs.set(page.id, [{ rev: 1, meta: metaOf(row), body: row.body, bodyPublic: row.bodyPublic, by, at: now }])
            return { updatedAt: now, rev: 1 }
        }
        const cur = pages.get(page.id)
        if (!cur || cur.deletedAt !== null || cur.updatedAt !== base) return { conflict: true }
        const history = revs.get(page.id) ?? []
        const last = history[history.length - 1]
        let rev
        if (last && last.rev === cur.rev && by && last.by === by && now - last.at < window) {
            rev = cur.rev
            Object.assign(last, { meta: metaOf(row), body: row.body, bodyPublic: row.bodyPublic, at: now })
        } else {
            rev = cur.rev + 1
            history.push({ rev, meta: metaOf(row), body: row.body, bodyPublic: row.bodyPublic, by, at: now })
            while (history.length && history[0].rev <= rev - MAX_REVISIONS) history.shift()
            revs.set(page.id, history)
        }
        pages.set(page.id, { ...cur, ...row, rev, updatedBy: by, updatedAt: now })
        return { updatedAt: now, rev }
    },
    setFlags: async (mesa, id, flags) => {
        const p = bucket(memPages, mesa).get(id)
        if (!p) return
        if (flags.visibility) p.visibility = flags.visibility
        if (typeof flags.locked === 'boolean') p.locked = flags.locked
    },
    setDeleted: async (mesa, id, at) => {
        const p = bucket(memPages, mesa).get(id)
        if (p) p.deletedAt = at
    },
    purge: async (mesa, id) => { bucket(memPages, mesa).delete(id); bucket(memRevs, mesa).delete(id) },
    history: async (mesa, id) => [...(bucket(memRevs, mesa).get(id) ?? [])].reverse()
        .map((r) => ({ rev: r.rev, by: r.by, at: r.at, title: r.meta.title })),
    revision: async (mesa, id, rev) => (bucket(memRevs, mesa).get(id) ?? []).find((r) => r.rev === rev) ?? null,
    backlinks: async (mesa, names, { gm, except }) => [...bucket(memPages, mesa).values()]
        .filter((p) => p.id !== except && p.deletedAt === null && (gm || p.visibility === 'public')
            && (gm ? p.linksAll : p.linksPublic).some((n) => names.includes(n)))
        .map((p) => ({ id: p.id, kind: p.kind, title: p.title }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    recent: async (mesa, limit) => [...bucket(memRevs, mesa).entries()]
        .flatMap(([page, history]) => history.map((r) => ({ page, rev: r.rev, by: r.by, at: r.at, title: r.meta.title })))
        .sort((a, b) => b.at - a.at).slice(0, limit),
    search: async (mesa, q, gm) => {
        const needle = fold(q)
        if (!needle) return []
        return [...bucket(memPages, mesa).values()]
            .filter((p) => p.deletedAt === null && (gm || p.visibility === 'public'))
            .map((p) => {
                const src = gm ? p.body : p.bodyPublic
                const pos = fold(src).indexOf(needle)
                const meta = fold([...p.aliases, ...p.tags, p.summary].join(' ')).includes(needle)
                const hit = fold(p.title).includes(needle) || meta || pos >= 0
                return hit ? { id: p.id, title: p.title, kind: p.kind, snippet: pos >= 0 ? src.slice(Math.max(0, pos - 60), pos + 120) : p.summary } : null
            })
            .filter(Boolean)
            .slice(0, 40)
    },
    names: async () => ({}),
}

const store = () => {
    const db = supabase()
    return db ? dbStore(db) : memoryStore
}

/** O resumo das páginas (sem o texto). `gm` inclui as só do GM; `trash`, a lixeira. */
export const listPages = (mesa, { gm = false, trash = false } = {}) => store().list(mesa, { gm, trash })

/** A página inteira (os dois textos, os links, autoria), ou `null`. */
export const readPage = (mesa, id) => store().read(mesa, id)

/**
 * Grava a página se ela ainda for a que o cliente viu (`base`; `null` = nova). `page` já vem com o
 * `body` resolvido (segredos), `body_public`, `links_all`/`links_public` e, se nova, a `visibility`.
 * `{ updatedAt, rev }` gravou; `{ conflict: true }` alguém mudou antes.
 */
export async function savePage(mesa, page, base, by = null, { coalesce = true } = {}) {
    const out = await store().save(mesa, page, base, by, Date.now(), coalesce ? REVISION_WINDOW_MS : 0)
    return out?.conflict ? { conflict: true } : { updatedAt: Number(out.updatedAt), rev: Number(out.rev) }
}

export const setPageFlags = (mesa, id, flags) => store().setFlags(mesa, id, flags)
export const trashPage = (mesa, id) => store().setDeleted(mesa, id, Date.now())
export const untrashPage = (mesa, id) => store().setDeleted(mesa, id, null)
export const purgePage = (mesa, id) => store().purge(mesa, id)

/** As versões de uma página, da mais nova para a mais velha: `{ rev, by, at, title }`. */
export const pageHistory = (mesa, id) => store().history(mesa, id)

/** Uma versão inteira: `{ rev, meta, body, bodyPublic, by, at }`, ou `null`. */
export const pageRevision = (mesa, id, rev) => store().revision(mesa, id, rev)

/** As páginas que citam algum destes nomes (dobrados). */
export const pageBacklinks = (mesa, names, opts) => store().backlinks(mesa, names, opts)

/** As últimas versões gravadas na mesa, de todas as páginas: `{ page, rev, by, at, title }`. */
export const recentChanges = (mesa, limit = 60) => store().recent(mesa, limit)

/** Busca por título, apelido, etiqueta, resumo e texto: `{ id, title, kind, snippet }`. */
export const searchPages = (mesa, q, gm) => store().search(mesa, q, gm)

const NAMES_TTL_MS = 60_000
const nameCache = new Map() // `${mesa}:${uuid}` → { name, at }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `{ uuid: nome }` de quem escreveu (o nome na mesa, senão o usuário). Guardado por 1 minuto. */
export async function authorNames(mesa, ids) {
    const want = [...new Set(ids.filter((id) => typeof id === 'string' && UUID_RE.test(id)))]
    const out = {}
    const missing = []
    const now = Date.now()
    for (const id of want) {
        const hit = nameCache.get(`${mesa}:${id}`)
        if (hit && now - hit.at < NAMES_TTL_MS) out[id] = hit.name
        else missing.push(id)
    }
    if (missing.length) {
        const found = await store().names(mesa, missing)
        for (const id of missing) {
            const name = typeof found?.[id] === 'string' ? found[id] : null
            if (name) { out[id] = name; nameCache.set(`${mesa}:${id}`, { name, at: now }) }
        }
    }
    return out
}
