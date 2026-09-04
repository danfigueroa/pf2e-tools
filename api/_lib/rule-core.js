// A regra de um termo, DIRETO DO AON E EM INGLÊS.
//
// Serve às caixinhas de regra da ficha de monstro: passar o mouse sobre uma
// condição, uma habilidade ("Grab" aparece na ficha só como nome e ação), um
// traço ou uma magia e ler o texto sem sair da mesa.
//
// **NÃO passa pela cadeia de tradução, de propósito.** É o mesmo motivo de
// `creature-core.js` e `spell-list-core.js` — um hover por termo estouraria o
// rate limit do tier gratuito —, e desta vez também é o pedido: a prosa das
// habilidades do monstro já fica em inglês no módulo, e uma caixa traduzida ao
// lado de um bloco em inglês seria a mistura pior.
//
// Por isso, e só por isso, o inglês daqui PODE ser cacheado: a regra "nada de
// cachear inglês" (ver `aon.js`) existe para tradução que FALHOU e precisa ser
// tentada de novo. Aqui o inglês é o resultado pretendido, não um acidente.

import { searchAonRaw } from './aon.js'
import { isLegacy, toArray } from './creature-core.js'

const AON_BASE = 'https://2e.aonprd.com'

/**
 * As categorias do índice que valem como "regra", e a ordem em que se procura
 * quando quem chama não sabe o tipo. `creature-ability` vem primeiro porque é
 * a categoria das habilidades de monstro (Grab, Ferocity, Trample) — as mesmas
 * que a ficha imprime sem prosa nenhuma.
 */
export const RULE_KINDS = ['creature-ability', 'condition', 'trait', 'spell', 'action', 'rules']

/** Rótulos de metadado que interessam numa caixa de regra. O resto é catálogo. */
const KEEP_LABELS = new Set([
  'requirements', 'trigger', 'effect', 'frequency', 'prerequisites',
  'cast', 'range', 'area', 'targets', 'target', 'duration',
  'saving throw', 'defense', 'critical success', 'success', 'failure',
  'critical failure', 'special', 'activate',
])

const delink = (text) => String(text || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')

function clean(text) {
  return delink(text)
    .replace(/<actions\s+string="([^"]+)"\s*\/?>/gi, ' [$1] ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * O texto da regra a partir do `markdown` do índice.
 *
 * Corta o `<title>` e a linha de fonte, e — nas entradas que têm o separador
 * `---` (magias) — guarda do cabeçalho só os rótulos mecânicos. Sem isso a
 * caixa de uma magia começaria com as onze divindades que a concedem, e a
 * regra ficaria fora da tela.
 */
function ruleText(markdown, maxLength = 1400) {
  const md = String(markdown || '')
    .replace(/<title[\s\S]*?<\/title>/i, '')
    .replace(/<traits>[\s\S]*?<\/traits>/i, '')

  const parts = md.split(/\n\s*---\s*\n/)
  const head = parts.length > 1 ? parts[0] : ''
  const body = parts.length > 1 ? parts.slice(1).join('\n\n') : md

  const meta = []
  for (const match of head.matchAll(/\*\*([^*]+)\*\*\s*([^\n]*(?:\n(?!\s*\*\*|\s*<)[^\n]*)*)/g)) {
    const label = match[1].trim().toLowerCase()
    if (!KEEP_LABELS.has(label)) continue
    const value = clean(match[2])
    if (value) meta.push(`${match[1].trim()} ${value}`)
  }

  const prose = clean(body)
    // A linha de fonte não é regra e come duas linhas da caixa.
    .replace(/^Source\s+[^\n]*\n?/i, '')
    .trim()

  const text = [meta.join('; '), prose].filter(Boolean).join('\n\n')
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text
}

function normalize(hit) {
  const s = hit?._source
  if (!s || !s.name) return null
  const url = String(s.url || '')
  return {
    name: s.name,
    category: s.category || null,
    // Em magia, `level` é o rank; nas outras categorias costuma não existir.
    level: Number.isFinite(s.level) ? s.level : null,
    actions: s.actions || null,
    traits: toArray(s.trait),
    text: ruleText(s.markdown),
    url: url.startsWith('http') ? url : AON_BASE + url,
  }
}

/** Nome exato ganha de relevância, e a reimpressão remaster ganha da legacy. */
function pickHit(hits, name) {
  const wanted = String(name || '').trim().toLowerCase()
  const usable = hits.filter((h) => h?._source?.name)
  if (usable.length === 0) return null
  const exact = usable.filter((h) => h._source.name.toLowerCase() === wanted)
  const pool = exact.length > 0 ? exact : []
  if (pool.length === 0) return null
  return pool.find((h) => !isLegacy(h._source)) || pool[0]
}

/**
 * @param {string} name termo em inglês, como está escrito na ficha
 * @param {string|null} kind categoria preferida; sem ela, tenta a lista inteira
 * @returns {Promise<object|null>} a regra, ou `null` quando o AON não tem o termo
 */
export async function resolveRule(name, kind = null) {
  const term = String(name || '').trim()
  if (!term) return null

  // A categoria pedida primeiro: "Attack of Opportunity" existe como talento,
  // como feature de classe E como habilidade de criatura, e numa ficha de
  // monstro a que vale é a última.
  const order = kind && RULE_KINDS.includes(kind)
    ? [kind, ...RULE_KINDS.filter((k) => k !== kind)]
    : RULE_KINDS

  for (const category of order) {
    const { hits } = await searchAonRaw({ query: term, category, limit: 8 })
    const hit = pickHit(hits, term)
    if (hit) return normalize(hit)
  }
  return null
}
