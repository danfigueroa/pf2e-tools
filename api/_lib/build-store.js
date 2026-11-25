// Builds do Criador de Personagem (`character_builds`, `character_build_versions`) e regras de criação da mesa
// (`mesa_rules`). Migration `criador_de_personagem`; esquema em docs/character-builder/MODELO-DE-DADOS.md §2–3.
//
// Mesa como 1º parâmetro de tudo. A escrita do build é CONDICIONAL pelo `rev` (o cliente manda o que viu; outro
// aparelho gravou antes = conflito). Sem banco, cai em Maps de processo por mesa (mesma política dos outros stores).
//
// PARES (regra global 7): `buildSlugFromName` ↔ `charId.ts`; `DEFAULT_MESA_RULES`/`sanitizeMesaRules` ↔
// `src/modules/character-builder/mesaRules.ts`.

import { randomUUID } from 'node:crypto'
import { supabase } from './supabase.js'

// Mesmos `SLUG_ALIASES` de `charId.ts`/`sheet-store.js`.
const SLUG_ALIASES = { 'thalos-alba': 'thalos' }
export const MAX_BUILD_SLUG = 48

/** Slug do build a partir do nome: mesmo algoritmo do `charSlugFromName`, cortado em 48 (CHECK da tabela). */
export function buildSlugFromName(name) {
    const slug = String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_BUILD_SLUG)
        .replace(/-+$/g, '')
    const final = slug || 'sem-nome'
    return SLUG_ALIASES[final] || final
}

// --- Regras da mesa -------------------------------------------------------------------------------------------

const RARITY = ['allow', 'ask', 'deny']
const SOURCE_RE = /^source:source-[0-9]{1,6}$/
const ID_RE = /^[a-z][a-z-]{0,30}:[a-z0-9][a-z0-9-]{0,60}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const DEFAULT_MESA_RULES = Object.freeze({
    sources: { allow: [] },
    legacy: false,
    rarity: { uncommon: 'ask', rare: 'ask' },
    variants: {
        freeArchetype: false,
        mythic: { enabled: false, progression: 'level' },
        ancestralParagon: false,
        abp: false,
        pwl: false,
        dualClass: false,
        gradualBoosts: false,
    },
    startingLevel: 1,
    wealth: 'table',
    exceptions: [],
})

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const flag = (v, fallback) => (typeof v === 'boolean' ? v : fallback)
const sourceList = (v) => (Array.isArray(v) ? [...new Set(v.filter((s) => typeof s === 'string' && SOURCE_RE.test(s)))].slice(0, 500) : [])

/** As regras na forma aceita; o que falta ou não serve volta ao padrão. Nunca `null`. */
export function sanitizeMesaRules(input) {
    const v = isObj(input) ? input : {}
    const d = DEFAULT_MESA_RULES
    const variants = isObj(v.variants) ? v.variants : {}
    const mythic = isObj(variants.mythic) ? variants.mythic : {}
    const deny = sourceList(v.sources?.deny)
    return {
        sources: { allow: sourceList(v.sources?.allow), ...(deny.length ? { deny } : {}) },
        legacy: flag(v.legacy, d.legacy),
        rarity: {
            uncommon: RARITY.includes(v.rarity?.uncommon) ? v.rarity.uncommon : d.rarity.uncommon,
            rare: RARITY.includes(v.rarity?.rare) ? v.rarity.rare : d.rarity.rare,
        },
        variants: {
            freeArchetype: flag(variants.freeArchetype, false),
            mythic: {
                enabled: flag(mythic.enabled, false),
                progression: mythic.progression === 'trials' ? 'trials' : 'level',
                ...(typeof mythic.destinyAsArchetype === 'boolean' ? { destinyAsArchetype: mythic.destinyAsArchetype } : {}),
            },
            ancestralParagon: flag(variants.ancestralParagon, false),
            abp: flag(variants.abp, false),
            pwl: flag(variants.pwl, false),
            dualClass: flag(variants.dualClass, false),
            gradualBoosts: flag(variants.gradualBoosts, false),
        },
        startingLevel: Number.isInteger(v.startingLevel) && v.startingLevel >= 1 && v.startingLevel <= 20 ? v.startingLevel : d.startingLevel,
        wealth: v.wealth === 'free' ? 'free' : 'table',
        exceptions: (Array.isArray(v.exceptions) ? v.exceptions : []).slice(0, 100).flatMap((e) => {
            if (!isObj(e) || typeof e.buildId !== 'string' || !UUID_RE.test(e.buildId)) return []
            const ids = Array.isArray(e.ids) ? [...new Set(e.ids.filter((x) => typeof x === 'string' && ID_RE.test(x)))].slice(0, 50) : []
            if (!ids.length) return []
            const note = typeof e.note === 'string' && e.note.trim() ? e.note.trim().slice(0, 200) : undefined
            return [{ buildId: e.buildId, ids, ...(note ? { note } : {}) }]
        }),
    }
}

