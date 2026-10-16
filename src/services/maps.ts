// Cliente do mapa de combate (`/api/state?map…`).
//
// Diferente do resto do estado da mesa, o mapa é ACOMPANHADO: quem arrasta um
// token espera que os outros vejam o movimento sem apertar "Atualizar". Em vez
// de conexão persistente (a Vercel serverless não segura uma), um poll lê só
// os contadores de revisão — um MGET no Redis — e o mapa inteiro só desce
// quando um deles mudou.
//
// Escrita é otimista e por campo, como em `tableState.ts`: a tela muda na hora
// e o valor fica como "override" até o servidor confirmar, para um poll que
// chegue no meio não devolver o token ao quadrado de antes.

import { useSyncExternalStore } from 'react'
import { saveField } from './tableState'
import { noteRollsRev } from './rolls'
import type { HpStored } from '../modules/character-viewer/components/useHpTracker'
import { sizeSquares, type Cell, type ImageRect } from '../modules/battle-map/geometry'
import { activeSizeEffect, sanitizeSizeEffect } from '../modules/character-viewer/sizeEffects'

export interface MapImage { url: string; w: number; h: number }

export interface MapMeta {
    name: string
    image: MapImage | null
    /** Onde a imagem fica, em quadrados (frações valem: é o alinhamento fino). */
    imageRect: ImageRect | null
    createdAt: number
}

/** O que o token É — escrito só pela Iniciativa. */
export interface TokenDescriptor {
    kind: 'pc' | 'npc'
    name: string
    /** Lado em quadrados. */
    size: number
    slug?: string
    /** PV máximo do personagem (o do monstro vem em `hp`). */
    maxHp?: number
    /** Imagem do monstro. A do personagem é da mesa (`pcs[slug].token`). */
    image?: string
    defeated?: boolean
    /** Deslocamento em pés — sem ele, o arrasto mostra só a distância. */
    speed?: number
    /**
     * Miúdo: ocupa 1 quadrado (alvo de toque) mas é desenhado menor. Só no
     * cliente — sai de `withPcSizes`, nunca é gravado.
     */
    tiny?: boolean
}

export interface NpcHp { current: number; max: number; temp: number; updatedAt?: number }

export interface PcSlice {
    hp: HpStored | null
    token: { url: string } | null
    /** Enlarge/Shrink ligado na Ficha Virtual — cru; `withPcSizes` interpreta. */
    size?: unknown
}

export interface MapData {
    id: string
    meta: MapMeta
    tokens: Record<string, TokenDescriptor>
    pos: Record<string, Cell>
    hp: Record<string, NpcHp>
    /** Desenhos crus do servidor — quem desenha valida com `sanitizeDrawing`. */
    drawings: Record<string, unknown>
    /** Pings em andamento (`{ x, y }` em quadrados) — quem pingou apaga em segundos. */
    pings: Record<string, unknown>
    /** Rolagens do rolador de dados, efêmeras como os pings (ver `battle-map/dice.ts`). */
    rolls: Record<string, unknown>
    turn: string | null
    pcs: Record<string, PcSlice>
    rev: number
    tableRev: number
    activeId: string | null
    /** Contador do feed de rolagens, de carona no MGET (ver `services/rolls.ts`). */
    rollsRev?: number
}

export interface MapSummary { id: string; name: string; createdAt: number; hasImage: boolean }

export interface MapSnapshot {
    data: MapData | null
    error: string | null
    /** Mapa para onde a mesa deve ir — muda pelo poll. */
    activeId: string | null
}

const API = '/api/state'

// --- Capacidades do servidor ------------------------------------------------

let blobReady: boolean | null = null
let storeReady = true

function noteCaps(body: { blobReady?: boolean; storeReady?: boolean }) {
    if (typeof body.blobReady === 'boolean') blobReady = body.blobReady
    if (typeof body.storeReady === 'boolean') storeReady = body.storeReady
}

/** false = sem Redis: o mapa só existe neste processo do servidor. */
export const isMapStoreReady = () => storeReady

