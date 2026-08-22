// Resolução de talentos e habilidades (features de classe, heritages, ações),
// compartilhada entre as funções serverless (api/feat.js, api/feats.js,
// api/search.js, api/searches.js) e o servidor de dev (server/index.mjs).
//
// Mesma arquitetura de api/_lib/spells-core.js: busca no AON, parse estrutural
// em EN, tradução SÓ da prosa/metadados com validação anti-truncamento e
// payload estruturado. O ponto crítico é `translationPending`: quando o Groq
// falha (429 do tier gratuito), o payload volta em EN marcado como pendente e
// NÃO é cacheado por ninguém — antes o inglês era cacheado para sempre, que é
// o motivo de talentos e habilidades aparecerem em inglês na ficha.

import {
  searchAon,
  cleanAonText,
  extractMainDescription,
  translateSegments,
  generateFallbackDescription,
} from './aon.js'
import { pickBestHit, parseAonText } from './aon-parse.js'

// Ordem de categorias por tipo de consulta: a mais provável primeiro. Heritages
// ("Running Animal") e features de classe não vivem em 'feat' no AON; `null`
// (sem filtro) fica por último como rede de segurança.
const FEAT_CATEGORIES = ['feat', 'heritage', 'ancestry-feature', 'class-feature', 'action']
const SPECIAL_CATEGORIES = ['class-feature', 'feat', 'action', 'ancestry-feature', 'heritage', null]

// Pathbuilder anexa qualificadores ao nome ("Assurance (Athletics)",
// "Scent (imprecise) 30 feet") que não existem no nome do AON.
function cleanSearchName(name) {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\d+\s*feet?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function findBestEntry(name, categories) {
  let best = null
  for (const cat of categories) {
    const results = await searchAon(name, cat, 10)
    const pick = pickBestHit(results, name)
    if (pick && pick._source?.name?.toLowerCase() === name.toLowerCase()) return pick
    if (!best && pick) best = pick
  }
  return best
}

function joinField(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return value == null ? '' : String(value).trim()
}

function emptyEntry(name, description, itemType) {
  return {
    name,
    level: null,
    actions: '',
    traits: [],
    category: itemType === 'feat' ? 'feat' : 'unknown',
    description: description || null,
  }
}

async function resolveEntry(rawName, categories, itemType, apiKey) {
  const searchName = cleanSearchName(rawName) || String(rawName || '')
  let best = await findBestEntry(searchName, categories)

  // Sem match exato e o nome foi alterado pela limpeza: tenta o nome cru também
  // (há talentos cujo nome no AON contém parênteses de verdade).
  const exact = (hit) => hit?._source?.name?.toLowerCase() === searchName.toLowerCase()
  if (!exact(best) && searchName !== String(rawName)) {
    const alt = await findBestEntry(String(rawName), categories)
    if (alt?._source?.name?.toLowerCase() === String(rawName).toLowerCase()) best = alt
    else if (!best) best = alt
  }

  if (!best) {
    const fallback = await generateFallbackDescription(searchName, itemType, apiKey)
    return emptyEntry(rawName, fallback, itemType)
  }

  const source = best._source
  const parsed = parseAonText(source.text || '')

  // Prosa: estrutura do AON (bloco após "---"). Sem separador reconhecível cai
  // no strip heurístico por rótulo, que é o caminho antigo — pior, mas raro.
  let proseEN = parsed.structured ? parsed.proseEN : ''
  if (proseEN.includes('<')) proseEN = cleanAonText(proseEN)
  // Rodapé de navegação do AON ("Assurance leads to... Automatic Knowledge"):
  // não é descrição, e cortar antes da tradução ainda economiza tokens.
  proseEN = proseEN.replace(/\s*[^.!?]*\bleads to\.{3}[\s\S]*$/i, '').trim()
  if (!proseEN) proseEN = extractMainDescription(source.text || source.markdown || '', 4000)
  // Entradas sem separador (categoria 'rules', p.ex.) começam repetindo o nome.
  // Cortar aqui, em EN, é confiável — depois de traduzido o nome não casa mais.
  const aonName = String(source.name || '').trim()
  if (aonName) {
    proseEN = proseEN.replace(new RegExp(`^${aonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s.:—–-]*`, 'i'), '').trim()
  }

  // Um único pedido ao Groq traduz prosa + metadados em prosa (pré-requisitos,
  // gatilho, requisitos…). Uma chamada por item é o que mantém a ficha inteira
  // dentro do rate limit.
  const segmentsEN = [
    proseEN,
    joinField(source.prerequisite),
    joinField(source.trigger),
    joinField(source.requirement),
    joinField(source.frequency),
    joinField(source.access),
    joinField(source.cost),
  ]

  const translated = apiKey
    ? await translateSegments(segmentsEN, apiKey)
    : segmentsEN.map(() => null)

  let translationPending = false
  // Mantém o EN completo quando a tradução falhou — nunca truncar, nunca
  // devolver meio traduzido — e sinaliza para não cachear.
  // Só a PROSA (idx 0) tratada como falha quando volta idêntica: nos metadados
  // a identidade é legítima e comum (nomes próprios como "Curse Maelstrom
  // Dedication"); marcar pending ali faria a ficha retraduzir para sempre.
  const take = (idx) => {
    const en = segmentsEN[idx]
    if (!en) return ''
    const pt = translated[idx]
    if (pt && (idx > 0 || pt !== en)) return pt
    if (apiKey) translationPending = true
    return en
  }

  let description = take(0)
  if (!description || description.trim().length < 20) {
    const fallback = await generateFallbackDescription(source.name || searchName, itemType, apiKey)
    if (fallback) {
      description = fallback
      translationPending = false
    }
  }

  const traits = Array.isArray(source.trait) ? source.trait : []

  return {
    name: source.name || rawName,
    level: typeof source.level === 'number' ? source.level : null,
    actions: source.actions || '',
    traits,
    category: source.category || 'unknown',
    className: joinField(source.class) || undefined,
    archetype: Array.isArray(source.archetype) && source.archetype.length > 0 ? source.archetype : undefined,
    sourceBook: parsed.sourceBook || undefined,
    prerequisites: take(1) || undefined,
    trigger: take(2) || undefined,
    requirements: take(3) || undefined,
    frequency: take(4) || undefined,
    access: take(5) || undefined,
    cost: take(6) || undefined,
    description: description || null,
    ...(translationPending ? { translationPending: true } : {}),
  }
}

export function resolveFeat(name, apiKey) {
  return resolveEntry(name, FEAT_CATEGORIES, 'feat', apiKey)
}

export function resolveSpecial(name, apiKey) {
  return resolveEntry(name, SPECIAL_CATEGORIES, 'special', apiKey)
}

// Executa vários nomes com concorrência limitada, chaveando o resultado pelo
// nome de ENTRADA — o AON normaliza nomes ("Power Attack" → "Vicious Swing") e
// sem isso o frontend perde o item.
export async function resolveMany(names, apiKey, resolver, concurrency = 3) {
  const results = {}
  for (let i = 0; i < names.length; i += concurrency) {
    const chunk = names.slice(i, i + concurrency)
    const resolved = await Promise.all(chunk.map(n => resolver(n, apiKey)))
    resolved.forEach((r, idx) => { results[chunk[idx]] = r })
  }
  return results
}
