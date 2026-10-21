// Cliente do mapa de combate (`/api/state?map…`).
//
// O mapa é ACOMPANHADO: quem arrasta um token espera que os outros vejam o
// movimento na hora. Cada campo que muda no banco é transmitido pelo Realtime
// no canal privado `mesa:<mesa>:map:<id>`, já com o valor e a REVISÃO da escrita
// que o mudou; o mapa inteiro só desce ao abrir e a cada (re)conexão. O PV, o
// token e o tamanho dos PCs chegam pelo canal do estado da mesa
// (`onStateChange`), e a lista e o mapa ativo pelo `mesa:<mesa>:maps`.
//
// Sem canal (sem Supabase, rede ruim), volta o poll de antes: lê só os
// contadores de revisão, e o mapa inteiro desce quando um deles mudou.
//
// Escrita é otimista e por campo, como em `tableState.ts`: a tela muda na hora
// e o valor fica como "override" até o servidor confirmar, para uma transmissão
// ou um poll que cheguem no meio não devolverem o token ao quadrado de antes.

import { useCallback, useSyncExternalStore } from 'react'
import { ensureStateLive, onStateChange, saveField } from './tableState'
import { listenMesaChannel } from './supabase'
import { onFeedActivity } from './rolls'
import type { HpStored } from '../modules/character-viewer/components/useHpTracker'
import { sizeSquares, type Cell, type ImageRect } from '../modules/battle-map/geometry'
import { activeSizeEffect, sanitizeSizeEffect } from '../modules/character-viewer/sizeEffects'
import { stateApi } from './mesa'

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
    /** Enquadramento que veio do companheiro de combate; o `fit:<id>` do mapa vale por cima. */
    fit?: { x: number; y: number; z: number }
    defeated?: boolean
    /** Deslocamento em pés — sem ele, o arrasto mostra só a distância. */
    speed?: number
    /**
     * Minúsculo: ocupa 1 quadrado (alvo de toque) mas é desenhado menor. A
     * Iniciativa grava o da criatura que É minúscula (`isTinySize`); o Shrink
     * de um personagem é aplicado só no cliente, por `withPcSizes`.
     */
    tiny?: boolean
    /** Posição do combatente na ordem de turnos da Iniciativa (0 = primeiro). */
    order?: number
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
    /** Só o Modo GM vê — quem não está nele nem recebe o mapa. */
    private?: boolean
    tokens: Record<string, TokenDescriptor>
    pos: Record<string, Cell>
    hp: Record<string, NpcHp>
    /** Enquadramento da imagem de cada token (centro e ampliação), cru — quem usa valida com `sanitizeFit`. */
    fit: Record<string, unknown>
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
}

export interface MapSummary { id: string; name: string; createdAt: number; hasImage: boolean; private: boolean }

export interface MapSnapshot {
    data: MapData | null
    error: string | null
    /** O mapa existe, mas é privado e quem olha não está no Modo GM. */
    hidden: boolean
    /** Mapa para onde a mesa deve ir — muda pelo poll. */
    activeId: string | null
}


// --- Capacidades do servidor ------------------------------------------------

let storeReady = true

function noteCaps(body: { storeReady?: boolean }) {
    if (typeof body.storeReady === 'boolean') storeReady = body.storeReady
}

/** false = sem banco: o mapa só existe neste processo do servidor. */
export const isMapStoreReady = () => storeReady

/** Erro de resposta com o corpo junto — o 403 do mapa privado traz os contadores. */
class ApiError extends Error {
    readonly body: Record<string, unknown>
    constructor(message: string, body: Record<string, unknown>) {
        super(message)
        this.body = body
    }
}

async function getJson<T>(query: string): Promise<T> {
    const r = await fetch(stateApi(`?${query}`))
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new ApiError(body.error || `Erro ${r.status}`, body)
    noteCaps(body)
    return body as T
}