/** Se o servidor tem Blob configurado. Pergunta uma vez e guarda. */
export async function isBlobReady(): Promise<boolean> {
    if (blobReady === null) {
        try { await listMaps() } catch { blobReady = false }
    }
    return blobReady === true
}

async function getJson<T>(query: string): Promise<T> {
    const r = await fetch(`${API}?${query}`)
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.error || `Erro ${r.status}`)
    noteCaps(body)
    return body as T
}

async function post<T>(payload: unknown): Promise<T> {
    const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.error || `Erro ${r.status}`)
    noteCaps(body)
    return body as T
}

// --- Lista ------------------------------------------------------------------

export async function listMaps(): Promise<{ maps: MapSummary[]; activeId: string | null }> {
    return getJson('maps=1')
}

export async function createMap(name: string): Promise<MapSummary> {
    const body = await post<{ map: MapSummary }>({ action: 'map-create', name })
    return body.map
}

export async function renameMap(id: string, name: string): Promise<void> {
    await post({ action: 'map-rename', id, name })
    void loadMap(id)
}

/** Manda a mesa para este mapa (`null` = nenhum). */
export async function activateMap(id: string | null): Promise<void> {
    await post({ action: 'map-activate', id })
    for (const entry of entries.values()) setSnapshot(entry, { activeId: id })
}

export async function deleteMap(id: string): Promise<void> {
    await post({ action: 'map-delete', id })
    entries.delete(id)
}

/** Apaga uma imagem do Blob que deixou de ser usada (troca de token). */
export async function deleteBlobImage(url: string): Promise<void> {
    await post({ action: 'blob-delete', url }).catch(() => {})
}

// --- Store por mapa ---------------------------------------------------------

interface Entry {
    id: string
    snapshot: MapSnapshot
    listeners: Set<() => void>
    /** Campos escritos aqui que o servidor ainda não confirmou. */
    overrides: Map<string, unknown>
    /** PV de personagem mexido aqui: o servidor só vê depois do debounce do tableState. */
    pcOverrides: Map<string, { hp: HpStored; until: number }>
    pending: Map<string, unknown>
    writeTimer: ReturnType<typeof setTimeout> | null
    pollTimer: ReturnType<typeof setTimeout> | null
    polling: boolean
    lastChange: number
    /** Até quando o poll fica no ritmo de rajada (ver `BURST_MS`). */
    burstUntil: number
    /** Uma escrita no ar: a próxima espera, para não chegarem fora de ordem. */
    flushing: boolean
    loading: Promise<void> | null
}

const entries = new Map<string, Entry>()

function entryFor(id: string): Entry {
    let entry = entries.get(id)
    if (!entry) {
        entry = {
            id,
            snapshot: { data: null, error: null, activeId: null },
            listeners: new Set(),
            overrides: new Map(),
            pcOverrides: new Map(),
            pending: new Map(),
            writeTimer: null,
            pollTimer: null,
            polling: false,
            lastChange: Date.now(),
            burstUntil: 0,
            flushing: false,
            loading: null,
        }
        entries.set(id, entry)
    }
    return entry
}

function setSnapshot(entry: Entry, patch: Partial<MapSnapshot>) {
    entry.snapshot = { ...entry.snapshot, ...patch }
    entry.listeners.forEach((l) => l())
}

/** Prefixo do campo → onde ele mora no `MapData`. */
const BAGS = { pos: 'pos', hp: 'hp', drw: 'drawings', ping: 'pings', roll: 'rolls' } as const

/** Aplica um campo (`meta`, `pos:<id>`, `hp:<id>`, `drw:<id>`) numa cópia do mapa. */
function withField(data: MapData, field: string, value: unknown): MapData {
    if (field === 'meta') return { ...data, meta: value as MapMeta }
    const at = field.indexOf(':')
    const prop = BAGS[field.slice(0, at) as keyof typeof BAGS]
    if (!prop) return data
    const tid = field.slice(at + 1)
    const bag = { ...(data[prop] ?? {}) } as Record<string, unknown>
    if (value === null) delete bag[tid]
    else bag[tid] = value
    return { ...data, [prop]: bag }
}

