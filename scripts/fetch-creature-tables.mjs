// Gera src/modules/monster-scaler/data/creatureTables.ts a partir das tabelas de
// construção de criaturas do GM Core, publicadas no índice do Archives of Nethys.
//
// Rode à mão: `node scripts/fetch-creature-tables.mjs`
//
// POR QUE BUSCAR EM VEZ DE DIGITAR: são dez tabelas de 26 linhas cada — 1.400
// números que, digitados à mão, erram em silêncio e viram monstro errado na
// mesa. O AON publica as mesmas tabelas como <table> HTML dentro do campo
// `markdown` da categoria `rules`, então dá para transcrever da fonte e
// reconferir o diff.
//
// POR QUE GERAR UM .ts EM VEZ DE BUSCAR EM TEMPO REAL: são regras estáticas.
// Buscar a cada geração de stat block acrescentaria latência e um modo de falha
// a uma conta que é pura consulta de tabela.

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../src/modules/monster-scaler/data/creatureTables.ts')

const ES = 'https://elasticsearch.aonprd.com/aon/_search'

// Nome exato da regra no AON → como a tabela sai daqui.
const WANTED = [
  'Attribute Modifiers',
  'Perception',
  'Skills',
  'Armor Class',
  'Saving Throws',
  'Hit Points',
  'Immunities, Weaknesses, and Resistances',
  'Strike Attack Bonus',
  'Strike Damage',
  'Spell DC and Spell Attack Modifier',
]

// ---------------------------------------------------------------------------
// Leitura das células
// ---------------------------------------------------------------------------

/**
 * O AON escreve nível negativo e faixa com TRAVESSÃO (– U+2013), não hífen, e
 * usa TRAÇO LONGO (— U+2014) para "não existe" (a coluna Extrema de Atributos
 * nos níveis baixos). Confundir os dois vira NaN silencioso.
 */
const EN_DASH = '–'
const EM_DASH = '—'

const cellText = (html) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()

function parseTables(markdown) {
  return [...markdown.matchAll(/<table>([\s\S]*?)<\/table>/g)].map((t) =>
    [...t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
      [...r[1].matchAll(/<t[dh]>([\s\S]*?)<\/t[dh]>/g)].map((c) => cellText(c[1])),
    ),
  )
}

/** "–1" → -1, "24" → 24. */
function parseLevel(raw) {
  const n = parseInt(raw.replace(new RegExp(EN_DASH, 'g'), '-'), 10)
  if (!Number.isFinite(n)) throw new Error(`nível ilegível: ${JSON.stringify(raw)}`)
  return n
}

