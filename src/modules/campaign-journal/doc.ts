// Os documentos do Diário de Campanha e a validação de cada um.
//
// Um documento é uma SESSÃO (uma página por sessão: preparação, cenas,
// encontros, elenco, registro e resumo), uma ficha do CATÁLOGO da campanha (os
// mesmos tipos e campos de uma página da Wiki — reaproveitada entre sessões) ou
// um GANCHO (pista, segredo, pendência, com estado aberto → revelado → resolvido).
//
// O servidor confere só a forma e o tamanho (`api/_lib/journal-store.js`); o
// conteúdo é validado AQUI, ao ler — da API ou do rascunho no `localStorage`.

import type { AonCreature } from '../../services/creatures'
import { WIKI_KINDS, type WikiAon, type WikiKind } from '../../services/wiki'
import { KIND_LABEL as WIKI_KIND_LABEL } from '../wiki/kinds'
import { tr } from '../../i18n'

/** O catálogo tem os tipos da Wiki: a ficha vai inteira para lá (decisão do usuário). */
export type CatalogKind = WikiKind
export type DocKind = 'session' | CatalogKind | 'thread'

export const CATALOG_KINDS: readonly CatalogKind[] = WIKI_KINDS

export const KIND_LABEL: Record<DocKind, { one: string; many: string }> = {
    session: { one: tr('Sessão', 'Session'), many: tr('Sessões', 'Sessions') },
    ...WIKI_KIND_LABEL,
    thread: { one: tr('Gancho', 'Hook'), many: tr('Ganchos', 'Hooks') },
}

export type SceneStatus = 'planned' | 'done' | 'skipped'
export type EncounterStatus = 'planned' | 'sent' | 'done'
export type ThreadStatus = 'open' | 'revealed' | 'resolved'

export const LOG_TAGS = ['combate', 'saque', 'decisao', 'npc', 'pista'] as const // i18n-ok: chaves
export type LogTag = typeof LOG_TAGS[number]
export const LOG_TAG_LABEL: Record<LogTag, string> = {
    combate: tr('Combate', 'Combat'), saque: tr('Saque', 'Loot'), decisao: tr('Decisão', 'Decision'), npc: 'NPC', pista: tr('Pista', 'Clue'),
}

export interface Scene { id: string; title: string; md: string; status: SceneStatus }

export interface PlannedCreature {
    creature: AonCreature
    count: number
    /** Nível-alvo do Escalar Monstro; ausente = a criatura como a AON a publica. */
    level?: number
}

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
    /** Fichas do catálogo e ganchos que aparecem nesta sessão, e páginas da Wiki (`wiki:<id>`). */
    links: string[]
    log: LogEntry[]
    recap: string
    /** Grupo do planejador de encontros: `null` = o das fichas publicadas. */
    party: { level: number; size: number } | null
    /** A página da Wiki da Mesa onde o resumo foi publicado como crônica. */
    chronicle: string | null
}

/** O mesmo modelo de uma página da Wiki (`WikiPage`), mais a ligação com ela. */
export interface CatalogData {
    image: string | null
    md: string
    tags: string[]
    /** Outros nomes: `[[ ]]` acha a ficha por eles também. */
    aliases: string[]
    /** Uma linha, como o resumo da Wiki. */
    summary: string
    /** A ficha rápida do tipo (`INFOBOX`), texto curto por campo. */
    fields: Record<string, string>
    /** A ficha da AON ligada (criatura, ou NPC com stat block). */
    aon: WikiAon | null
    /** A ficha-mãe no catálogo ("Fica em"). */
    parent: string | null
    /** A página da Wiki da Mesa ligada a esta ficha (a parte que a mesa conhece). */
    wiki: string | null
}

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
    /** Só sessão: as fichas e ganchos ligados a ela. */
    links: string[]
    /** Só ficha: a ficha-mãe e as pílulas da ficha rápida. */
    parent: string | null
    badges: { status?: string; attitude?: string; part?: string }
}

// ── Limites (o documento inteiro cabe em 256 KB no banco) ────────────────────

const MAX_TEXT = 60_000
const MAX_SCENES = 60
const MAX_ENCOUNTERS = 30
const MAX_CREATURES = 20
export const MAX_LOG = 500
const MAX_LINKS = 200
const MAX_TAGS = 12
// Os mesmos tetos do `wiki-store.js` (a ficha vira página sem perder nada).
const MAX_ALIASES = 10
const MAX_FIELDS = 30
const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9]{0,30}$/
const AON_URL_RE = /^https:\/\/2e\.aonprd\.com\/[\w./?=&%-]{1,280}$/