function withOverrides(entry: Entry, data: MapData): MapData {
    let out = data
    for (const [field, value] of entry.overrides) out = withField(out, field, value)
    const now = Date.now()
    for (const [slug, o] of entry.pcOverrides) {
        if (o.until < now) { entry.pcOverrides.delete(slug); continue }
        out = { ...out, pcs: { ...out.pcs, [slug]: { ...out.pcs[slug], token: out.pcs[slug]?.token ?? null, hp: o.hp } } }
    }
    return out
}

/** O mapa que chegou do servidor vira o snapshot, por baixo do que ainda não subiu daqui. */
function applyMap(entry: Entry, map: MapData) {
    entry.lastChange = Date.now()
    setSnapshot(entry, { data: withOverrides(entry, map), error: null, activeId: map.activeId })
}

/** Baixa o mapa inteiro. Chamadas simultâneas dividem o mesmo pedido. */
export function loadMap(id: string): Promise<void> {
    const entry = entryFor(id)
    if (entry.loading) return entry.loading
    entry.loading = (async () => {
        try {
            const body = await getJson<{ map: MapData }>(`map=${encodeURIComponent(id)}`)
            applyMap(entry, body.map)
        } catch (error) {
            setSnapshot(entry, { error: error instanceof Error ? error.message : 'Erro ao abrir o mapa' })
        } finally {
            entry.loading = null
        }
    })()
    return entry.loading
}

// --- Poll ---------------------------------------------------------------------

/**
 * Ritmo do poll, em três marchas:
 * - RAJADA (700 ms) por 5 s depois de qualquer mudança, daqui ou de fora: na
 *   mesa uma ação puxa a seguinte (rola o ataque, move o token, aplica o dano),
 *   e é nessa hora que a demora aparece;
 * - RÁPIDO (1,5 s) enquanto houve mudança no último minuto;
 * - LENTO (4 s) com a mesa parada.
 *
 * A rajada é curta DE PROPÓSITO, e é o número a mexer com cuidado: cada poll é
 * um comando no Upstash (free: 500 mil/mês). Em combate as mudanças vêm a cada
 * poucos segundos, e uma janela longa deixaria os aparelhos na rajada o tempo
 * todo — 600 ms com janela de 8 s dava ~2,5× o gasto de antes e estourava a
 * cota com uma sessão por semana. Com 700 ms/5 s a conta fica em ~1,5× (ver o
 * CLAUDE.md).
 */
const BURST_MS = 700
const BURST_WINDOW_MS = 5000
const FAST_MS = 1500
const SLOW_MS = 4000
const QUIET_AFTER_MS = 60_000

function burst(entry: Entry) {
    entry.burstUntil = Date.now() + BURST_WINDOW_MS
}

function schedulePoll(entry: Entry, delay?: number) {
    if (entry.pollTimer) clearTimeout(entry.pollTimer)
    entry.pollTimer = null
    // Aba escondida não pede nada: celular com a tela apagada não gasta bateria
    // nem a cota do Redis. O `visibilitychange` religa.
    if (entry.listeners.size === 0 || document.hidden) return
    const now = Date.now()
    const wait = delay ?? (now < entry.burstUntil ? BURST_MS : now - entry.lastChange < QUIET_AFTER_MS ? FAST_MS : SLOW_MS)
    entry.pollTimer = setTimeout(() => { void poll(entry) }, wait)
}

async function poll(entry: Entry) {
    if (entry.polling) return
    entry.polling = true
    try {
        const data = entry.snapshot.data
        // Diz ao servidor o que já tem: se mudou, o mapa vem nesta mesma resposta.
        const known = data ? `&rev=${data.rev}&tableRev=${data.tableRev}` : ''
        const revs = await getJson<{ rev: number; tableRev: number; activeId: string | null; rollsRev?: number; map?: MapData }>(
            `mapRev=${encodeURIComponent(entry.id)}${known}`,
        )
        // O feed de rolagens lê o contador daqui e pausa o poll próprio.
        noteRollsRev(revs.rollsRev)
        if (revs.map) {
            applyMap(entry, revs.map)
            burst(entry)
        } else if (!data || revs.rev !== data.rev || revs.tableRev !== data.tableRev) {
            await loadMap(entry.id)
            burst(entry)
        } else if (revs.activeId !== entry.snapshot.activeId) {
            setSnapshot(entry, { activeId: revs.activeId })
        }
    } catch {
        // Rede caiu: tenta de novo no ritmo lento, sem derrubar a tela.
        entry.lastChange = 0
    } finally {
        entry.polling = false
        schedulePoll(entry)
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return
        for (const entry of entries.values()) {
            if (entry.listeners.size > 0) schedulePoll(entry, 0)
        }
    })
}