/** "+9" → 9, "20" → 20, "—" → null. */
function parseNum(raw) {
  if (!raw || raw === EM_DASH || raw === '-') return null
  const n = parseInt(raw.replace(new RegExp(EN_DASH, 'g'), '-').replace('+', ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Faixas aparecem em dois dialetos: PV como "508–492" (travessão, maior
 * primeiro) e perícia Baixa como "+38 to +33". Valor único ("9") vira faixa de
 * um ponto só, para o consumidor não precisar de dois caminhos.
 */
function parseRange(raw) {
  if (!raw || raw === EM_DASH) return null
  const parts = raw.split(new RegExp(`\\s*(?:${EN_DASH}|\\bto\\b)\\s*`)).map(parseNum)
  if (parts.length === 1 || parts[1] === null) {
    return parts[0] === null ? null : { max: parts[0], min: parts[0] }
  }
  const [a, b] = parts
  return { max: Math.max(a, b), min: Math.min(a, b) }
}

/** "4d12+42 (68)" → { formula: '4d12+42', average: 68 }. */
function parseDamage(raw) {
  if (!raw || raw === EM_DASH) return null
  const m = raw.match(/^(.+?)\s*\((\d+)\)$/)
  if (!m) return { formula: raw.trim(), average: null }
  return { formula: m[1].trim(), average: parseInt(m[2], 10) }
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/** Cabeçalho "Extreme"/"High"/… → chave do nosso Record. */
const COLUMN_KEY = {
  extreme: 'extreme',
  high: 'high',
  moderate: 'moderate',
  low: 'low',
  terrible: 'terrible',
}

/**
 * Tabela de coluna simples: uma chave por coluna do livro, um valor por nível.
 * `read` decide se a célula é número, faixa ou fórmula de dano.
 */
function buildByColumn(rows, read) {
  const header = rows[0].map((h) => h.toLowerCase())
  const out = {}
  for (const row of rows.slice(1)) {
    if (row.length < 2) continue
    const level = parseLevel(row[0])
    const entry = {}
    for (let i = 1; i < row.length; i += 1) {
      const key = COLUMN_KEY[header[i]]
      if (!key) continue
      const value = read(row[i])
      if (value !== null) entry[key] = value
    }
    out[level] = entry
  }
  return out
}

/** Magias trazem DC e ataque na MESMA linha, dois campos por coluna. */
function buildSpellTable(rows) {
  const header = rows[0].map((h) => h.toLowerCase())
  const out = {}
  for (const row of rows.slice(1)) {
    if (row.length < 2) continue
    const level = parseLevel(row[0])
    const entry = {}
    for (let i = 1; i < row.length; i += 1) {
      const label = header[i]
      const column = ['extreme', 'high', 'moderate'].find((c) => label.startsWith(c))
      if (!column) continue
      const value = parseNum(row[i])
      if (value === null) continue
      if (!entry[column]) entry[column] = {}
      entry[column][label.includes('attack') ? 'attack' : 'dc'] = value
    }
    out[level] = entry
  }
  return out
}

/** Resistências: colunas Maximum/Minimum, não o degrau habitual. */
function buildResistanceTable(rows) {
  const out = {}
  for (const row of rows.slice(1)) {
    if (row.length < 3) continue
    out[parseLevel(row[0])] = { max: parseNum(row[1]), min: parseNum(row[2]) }
  }
  return out
}

// ---------------------------------------------------------------------------

async function fetchRules() {
  const res = await fetch(ES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: 40,
      _source: ['name', 'url', 'markdown'],
      query: {
        bool: {
          filter: [
            { term: { category: 'rules' } },
            { term: { 'source.keyword': 'GM Core' } },
            { terms: { 'name.keyword': WANTED } },
          ],
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`AON respondeu ${res.status}`)
  const data = await res.json()

  const byName = new Map()
  for (const hit of data.hits.hits) {
    const s = hit._source
    const tables = parseTables(s.markdown || '')
    // Várias páginas do GM Core repetem o mesmo nome; vale a que tem tabela.
    if (tables.length > 0 && !byName.has(s.name)) {
      byName.set(s.name, { rows: tables[0], url: s.url })
    }
  }

  const faltando = WANTED.filter((n) => !byName.has(n))
  if (faltando.length > 0) {
    throw new Error(`Sem tabela para: ${faltando.join(', ')}`)
  }
  return byName
}

const serialize = (value) =>
  JSON.stringify(value, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, '$1:')

async function main() {
  const rules = await fetchRules()
  const rows = (name) => rules.get(name).rows

  const tables = {
    AC_TABLE: buildByColumn(rows('Armor Class'), parseNum),
    HP_TABLE: buildByColumn(rows('Hit Points'), parseRange),
    PERCEPTION_TABLE: buildByColumn(rows('Perception'), parseNum),
    SAVE_TABLE: buildByColumn(rows('Saving Throws'), parseNum),
    ATTRIBUTE_TABLE: buildByColumn(rows('Attribute Modifiers'), parseNum),
    SKILL_TABLE: buildByColumn(rows('Skills'), parseRange),
    STRIKE_ATTACK_TABLE: buildByColumn(rows('Strike Attack Bonus'), parseNum),
    STRIKE_DAMAGE_TABLE: buildByColumn(rows('Strike Damage'), parseDamage),
    SPELL_TABLE: buildSpellTable(rows('Spell DC and Spell Attack Modifier')),
    RESISTANCE_TABLE: buildResistanceTable(
      rows('Immunities, Weaknesses, and Resistances'),
    ),
  }

  // Toda tabela do livro vai de -1 a 24. Uma linha a menos significa parse
  // quebrado, e é melhor falhar aqui do que gerar número errado.
  for (const [name, table] of Object.entries(tables)) {
    const levels = Object.keys(table).map(Number)
    if (levels.length !== 26 || Math.min(...levels) !== -1 || Math.max(...levels) !== 24) {
      throw new Error(`${name}: esperava níveis -1..24, veio ${levels.length} linha(s)`)
    }
  }

  const banner = `// GERADO por scripts/fetch-creature-tables.mjs — não editar à mão.
//
// Tabelas de construção de criaturas do GM Core (pg. 112-121), transcritas do
// índice do Archives of Nethys. Níveis -1 a 24.
//
// Coluna ausente é ausente de propósito: a tabela de Atributos não tem valor
// Extremo nos níveis baixos, e só Percepção e Salvamentos têm coluna Terrível.
`

  const types = `
/** Degrau do benchmark. O AON usa os mesmos rótulos nos campos \`*_scale\`. */
export type ScaleColumn = 'extreme' | 'high' | 'moderate' | 'low' | 'terrible'

/** Faixa fechada. PV e perícia Baixa vêm assim no livro. */
export interface Band { max: number; min: number }

export interface DamageBenchmark { formula: string; average: number | null }

export type ByLevel<T> = Record<number, Partial<Record<ScaleColumn, T>>>
`

  const decls = [
    ['AC_TABLE', 'ByLevel<number>'],
    ['HP_TABLE', 'ByLevel<Band>'],
    ['PERCEPTION_TABLE', 'ByLevel<number>'],
    ['SAVE_TABLE', 'ByLevel<number>'],
    ['ATTRIBUTE_TABLE', 'ByLevel<number>'],
    ['SKILL_TABLE', 'ByLevel<Band>'],
    ['STRIKE_ATTACK_TABLE', 'ByLevel<number>'],
    ['STRIKE_DAMAGE_TABLE', 'ByLevel<DamageBenchmark>'],
    ['SPELL_TABLE', 'Record<number, Partial<Record<ScaleColumn, { dc?: number; attack?: number }>>>'],
    ['RESISTANCE_TABLE', 'Record<number, Band>'],
  ]

  const body = decls
    .map(([name, type]) => `export const ${name}: ${type} = ${serialize(tables[name])}`)
    .join('\n\n')

  const footer = `
/** Menor e maior nível que as tabelas cobrem. */
export const MIN_LEVEL = -1
export const MAX_LEVEL = 24

export const TABLES_SOURCE = 'GM Core pg. 112-121'
`

  writeFileSync(OUT, `${banner}${types}\n${body}\n${footer}`, 'utf8')
  console.log(`✓ ${OUT}`)
  for (const [name, table] of Object.entries(tables)) {
    console.log(`  ${name.padEnd(22)} -1: ${JSON.stringify(table[-1])}`)
  }
}

main().catch((e) => {
  console.error('✗', e.message)
  process.exit(1)
})
