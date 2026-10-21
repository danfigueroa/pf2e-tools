// Mapas de combate (VTT). Mesma filosofia do `table-store.js`: um campo por
// fatia, para duas pessoas mexendo em coisas diferentes não se sobrescreverem.
// No Postgres (migration `mapas`), uma LINHA por campo em `map_fields`:
//
//   maps        (id) → mesa, private, rev — a revisão sobe a cada escrita
//   map_fields  (map_id, field) →
//     ├─ meta          → nome, imagem e o retângulo dela em quadrados
//     ├─ turn          → id do combatente que está agindo (vem da Iniciativa)
//     ├─ tok:<cid>     → o que o token É (nome, tipo, tamanho, imagem)…
//     ├─ pos:<cid>     → …onde ele ESTÁ (quem escreve é o mapa)…
//     ├─ fit:<cid>     → …como a imagem do token é enquadrada (centro e ampliação — escolha do GM no mapa)…
//     ├─ hp:<cid>      → …e o PV do monstro (Iniciativa e mapa, nos dois sentidos)
//     ├─ imgs          → toda imagem de monstro que já passou por este mapa
//     ├─ ping:<id>     → um ping (clique duplo), que quem pingou apaga em segundos
//     ├─ roll:<id>     → (legado) a rolagem do rolador antigo; ninguém mais escreve
//     └─ drw:<id>      → um desenho (parede de fogo, área de magia) — um campo
//                        por desenho, para apagar um sem tocar nos outros
//   mesas.active_map_id → o mapa para onde a mesa deve ir
//
// `tok`, `pos` e `hp` são três campos e não um porque cada um tem um dono
// diferente: a Iniciativa reescreve o `tok` a cada mudança no encontro, o
// jogador arrasta o `pos`, e o `hp` do monstro é tocado pelos dois lados.
// Num campo só, o GM renomeando um goblin devolveria o goblin ao quadrado de
// antes do arrasto.
//
// `private` é coluna de `maps`, e não um flag dentro do `meta`, pelo mesmo
// motivo: o cliente regrava o `meta` inteiro com a cópia que tem (imagem,
// alinhamento, nome), e um ajuste logo depois de revelar o mapa o esconderia de
// novo. Só a ação `map-visibility` mexe nele.
//
// Toda escrita é uma função do banco (`map_write`…) que sobe a revisão e grava
// numa transação; um trigger transmite cada campo mudado pelo Realtime, com a
// revisão (`mesa:<mesa>:map:<id>`). O poll de contadores (`readRevs`) ficou como
// plano B, para quem está sem canal.
//
// Tudo é da mesa, e por isso toda função recebe `mesa`. Sem banco, Maps de
// processo, como o resto do estado.

import { memoryTableRev, readCharacterSlices } from './table-store.js'
import { supabase } from './supabase.js'
import { sameJson } from './json.js'

export const MAX_MAP_FIELD_BYTES = 8 * 1024
export const MAX_TOKENS = 200
const MAX_MAPS = 50

const ID_RE = /^[a-z0-9]{6,16}$/
const TOKEN_ID_RE = /^[a-z0-9-]{1,64}$/
const FIELD_RE = /^(meta|turn|(tok|pos|hp|fit|drw|ping|roll):[a-z0-9-]{1,64})$/

/** Teto de desenhos por mapa: o mapa inteiro desce a cada abertura. */
export const MAX_DRAWINGS = 300

export const isValidMapId = (id) => typeof id === 'string' && ID_RE.test(id)
export const isValidTokenId = (id) => typeof id === 'string' && TOKEN_ID_RE.test(id)
export const isValidMapField = (field) => typeof field === 'string' && FIELD_RE.test(field)

// --- Armazenamento ------------------------------------------------------------
//
// Duas implementações da mesma interface. `fields` é sempre
// `{ campo: { data, updatedAt } }`.

const check = ({ data, error }) => {
    if (error) throw error
    return data
}

