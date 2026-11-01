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

import { searchAonRaw, translateSegments, hasTranslationKey, runChainedPrompt } from './aon.js'
import { isLegacy, toArray } from './creature-core.js'
import { cachedLookup } from './lookup-cache.js'

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


// --- Traços de arma, em português, em lote e já no banco ------------------------------------------

export const MAX_TRAIT_RULES = 30

/**
 * O traço de arma como a AON o registra: "Deadly d10" → "Deadly", "Fatal 1d10" → "Fatal",
 * "Volley 30 ft." → "Volley", "Versatile S" → "Versatile", "Twin (Sheath)" → "Twin".
 * (`traitName` em `character-viewer/weaponTraits.ts` é a mesma conta — mudou uma, muda a outra.)
 */
export function weaponTraitName(raw) {
  return String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d*d\d+\b/gi, ' ')
    .replace(/\d+\s*(?:feet|foot|ft\.?)?/gi, ' ')
    .replace(/^(versatile|modular)\b.*$/i, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * O vocabulário que a ficha já usa para os traços (o mesmo de `transformation-statblock/i18n.ts`).
 * O que não está aqui é traduzido pela cadeia e fica no banco. (`TRAIT_PT` em `weaponTraits.ts` é a
 * mesma lista — mudou uma, muda a outra; o `check-rolls` confere.)
 */
export const TRAIT_PT = {
  agile: 'ágil',
  finesse: 'acuidade',
  deadly: 'letal',
  versatile: 'versátil',
  forceful: 'impetuoso',
  sweep: 'amplo',
  shove: 'empurrar',
  backswing: 'contragolpe',
  thrown: 'arremesso',
  unarmed: 'desarmado',
  trip: 'derrubar',
}

/** Só a categoria `trait`: "Unarmed" ou "Deadly" não podem cair numa magia ou condição homônima. */
async function resolveTraitOnly(term) {
  const { hits } = await searchAonRaw({ query: term, category: 'trait', limit: 8 })
  const hit = pickHit(hits, term)
  return hit ? normalize(hit) : null
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const CHUNK = 6

/**
 * O nome em português de traços de arma que a ficha ainda não tem no vocabulário. Prompt PRÓPRIO, não o
 * `translateSegments`: aquele manda manter nomes próprios em inglês e devolvia "Volley" e "Twin" como
 * estavam — o nome de um traço é palavra comum, e traduz-se. O vocabulário da ficha entra no prompt para
 * o resto combinar com ele. `null` na falha (nada é cacheado).
 */
async function translateTraitNames(names) {
  if (names.length === 0 || !hasTranslationKey()) return {}
  const glossary = Object.entries(TRAIT_PT).map(([en, pt]) => `${en} = ${pt}`).join('; ')
  const prompt = `Dê o nome em português brasileiro, como usado nas edições brasileiras de Pathfinder 2e (Remaster), de cada TRAÇO DE ARMA abaixo. O nome de um traço é palavra comum, não nome próprio: traduza-o (só deixe igual quando o próprio livro brasileiro o mantém, como "Fatal"). Use o mesmo vocabulário do restante da ficha: ${glossary}. Responda APENAS um objeto JSON {"Nome em inglês": "nome em português"}, sem explicações nem crases.\n\n${JSON.stringify(names)}`
  const raw = await runChainedPrompt(prompt, { clean: false, maxTokens: 1024 })
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw.replace(/^[^{]*/, '').replace(/[^}]*$/, ''))
    const out = {}
    for (const name of names) {
      const pt = typeof parsed?.[name] === 'string' ? parsed[name].replace(/[.*_"]/g, '').trim() : ''
      if (pt && pt.length <= 40) out[name] = pt.toLowerCase()
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Traduz o nome (vocabulário da ficha ou prompt de nomes) e o texto de cada regra. Só devolve a regra
 * COMPLETAMENTE traduzida: tradução que falhou não é cacheada (ver "Nada de cachear inglês" no
 * CLAUDE.md) — quem chama tenta de novo na próxima consulta.
 */
async function translateTraitRules(rules) {
  const enabled = hasTranslationKey()
  const unknown = [...new Set(rules.map(({ rule }) => rule.name).filter((n) => !TRAIT_PT[n.toLowerCase()]))]
  const names = {}
  for (let i = 0; i < unknown.length; i += 15) Object.assign(names, await translateTraitNames(unknown.slice(i, i + 15)))

  const out = {}
  for (let i = 0; i < rules.length; i += CHUNK) {
    const group = rules.slice(i, i + CHUNK)
    const pt = await translateSegments(group.map(({ rule }) => rule.text), enabled)
    group.forEach(({ term, rule }, n) => {
      const label = TRAIT_PT[rule.name.toLowerCase()] ?? names[rule.name]
      if (!pt[n] || !label) return
      const shown = capitalize(label)
      // O texto traduzido ainda cita o traço pelo nome em inglês ("uma arma twin"): troca pelo daqui.
      const text = label.toLowerCase() === rule.name.toLowerCase()
        ? pt[n]
        : pt[n].replace(new RegExp(`\\b${rule.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), label)
      out[term] = { ...rule, label: shown, name: label.toLowerCase() === rule.name.toLowerCase() ? shown : `${shown} (${rule.name})`, text }
    })
  }
  return out
}

async function resolveTraitRulesUncached(terms) {
  const found = []
  for (const term of terms) {
    const rule = await resolveTraitOnly(term).catch(() => null)
    if (rule) found.push({ term, rule })
  }
  return translateTraitRules(found)
}

async function resolveTraitRulesEnglish(terms) {
  const out = {}
  for (const term of terms) {
    const rule = await resolveTraitOnly(term).catch(() => null)
    if (rule) out[term] = { ...rule, label: capitalize(rule.name) }
  }
  return out
}

/**
 * A regra de vários traços de uma vez, EM PORTUGUÊS, chaveada pelo termo. A primeira vez vai à AON e à
 * tradução; depois sai do banco (`aon_lookups`, `trait:v2`, global) — tocar no chip da arma não espera
 * nada. O que a tradução não deu fica de fora do banco e volta em inglês com `translationPending`
 * (o cliente não o guarda e pede de novo). Subiu o formato? Suba a versão.
 */
export async function resolveTraitRules(rawTerms, lang = 'pt') {
  const terms = [...new Set(rawTerms.map(weaponTraitName).filter(Boolean))].slice(0, MAX_TRAIT_RULES)
  // Inglês: a regra como a AON escreve, sem tradução — também no banco, em `traiten:v1`.
  if (lang === 'en') return cachedLookup('traiten:v1', terms, resolveTraitRulesEnglish)
  const out = await cachedLookup('trait:v2', terms, resolveTraitRulesUncached)
  for (const term of terms) {
    if (out[term]) continue
    const rule = await resolveTraitOnly(term).catch(() => null)
    if (rule) out[term] = { ...rule, ...(TRAIT_PT[term.toLowerCase()] ? { label: capitalize(TRAIT_PT[term.toLowerCase()]) } : {}), translationPending: true }
  }
  return out
}
