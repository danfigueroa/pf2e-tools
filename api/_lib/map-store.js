// Mapas de combate (VTT). Mesma filosofia do `table-store.js`: um HASH por
// mapa, um campo por fatia, para duas pessoas mexendo em coisas diferentes não
// se sobrescreverem.
//
//   pf2e:map:v1:<id>
//     ├─ meta          → nome, imagem e o retângulo dela em quadrados
//     ├─ turn          → id do combatente que está agindo (vem da Iniciativa)
//     ├─ tok:<cid>     → o que o token É (nome, tipo, tamanho, imagem)…
//     ├─ pos:<cid>     → …onde ele ESTÁ (quem escreve é o mapa)…
//     ├─ fit:<cid>     → …como a imagem do token é enquadrada (centro e ampliação — escolha do GM no mapa)…
//     ├─ hp:<cid>      → …e o PV do monstro (Iniciativa e mapa, nos dois sentidos)
//     ├─ private       → presente = só o Modo GM vê o mapa (ausente = público)
//     ├─ imgs          → toda imagem de monstro que já passou por este mapa
//     ├─ ping:<id>     → um ping (Alt+clique), que quem pingou apaga em segundos
//     ├─ roll:<id>     → uma rolagem do rolador de dados, efêmera como o ping
//     └─ drw:<id>      → um desenho (parede de fogo, área de magia) — um campo
//                        por desenho, para apagar um sem tocar nos outros
//
// `tok`, `pos` e `hp` são três campos e não um porque cada um tem um dono
// diferente: a Iniciativa reescreve o `tok` a cada mudança no encontro, o
// jogador arrasta o `pos`, e o `hp` do monstro é tocado pelos dois lados.
// Num campo só, o GM renomeando um goblin devolveria o goblin ao quadrado de
// antes do arrasto.
//
// `private` também é campo próprio, e não um flag dentro do `meta`, pelo mesmo
// motivo: o cliente regrava o `meta` inteiro com a cópia que tem (imagem,
// alinhamento, nome), e um ajuste logo depois de revelar o mapa o esconderia de
// novo. Fica fora do `FIELD_RE` — só a ação `map-visibility` mexe nele.
//
//   pf2e:maps:v1         SET com os ids
//   pf2e:maps:active     o mapa para onde a mesa deve ir
//   pf2e:map:rev:<id>    contador — sobe a cada escrita, é o que o poll lê
//   pf2e:table:rev       contador do estado dos personagens (table-store.js)
//
// O poll lê só os contadores (um MGET); o mapa inteiro só desce quando um
// deles mudou.
//
// Todas as chaves são da mesa (`scoped`, ver mesas.js): cada mesa tem a lista,
// o mapa ativo e os contadores dela, e por isso toda função recebe `mesa`.

import { memoryTableRev, readCharacterSlices, redis, tableRevKey } from './table-store.js'
import { scoped } from './mesas.js'

const MAP_PREFIX = 'pf2e:map:v1:'
const REV_PREFIX = 'pf2e:map:rev:'
const INDEX_KEY = 'pf2e:maps:v1'
const ACTIVE_KEY = 'pf2e:maps:active'

const mapKey = (mesa, id) => scoped(mesa, MAP_PREFIX + id)
const revKey = (mesa, id) => scoped(mesa, REV_PREFIX + id)
const indexKey = (mesa) => scoped(mesa, INDEX_KEY)
const activeKey = (mesa) => scoped(mesa, ACTIVE_KEY)

// Rede de segurança: o caminho normal é o GM apagar o mapa depois do jogo.
const TTL_SECONDS = 30 * 24 * 60 * 60

export const MAX_MAP_FIELD_BYTES = 8 * 1024
export const MAX_TOKENS = 200
const MAX_MAPS = 50

const ID_RE = /^[a-z0-9]{6,16}$/
const TOKEN_ID_RE = /^[a-z0-9-]{1,64}$/
const FIELD_RE = /^(meta|turn|(tok|pos|hp|fit|drw|ping|roll):[a-z0-9-]{1,64})$/

/** Teto de desenhos por mapa: o hash inteiro desce a cada mudança. */
export const MAX_DRAWINGS = 300

export const isValidMapId = (id) => typeof id === 'string' && ID_RE.test(id)
export const isValidTokenId = (id) => typeof id === 'string' && TOKEN_ID_RE.test(id)
export const isValidMapField = (field) => typeof field === 'string' && FIELD_RE.test(field)

// --- Fallback em memória (sem Redis) ----------------------------------------

const memHashes = new Map()
const memStrings = new Map()
const memSets = new Map()
function memIndex(mesa) {
    const key = indexKey(mesa)
    if (!memSets.has(key)) memSets.set(key, new Set())
    return memSets.get(key)
}