const dbStore = (db) => ({
    list: async (mesa) => check(await db.rpc('list_maps', { p_mesa: mesa })),
    create: async (mesa, id, meta) => {
        check(await db.from('maps').insert({ id, mesa, private: true }))
        return check(await db.rpc('map_write', { p_mesa: mesa, p_id: id, p_set: { meta }, p_del: null, p_max_drawings: null }))
    },
    /** O mapa inteiro, coerente: contadores, campos e os PCs que estão nele. */
    read: async (mesa, id) => check(await db.rpc('read_map', { p_mesa: mesa, p_id: id })),
    revs: async (mesa, id) => check(await db.rpc('map_revs', { p_mesa: mesa, p_id: id })),
    fields: async (mesa, id) => {
        const rows = check(await db.from('map_fields').select('field, value, updated_at').eq('map_id', id).eq('mesa', mesa))
        return Object.fromEntries(rows.map((r) => [r.field, { data: r.value, updatedAt: Number(r.updated_at) }]))
    },
    exists: async (mesa, id) => !!check(await db.from('maps').select('id').eq('id', id).eq('mesa', mesa).maybeSingle()),
    write: async (mesa, id, set, del, maxDrawings) => check(await db.rpc('map_write', {
        p_mesa: mesa, p_id: id, p_set: set, p_del: del, p_max_drawings: maxDrawings,
    })),
    clearDrawings: async (mesa, id) => check(await db.rpc('map_clear_drawings', { p_mesa: mesa, p_id: id })),
    setPrivate: async (mesa, id, on) => check(await db.rpc('map_set_private', { p_mesa: mesa, p_id: id, p_on: on })),
    setActive: async (mesa, id) => { check(await db.from('mesas').update({ active_map_id: id }).eq('id', mesa)) },
    remove: async (mesa, id) => { check(await db.from('maps').delete().eq('id', id).eq('mesa', mesa)) },
})

const memoryStore = (() => {
    const maps = new Map()
    const active = new Map()
    const get = (mesa, id) => {
        const m = maps.get(id)
        return m && m.mesa === mesa ? m : null
    }
    const revsOf = (mesa, m) => ({ rev: m?.rev ?? 0, tableRev: memoryTableRev(mesa), activeId: active.get(mesa) ?? null })
    return {
        list: async (mesa) => ({
            activeId: active.get(mesa) ?? null,
            maps: [...maps.entries()].filter(([, m]) => m.mesa === mesa && m.fields.meta).map(([id, m]) => ({
                id,
                name: m.fields.meta.data.name,
                createdAt: m.fields.meta.data.createdAt ?? 0,
                hasImage: !!m.fields.meta.data.image,
                private: m.private,
            })).sort((a, b) => a.createdAt - b.createdAt),
        }),
        create: async (mesa, id, meta) => {
            maps.set(id, { mesa, private: true, rev: 1, fields: { meta: { data: meta, updatedAt: Date.now() } } })
            return 1
        },
        read: async (mesa, id) => {
            const m = get(mesa, id)
            if (!m) return null
            const slugs = [...new Set(Object.entries(m.fields)
                .filter(([f, v]) => f.startsWith('tok:') && v.data?.kind === 'pc' && typeof v.data.slug === 'string')
                .map(([, v]) => v.data.slug))]
            return { ...revsOf(mesa, m), private: m.private, fields: { ...m.fields }, pcs: await readCharacterSlices(mesa, slugs, ['hp', 'token', 'size']) }
        },
        revs: async (mesa, id) => revsOf(mesa, get(mesa, id)),
        fields: async (mesa, id) => ({ ...(get(mesa, id)?.fields ?? {}) }),
        exists: async (mesa, id) => !!get(mesa, id),
        write: async (mesa, id, set, del, maxDrawings) => {
            const m = get(mesa, id)
            if (!m) return null
            const drawings = Object.keys(m.fields).filter((f) => f.startsWith('drw:')).length
            const adds = Object.keys(set).some((f) => f.startsWith('drw:') && !m.fields[f])
            if (maxDrawings != null && adds && drawings >= maxDrawings) return -1
            const now = Date.now()
            for (const [f, data] of Object.entries(set)) m.fields[f] = { data, updatedAt: now }
            for (const f of del ?? []) delete m.fields[f]
            m.rev += 1
            return m.rev
        },
        clearDrawings: async (mesa, id) => {
            const m = get(mesa, id)
            if (!m) return null
            for (const f of Object.keys(m.fields)) if (f.startsWith('drw:')) delete m.fields[f]
            m.rev += 1
            return m.rev
        },
        setPrivate: async (mesa, id, on) => {
            const m = get(mesa, id)
            if (!m) return null
            if (on && active.get(mesa) === id) active.delete(mesa)
            if (m.private === on) return m.rev
            m.private = on
            m.rev += 1
            return m.rev
        },
        setActive: async (mesa, id) => { if (id === null) active.delete(mesa); else active.set(mesa, id) },
        remove: async (mesa, id) => {
            if (!get(mesa, id)) return
            maps.delete(id)
            if (active.get(mesa) === id) active.delete(mesa)
        },
    }
})()

const store = () => {
    const db = supabase()
    return db ? dbStore(db) : memoryStore
}

const num = (v) => Number(v) || 0

// --- Lista e mapa ativo -----------------------------------------------------

/**
 * Os mapas da sessão. Sem `includePrivate` (quem não está no Modo GM), os
 * privados nem saem daqui — e o `activeId` também não aponta para um deles.
 */