// --- Armazenamento ------------------------------------------------------------------------------------------

const HEADER = 'id, slug, owner_id, name, class_name, level, rules_version, rev, updated_at, updated_by, published_rev, deleted_at, created_at'

const ms = (v) => (v ? Date.parse(v) : null)
const fromRow = (row) => row && {
    id: row.id,
    slug: row.slug,
    ownerId: row.owner_id ?? null,
    name: row.name,
    className: row.class_name ?? null,
    level: row.level,
    rulesVersion: row.rules_version,
    rev: row.rev,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    updatedBy: row.updated_by ?? null,
    publishedRev: row.published_rev ?? null,
    deletedAt: ms(row.deleted_at),
    ...(row.state !== undefined ? { state: row.state } : {}),
}

const check = ({ data, error }) => {
    if (error) throw error
    return data
}

const dbStore = (db) => ({
    list: async (mesa) => check(await db.from('character_builds').select(HEADER).eq('mesa', mesa)
        .order('updated_at', { ascending: false })).map(fromRow),
    read: async (mesa, id) => fromRow(check(await db.from('character_builds').select(`${HEADER}, state`)
        .eq('mesa', mesa).eq('id', id).maybeSingle())),
    slugTaken: async (mesa, slug) => {
        const [builds, sheets] = await Promise.all([
            db.from('character_builds').select('id').eq('mesa', mesa).eq('slug', slug).limit(1),
            db.from('sheets').select('slug').eq('mesa', mesa).eq('slug', slug).limit(1),
        ])
        return check(builds).length > 0 || check(sheets).length > 0
    },
    insert: async (mesa, row) => {
        const { data, error } = await db.from('character_builds').insert({ mesa, ...row }).select(`${HEADER}, state`).single()
        if (error?.code === '23505') return null
        if (error) throw error
        return fromRow(data)
    },
    update: async (mesa, id, rev, patch) => {
        let q = db.from('character_builds').update({ ...patch, updated_at: new Date().toISOString() }).eq('mesa', mesa).eq('id', id)
        if (rev !== null) q = q.eq('rev', rev)
        const rows = check(await q.select(HEADER))
        return rows.length ? fromRow(rows[0]) : null
    },
    // Mesma função da autoria da Wiki: o nome na mesa, senão o usuário.
    names: async (mesa, ids) => (ids.length ? check(await db.rpc('member_names', { p_mesa: mesa, p_ids: ids })) ?? {} : {}),
    readRules: async (mesa) => check(await db.from('mesa_rules').select('rules, updated_at').eq('mesa', mesa).maybeSingle()),
    writeRules: async (mesa, rules, by) => {
        const row = check(await db.from('mesa_rules').upsert({ mesa, rules, updated_at: new Date().toISOString(), updated_by: by })
            .select('rules, updated_at').single())
        return row
    },
})

const memory = new Map()
const mem = (mesa) => {
    if (!memory.has(mesa)) memory.set(mesa, { builds: new Map(), rules: null })
    return memory.get(mesa)
}
const copy = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

