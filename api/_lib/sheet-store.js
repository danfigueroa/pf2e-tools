// Fichas publicadas pela mesa: o JSON do Pathbuilder que um jogador subiu
// depois de atualizar o personagem, mais o guia "Como Jogar" gerado para ela.
//
// Fica FORA do hash do estado da mesa (`table-store.js`) de propósito: aquele
// hash é lido inteiro (HGETALL) a cada abertura de ficha e a cada "Atualizar",
// e carregar junto 8 KB de ficha e 7 KB de guia toda vez seria desperdício. A
// ficha muda no level-up; o PV muda a cada golpe.
//
//   pf2e:sheet:v1:<slug> → { json, name, className, level, publishedAt,
//                            guide: { markdown, generatedAt } | null,
//                            previous: { json, publishedAt, guide } | null }
//   pf2e:sheets:v1       → SET com os slugs publicados (para a lista)
//
// Sem TTL: ao contrário do PV, uma ficha publicada é a fonte da verdade do
// personagem, e sumir em seis meses seria perder o level-up de alguém.
//
// Não há login — qualquer pessoa da mesa publica. A salvaguarda é a versão
// anterior guardada (`previous`), que volta com um clique.

import { redis } from './table-store.js'

const KEY_PREFIX = 'pf2e:sheet:v1:'
const INDEX_KEY = 'pf2e:sheets:v1'

/** Teto do JSON publicado. A maior ficha real (Nathaniel) tem 8,2 KB. */
export const MAX_SHEET_BYTES = 64 * 1024
/** Teto do guia de base que o cliente manda para a IA atualizar. */
export const MAX_GUIDE_BYTES = 16 * 1024

// Mesmo algoritmo de `charSlugFromName` em `src/modules/character-viewer/charId.ts`:
// é a MESMA identidade do estado da mesa, então os dois têm de concordar.
export function slugFromName(name) {
  const slug = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return slug || 'sem-nome'
}

/** Um export do Pathbuilder tem `build` com nome, classe e nível. */
export function sheetInfo(json) {
  const b = json && typeof json === 'object' ? json.build : null
  if (!b || typeof b !== 'object') return null
  if (typeof b.name !== 'string' || !b.name.trim()) return null
  if (typeof b.level !== 'number') return null
  return { name: b.name.trim(), className: String(b.class || ''), level: b.level }
}

// Sem Redis, um Map de processo — mesma política do estado da mesa.
const memory = new Map()

async function readRaw(slug) {
  const r = redis()
  const raw = r ? await r.get(KEY_PREFIX + slug) : memory.get(slug)
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return null }
}

async function writeRaw(slug, record) {
  const r = redis()
  if (!r) { memory.set(slug, JSON.stringify(record)); return }
  await r.set(KEY_PREFIX + slug, JSON.stringify(record))
  await r.sadd(INDEX_KEY, slug)
}

/** O registro sem o JSON da versão anterior — que só interessa ao restaurar. */
function publicView(slug, record) {
  if (!record) return null
  return {
    slug,
    json: record.json,
    name: record.name,
    className: record.className,
    level: record.level,
    publishedAt: record.publishedAt,
    guide: record.guide ?? null,
    previous: record.previous
      ? { publishedAt: record.previous.publishedAt, level: record.previous.level ?? null }
      : null,
  }
}

export async function readSheet(slug) {
  return publicView(slug, await readRaw(slug))
}

/** A lista, sem o JSON de cada ficha — é o que os cards da tela inicial precisam. */
export async function listSheets() {
  const r = redis()
  const slugs = r ? await r.smembers(INDEX_KEY) : [...memory.keys()]
  const records = await Promise.all(slugs.map(async (slug) => [slug, await readRaw(slug)]))
  return records
    .filter(([, rec]) => rec)
    .map(([slug, rec]) => ({
      slug,
      name: rec.name,
      className: rec.className,
      level: rec.level,
      publishedAt: rec.publishedAt,
      hasGuide: !!rec.guide,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Publica uma versão nova. A atual vira `previous` (só uma, não histórico), e o
 * guia recomeça vazio: o guia da ficha antiga não descreve a nova, e quem
 * publicou pede a geração logo em seguida.
 */
export async function publishSheet(slug, json) {
  const info = sheetInfo(json)
  const current = await readRaw(slug)
  const record = {
    json,
    ...info,
    publishedAt: Date.now(),
    guide: null,
    previous: current
      ? { json: current.json, level: current.level, publishedAt: current.publishedAt, guide: current.guide ?? null }
      : null,
  }
  await writeRaw(slug, record)
  return publicView(slug, record)
}

/**
 * Grava o guia gerado — só se a ficha ainda for a mesma que o gerou. Duas
 * publicações seguidas não podem terminar com o guia da primeira na segunda.
 */
export async function saveGuide(slug, publishedAt, markdown) {
  const current = await readRaw(slug)
  if (!current || current.publishedAt !== publishedAt) return null
  current.guide = { markdown, generatedAt: Date.now() }
  await writeRaw(slug, current)
  return publicView(slug, current)
}

/** Troca a versão atual pela anterior (e vice-versa: desfazer o desfazer). */
export async function restorePrevious(slug) {
  const current = await readRaw(slug)
  if (!current?.previous) return null
  const prev = current.previous
  const info = sheetInfo(prev.json)
  const record = {
    json: prev.json,
    ...info,
    publishedAt: Date.now(),
    guide: prev.guide ?? null,
    previous: { json: current.json, level: current.level, publishedAt: current.publishedAt, guide: current.guide ?? null },
  }
  await writeRaw(slug, record)
  return publicView(slug, record)
}

/** Só para a geração do guia: o JSON atual e o guia da versão anterior. */
export async function readForGuide(slug) {
  const rec = await readRaw(slug)
  if (!rec) return null
  return { json: rec.json, publishedAt: rec.publishedAt, previousGuide: rec.previous?.guide?.markdown ?? null }
}
