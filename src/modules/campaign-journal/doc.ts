// Os documentos do Diário de Campanha e a validação de cada um.
//
// Um documento é uma SESSÃO (uma página por sessão: preparação, cenas,
// encontros, elenco, registro e resumo), uma ficha do CATÁLOGO da campanha (NPC,
// local, item, facção, outro — reaproveitada entre sessões) ou um GANCHO (pista,
// segredo, pendência, com estado aberto → revelado → resolvido).
//
// O servidor confere só a forma e o tamanho (`api/_lib/journal-store.js`); o
// conteúdo é validado AQUI, ao ler — da API ou do rascunho no `localStorage`.

import type { AonCreature } from '../../services/creatures'

export type CatalogKind = 'npc' | 'location' | 'item' | 'faction' | 'other'
export type DocKind = 'session' | CatalogKind | 'thread'

export const CATALOG_KINDS: readonly CatalogKind[] = ['npc', 'location', 'item', 'faction', 'other']

export const KIND_LABEL: Record<DocKind, { one: string; many: string }> = {
    session: { one: 'Sessão', many: 'Sessões' },
    npc: { one: 'NPC', many: 'NPCs' },
    location: { one: 'Local', many: 'Locais' },
    item: { one: 'Item', many: 'Itens' },
    faction: { one: 'Facção', many: 'Facções' },
    other: { one: 'Outro', many: 'Outros' },
    thread: { one: 'Gancho', many: 'Ganchos' },
}

export type SceneStatus = 'planned' | 'done' | 'skipped'
export type EncounterStatus = 'planned' | 'sent' | 'done'
export type ThreadStatus = 'open' | 'revealed' | 'resolved'

export const LOG_TAGS = ['combate', 'saque', 'decisao', 'npc', 'pista'] as const
export type LogTag = typeof LOG_TAGS[number]
export const LOG_TAG_LABEL: Record<LogTag, string> = {
    combate: 'Combate', saque: 'Saque', decisao: 'Decisão', npc: 'NPC', pista: 'Pista',
}

export interface Scene { id: string; title: string; md: string; status: SceneStatus }

export interface PlannedCreature { creature: AonCreature; count: number }

export interface PlannedEncounter {
    id: string
    title: string
    md: string
    creatures: PlannedCreature[]
    status: EncounterStatus
}

export interface LogEntry { id: string; at: number; tag: LogTag | null; text: string }

export interface SessionData {
    number: number
    /** Data marcada (YYYY-MM-DD), da agenda do GM. */
    plannedFor: string | null
    /** O dia de jogo em que foi jogada (o mesmo do Histórico de Rolagens). */
    playedOn: string | null
    status: 'planned' | 'played'
    prep: string
    scenes: Scene[]
    encounters: PlannedEncounter[]
    /** Fichas do catálogo e ganchos que aparecem nesta sessão. */
    links: string[]
    log: LogEntry[]
    recap: string
    /** Grupo do planejador de encontros: `null` = o das fichas publicadas. */
    party: { level: number; size: number } | null
}

export interface CatalogData { image: string | null; md: string; tags: string[] }

export interface ThreadData {
    md: string
    status: ThreadStatus
    introducedIn: string | null
    resolvedIn: string | null
}

interface Base { id: string; title: string; sort: number; updatedAt: number | null }
export type SessionDoc = Base & { kind: 'session'; data: SessionData }
export type CatalogDoc = Base & { kind: CatalogKind; data: CatalogData }
export type ThreadDoc = Base & { kind: 'thread'; data: ThreadData }
export type JournalDoc = SessionDoc | CatalogDoc | ThreadDoc

/** O que a lista do diário recebe (`?journal=list`): sem o `data`. */
export interface JournalSummary {
    id: string
    kind: DocKind
    title: string
    sort: number
    updatedAt: number
    image: string | null
    status: string | null
}

// ── Limites (o documento inteiro cabe em 256 KB no banco) ────────────────────

const MAX_TEXT = 60_000
const MAX_SCENES = 60
const MAX_ENCOUNTERS = 30
const MAX_CREATURES = 20
export const MAX_LOG = 500
const MAX_LINKS = 200
const MAX_TAGS = 12

export const ID_RE = /^[a-z0-9-]{1,64}$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const line = (v: unknown, max: number) => str(v, max).replace(/[\n\r\t]+/g, ' ')
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
    (list.includes(v as T) ? v as T : fallback)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {})
const idOr = (v: unknown, prefix: string) => (typeof v === 'string' && ID_RE.test(v) ? v : newId(prefix))
const day = (v: unknown) => (typeof v === 'string' && DAY_RE.test(v) ? v : null)
const ids = (v: unknown, max: number) => [...new Set(arr(v).filter((x): x is string => typeof x === 'string' && ID_RE.test(x)))].slice(0, max)

function creatureOf(raw: unknown): AonCreature | null {
    const c = obj(raw)
    if (typeof c.name !== 'string' || !c.name || !Number.isInteger(c.level)) return null
    if (typeof c.hp !== 'number' || typeof c.ac !== 'number') return null
    // Vem da AON pela busca de criaturas; o planejador só lê nome, nível e o que a Iniciativa precisa.
    return c as unknown as AonCreature
}

export function emptySession(number: number): SessionData {
    return {
        number, plannedFor: null, playedOn: null, status: 'planned', prep: '', scenes: [], encounters: [],
        links: [], log: [], recap: '', party: null,
    }
}

