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
  cleanAonText,
  extractMainDescription,
  translateSegments,
  generateFallbackDescription,
} from './aon.js'
import { parseAonText } from './aon-parse.js'
import { bestAonHit } from './rules-local.js'
import { staffForTier } from './staff-parse.js'

// Ordem de categorias por tipo de consulta: a mais provável primeiro. Heritages
// ("Running Animal") e features de classe não vivem em 'feat' no AON; `null`
// (sem filtro) fica por último como rede de segurança.
const FEAT_CATEGORIES = ['feat', 'heritage', 'ancestry-feature', 'class-feature', 'action']
// A lista de "special" também atende os itens do inventário (mesmo endpoint,
// /api/searches), por isso 'equipment' entra antes da rede de segurança.
// Armas, armaduras, relíquias e opções de classe (instinto, racket, chamado…) antes da rede de segurança e só por nome
// exato: o catálogo local as cobre (F10.4), e o acerto aproximado segue vindo da busca sem categoria, como antes.
const EXACT_ONLY = ['weapon', 'armor', 'shield', 'relic', 'apparition', 'arcane-school', 'arcane-thesis', 'bloodline', 'cause',
  'class-kit', 'conscious-mind', 'doctrine', 'draconic-exemplar', 'druidic-order', 'eidolon', 'element', 'epithet', 'fey-patronage',
  'grim-fascination', 'hunters-edge', 'hybrid-study', 'ikon', 'implement', 'innovation', 'instinct', 'lesson', 'methodology', 'muse',
  'mystery', 'mythic-calling', 'patron', 'practice', 'racket', 'research-field', 'runesmith-rune', 'style', 'subconscious-mind',
  'tactic', 'way']
const SPECIAL_CATEGORIES = ['class-feature', 'feat', 'action', 'ancestry-feature', 'heritage', 'equipment', ...EXACT_ONLY, null]

// Pathbuilder anexa qualificadores ao nome ("Assurance (Athletics)",
// "Scent (imprecise) 30 feet") que não existem no nome do AON.
function cleanSearchName(name) {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\d+\s*feet?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// As classes do jogo, para reconhecer o qualificador "(Magus)" que o cliente põe nas características que várias
// classes têm com o mesmo nome (`sharedClassFeatures.ts`, `specialLookupName`).
const CLASS_NAMES = new Set([
  'alchemist', 'animist', 'barbarian', 'bard', 'champion', 'cleric', 'commander', 'druid', 'exemplar', 'fighter',
  'guardian', 'gunslinger', 'inventor', 'investigator', 'kineticist', 'magus', 'monk', 'necromancer', 'oracle',
  'psychic', 'ranger', 'rogue', 'runesmith', 'sorcerer', 'summoner', 'swashbuckler', 'thaumaturge', 'witch', 'wizard',
])

/** "Weapon Expertise (Magus)" → "Magus"; o parêntese que não é classe ("Assurance (Athletics)") não conta. */
function classHint(name) {
  const m = /\(([^)]+)\)\s*$/.exec(String(name || ''))
  return m && CLASS_NAMES.has(m[1].trim().toLowerCase()) ? m[1].trim() : null
}

// O catálogo local primeiro, a AON depois (F10.4): ver `rules-local.js`.
/** As categorias da escolha, para o `check-local-aon` rodar exatamente as do pipeline. */
export const LOOKUP_CATEGORIES = { feat: FEAT_CATEGORIES, special: SPECIAL_CATEGORIES, item: SPECIAL_CATEGORIES, exactOnly: EXACT_ONLY }

const findBestEntry = (name, categories, className = null, item = false) => bestAonHit(name, categories, { className, item, exactOnly: EXACT_ONLY })

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

/** Busca no AON e parseia em EN — a parte barata, sem LLM. Ver `resolveEntries`. */
/** Categorias da AON que um nome pode trazer entre colchetes ("Bone [grim-fascination]"). */
// `ritual`: o Criador pede o ritual com a etiqueta, e só a categoria dele casa ("Animate Object" também é magia).
const TAGGABLE = new Set([...SPECIAL_CATEGORIES.filter(Boolean), 'ancestry', 'background', 'class', 'deity', 'archetype', 'ritual'])

/**
 * "Bone [grim-fascination]": o Criador pede a opção do catálogo com a categoria junto, porque só pelo nome a busca
 * casava outra coisa (o material "Bone" no lugar do fascínio do Necromancer). Com a etiqueta, só aquela categoria vale;
 * o nome com a etiqueta é a chave no banco, então não colide com o "Bone" da ficha do Pathbuilder.
 */
export function splitCategoryTag(raw) {
  const m = /^(.*\S) \[([a-z][a-z-]{1,30})\]$/.exec(String(raw || '').trim())
  return m && TAGGABLE.has(m[2]) ? { name: m[1], category: m[2] } : null
}