async function post<T>(payload: unknown): Promise<T> {
    const r = await fetch(stateApi(), {
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

/** `gm`: inclui os mapas privados (Modo GM, Iniciativa). */
export async function listMaps(opts: { gm?: boolean } = {}): Promise<{ maps: MapSummary[]; activeId: string | null }> {
    return getJson(opts.gm ? 'maps=1&gm=1' : 'maps=1')
}

export async function createMap(name: string): Promise<MapSummary> {
    const body = await post<{ map: MapSummary }>({ action: 'map-create', name })
    return body.map
}

export async function renameMap(id: string, name: string): Promise<void> {
    await post({ action: 'map-rename', id, name })
    void loadMap(id)
}

/** Esconde o mapa da mesa (só o Modo GM vê) ou o revela. */
export async function setMapVisibility(id: string, isPrivate: boolean): Promise<void> {
    await post({ action: 'map-visibility', id, private: isPrivate })
    if (entries.has(id)) void loadMap(id)
}

/** Manda a mesa para este mapa (`null` = nenhum). O servidor revela o mapa junto. */
export async function activateMap(id: string | null): Promise<void> {
    await post({ action: 'map-activate', id })
    for (const entry of entries.values()) setSnapshot(entry, { activeId: id })
    if (id && entries.has(id)) void loadMap(id)
}

export async function deleteMap(id: string): Promise<void> {
    await post({ action: 'map-delete', id })
    entries.delete(id)
}

/** Apaga uma imagem que deixou de ser usada (troca de token). Quem apaga é o servidor. */
export async function deleteStoredImage(url: string): Promise<void> {
    await post({ action: 'image-delete', url }).catch(() => {})
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
    /** Lê como o Modo GM (`&gm=1`): enxerga o mapa mesmo privado. */
    gm: boolean
    /**
     * Contadores do mapa privado que este aparelho não pode ver. Com eles o poll
     * de quem espera a revelação segue sendo só o MGET; sem, cada volta baixaria
     * o hash inteiro para ouvir "privado" de novo.
     */
    hiddenRevs: { rev: number; tableRev: number } | null
    /** O canal do mapa está aberto: nada de poll. */
    live: boolean
    /** Sai do canal (quando ninguém mais olha o mapa). */
    stopLive: (() => void) | null
    /** Revisão da última leitura inteira: transmissão até ela já estava dentro. */
    loadedRev: number
    /** A revisão mais nova aplicada em cada campo — transmissão mais velha é descartada. */
    fieldRev: Map<string, number>
    /**
     * Campos transmitidos depois da última leitura inteira. Uma leitura que saiu
     * ANTES deles e chegou depois (a da reconexão, a da aba que voltou) não pode
     * desfazê-los: são reaplicados por cima dela.
     */
    recent: Map<string, { rev: number; value: unknown }>
}

const entries = new Map<string, Entry>()

// Rolagem ou regra compartilhada nova na mesa: marcha rápida, sem rajada nem
// download do mapa — a mesa está ativa, e a próxima ação costuma vir logo.
onFeedActivity(() => { for (const entry of entries.values()) entry.lastChange = Date.now() })

function entryFor(id: string): Entry {
    let entry = entries.get(id)
    if (!entry) {
        entry = {
            id,
            snapshot: { data: null, error: null, activeId: null, hidden: false },
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
            gm: false,
            hiddenRevs: null,
            live: false,
            stopLive: null,
            loadedRev: 0,
            fieldRev: new Map(),
            recent: new Map(),
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
const BAGS = { pos: 'pos', hp: 'hp', fit: 'fit', drw: 'drawings', ping: 'pings', roll: 'rolls' } as const

/** Aplica um campo (`meta`, `turn`, `tok:<id>`, `pos:<id>`, `hp:<id>`, `drw:<id>`…) numa cópia do mapa. */
function withField(data: MapData, field: string, value: unknown): MapData {
    if (field === 'meta') return value === null ? data : { ...data, meta: value as MapMeta }
    if (field === 'turn') return { ...data, turn: (value as string | null) ?? null }
    if (field.startsWith('tok:')) {
        const tokens = { ...data.tokens }
        if (value === null) delete tokens[field.slice(4)]
        else tokens[field.slice(4)] = value as TokenDescriptor
        return { ...data, tokens }
    }
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
    entry.hiddenRevs = null
    entry.loadedRev = Math.max(entry.loadedRev, map.rev)
    let data = map
    for (const [field, { rev, value }] of entry.recent) {
        if (rev > map.rev) data = { ...withField(data, field, value), rev: Math.max(data.rev, rev) }
        else entry.recent.delete(field)
    }
    setSnapshot(entry, { data: withOverrides(entry, data), error: null, activeId: map.activeId, hidden: false })
}

/** O mapa ficou (ou continua) privado para este aparelho: some da tela. */
function applyHidden(entry: Entry, revs: { rev: number; tableRev: number }) {
    entry.hiddenRevs = { rev: revs.rev, tableRev: revs.tableRev }
    setSnapshot(entry, { data: null, error: null, hidden: true })
}

const gmParam = (entry: Entry) => (entry.gm ? '&gm=1' : '')

/** Baixa o mapa inteiro. Chamadas simultâneas dividem o mesmo pedido. */
export function loadMap(id: string): Promise<void> {
    const entry = entryFor(id)
    if (entry.loading) return entry.loading
    entry.loading = (async () => {
        try {
            const body = await getJson<{ map: MapData }>(`map=${encodeURIComponent(id)}${gmParam(entry)}`)
            applyMap(entry, body.map)
        } catch (error) {
            if (error instanceof ApiError && error.body.private === true) {
                applyHidden(entry, { rev: Number(error.body.rev) || 0, tableRev: Number(error.body.tableRev) || 0 })
                return
            }
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
 * - RÁPIDO (1,5 s) enquanto houve mudança no último minuto — inclusive rolagem
 *   ou regra compartilhada nova, que não baixa o mapa mas é a mesa em ação: sem
 *   isso, quem está no mapa via o cartão até 4 s depois dos outros;
 * - LENTO (2 s) com a mesa parada. Era 4 s; a mesa joga 1–2 vezes por mês e a
 *   cota tem folga, e o primeiro movimento depois de uma pausa demorava.
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
const SLOW_MS = 2000
const QUIET_AFTER_MS = 60_000

function burst(entry: Entry) {
    entry.burstUntil = Date.now() + BURST_WINDOW_MS
}

function schedulePoll(entry: Entry, delay?: number) {
    if (entry.pollTimer) clearTimeout(entry.pollTimer)
    entry.pollTimer = null
    // Com o canal aberto não há poll. Aba escondida não pede nada: celular com a
    // tela apagada não gasta bateria. O `visibilitychange` religa.
    if (entry.live || entry.listeners.size === 0 || document.hidden) return
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
        const have = data ?? entry.hiddenRevs
        const known = have ? `&rev=${have.rev}&tableRev=${have.tableRev}` : ''
        const revs = await getJson<{
            rev: number; tableRev: number; activeId: string | null; map?: MapData; hidden?: boolean
        }>(`mapRev=${encodeURIComponent(entry.id)}${known}${gmParam(entry)}`)
        if (revs.map) {
            applyMap(entry, revs.map)
            burst(entry)
        } else if (revs.hidden) {
            // O GM escondeu o mapa (ou mexeu nele, ainda privado).
            applyHidden(entry, revs)
            setSnapshot(entry, { activeId: revs.activeId })
        } else if (!have || revs.rev !== have.rev || revs.tableRev !== have.tableRev) {
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
            if (entry.listeners.size === 0) continue
            // Com o canal: relê uma vez (o socket pode ter morrido sem avisar).
            if (entry.live) void loadMap(entry.id)
            else schedulePoll(entry, 0)
        }
    })
}

// --- Tempo real -----------------------------------------------------------------

interface FieldMessage { field?: unknown; value?: unknown; updatedAt?: unknown; rev?: unknown }

/**
 * Um campo que o banco transmitiu. Fica de fora o que este aparelho ainda está
 * gravando (o override é mais novo) e o que for mais velho que o que já se tem —
 * o eco atrasado de um arrasto não devolve o token ao quadrado anterior.
 */
function applyRemoteField(entry: Entry, msg: FieldMessage) {
    const { field, rev } = msg
    const data = entry.snapshot.data
    if (!data || typeof field !== 'string' || typeof rev !== 'number') return
    if (rev <= entry.loadedRev || rev <= (entry.fieldRev.get(field) ?? 0)) return
    entry.fieldRev.set(field, rev)
    if (entry.overrides.has(field) || entry.pending.has(field)) return
    if (field === 'imgs' || field === 'private') return
    let value = msg.value ?? null
    // O PV do monstro leva o `updatedAt` junto, como na leitura inteira.
    if (field.startsWith('hp:') && value && typeof value === 'object' && typeof msg.updatedAt === 'number') {
        value = { ...(value as object), updatedAt: msg.updatedAt }
    }
    entry.lastChange = Date.now()
    entry.recent.set(field, { rev, value })
    setSnapshot(entry, { data: { ...withField(data, field, value), rev: Math.max(data.rev, rev) } })
    // Personagem que acabou de entrar no mapa: o PV e o token dele vêm na leitura inteira.
    const token = value as TokenDescriptor | null
    if (field.startsWith('tok:') && token?.kind === 'pc' && token.slug && !(token.slug in data.pcs)) void loadMap(entry.id)
}

function applyRemotePrivate(entry: Entry, msg: { private?: unknown; rev?: unknown }) {
    if (typeof msg.private !== 'boolean') return
    const data = entry.snapshot.data
    if (msg.private && !entry.gm) {
        applyHidden(entry, { rev: Number(msg.rev) || 0, tableRev: data?.tableRev ?? 0 })
    } else if (!msg.private && entry.snapshot.hidden) {
        void loadMap(entry.id)
    } else if (data) {
        setSnapshot(entry, { data: { ...data, private: msg.private } })
    }
}

function startLive(entry: Entry) {
    if (entry.stopLive) return
    // Marca antes da promessa: duas montagens seguidas não abrem dois canais.
    entry.stopLive = () => {}
    startMesaMaps()
    void listenMesaChannel(
        `map:${entry.id}`,
        {
            field: (p) => applyRemoteField(entry, p as FieldMessage),
            private: (p) => applyRemotePrivate(entry, p as { private?: unknown; rev?: unknown }),
        },
        (live) => {
            entry.live = live
            // A cada (re)conexão, o mapa inteiro: o que mudou com o canal fechado.
            if (live && entry.listeners.size > 0) void loadMap(entry.id)
            schedulePoll(entry)
        },
    ).then((stop) => {
        if (!stop) { entry.stopLive = null; return }
        // Saíram do mapa enquanto o canal abria.
        if (entry.listeners.size === 0) { stop(); entry.stopLive = null; entry.live = false; return }
        entry.stopLive = () => { stop(); entry.live = false }
    })
}

function stopLive(entry: Entry) {
    entry.stopLive?.()
    entry.stopLive = null
    entry.live = false
}

let mesaMapsStarted = false

/**
 * O canal da lista (`mesa:<mesa>:maps`): o mapa ativo ("Levar a mesa") e as
 * mudanças na lista. E o do estado da mesa, por onde chegam o PV, o token e o
 * tamanho dos personagens que estão nos mapas abertos.
 */
function startMesaMaps() {
    if (mesaMapsStarted) return
    mesaMapsStarted = true
    ensureStateLive()
    void listenMesaChannel('maps', {
        changed: (p) => {
            const payload = p as { activeId?: unknown }
            if ('activeId' in payload) {
                const activeId = typeof payload.activeId === 'string' ? payload.activeId : null
                for (const entry of entries.values()) setSnapshot(entry, { activeId })
            }
            mapsListeners.forEach((l) => l())
        },
    }, () => {}).then((stop) => { if (!stop) mesaMapsStarted = false })
}

const PC_FIELDS = new Set(['hp', 'token', 'size'])

onStateChange((slug, field, value) => {
    if (!PC_FIELDS.has(field)) return
    for (const entry of entries.values()) {
        const data = entry.snapshot.data
        if (!data || !(slug in data.pcs)) continue
        // O PV que este mapa acabou de mexer já está na tela (e é o mais novo).
        if (field === 'hp' && entry.pcOverrides.has(slug)) continue
        const pc = data.pcs[slug]
        setSnapshot(entry, { data: { ...data, pcs: { ...data.pcs, [slug]: { ...pc, [field]: value } } } })
    }
})

const mapsListeners = new Set<() => void>()

/** A lista de mapas mudou (criado, apagado, renomeado, escondido) — quem mostra a lista relê. */
export function onMapsChanged(listener: () => void): () => void {
    mapsListeners.add(listener)
    return () => { mapsListeners.delete(listener) }
}

function subscribe(id: string, gm: boolean, listener: () => void): () => void {
    const entry = entryFor(id)
    entry.listeners.add(listener)
    if (entry.gm !== gm) {
        // Ligar o Modo GM sobre um mapa escondido o mostra; desligar sobre um
        // privado o esconde — nos dois casos o que está na tela não vale mais.
        entry.gm = gm
        if (entry.snapshot.data || entry.snapshot.hidden) {
            void loadMap(id).then(() => schedulePoll(entry))
            return () => unsubscribe(entry, listener)
        }
    }
    if (entry.listeners.size === 1) {
        startLive(entry)
        if (!entry.snapshot.data) void loadMap(id).then(() => schedulePoll(entry))
        else schedulePoll(entry, 0)
    }
    return () => unsubscribe(entry, listener)
}

function unsubscribe(entry: Entry, listener: () => void) {
    entry.listeners.delete(listener)
    if (entry.listeners.size > 0) return
    if (entry.pollTimer) {
        clearTimeout(entry.pollTimer)
        entry.pollTimer = null
    }
    stopLive(entry)
}

const EMPTY: MapSnapshot = { data: null, error: null, activeId: null, hidden: false }

/**
 * O mapa, acompanhado pelo poll enquanto algum componente o estiver usando.
 * `gm`: lê como o Modo GM — sem ele, mapa privado chega como `hidden`.
 */
export function useMapData(id: string | null, gm = false): MapSnapshot {
    const sub = useCallback(
        (listener: () => void) => (id ? subscribe(id, gm, listener) : () => {}),
        [id, gm],
    )
    return useSyncExternalStore(
        sub,
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
        // Só solta o override se ainda for o valor que subiu. E a transmissão
        // desta escrita (ou de uma anterior, atrasada) não volta a tela para trás.
        for (const [field, value] of Object.entries(fields)) {
            if (entry.overrides.get(field) === value) entry.overrides.delete(field)
            if (typeof body.rev === 'number') entry.fieldRev.set(field, Math.max(entry.fieldRev.get(field) ?? 0, body.rev))
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
