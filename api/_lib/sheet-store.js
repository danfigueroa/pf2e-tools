// Fichas publicadas pela mesa: o JSON do Pathbuilder que um jogador subiu
// depois de atualizar o personagem, mais o guia "Como Jogar" gerado para ela.
//
// No Postgres (migration `fichas_publicadas`), FORA do estado da mesa
// (`table-store.js`) de propósito: o estado é lido inteiro a cada abertura de
// ficha, e carregar junto 8 KB de ficha e 7 KB de guia toda vez seria
// desperdício. A ficha muda no level-up; o PV muda a cada golpe.
//
//   sheets          (mesa, slug) → json, nome, classe, nível, publishedAt, guia, quem publicou
//   sheet_versions  o HISTÓRICO: cada versão substituída (até 30 por ficha), com o guia dela
//
// Publicar e restaurar são funções do banco (`publish_sheet`, `restore_sheet`),
// numa transação com a linha travada: duas publicações ao mesmo tempo não
// arquivam a mesma versão duas vezes.
//
// As fichas são da mesa: a mesma pessoa pode ter um personagem de mesmo nome em
// duas mesas, e a lista de uma não mostra a outra. Sem prazo de validade: uma
// ficha publicada é a fonte da verdade do personagem.
//
// Não há login — qualquer pessoa da mesa publica. A salvaguarda é o histórico,
// que volta com um clique; `published_by` guarda a sessão anônima de quem
// publicou, quando o aparelho mandou uma.

import { supabase } from './supabase.js'

/** Teto do JSON publicado. A maior ficha real (Nathaniel) tem 8,2 KB. */
export const MAX_SHEET_BYTES = 64 * 1024
/** Teto do guia de base que o cliente manda para a IA atualizar. */
export const MAX_GUIDE_BYTES = 16 * 1024

// Mesmo algoritmo de `charSlugFromName` em `src/modules/character-viewer/charId.ts`:
// é a MESMA identidade do estado da mesa, então os dois têm de concordar.
// Personagem renomeado no Pathbuilder mantém o slug antigo (token, PV e ficha publicada moram nele).
// Espelha `SLUG_ALIASES` de `charId.ts`.
const SLUG_ALIASES = { 'thalos-alba': 'thalos' }

export function slugFromName(name) {
  const slug = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  const final = slug || 'sem-nome'
  return SLUG_ALIASES[final] || final
}

/** Um export do Pathbuilder tem `build` com nome, classe e nível. */
export function sheetInfo(json) {
  const b = json && typeof json === 'object' ? json.build : null
  if (!b || typeof b !== 'object') return null
  if (typeof b.name !== 'string' || !b.name.trim()) return null
  if (typeof b.level !== 'number') return null
  return { name: b.name.trim(), className: String(b.class || ''), level: b.level }
}

// --- Armazenamento ------------------------------------------------------------
//
// O Postgres e, sem credenciais, Maps de processo por mesa (mesma política do
// estado da mesa). Erro do banco sobe: o handler responde 500.

const fromRow = (row) => row && {
  json: row.json,
  name: row.name,
  className: row.class_name,
  level: row.level,
  publishedAt: Number(row.published_at),
  guide: row.guide ?? null,
  ownerId: row.owner_id ?? null,
}

const fromVersionRow = (row) => row && {
  id: Number(row.id),
  level: row.level,
  publishedAt: Number(row.published_at),
  archivedAt: Date.parse(row.archived_at),
  guide: row.guide ?? null,
}

const dbStore = (db) => {
  const check = ({ data, error }) => {
    if (error) throw error
    return data
  }
  const SHEET_COLUMNS = 'json, name, class_name, level, published_at, guide, owner_id'
  return {
    current: async (mesa, slug) => fromRow(check(await db.from('sheets').select(SHEET_COLUMNS)
      .eq('mesa', mesa).eq('slug', slug).maybeSingle())),
    /** As versões do histórico, a mais recente primeiro. `withGuide` traz o markdown junto. */
    versions: async (mesa, slug, limit, withGuide = false) =>
      check(await db.from('sheet_versions')
        .select(withGuide ? 'id, level, published_at, archived_at, guide' : 'id, level, published_at, archived_at, has_guide:guide->generatedAt')
        .eq('mesa', mesa).eq('slug', slug).order('id', { ascending: false }).limit(limit))
        .map((row) => ({ ...fromVersionRow(row), hasGuide: withGuide ? !!row.guide : row.has_guide != null })),
    list: async (mesa) => check(await db.from('sheets')
      .select('slug, name, class_name, level, published_at, owner_id, guide_at:guide->generatedAt').eq('mesa', mesa))
      .map((row) => ({ slug: row.slug, ...fromRow(row), hasGuide: row.guide_at != null })),
    publish: async (mesa, slug, json, info, by) => fromRow(check(await db.rpc('publish_sheet', {
      p_mesa: mesa, p_slug: slug, p_json: json, p_name: info.name, p_class: info.className, p_level: info.level, p_by: by,
    }))),
    saveGuide: async (mesa, slug, publishedAt, guide) => fromRow(check(await db.from('sheets').update({ guide })
      .eq('mesa', mesa).eq('slug', slug).eq('published_at', publishedAt).select(SHEET_COLUMNS).maybeSingle())),
    restore: async (mesa, slug, version, by) => fromRow(check(await db.rpc('restore_sheet', {
      p_mesa: mesa, p_slug: slug, p_version: version, p_by: by,
    }))),
  }
}

const MAX_VERSIONS = 30