const safeParse = (raw) => {
    if (typeof raw !== 'string') return raw ?? null
    try { return JSON.parse(raw) } catch { return null }
}

const envelope = (data) => JSON.stringify({ data, updatedAt: Date.now() })

/** Campo gravado → `{ data, updatedAt }`, aceitando string ou objeto. */
function unwrap(raw) {
    const parsed = safeParse(raw)
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null
    return { data: parsed.data, updatedAt: parsed.updatedAt ?? 0 }
}

async function hgetall(key) {
    const r = redis()
    if (r) return (await r.hgetall(key)) || {}
    return { ...(memHashes.get(key) || {}) }
}

async function bump(mesa, id) {
    const r = redis()
    if (r) {
        const rev = await r.incr(revKey(mesa, id))
        await r.expire(revKey(mesa, id), TTL_SECONDS)
        return rev
    }
    const rev = (memStrings.get(revKey(mesa, id)) || 0) + 1
    memStrings.set(revKey(mesa, id), rev)
    return rev
}

/** Grava e apaga campos de um mapa e sobe a revisão — uma escrita só. */
async function writeRaw(mesa, id, set, del = []) {
    const key = mapKey(mesa, id)
    const r = redis()
    if (r) {
        const p = r.pipeline()
        if (Object.keys(set).length > 0) p.hset(key, set)
        if (del.length > 0) p.hdel(key, ...del)
        p.expire(key, TTL_SECONDS)
        await p.exec()
    } else {
        const hash = memHashes.get(key) || {}
        Object.assign(hash, set)
        for (const f of del) delete hash[f]
        memHashes.set(key, hash)
    }
    return bump(mesa, id)
}

// --- Lista e mapa ativo -----------------------------------------------------

/**
 * Os mapas da sessão. Sem `includePrivate` (quem não está no Modo GM), os
 * privados nem saem daqui — e o `activeId` também não aponta para um deles.
 */
export async function listMaps(mesa, includePrivate = false) {
    const r = redis()
    const ids = r ? await r.smembers(indexKey(mesa)) : [...memIndex(mesa)]
    const active = r ? await r.get(activeKey(mesa)) : memStrings.get(activeKey(mesa)) ?? null

    let rows
    if (r && ids.length > 0) {
        const p = r.pipeline()
        ids.forEach((id) => p.hmget(mapKey(mesa, id), 'meta', 'private'))
        rows = await p.exec()
    } else {
        rows = ids.map((id) => {
            const hash = memHashes.get(mapKey(mesa, id))
            return { meta: hash?.meta ?? null, private: hash?.private ?? null }
        })
    }

    const maps = []
    const orphans = []
    ids.forEach((id, i) => {
        const meta = unwrap(rows[i]?.meta)?.data
        // Mapa que expirou pelo TTL some do hash mas fica no SET: limpa aqui.
        if (!meta) { orphans.push(id); return }
        const isPrivate = !!unwrap(rows[i]?.private)?.data
        if (isPrivate && !includePrivate) return
        maps.push({ id, name: meta.name, createdAt: meta.createdAt ?? 0, hasImage: !!meta.image, private: isPrivate })
    })
    if (orphans.length > 0) {
        if (r) await r.srem(indexKey(mesa), ...orphans)
        else orphans.forEach((id) => memIndex(mesa).delete(id))
    }

    maps.sort((a, b) => a.createdAt - b.createdAt)
    return { maps, activeId: maps.some((m) => m.id === active) ? active : null }
}

const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')

export async function createMap(mesa, name) {
    const { maps } = await listMaps(mesa)
    if (maps.length >= MAX_MAPS) return null
    const id = newId()
    const meta = { name, image: null, imageRect: null, createdAt: Date.now() }
    const r = redis()
    if (r) await r.sadd(indexKey(mesa), id)
    else memIndex(mesa).add(id)
    // Nasce privado: o GM monta o mapa escondido e revela quando a mesa chegar lá.
    await writeRaw(mesa, id, { meta: envelope(meta), private: envelope(true) })
    return { id, name, createdAt: meta.createdAt, hasImage: false, private: true }
}

/**
 * Esconde ou revela o mapa. Sobe a revisão — é assim que o poll de quem está
 * olhando percebe. Esconder o mapa onde a mesa está tira a mesa dele.
 * @returns {Promise<number|null>} a nova revisão, ou null se o mapa não existe.
 */
export async function setMapPrivate(mesa, id, on) {
    if (!(await mapExists(mesa, id))) return null
    const r = redis()
    if (on) {
        const active = r ? await r.get(activeKey(mesa)) : memStrings.get(activeKey(mesa)) ?? null
        if (active === id) await setActiveMap(mesa, null)
    }
    // Já está como pedido (o caso comum de "Levar a mesa"): não sobe a revisão,
    // senão todo aparelho rebaixaria o mapa à toa.
    const current = r ? await r.hget(mapKey(mesa, id), 'private') : memHashes.get(mapKey(mesa, id))?.private
    if (!!current === on) return (await readRevs(mesa, id)).rev
    return on ? writeRaw(mesa, id, { private: envelope(true) }) : writeRaw(mesa, id, {}, ['private'])
}