export const ID_RE = /^[a-z0-9-]{1,64}$/
/** Uma página da Wiki da Mesa (o id de `services/wiki.ts`). */
export const WIKI_ID_RE = /^w-[a-z0-9]{6,32}$/
/** No elenco da sessão, a página da Wiki vai como `wiki:<id>`. */
export const WIKI_LINK_PREFIX = 'wiki:'
const isLink = (x: string) => ID_RE.test(x) || (x.startsWith(WIKI_LINK_PREFIX) && WIKI_ID_RE.test(x.slice(WIKI_LINK_PREFIX.length)))
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
const links = (v: unknown, max: number) => [...new Set(arr(v).filter((x): x is string => typeof x === 'string' && isLink(x)))].slice(0, max)
const wikiId = (v: unknown) => (typeof v === 'string' && WIKI_ID_RE.test(v) ? v : null)

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
        links: [], log: [], recap: '', party: null, chronicle: null,
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
                    if (!creature) return []
                    const level = Number.isInteger(pc.level) && (pc.level as number) !== creature.level
                        ? Math.min(25, Math.max(-1, pc.level as number)) : undefined
                    return [{ creature, count, ...(level !== undefined ? { level } : {}) }]
                }),
            }
        }),
        links: links(d.links, MAX_LINKS),
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
        chronicle: wikiId(d.chronicle),
    }
}

const uniqueLines = (v: unknown, maxItems: number, maxLen: number) => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const x of arr(v)) {
        const s = line(x, maxLen).trim()
        if (!s || seen.has(s.toLowerCase())) continue
        seen.add(s.toLowerCase())
        out.push(s)
        if (out.length >= maxItems) break
    }
    return out
}

function fieldsOf(raw: unknown): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj(raw))) {
        if (Object.keys(out).length >= MAX_FIELDS) break
        if (!FIELD_KEY_RE.test(k) || k === 'aon' || typeof v !== 'string') continue
        const s = line(v, 300).trim()
        if (s) out[k] = s
    }
    return out
}

/** As pílulas da ficha (as mesmas que a lista da Wiki mostra; `badgesOf` do `wiki-store.js`). */
export function badgesOf(fields: Record<string, string>): JournalSummary['badges'] {
    const out: JournalSummary['badges'] = {}
    if (fields.status) out.status = fields.status.slice(0, 40)
    if (fields.attitude) out.attitude = fields.attitude.slice(0, 40)
    if (fields.part) out.part = fields.part.slice(0, 120)
    return out
}

export function aonOf(raw: unknown): WikiAon | null {
    const a = obj(raw)
    const name = line(a.name, 120).trim()
    if (!name) return null
    return {
        name,
        level: Number.isInteger(a.level) && (a.level as number) >= -1 && (a.level as number) <= 30 ? a.level as number : null,
        url: typeof a.url === 'string' && AON_URL_RE.test(a.url) ? a.url : null,
        traits: uniqueLines(a.traits, 16, 40),
    }
}

function catalogData(raw: unknown): CatalogData {
    const d = obj(raw)
    return {
        image: typeof d.image === 'string' && d.image.length <= 500 ? d.image : null,
        md: str(d.md, MAX_TEXT),
        tags: [...new Set(arr(d.tags).map((t) => line(t, 30).trim()).filter(Boolean))].slice(0, MAX_TAGS),
        aliases: uniqueLines(d.aliases, MAX_ALIASES, 120),
        summary: line(d.summary, 300).trim(),
        fields: fieldsOf(d.fields),
        aon: aonOf(d.aon),
        parent: typeof d.parent === 'string' && ID_RE.test(d.parent) ? d.parent : null,
        wiki: wikiId(d.wiki),
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
        title: line(r.title, 200).trim() || tr('Sem título', 'Untitled'),
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
        title: line(r.title, 200) || tr('Sem título', 'Untitled'),
        sort: Number.isInteger(r.sort) ? r.sort as number : 0,
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
        image: typeof r.image === 'string' ? r.image : null,
        status: typeof r.status === 'string' ? r.status : null,
        links: links(r.links, MAX_LINKS),
        parent: typeof r.parent === 'string' && ID_RE.test(r.parent) && r.parent !== r.id ? r.parent : null,
        badges: Object.fromEntries((['status', 'attitude', 'part'] as const)
            .map((k) => [k, obj(r.badges)[k]])
            .filter(([, v]) => typeof v === 'string' && v)) as JournalSummary['badges'],
    }
}

/** Documento novo, já com o modelo da seção quando há um. */
export function newDoc(kind: DocKind, title: string, opts: { number?: number; md?: string } = {}): JournalDoc {
    const base: Base = { id: newId(kind === 'session' ? 's' : kind === 'thread' ? 'g' : 'f'), title, sort: opts.number ?? 0, updatedAt: null }
    if (kind === 'session') return { ...base, kind, data: { ...emptySession(opts.number ?? 0), prep: opts.md ?? '' } }
    if (kind === 'thread') return { ...base, kind, data: { md: opts.md ?? '', status: 'open', introducedIn: null, resolvedIn: null } }
    return { ...base, kind, data: { image: null, md: opts.md ?? '', tags: [], aliases: [], summary: '', fields: {}, aon: null, parent: null, wiki: null } }
}

/** Para o servidor (`journal-save`): sem o `updatedAt`, que ele mesmo dá. */
export const wireDoc = (doc: JournalDoc) => ({ id: doc.id, kind: doc.kind, title: doc.title, sort: doc.sort, data: doc.data })