export async function listMaps(mesa, includePrivate = false) {
    const { maps, activeId } = await store().list(mesa)
    const visible = (maps ?? []).filter((m) => includePrivate || !m.private)
    return { maps: visible, activeId: visible.some((m) => m.id === activeId) ? activeId : null }
}

const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')

export async function createMap(mesa, name) {
    const { maps } = await listMaps(mesa, true)
    if (maps.length >= MAX_MAPS) return null
    const id = newId()
    const meta = { name, image: null, imageRect: null, createdAt: Date.now() }
    // Nasce privado: o GM monta o mapa escondido e revela quando a mesa chegar lá.
    await store().create(mesa, id, meta)
    return { id, name, createdAt: meta.createdAt, hasImage: false, private: true }
}

/**
 * Esconde ou revela o mapa. Sobe a revisão — é assim que quem está olhando
 * percebe. Esconder o mapa onde a mesa está tira a mesa dele.
 * @returns {Promise<number|null>} a nova revisão, ou null se o mapa não existe.
 */
export async function setMapPrivate(mesa, id, on) {
    const rev = await store().setPrivate(mesa, id, on)
    return rev === null ? null : num(rev)
}

export async function setActiveMap(mesa, id) {
    await store().setActive(mesa, id)
}

/**
 * Apaga o mapa e devolve as URLs de imagem que só ele usava — a do mapa e as
 * dos tokens de monstro. O token do personagem é da mesa (campo `token` do
 * estado dele) e sobrevive.
 */
export async function deleteMap(mesa, id) {
    const db = store()
    const fields = await db.fields(mesa, id)
    const urls = []
    for (const [field, entry] of Object.entries(fields)) {
        const data = entry?.data
        if (field === 'meta' && data?.image?.url) urls.push(data.image.url)
        if (field.startsWith('tok:') && data?.kind === 'npc' && data.image) urls.push(data.image)
        // Imagem enviada pelo GM no próprio mapa (enquadramento): é do mapa e some com ele.
        if (field.startsWith('fit:') && typeof data?.url === 'string') urls.push(data.url)
        if (field === 'imgs' && Array.isArray(data)) urls.push(...data.filter((u) => typeof u === 'string'))
    }
    await db.remove(mesa, id)
    // A mesma imagem pode estar em dois tokens (o "Duplicar" reaproveita).
    return [...new Set(urls)]
}

// --- Leitura -----------------------------------------------------------------

/** Os contadores numa consulta — o poll de reserva, de quem está sem Realtime. */
export async function readRevs(mesa, id) {
    const revs = await store().revs(mesa, id)
    return { rev: num(revs.rev), tableRev: num(revs.tableRev), activeId: revs.activeId ?? null }
}

/**
 * O mapa inteiro, já com o PV e o token dos personagens que estão nele — assim
 * uma mudança de PV feita na Ficha Virtual desce no MESMO pedido, em vez de um
 * pedido por personagem por aparelho. Uma consulta só (`read_map`), coerente:
 * contadores e dados saem do mesmo instante.
 */
export async function readMap(mesa, id) {
    const raw = await store().read(mesa, id)
    if (!raw?.fields?.meta) return null

    const tokens = {}
    const pos = {}
    const hp = {}
    const fit = {}
    const drawings = {}
    const pings = {}
    const rolls = {}
    let turn = null
    for (const [field, entry] of Object.entries(raw.fields)) {
        if (!entry) continue
        const at = field.indexOf(':')
        const kind = at < 0 ? field : field.slice(0, at)
        const tid = field.slice(at + 1)
        if (kind === 'tok') tokens[tid] = entry.data
        else if (kind === 'pos') pos[tid] = entry.data
        else if (kind === 'hp') hp[tid] = { ...entry.data, updatedAt: num(entry.updatedAt) }
        else if (kind === 'fit') fit[tid] = entry.data
        else if (kind === 'drw') drawings[tid] = entry.data
        else if (kind === 'ping') pings[tid] = entry.data
        else if (kind === 'roll') rolls[tid] = entry.data
        else if (field === 'turn') turn = entry.data
    }

    const pcs = {}
    for (const t of Object.values(tokens)) {
        if (t?.kind !== 'pc' || typeof t.slug !== 'string') continue
        const slices = raw.pcs?.[t.slug] ?? {}
        pcs[t.slug] = { hp: slices.hp ?? null, token: slices.token ?? null, size: slices.size ?? null }
    }

    return {
        id, meta: raw.fields.meta.data, private: !!raw.private, tokens, pos, hp, fit, drawings, pings, rolls, turn, pcs,
        rev: num(raw.rev), tableRev: num(raw.tableRev), activeId: raw.activeId ?? null,
    }
}

// --- Escrita -----------------------------------------------------------------