export async function setActiveMap(mesa, id) {
    const r = redis()
    if (id === null) {
        if (r) await r.del(activeKey(mesa))
        else memStrings.delete(activeKey(mesa))
        return
    }
    if (r) await r.set(activeKey(mesa), id)
    else memStrings.set(activeKey(mesa), id)
}

/**
 * Apaga o mapa e devolve as URLs de imagem que só ele usava — a do mapa e as
 * dos tokens de monstro. O token do personagem é da mesa (campo `token` do
 * hash dele) e sobrevive.
 */
export async function deleteMap(mesa, id) {
    const key = mapKey(mesa, id)
    const raw = await hgetall(key)
    const urls = []
    for (const [field, value] of Object.entries(raw)) {
        const data = unwrap(value)?.data
        if (field === 'meta' && data?.image?.url) urls.push(data.image.url)
        if (field.startsWith('tok:') && data?.kind === 'npc' && data.image) urls.push(data.image)
        // Imagem enviada pelo GM no próprio mapa (enquadramento): é do mapa e some com ele.
        if (field.startsWith('fit:') && typeof data?.url === 'string') urls.push(data.url)
        if (field === 'imgs' && Array.isArray(data)) urls.push(...data.filter((u) => typeof u === 'string'))
    }

    const r = redis()
    if (r) {
        const p = r.pipeline()
        p.del(key)
        p.del(revKey(mesa, id))
        p.srem(indexKey(mesa), id)
        await p.exec()
        if ((await r.get(activeKey(mesa))) === id) await r.del(activeKey(mesa))
    } else {
        memHashes.delete(key)
        memStrings.delete(revKey(mesa, id))
        memIndex(mesa).delete(id)
        if (memStrings.get(activeKey(mesa)) === id) memStrings.delete(activeKey(mesa))
    }
    // A mesma imagem pode estar em dois tokens (o "Duplicar" reaproveita).
    return [...new Set(urls)]
}

// --- Leitura -----------------------------------------------------------------

/**
 * Os contadores numa ida só. É o que o poll pede a cada segundo e meio, então
 * tem de custar UM comando no Redis. (O feed de rolagens ia de carona aqui; hoje
 * ele chega pelo Realtime.)
 */
export async function readRevs(mesa, id) {
    const r = redis()
    if (r) {
        const [rev, tableRev, active] = await r.mget(revKey(mesa, id), tableRevKey(mesa), activeKey(mesa))
        return { rev: Number(rev) || 0, tableRev: Number(tableRev) || 0, activeId: active ?? null }
    }
    return {
        rev: memStrings.get(revKey(mesa, id)) || 0,
        tableRev: memoryTableRev(mesa),
        activeId: memStrings.get(activeKey(mesa)) ?? null,
    }
}

/**
 * O mapa inteiro, já com o PV e o token dos personagens que estão nele — assim
 * uma mudança de PV feita na Ficha Virtual desce no MESMO pedido, em vez de um
 * pedido por personagem por aparelho.
 */
export async function readMap(mesa, id, knownRevs) {
    // Contadores ANTES dos dados: uma escrita que caia entre as duas leituras
    // deixa o contador velho e os dados novos, e o próximo poll baixa de novo.
    // Na ordem inversa (como era), o contador já incluía a escrita que os dados
    // não tinham — e o poll achava que estava em dia até a mudança seguinte.
    const revs = knownRevs ?? await readRevs(mesa, id)
    const raw = await hgetall(mapKey(mesa, id))
    const metaEntry = unwrap(raw.meta)
    if (!metaEntry) return null

    const tokens = {}
    const pos = {}
    const hp = {}
    const fit = {}
    const drawings = {}
    const pings = {}
    const rolls = {}
    let turn = null
    let isPrivate = false
    for (const [field, value] of Object.entries(raw)) {
        const entry = unwrap(value)
        if (!entry) continue
        const at = field.indexOf(':')
        const kind = at < 0 ? field : field.slice(0, at)
        const tid = field.slice(at + 1)
        if (kind === 'tok') tokens[tid] = entry.data
        else if (kind === 'pos') pos[tid] = entry.data
        else if (kind === 'hp') hp[tid] = { ...entry.data, updatedAt: entry.updatedAt }
        else if (kind === 'fit') fit[tid] = entry.data
        else if (kind === 'drw') drawings[tid] = entry.data
        else if (kind === 'ping') pings[tid] = entry.data
        else if (kind === 'roll') rolls[tid] = entry.data
        else if (field === 'turn') turn = entry.data
        else if (field === 'private') isPrivate = !!entry.data
    }

    const slugs = [...new Set(Object.values(tokens)
        .filter((t) => t?.kind === 'pc' && typeof t.slug === 'string')
        .map((t) => t.slug))]
    const pcs = await readPcs(mesa, slugs)

    return { id, meta: metaEntry.data, private: isPrivate, tokens, pos, hp, fit, drawings, pings, rolls, turn, pcs, ...revs }
}

