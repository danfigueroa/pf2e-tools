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
import { staffForTier } from './staff-parse.js'

// Ordem de categorias por tipo de consulta: a mais provável primeiro. Heritages
// ("Running Animal") e features de classe não vivem em 'feat' no AON; `null`
// (sem filtro) fica por último como rede de segurança.
const FEAT_CATEGORIES = ['feat', 'heritage', 'ancestry-feature', 'class-feature', 'action']
// A lista de "special" também atende os itens do inventário (mesmo endpoint,
// /api/searches), por isso 'equipment' entra antes da rede de segurança.
const SPECIAL_CATEGORIES = ['class-feature', 'feat', 'action', 'ancestry-feature', 'heritage', 'equipment', null]

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

async function resolveEntry(rawName, categories, itemType, translationEnabled) {
  const fullName = String(rawName || '').trim()
  const searchName = cleanSearchName(rawName) || fullName
  const isExact = (hit, name) => hit?._source?.name?.toLowerCase() === String(name).toLowerCase()

  // O nome CRU vem primeiro quando a limpeza mudou algo, porque o parêntese do
  // Pathbuilder às vezes **é** parte do nome no AON: os degraus de bastão
  // ("Staff of Healing (Greater)") existem como entradas próprias, e resolver
  // pelo nome limpo devolvia o item BASE — nível, preço e magias errados.
  // Só quando o nome cru não casa exato vale a limpeza, que é o caminho de
  // "Assurance (Athletics)" e "Scent (imprecise) 30 feet".
  let best = null
  if (fullName && fullName !== searchName) {
    best = await findBestEntry(fullName, categories)
  }
  if (!isExact(best, fullName)) {
    const alt = await findBestEntry(searchName, categories)
    if (isExact(alt, searchName)) best = alt
    else if (!best) best = alt
  }

  if (!best) {
    const fallback = await generateFallbackDescription(searchName, itemType, translationEnabled)
    return emptyEntry(rawName, fallback, itemType)
  }

  const source = best._source
  const parsed = parseAonText(source.text || '')

  // Bastão: o documento do AON guarda a FAMÍLIA inteira (base, Greater, Major,
  // True). O parse próprio isola o degrau que a ficha possui e acumula as
  // magias só para baixo — ver api/_lib/staff-parse.js.
  const staff = staffForTier(source, fullName)

  // Prosa: estrutura do AON (bloco após "---"). Sem separador reconhecível cai
  // no strip heurístico por rótulo, que é o caminho antigo — pior, mas raro.
  // Bastão é a exceção: `parseAonText` colaria os quatro degraus num parágrafo
  // único (com preços e magias de rank 7 no meio), então a prosa vem da seção
  // da família, sem degrau nenhum.
  let proseEN = staff ? staff.intro : (parsed.structured ? parsed.proseEN : '')
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

  // O efeito do degrau ("The item bonus granted to heal spells is +2.") entra
  // na MESMA chamada de tradução: uma chamada por item é o que mantém a ficha
  // inteira dentro do rate limit do tier gratuito.
  const staffEffectIdx = segmentsEN.length
  if (staff?.effect) segmentsEN.push(staff.effect)

  const translated = translationEnabled
    ? await translateSegments(segmentsEN, translationEnabled)
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
    if (translationEnabled) translationPending = true
    return en
  }

  let description = take(0)
  if (!description || description.trim().length < 20) {
    const fallback = await generateFallbackDescription(source.name || searchName, itemType, translationEnabled)
    if (fallback) {
      description = fallback
      translationPending = false
    }
  }

  const traits = Array.isArray(source.trait) ? source.trait : []

  // `intro` já saiu como descrição — não repetir no payload.
  const staffPayload = staff
    ? {
      tierName: staff.tierName,
      tierLevel: staff.tierLevel,
      price: staff.price,
      effect: staff.effect ? take(staffEffectIdx) : '',
      ranks: staff.ranks,
      tiers: staff.tiers,
    }
    : null

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
    ...(staffPayload ? { staff: staffPayload } : {}),
    ...(translationPending ? { translationPending: true } : {}),
  }
}

export function resolveFeat(name, translationEnabled) {
  return resolveEntry(name, FEAT_CATEGORIES, 'feat', translationEnabled)
}

export function resolveSpecial(name, translationEnabled) {
  return resolveEntry(name, SPECIAL_CATEGORIES, 'special', translationEnabled)
}

// Executa vários nomes com concorrência limitada, chaveando o resultado pelo
// nome de ENTRADA — o AON normaliza nomes ("Power Attack" → "Vicious Swing") e
// sem isso o frontend perde o item.
export async function resolveMany(names, translationEnabled, resolver, concurrency = 3) {
  const results = {}
  for (let i = 0; i < names.length; i += concurrency) {
    const chunk = names.slice(i, i + concurrency)
    const resolved = await Promise.all(chunk.map(n => resolver(n, translationEnabled)))
    resolved.forEach((r, idx) => { results[chunk[idx]] = r })
  }
  return results
}