function sessionData(raw: unknown): SessionData {
    const d = obj(raw)
    const party = obj(d.party)
    return {
        number: Number.isInteger(d.number) ? d.number as number : 0,
        plannedFor: day(d.plannedFor),
        playedOn: day(d.playedOn),
        status: oneOf(d.status, ['planned', 'played'] as const, 'planned'),
        prep: str(d.prep, MAX_TEXT),
        scenes: arr(d.scenes).slice(0, MAX_SCENES).map((s) => {
            const x = obj(s)
            return { id: idOr(x.id, 'c'), title: line(x.title, 120), md: str(x.md, MAX_TEXT), status: oneOf(x.status, ['planned', 'done', 'skipped'] as const, 'planned') }
        }),
        encounters: arr(d.encounters).slice(0, MAX_ENCOUNTERS).map((e) => {
            const x = obj(e)
            return {
                id: idOr(x.id, 'e'),
                title: line(x.title, 120),
                md: str(x.md, MAX_TEXT),
                status: oneOf(x.status, ['planned', 'sent', 'done'] as const, 'planned'),
                creatures: arr(x.creatures).slice(0, MAX_CREATURES).flatMap((p) => {
                    const pc = obj(p)
                    const creature = creatureOf(pc.creature)
                    const count = Number.isInteger(pc.count) ? Math.min(20, Math.max(1, pc.count as number)) : 1
                    return creature ? [{ creature, count }] : []
                }),
            }
        }),
        links: ids(d.links, MAX_LINKS),
        log: arr(d.log).slice(-MAX_LOG).flatMap((l) => {
            const x = obj(l)
            const text = str(x.text, 2000).trim()
            if (!text || typeof x.at !== 'number') return []
            const tag = (LOG_TAGS as readonly unknown[]).includes(x.tag) ? x.tag as LogTag : null
            return [{ id: idOr(x.id, 'r'), at: x.at, tag, text }]
        }),
        recap: str(d.recap, MAX_TEXT),
        party: Number.isInteger(party.level) && Number.isInteger(party.size)
            ? { level: Math.min(25, Math.max(-1, party.level as number)), size: Math.min(12, Math.max(1, party.size as number)) }
            : null,
    }
}

function catalogData(raw: unknown): CatalogData {
    const d = obj(raw)
    return {
        image: typeof d.image === 'string' && d.image.length <= 500 ? d.image : null,
        md: str(d.md, MAX_TEXT),
        tags: [...new Set(arr(d.tags).map((t) => line(t, 30).trim()).filter(Boolean))].slice(0, MAX_TAGS),
    }
}

function threadData(raw: unknown): ThreadData {
    const d = obj(raw)
    return {
        md: str(d.md, MAX_TEXT),
        status: oneOf(d.status, ['open', 'revealed', 'resolved'] as const, 'open'),
        introducedIn: typeof d.introducedIn === 'string' && ID_RE.test(d.introducedIn) ? d.introducedIn : null,
        resolvedIn: typeof d.resolvedIn === 'string' && ID_RE.test(d.resolvedIn) ? d.resolvedIn : null,
    }
}

const KINDS: readonly DocKind[] = ['session', ...CATALOG_KINDS, 'thread']

/** Um documento válido, com os padrões preenchidos, ou `null`. */
export function sanitizeDoc(raw: unknown): JournalDoc | null {
    const r = obj(raw)
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return null
    if (!KINDS.includes(r.kind as DocKind)) return null
    const base: Base = {
        id: r.id,
        title: line(r.title, 200).trim() || 'Sem título',
        sort: Number.isInteger(r.sort) ? r.sort as number : 0,
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : null,
    }
    if (r.kind === 'session') return { ...base, kind: 'session', data: sessionData(r.data) }
    if (r.kind === 'thread') return { ...base, kind: 'thread', data: threadData(r.data) }
    return { ...base, kind: r.kind as CatalogKind, data: catalogData(r.data) }
}

export function sanitizeSummary(raw: unknown): JournalSummary | null {
    const r = obj(raw)
    if (typeof r.id !== 'string' || !ID_RE.test(r.id) || !KINDS.includes(r.kind as DocKind)) return null
    return {
        id: r.id,
        kind: r.kind as DocKind,
        title: line(r.title, 200) || 'Sem título',
        sort: Number.isInteger(r.sort) ? r.sort as number : 0,
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
        image: typeof r.image === 'string' ? r.image : null,
        status: typeof r.status === 'string' ? r.status : null,
    }
}

/** Documento novo, já com o modelo da seção quando há um. */
export function newDoc(kind: DocKind, title: string, opts: { number?: number; md?: string } = {}): JournalDoc {
    const base: Base = { id: newId(kind === 'session' ? 's' : kind === 'thread' ? 'g' : 'f'), title, sort: opts.number ?? 0, updatedAt: null }
    if (kind === 'session') return { ...base, kind, data: { ...emptySession(opts.number ?? 0), prep: opts.md ?? '' } }
    if (kind === 'thread') return { ...base, kind, data: { md: opts.md ?? '', status: 'open', introducedIn: null, resolvedIn: null } }
    return { ...base, kind, data: { image: null, md: opts.md ?? '', tags: [] } }
}

/** Para o servidor (`journal-save`): sem o `updatedAt`, que ele mesmo dá. */
export const wireDoc = (doc: JournalDoc) => ({ id: doc.id, kind: doc.kind, title: doc.title, sort: doc.sort, data: doc.data })