/**
 * `hp`, `token` e `size` (Enlarge/Shrink ligado) de cada personagem, do estado
 * da mesa (Postgres) — uma consulta para todos.
 */
async function readPcs(mesa, slugs) {
    const slices = await readCharacterSlices(mesa, slugs, ['hp', 'token', 'size'])
    return Object.fromEntries(slugs.map((slug) => [slug, {
        hp: slices[slug]?.hp ?? null,
        token: slices[slug]?.token ?? null,
        size: slices[slug]?.size ?? null,
    }]))
}

// --- Escrita -----------------------------------------------------------------

/**
 * Escrita genérica de campos (`meta`, `pos:*`, `hp:*`). `null` apaga o campo.
 * @returns {Promise<number|null>} a nova revisão, ou null se o mapa não existe.
 */
export async function writeMapFields(mesa, id, fields) {
    const exists = await mapExists(mesa, id)
    if (!exists) return null
    if (Object.entries(fields).some(([f, d]) => f.startsWith('drw:') && d !== null)) {
        const raw = await hgetall(mapKey(mesa, id))
        const count = Object.keys(raw).filter((f) => f.startsWith('drw:')).length
        if (count >= MAX_DRAWINGS) return -1
    }
    const set = {}
    const del = []
    for (const [field, data] of Object.entries(fields)) {
        if (data === null) del.push(field)
        else set[field] = envelope(data)
    }
    return writeRaw(mesa, id, set, del)
}

/** Apaga todos os desenhos de uma vez — o fim do combate. */
export async function clearDrawings(mesa, id) {
    const raw = await hgetall(mapKey(mesa, id))
    if (!unwrap(raw.meta)) return null
    const fields = Object.keys(raw).filter((f) => f.startsWith('drw:'))
    if (fields.length === 0) return (await readRevs(mesa, id)).rev
    return writeRaw(mesa, id, {}, fields)
}

async function mapExists(mesa, id) {
    const r = redis()
    if (r) return (await r.hexists(mapKey(mesa, id), 'meta')) === 1
    return !!memHashes.get(mapKey(mesa, id))?.meta
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
    const raw = await hgetall(mapKey(mesa, id))
    if (!unwrap(raw.meta)) return null

    const keep = new Set(tokens.map((t) => t.id))
    const occupied = []
    const existing = new Set()
    const del = []
    const leftUrls = []

    for (const [field, value] of Object.entries(raw)) {
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
                const url = unwrap(value)?.data?.url
                if (typeof url === 'string') leftUrls.push(url)
            }
            continue
        }
        if (kind === 'pos') {
            const p = unwrap(value)?.data
            if (p) occupied.push({ x: p.x, y: p.y, size: unwrap(raw[`tok:${tid}`])?.data?.size || 1 })
            existing.add(tid)
        }
    }

    const set = {}
    for (const token of tokens) {
        const { id: tid, ...descriptor } = token
        set[`tok:${tid}`] = envelope(descriptor)
        if (!existing.has(tid)) {
            const size = descriptor.size || 1
            const spot = freeSpot(occupied, size)
            occupied.push({ ...spot, size })
            set[`pos:${tid}`] = envelope(spot)
        }
    }
    for (const [tid, value] of Object.entries(hp || {})) {
        if (keep.has(tid)) set[`hp:${tid}`] = envelope(value)
    }
    set.turn = envelope(turn ?? null)

    // Registro de toda imagem de monstro que entrou neste mapa. Sem ele, o
    // monstro que saiu do encontro (ou trocou de imagem) levaria a referência
    // embora e a imagem ficaria órfã no Blob quando o mapa fosse apagado.
    const known = unwrap(raw.imgs)?.data
    const imgs = new Set(Array.isArray(known) ? known : [])
    for (const t of tokens) if (t.kind === 'npc' && typeof t.image === 'string') imgs.add(t.image)
    for (const url of leftUrls) imgs.add(url)
    set.imgs = envelope([...imgs].slice(-500))

    // Nada mudou de fato? Não sobe a revisão: o poll de todo mundo ficaria
    // baixando o mapa inteiro sem motivo.
    const changed = del.length > 0 || Object.entries(set).some(([field, value]) =>
        JSON.stringify(unwrap(raw[field])?.data ?? null) !== JSON.stringify(unwrap(value).data))
    if (!changed) return (await readRevs(mesa, id)).rev

    return writeRaw(mesa, id, set, del)
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