/**
 * Escrita genérica de campos (`meta`, `pos:*`, `hp:*`, `drw:*`…). `null` apaga o campo.
 * @returns {Promise<number|null>} a nova revisão, null se o mapa não existe, -1
 *   se passaria do teto de desenhos.
 */
export async function writeMapFields(mesa, id, fields) {
    const set = {}
    const del = []
    for (const [field, data] of Object.entries(fields)) {
        if (data === null) del.push(field)
        else set[field] = data
    }
    const rev = await store().write(mesa, id, set, del, MAX_DRAWINGS)
    return rev === null ? null : num(rev)
}

/** Apaga todos os desenhos de uma vez — o fim do combate. */
export async function clearDrawings(mesa, id) {
    const rev = await store().clearDrawings(mesa, id)
    return rev === null ? null : num(rev)
}

/**
 * O encontro da Iniciativa manda a lista INTEIRA de tokens: o que entrou ganha
 * um quadrado livre, o que saiu some (com posição e PV), e quem já estava fica
 * onde o jogador o deixou. É o encontro que manda em QUEM está no mapa; o mapa
 * manda em ONDE.
 *
 * `hp` vem só para os monstros cujo PV mudou na Iniciativa desde o último
 * envio — mandar todos a cada sincronia apagaria um dano dado no mapa que a
 * Iniciativa ainda não leu.
 */
export async function syncTokens(mesa, id, tokens, turn, hp) {
    const db = store()
    const raw = await db.fields(mesa, id)
    if (!raw.meta) return null

    const keep = new Set(tokens.map((t) => t.id))
    const occupied = []
    const existing = new Set()
    const del = []
    const leftUrls = []

    for (const [field, entry] of Object.entries(raw)) {
        const at = field.indexOf(':')
        if (at < 0) continue
        const kind = field.slice(0, at)
        const tid = field.slice(at + 1)
        if (kind !== 'tok' && kind !== 'pos' && kind !== 'hp' && kind !== 'fit') continue
        if (!keep.has(tid)) {
            del.push(field)
            // A imagem que o GM enviou para este token não pode ficar órfã no Blob:
            // vai para o registro do mapa, que é o que o `deleteMap` apaga.
            if (kind === 'fit') {
                const url = entry?.data?.url
                if (typeof url === 'string') leftUrls.push(url)
            }
            continue
        }
        if (kind === 'pos') {
            const p = entry?.data
            if (p) occupied.push({ x: p.x, y: p.y, size: raw[`tok:${tid}`]?.data?.size || 1 })
            existing.add(tid)
        }
    }

    const set = {}
    for (const token of tokens) {
        const { id: tid, ...descriptor } = token
        set[`tok:${tid}`] = descriptor
        if (!existing.has(tid)) {
            const size = descriptor.size || 1
            const spot = freeSpot(occupied, size)
            occupied.push({ ...spot, size })
            set[`pos:${tid}`] = spot
        }
    }
    for (const [tid, value] of Object.entries(hp || {})) {
        if (keep.has(tid)) set[`hp:${tid}`] = value
    }
    set.turn = turn ?? null

    // Registro de toda imagem de monstro que entrou neste mapa. Sem ele, o
    // monstro que saiu do encontro (ou trocou de imagem) levaria a referência
    // embora e a imagem ficaria órfã no Blob quando o mapa fosse apagado.
    const known = raw.imgs?.data
    const imgs = new Set(Array.isArray(known) ? known : [])
    for (const t of tokens) if (t.kind === 'npc' && typeof t.image === 'string') imgs.add(t.image)
    for (const url of leftUrls) imgs.add(url)
    set.imgs = [...imgs].slice(-500)

    // Nada mudou de fato? Não sobe a revisão (no banco, campo igual também não é
    // regravado nem transmitido — mas a revisão subiria à toa).
    const changed = del.length > 0 || Object.entries(set).some(([field, value]) => !sameJson(raw[field]?.data, value))
    if (!changed) return (await readRevs(mesa, id)).rev

    const rev = await db.write(mesa, id, set, del, null)
    return rev === null ? null : num(rev)
}

/**
 * Primeiro canto livre numa faixa de 20 colunas a partir do topo — quem chega
 * entra junto da borda e o GM arrasta para o lugar. Livre = nenhum quadrado da
 * pegada coincide com a de outro token.
 */
function freeSpot(occupied, size) {
    const hit = (x, y) => occupied.some((o) => {
        const s = o.size
        return x < o.x + s && x + size > o.x && y < o.y + s && y + size > o.y
    })
    const WIDTH = 20
    for (let y = 0; y < 200; y += 1) {
        for (let x = 0; x <= WIDTH - size; x += 1) {
            if (!hit(x, y)) return { x, y }
        }
    }
    return { x: 0, y: 0 }
}