const memoryStore = (() => {
  const sheets = new Map()
  const history = new Map()
  let nextId = 1
  const key = (mesa, slug) => `${mesa}|${slug}`
  const archive = (mesa, slug) => {
    const cur = sheets.get(key(mesa, slug))
    if (!cur) return
    const list = history.get(key(mesa, slug)) ?? []
    list.unshift({ ...cur, id: nextId++, archivedAt: Date.now() })
    history.set(key(mesa, slug), list.slice(0, MAX_VERSIONS))
  }
  return {
    current: async (mesa, slug) => sheets.get(key(mesa, slug)) ?? null,
    versions: async (mesa, slug, limit) => (history.get(key(mesa, slug)) ?? []).slice(0, limit)
      .map((v) => ({ id: v.id, level: v.level, publishedAt: v.publishedAt, archivedAt: v.archivedAt, guide: v.guide, hasGuide: !!v.guide })),
    list: async (mesa) => [...sheets.entries()]
      .filter(([k]) => k.startsWith(`${mesa}|`))
      .map(([k, rec]) => ({ slug: k.slice(mesa.length + 1), ...rec, hasGuide: !!rec.guide })),
    publish: async (mesa, slug, json, info) => {
      archive(mesa, slug)
      const rec = { json, ...info, publishedAt: Date.now(), guide: null }
      sheets.set(key(mesa, slug), rec)
      return rec
    },
    saveGuide: async (mesa, slug, publishedAt, guide) => {
      const cur = sheets.get(key(mesa, slug))
      if (!cur || cur.publishedAt !== publishedAt) return null
      cur.guide = guide
      return cur
    },
    restore: async (mesa, slug, version) => {
      const list = history.get(key(mesa, slug)) ?? []
      const i = version == null ? 0 : list.findIndex((v) => v.id === version)
      if (!sheets.has(key(mesa, slug)) || i < 0 || !list[i]) return null
      const [target] = list.splice(i, 1)
      archive(mesa, slug)
      const rec = { json: target.json, name: target.name, className: target.className, level: target.level, publishedAt: Date.now(), guide: target.guide }
      sheets.set(key(mesa, slug), rec)
      return rec
    },
  }
})()

const store = () => {
  const db = supabase()
  return db ? dbStore(db) : memoryStore
}

/** O registro como o cliente o conhece, com a versão anterior resumida (`previous`). */
async function publicView(db, mesa, slug, record) {
  if (!record) return null
  const [previous] = await db.versions(mesa, slug, 1)
  return {
    slug,
    json: record.json,
    name: record.name,
    className: record.className,
    level: record.level,
    publishedAt: record.publishedAt,
    guide: record.guide ?? null,
    ownerId: record.ownerId ?? null,
    previous: previous ? { publishedAt: previous.publishedAt, level: previous.level ?? null } : null,
  }
}

export async function readSheet(mesa, slug) {
  const db = store()
  return publicView(db, mesa, slug, await db.current(mesa, slug))
}

/** A lista, sem o JSON de cada ficha — é o que os cards da tela inicial precisam. */
export async function listSheets(mesa) {
  const rows = await store().list(mesa)
  return rows
    .map(({ slug, name, className, level, publishedAt, hasGuide, ownerId }) => ({ slug, name, className, level, publishedAt, hasGuide, ownerId: ownerId ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** O histórico da ficha, a mais recente primeiro, sem o JSON (só o que uma lista mostra). */
export async function listSheetVersions(mesa, slug) {
  const versions = await store().versions(mesa, slug, MAX_VERSIONS)
  return versions.map(({ id, level, publishedAt, archivedAt, hasGuide }) => ({ id, level, publishedAt, archivedAt, hasGuide }))
}

/**
 * Publica uma versão nova. A atual vai para o histórico, e o guia recomeça
 * vazio: o guia da ficha antiga não descreve a nova, e quem publicou pede a
 * geração logo em seguida. `by` = a sessão anônima de quem publicou (ou null).
 */
export async function publishSheet(mesa, slug, json, by = null) {
  const db = store()
  return publicView(db, mesa, slug, await db.publish(mesa, slug, json, sheetInfo(json), by))
}

/**
 * Grava o guia gerado — só se a ficha ainda for a mesma que o gerou. Duas
 * publicações seguidas não podem terminar com o guia da primeira na segunda.
 */
export async function saveGuide(mesa, slug, publishedAt, markdown) {
  const db = store()
  const saved = await db.saveGuide(mesa, slug, publishedAt, { markdown, generatedAt: Date.now() })
  return publicView(db, mesa, slug, saved)
}

/**
 * Volta a uma versão do histórico — a mais recente quando `version` é null. A
 * atual vai para o histórico, então restaurar de novo desfaz o desfazer.
 */
export async function restorePrevious(mesa, slug, version = null, by = null) {
  const db = store()
  return publicView(db, mesa, slug, await db.restore(mesa, slug, version, by))
}

/** Só para a geração do guia: o JSON atual e o guia da versão anterior. */
export async function readForGuide(mesa, slug) {
  const db = store()
  const [rec, [previous]] = await Promise.all([db.current(mesa, slug), db.versions(mesa, slug, 1, true)])
  if (!rec) return null
  return { json: rec.json, publishedAt: rec.publishedAt, previousGuide: previous?.guide?.markdown ?? null }
}

/**
 * Faz de `userId` o dono da ficha — só se ela ainda não tem um. Roda logo depois da
 * PRIMEIRA publicação, e o `is null` impede que uma segunda chamada tome a ficha de
 * quem já a tem. Sem Supabase não há dono.
 */
export async function claimSheet(mesa, slug, userId) {
  const db = supabase()
  if (!db || !userId) return
  const { error } = await db.from('sheets').update({ owner_id: userId })
    .eq('mesa', mesa).eq('slug', slug).is('owner_id', null)
  if (error) throw error
}