function subscribe(id: string, listener: () => void): () => void {
    const entry = entryFor(id)
    entry.listeners.add(listener)
    if (entry.listeners.size === 1) {
        if (!entry.snapshot.data) void loadMap(id).then(() => schedulePoll(entry))
        else schedulePoll(entry, 0)
    }
    return () => {
        entry.listeners.delete(listener)
        if (entry.listeners.size === 0 && entry.pollTimer) {
            clearTimeout(entry.pollTimer)
            entry.pollTimer = null
        }
    }
}

const EMPTY: MapSnapshot = { data: null, error: null, activeId: null }

/** O mapa, acompanhado pelo poll enquanto algum componente o estiver usando. */
export function useMapData(id: string | null): MapSnapshot {
    return useSyncExternalStore(
        (listener) => (id ? subscribe(id, listener) : () => {}),
        () => (id ? entryFor(id).snapshot : EMPTY),
        () => EMPTY,
    )
}

// --- Escrita ------------------------------------------------------------------

/** Junta os arrastos de um mesmo instante (soltar e logo arrastar outro). Rolagem
 *  e token solto não esperam: vão com `{ now: true }` (ver `writeMapField`). */
const WRITE_DEBOUNCE_MS = 150

/**
 * Grava `meta`, `pos:<id>` ou `hp:<id>` (`null` apaga). Otimista: a tela muda
 * agora e o campo fica como override até a escrita voltar.
 */
export function writeMapField(id: string, field: string, value: unknown, opts: { now?: boolean } = {}): void {
    const entry = entryFor(id)
    entry.overrides.set(field, value)
    entry.pending.set(field, value)
    entry.lastChange = Date.now()
    if (entry.snapshot.data) setSnapshot(entry, { data: withField(entry.snapshot.data, field, value) })

    if (entry.writeTimer) clearTimeout(entry.writeTimer)
    // `now`: o que os outros esperam ver na hora (a rolagem, o token solto).
    // Ainda por `setTimeout(0)`, para juntar o que for escrito no mesmo instante.
    entry.writeTimer = setTimeout(() => { void flushWrites(entry) }, opts.now ? 0 : WRITE_DEBOUNCE_MS)
    // Mudança feita aqui acelera o poll: a resposta dos outros vem logo atrás.
    burst(entry)
    schedulePoll(entry)
}

async function flushWrites(entry: Entry) {
    entry.writeTimer = null
    // Uma escrita por vez: sem espera nenhuma, dois arrastos seguidos do mesmo
    // token sairiam em dois pedidos que podem chegar invertidos — e o servidor
    // ficaria com a posição de antes. Quem chega no meio sai quando esta voltar.
    if (entry.flushing || entry.pending.size === 0) return
    entry.flushing = true
    const fields = Object.fromEntries(entry.pending)
    entry.pending.clear()
    try {
        const body = await post<{ rev: number }>({ action: 'map-write', id: entry.id, fields })
        // Só solta o override se ainda for o valor que subiu.
        for (const [field, value] of Object.entries(fields)) {
            if (entry.overrides.get(field) === value) entry.overrides.delete(field)
        }
        // A revisão só andou por causa desta escrita: não há o que baixar.
        const data = entry.snapshot.data
        if (data && body.rev === data.rev + 1) setSnapshot(entry, { data: { ...data, rev: body.rev } })
    } catch {
        // Volta para a fila; a próxima escrita (ou a próxima tentativa) leva junto.
        for (const [field, value] of Object.entries(fields)) {
            if (!entry.pending.has(field)) entry.pending.set(field, value)
        }
        entry.writeTimer = setTimeout(() => { void flushWrites(entry) }, 3000)
    } finally {
        entry.flushing = false
        if (entry.pending.size > 0 && !entry.writeTimer) void flushWrites(entry)
    }
}