async function prepareEntry(rawInput, baseCategories, itemType, translationEnabled) {
  const tag = splitCategoryTag(rawInput)
  const rawName = tag ? tag.name : rawInput
  const categories = tag ? [tag.category] : baseCategories
  const fullName = String(rawName || '').trim()
  const searchName = cleanSearchName(rawName) || fullName
  const isExact = (hit, name) => hit?._source?.name?.trim().toLowerCase() === String(name).trim().toLowerCase()

  // O nome CRU vem primeiro quando a limpeza mudou algo, porque o parêntese do
  // Pathbuilder às vezes **é** parte do nome no AON: os degraus de bastão
  // ("Staff of Healing (Greater)") existem como entradas próprias, e resolver
  // pelo nome limpo devolvia o item BASE — nível, preço e magias errados.
  // Só quando o nome cru não casa exato vale a limpeza, que é o caminho de
  // "Assurance (Athletics)" e "Scent (imprecise) 30 feet".
  const hint = classHint(fullName)
  let best = null
  if (fullName && fullName !== searchName) {
    best = await findBestEntry(fullName, categories, hint, itemType === 'item')
  }
  if (!isExact(best, fullName)) {
    const alt = await findBestEntry(searchName, categories, hint, itemType === 'item')
    if (isExact(alt, searchName)) best = alt
    else if (!best) best = alt
  }

  if (!best) {
    // O que a AON não tem fica SEM descrição (a tela diz isso): nem regra nem item se inventa por LLM — "descreva
    // o que é Shadow Weaver no Pathfinder" devolveria um texto plausível e falso.
    return { done: emptyEntry(rawName, null, itemType) }
  }

  const source = best._source
  const parsed = parseAonText(source.text || '', source.markdown)

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

  return { rawName, searchName, itemType, source, parsed, staff, segmentsEN, staffEffectIdx }
}

/** Monta o payload a partir do que `prepareEntry` achou e das traduções (na ordem de `segmentsEN`). */
async function finishEntry(prep, translated, translationEnabled) {
  const { rawName, searchName, itemType, source, parsed, staff, segmentsEN, staffEffectIdx } = prep

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

  // O nome da AON difere do pedido (mais do que o parêntese que o Pathbuilder anexa): a tela avisa de qual
  // entrada é a descrição ("Kreighton's Cognitive Crossover" para "Cognitive Crossover").
  const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
  const matchedName = source.name && !sameName(source.name, rawName) && !sameName(source.name, searchName) ? source.name : undefined

  return {
    name: source.name || rawName,
    ...(matchedName ? { matchedName } : {}),
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

/**
 * Vários itens de uma vez, como `resolveSpells`: a busca no AON roda em
 * paralelo e a tradução de TODOS vai numa chamada só (marcadores <<N>>). Uma
 * chamada por item servia ao drawer, que abre um de cada vez; para montar o
 * pacote de uma ficha inteira (~100 talentos, habilidades e itens) seriam cem
 * chamadas a 4,2 s de distância no Gemini free. Devolve na ordem de `names`.
 */
async function resolveEntries(names, categories, itemType, translationEnabled, lang = 'pt') {
  // `lang = 'en'`: o texto da AON como está, sem LLM (nem para completar prosa curta).
  if (lang === 'en') translationEnabled = false
  const preps = await Promise.all(names.map((n) => prepareEntry(n, categories, itemType, translationEnabled)))
  const owners = []
  const segments = []
  preps.forEach((prep, i) => {
    if (prep.done) return
    prep.segmentsEN.forEach((seg, k) => { owners.push([i, k]); segments.push(seg) })
  })
  const translated = translationEnabled && segments.length > 0
    ? await translateSegments(segments, translationEnabled)
    : segments.map(() => null)
  const perEntry = preps.map((prep) => (prep.done ? [] : prep.segmentsEN.map(() => null)))
  translated.forEach((t, j) => { const [i, k] = owners[j]; perEntry[i][k] = t })
  return Promise.all(preps.map((prep, i) =>
    prep.done ? prep.done : finishEntry(prep, perEntry[i], translationEnabled)))
}

export function resolveFeats(names, translationEnabled, lang = 'pt') {
  return resolveEntries(names, FEAT_CATEGORIES, 'feat', translationEnabled, lang)
}

/** Habilidades especiais E itens do inventário (mesmo endpoint, `/api/searches`). */
export function resolveSpecials(names, translationEnabled, lang = 'pt') {
  return resolveEntries(names, SPECIAL_CATEGORIES, 'special', translationEnabled, lang)
}

/**
 * Itens do inventário: as mesmas categorias das habilidades (uma dádiva de relíquia é "item"), mas um acerto de
 * nome parcial só vale se também for item (`namesCompatible(..., item)`).
 */
export function resolveItems(names, translationEnabled, lang = 'pt') {
  return resolveEntries(names, SPECIAL_CATEGORIES, 'item', translationEnabled, lang)
}

export async function resolveFeat(name, translationEnabled, lang = 'pt') {
  const [entry] = await resolveFeats([name], translationEnabled, lang)
  return entry
}

export async function resolveItem(name, translationEnabled, lang = 'pt') {
  const [entry] = await resolveItems([name], translationEnabled, lang)
  return entry
}

export async function resolveSpecial(name, translationEnabled, lang = 'pt') {
  const [entry] = await resolveSpecials([name], translationEnabled, lang)
  return entry
}

// Executa vários nomes com concorrência limitada, chaveando o resultado pelo
// nome de ENTRADA — o AON normaliza nomes ("Power Attack" → "Vicious Swing") e
// sem isso o frontend perde o item.
export async function resolveMany(names, translationEnabled, resolver, concurrency = 3, lang = 'pt') {
  const results = {}
  for (let i = 0; i < names.length; i += concurrency) {
    const chunk = names.slice(i, i + concurrency)
    const resolved = await Promise.all(chunk.map(n => resolver(n, translationEnabled, lang)))
    resolved.forEach((r, idx) => { results[chunk[idx]] = r })
  }
  return results
}