const memoryStore = {
    list: async (mesa) => [...mem(mesa).builds.values()].map(({ state, ...header }) => copy(header))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    read: async (mesa, id) => copy(mem(mesa).builds.get(id)) ?? null,
    slugTaken: async (mesa, slug) => [...mem(mesa).builds.values()].some((b) => b.slug === slug),
    insert: async (mesa, row) => {
        const m = mem(mesa)
        if ([...m.builds.values()].some((b) => b.slug === row.slug)) return null
        const now = Date.now()
        const build = fromRow({ ...row, id: randomUUID(), rev: 1, created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
        m.builds.set(build.id, build)
        return copy(build)
    },
    update: async (mesa, id, rev, patch) => {
        const current = mem(mesa).builds.get(id)
        if (!current || (rev !== null && current.rev !== rev)) return null
        const next = { ...current, updatedAt: Date.now() }
        if (patch.state !== undefined) next.state = copy(patch.state)
        if (patch.name !== undefined) next.name = patch.name
        if (patch.class_name !== undefined) next.className = patch.class_name
        if (patch.level !== undefined) next.level = patch.level
        if (patch.rules_version !== undefined) next.rulesVersion = patch.rules_version
        if (patch.rev !== undefined) next.rev = patch.rev
        if (patch.updated_by !== undefined) next.updatedBy = patch.updated_by
        if (patch.owner_id !== undefined) next.ownerId = patch.owner_id
        if (patch.deleted_at !== undefined) next.deletedAt = ms(patch.deleted_at)
        mem(mesa).builds.set(id, next)
        const { state, ...header } = next
        return copy(header)
    },
    names: async () => ({}),
    readRules: async (mesa) => copy(mem(mesa).rules),
    writeRules: async (mesa, rules) => {
        mem(mesa).rules = { rules: copy(rules), updated_at: new Date().toISOString() }
        return copy(mem(mesa).rules)
    },
}

const store = () => {
    const db = supabase()
    return db ? dbStore(db) : memoryStore
}

/** Cabeçalhos de todos os builds da mesa (sem o `state`), inclusive os da lixeira. */
export const listBuilds = (mesa) => store().list(mesa)

/** Nome de cada dono (`userId → nome`), para o "personagem de <dono>" da lista. */
export const memberNames = (mesa, ids) => store().names(mesa, [...new Set(ids.filter(Boolean))])

/** Build completo (com `state`), ou `null`. */
export const readBuild = (mesa, id) => (UUID_RE.test(String(id)) ? store().read(mesa, id) : Promise.resolve(null))

/** Primeiro slug livre na mesa a partir do nome (nem build nem ficha publicada com ele): `ana`, `ana-2`… */
export async function freeBuildSlug(mesa, name) {
    const db = store()
    const base = buildSlugFromName(name)
    for (let n = 1; n <= 50; n += 1) {
        const suffix = n === 1 ? '' : `-${n}`
        const slug = `${base.slice(0, MAX_BUILD_SLUG - suffix.length).replace(/-+$/g, '')}${suffix}`
        if (!(await db.slugTaken(mesa, slug))) return slug
    }
    return null
}

/**
 * Cria o build. `null` = o slug foi tomado entre a escolha e o insert (o handler tenta de novo).
 * `state` já sanitizado; o cabeçalho sai dele.
 */
export function createBuild(mesa, { slug, state, className, ownerId, by }) {
    return store().insert(mesa, {
        slug,
        owner_id: ownerId,
        name: state.name,
        class_name: className ?? null,
        level: state.level,
        state,
        rules_version: state.rulesVersion || '',
        created_by: by,
        updated_by: by,
    })
}

/** Grava o `state` se o `rev` ainda for o visto. `null` = conflito (ou o build sumiu). */
export function saveBuild(mesa, id, rev, { state, className, by }) {
    return store().update(mesa, id, rev, {
        state,
        name: state.name,
        class_name: className ?? null,
        level: state.level,
        rules_version: state.rulesVersion || '',
        rev: rev + 1,
        updated_by: by,
    })
}

/** Lixeira (`deleted = true`) ou volta dela. Não mexe no `rev`. */
export const trashBuild = (mesa, id, deleted, by) =>
    store().update(mesa, id, null, { deleted_at: deleted ? new Date().toISOString() : null, updated_by: by })

/** Troca o dono (GM). */
export const assignBuild = (mesa, id, ownerId, by) => store().update(mesa, id, null, { owner_id: ownerId, updated_by: by })

/** Regras de criação da mesa, sempre completas (padrão quando a mesa não tem linha). */
export async function readMesaRules(mesa) {
    const row = await store().readRules(mesa)
    return { rules: sanitizeMesaRules(row?.rules), updatedAt: ms(row?.updated_at) }
}

export async function writeMesaRules(mesa, rules, by) {
    const row = await store().writeRules(mesa, sanitizeMesaRules(rules), by)
    return { rules: sanitizeMesaRules(row.rules), updatedAt: ms(row.updated_at) }
}