/** Apaga todos os desenhos do mapa (fim do combate). */
export async function clearDrawings(id: string): Promise<void> {
    const entry = entryFor(id)
    // Desenho ainda na fila de subida voltaria depois da limpeza.
    for (const bag of [entry.overrides, entry.pending]) {
        for (const field of [...bag.keys()]) {
            if (field.startsWith('drw:')) bag.delete(field)
        }
    }
    if (entry.snapshot.data) setSnapshot(entry, { data: { ...entry.snapshot.data, drawings: {} } })
    await post({ action: 'map-clear-drawings', id })
    void loadMap(id)
}

/**
 * PV de personagem mexido no mapa. Vai para o MESMO campo `hp` que a Ficha
 * Virtual e a Iniciativa usam — o mapa não tem cópia própria do PV de ninguém.
 */
export function writePcHp(id: string, slug: string, hp: HpStored): void {
    saveField(slug, 'hp', hp)
    const entry = entryFor(id)
    // O tableState sobe com debounce de 600 ms; até o contador da mesa andar,
    // um poll traria o PV antigo de volta.
    entry.pcOverrides.set(slug, { hp, until: Date.now() + 5000 })
    entry.lastChange = Date.now()
    const data = entry.snapshot.data
    if (data) {
        setSnapshot(entry, {
            data: { ...data, pcs: { ...data.pcs, [slug]: { ...data.pcs[slug], token: data.pcs[slug]?.token ?? null, hp } } },
        })
    }
}

/**
 * A Iniciativa diz quem está no mapa. `hp` leva só os monstros cujo PV mudou
 * desde o último envio.
 * @returns a revisão do mapa depois da escrita.
 */
export async function syncTokens(
    id: string,
    tokens: Array<TokenDescriptor & { id: string }>,
    turn: string | null,
    hp: Record<string, Omit<NpcHp, 'updatedAt'>>,
): Promise<number> {
    const body = await post<{ rev: number }>({ action: 'map-sync', id, tokens, turn, hp })
    const entry = entries.get(id)
    if (entry && entry.listeners.size > 0) {
        entry.lastChange = Date.now()
        // Espera um carregamento em curso terminar: ele pode ter saído ANTES
        // desta escrita, e quem chamou precisa ver a revisão nova.
        if (entry.loading) await entry.loading
        void loadMap(id)
    }
    return body.rev
}

const SIZE_BY_SQUARES = ['medium', 'medium', 'large', 'huge', 'gargantuan'] as const

/**
 * Tokens de personagem com o tamanho de AGORA: um Enlarge ligado na Ficha
 * Virtual (campo `size` da mesa) faz o token crescer, um Shrink o encolhe.
 * Fica no cliente e não no `tok:` porque o `tok:` é da Iniciativa — o tamanho
 * original volta sozinho quando o efeito desliga, sem ninguém regravar nada.
 *
 * O token só sabe o lado em quadrados, então o tamanho base é deduzido dele
 * (1 quadrado = Médio) — é o que basta para a regra de "sem efeito em quem já
 * é Enorme".
 */
export function withPcSizes(data: MapData): MapData {
    let tokens: Record<string, TokenDescriptor> | null = null
    for (const [id, token] of Object.entries(data.tokens)) {
        if (token.kind !== 'pc' || !token.slug) continue
        const stored = sanitizeSizeEffect(data.pcs[token.slug]?.size)
        const base = SIZE_BY_SQUARES[Math.min(4, Math.max(1, token.size))]
        const effect = activeSizeEffect(stored, base)
        if (!effect) continue
        tokens ??= { ...data.tokens }
        tokens[id] = { ...token, size: sizeSquares(effect.size), tiny: effect.size === 'tiny' }
    }
    return tokens ? { ...data, tokens } : data
}
