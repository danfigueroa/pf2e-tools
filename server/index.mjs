import 'dotenv/config'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import { translateMetadata } from '../api/_lib/metadata-i18n.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const CACHE = new Map()
const TRANSLATION_CACHE = new Map()
const FAILED_TRANSLATIONS = new Set() // Marca textos que falharam para não tentar novamente

// ============================================================================
// SISTEMA DE TRADUÇÃO ROBUSTO
// ============================================================================

// Faz requisição POST para a API do Groq
function fetchGroq(prompt, temperature = 0.1) {
  return new Promise((resolve, reject) => {
    if (!GROQ_API_KEY) {
      reject(new Error('GROQ_API_KEY não configurada'))
      return
    }
    
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature, // Baixa temperatura = mais consistente
      max_tokens: 2048
    })
    
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      }
    }
    
    const req = https.request(options, (res) => {
      const chunks = []
      res.on('data', chunk => { chunks.push(chunk) })
      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString('utf8')
          const json = JSON.parse(data)
          if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)))
            return
          }
          const text = json.choices?.[0]?.message?.content || ''
          resolve(text.trim())
        } catch (e) {
          reject(e)
        }
      })
    })
    
    req.on('error', reject)
    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
    req.write(body)
    req.end()
  })
}

// Controle de rate limiting com backoff exponencial
let lastTranslationTime = 0
let consecutiveErrors = 0
const BASE_DELAY_MS = 8000 // 8 segundos base entre traduções

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Detecta se o texto tem caracteres corrompidos ou estranhos
function hasCorruptedCharacters(text) {
  if (!text) return true
  
  // Padrões de corrupção comuns:
  // 1. Sequências de caracteres Unicode estranhos repetidos (ỹỹỹ, etc.)
  // 2. Muitos caracteres especiais seguidos
  // 3. Texto com espaçamento muito estranho (letra por letra)
  
  const patterns = [
    /[\u1EF9\u1EF8]{2,}/g,        // ỹ repetido
    /[ãáàâéêíóôõúç]{5,}/gi,       // Muitos acentos seguidos (improvável em PT)
    /(\w)\s+(\w)\s+(\w)\s+(\w)\s+(\w)\s+(\w)/g, // Letras separadas por espaços
    /[^\x00-\x7F\u00C0-\u024F\u1E00-\u1EFF]{3,}/g, // Muitos caracteres não-latinos
    /(.)\1{4,}/g,                  // Qualquer caractere repetido 5+ vezes
  ]
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true
    }
  }
  
  // Verifica proporção de caracteres estranhos
  const strangeChars = (text.match(/[^\x00-\x7F\u00C0-\u024F]/g) || []).length
  const ratio = strangeChars / text.length
  if (ratio > 0.15) { // Mais de 15% de caracteres estranhos
    return true
  }
  
  return false
}

// Limpa o texto traduzido de problemas comuns
function cleanTranslation(text) {
  if (!text) return ''
  
  let cleaned = text
    // Remove prefixos comuns do LLM
    .replace(/^(Tradução|Translation|TRADUÇÃO|Aqui está|Here is|Here's|TIPO:[^\n]*|Tradução em português:?|Portuguese:?|Resposta:?)\s*/gi, '')
    // Remove aspas no início/fim
    .replace(/^["']|["']$/g, '')
    // Remove linhas vazias no início
    .replace(/^\s*\n+/, '')
    // Remove caracteres de controle
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  
  // Remove caracteres Unicode estranhos - mapeia para equivalentes latinos
  const charMap = {
    // Vietnamita
    'ỹ': 'y', 'Ỹ': 'Y', 'ỳ': 'y', 'Ỳ': 'Y', 'ỷ': 'y', 'ỵ': 'y', 'ỹ': 'y',
    'ẵ': 'ã', 'Ẵ': 'Ã', 'ặ': 'a', 'Ặ': 'A', 'ắ': 'á', 'ằ': 'à', 'ẳ': 'a', 'ẫ': 'ã',
    'ề': 'ê', 'Ề': 'Ê', 'ể': 'ê', 'Ể': 'Ê', 'ễ': 'ê', 'ệ': 'ê', 'ế': 'é',
    'ị': 'i', 'Ị': 'I', 'ỉ': 'i', 'ĩ': 'i',
    'ọ': 'o', 'Ọ': 'O', 'ỏ': 'o', 'ố': 'ô', 'ồ': 'ô', 'ổ': 'ô', 'ỗ': 'ô', 'ộ': 'ô',
    'ụ': 'u', 'Ụ': 'U', 'ử': 'u', 'Ử': 'U', 'ũ': 'u', 'ủ': 'u', 'ứ': 'u', 'ừ': 'u',
    'ơ': 'o', 'Ơ': 'O', 'ư': 'u', 'Ư': 'U', 'ờ': 'o', 'ớ': 'o', 'ở': 'o',
  }
  
  cleaned = cleaned.replace(/[\u1E00-\u1EFF]/g, (char) => charMap[char] || '')
  
  // IMPORTANTE: Corrige o padrão de espaçamento letra por letra
  // Detecta: "c o n s i d e r a m" e transforma em "consideram"
  // Padrão: letra, espaço, letra, espaço, letra... (pelo menos 5 ocorrências)
  cleaned = cleaned.replace(/\b([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])(\s+[a-záàâãéêíóôõúç])*/gi, (match) => {
    return match.replace(/\s+/g, '')
  })
  
  // Remove sequências de caracteres estranhos repetidos
  cleaned = cleaned.replace(/[ỹỳỷỵ]+/g, 'y')
  cleaned = cleaned.replace(/(.)\1{3,}/g, '$1$1') // Reduz repetições excessivas
  
  // Normaliza espaços múltiplos
  cleaned = cleaned.replace(/\s{2,}/g, ' ')
  
  return cleaned.trim()
}

// Verifica se a tradução é válida
function isValidTranslation(original, translated) {
  if (!translated || translated.length < 10) return false
  
  // Deve ter pelo menos 25% do tamanho original
  if (translated.length < original.length * 0.25) return false
  
  // Não deve ter caracteres corrompidos
  if (hasCorruptedCharacters(translated)) return false
  
  // Não deve ser idêntica ao original (não foi traduzida)
  if (translated === original) return false
  
  // Deve conter algumas palavras em português comuns
  const ptWords = /\b(você|que|para|com|uma?|seu|sua|pode|não|este|esta|como|fazer|quando|então|mais|também|sobre|entre|cada|mesmo|essa?|pelo|pela|aos?|nas?|nos?|dos?|das?)\b/i
  if (!ptWords.test(translated)) {
    // Se não tem palavras PT, verifica se pelo menos parte foi traduzida
    const englishRatio = (translated.match(/\b(you|the|and|that|with|for|are|this|from|have|your|can|will|when|make|each|any)\b/gi) || []).length
    const words = translated.split(/\s+/).length
    if (englishRatio / words > 0.3) { // Mais de 30% em inglês
      return false
    }
  }
  
  return true
}

// Gera o prompt de tradução — consistente com api/_lib/aon.js
function getTranslationPrompt(text) {
  return `Traduza para português brasileiro o seguinte texto de RPG Pathfinder 2e. Mantenha termos técnicos em inglês quando apropriado (como "flat-footed", "flanking", "prone", "grabbed", "immobilized"). Retorne APENAS a tradução, sem explicações:\n\n${text}`
}

// Função principal de tradução com sistema robusto
async function translateToPortuguese(text, itemType = 'item') {
  if (!text || text.length < 5) return text
  if (!GROQ_API_KEY) {
    console.log('[translate] Sem GROQ_API_KEY, retornando texto original')
    return text
  }
  
  // Verifica cache
  const cacheKey = `${itemType}:${text.substring(0, 300)}`
  if (TRANSLATION_CACHE.has(cacheKey)) {
    return TRANSLATION_CACHE.get(cacheKey)
  }
  
  // Se já falhou antes, não tenta novamente nesta sessão
  if (FAILED_TRANSLATIONS.has(cacheKey)) {
    console.log('[translate] Pulando tradução que já falhou anteriormente')
    return text
  }
  
  // Calcula delay com backoff exponencial baseado em erros consecutivos
  const backoffMultiplier = Math.min(Math.pow(1.5, consecutiveErrors), 4) // Max 4x
  const currentDelay = BASE_DELAY_MS * backoffMultiplier
  
  // Rate limiting: espera se necessário
  const now = Date.now()
  const timeSinceLastTranslation = now - lastTranslationTime
  if (timeSinceLastTranslation < currentDelay) {
    await delay(currentDelay - timeSinceLastTranslation)
  }
  lastTranslationTime = Date.now()
  
  const prompt = getTranslationPrompt(text)
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[translate] Tentativa ${attempt}/${maxRetries} para "${text.substring(0, 40)}..."`)
      
      // Usa temperatura mais baixa em retries para respostas mais consistentes
      const temperature = attempt === 1 ? 0.1 : 0.05
      let translated = await fetchGroq(prompt, temperature)
      
      // Limpa a resposta
      translated = cleanTranslation(translated)
      
      // Valida a tradução
      if (isValidTranslation(text, translated)) {
        TRANSLATION_CACHE.set(cacheKey, translated)
        consecutiveErrors = 0 // Reset contador de erros
        console.log(`[translate] ✓ OK: "${translated.substring(0, 60)}..."`)
        return translated
      }
      
      // Tradução inválida
      console.log(`[translate] ✗ Tradução inválida na tentativa ${attempt}`)
      if (hasCorruptedCharacters(translated)) {
        console.log(`[translate]   Motivo: caracteres corrompidos detectados`)
      }
      
      // Espera antes do próximo retry
      if (attempt < maxRetries) {
        const retryDelay = 3000 * attempt // 3s, 6s, 9s
        console.log(`[translate] Aguardando ${retryDelay/1000}s antes do retry...`)
        await delay(retryDelay)
      }
      
    } catch (e) {
      console.error(`[translate] Erro na tentativa ${attempt}:`, e.message)
      consecutiveErrors++
      
      // Se é rate limit, espera mais
      if (e.message?.includes('Rate limit')) {
        const waitTime = 15000 * attempt // 15s, 30s, 45s
        console.log(`[translate] Rate limit - aguardando ${waitTime/1000}s...`)
        await delay(waitTime)
        lastTranslationTime = Date.now()
      } else if (attempt < maxRetries) {
        await delay(2000 * attempt)
      }
    }
  }
  
  // Todas as tentativas falharam
  console.log(`[translate] ✗ Falha total após ${maxRetries} tentativas, marcando para não tentar novamente`)
  FAILED_TRANSLATIONS.add(cacheKey)
  return null // Retorna null para indicar falha (melhor que retornar texto potencialmente corrompido)
}

// Gera descrição via Groq quando o item não é encontrado no AON
async function generateFallbackDescription(name, itemType = 'special') {
  if (!GROQ_API_KEY || !name) return null

  const typeLabel = {
    feat: 'talento',
    spell: 'magia',
    'class-feature': 'habilidade de classe',
    special: 'habilidade especial',
  }[itemType] || 'habilidade'

  const prompt = `Em 1-2 frases curtas em português brasileiro, descreva o que é "${name}" no RPG Pathfinder 2e (${typeLabel}). Seja direto e objetivo. Retorne APENAS a descrição, sem formatação.`

  try {
    const result = await fetchGroq(prompt, 0.3)
    if (!result || result.length < 10) return null
    return cleanTranslation(result)
  } catch (e) {
    console.error(`[fallback] Erro gerando descrição para "${name}":`, e.message)
    return null
  }
}

// ============================================================================
// API DE BUSCA (AON Elasticsearch)
// ============================================================================

// Limpa o texto da AON removendo tags HTML/XML e metadata
function cleanAonText(text) {
  if (!text) return ''
  
  let cleaned = text
    // Remove tags XML/HTML completas (ex: <title level="1" ...>)
    .replace(/<[^>]+>/g, '')
    // Remove entidades HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Remove padrões de metadata da AON
    .replace(/\s*---\s*/g, ' --- ')
    // Remove espaços múltiplos
    .replace(/\s{2,}/g, ' ')
    // Remove espaços antes de pontuação
    .replace(/\s+([.,;:!?])/g, '$1')
  
  // Remove a parte "leva a..." ou "leads to..." (árvore de talentos)
  // Padrões: "X leva a... Y, Z" ou "X leads to... Y, Z"
  cleaned = cleaned
    .replace(/\s+\S+\s+(leva a|leads to)\.{0,3}\s*.*/gi, '')
    .replace(/\s+(Leads to|Leva a):?\s*.*/gi, '')
  
  return cleaned.trim()
}

// Extrai o texto principal da descrição. NÃO concatena name/source/prerequisites
// no começo: o source.text do AON já contém "Source X pg. NN" inline; se duplicarmos,
// a tradução vira "Nome Nome Fonte: ... Fonte ..." (ruído puro).
// O frontend (format-description.ts) extrai a Fonte/Source para o chip dedicado.
function extractMainDescription(source) {
  let mainText = ''
  if (source.text) {
    mainText = cleanAonText(source.text)
  } else if (source.markdown) {
    mainText = source.markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links markdown
      .replace(/\*\*([^*]+)\*\*/g, '$1')        // bold
      .replace(/\*([^*]+)\*/g, '$1')            // italic
      .replace(/#+\s*/g, '')                    // headers
    mainText = cleanAonText(mainText)
  }
  return mainText
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 pf2e-tools',
        'Accept': 'application/json'
      }
    }
    
    const req = https.get(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', reject)
    })
    
    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

// Busca na API Elasticsearch da AON
async function searchAon(name, category = null) {
  const cacheKey = `aon:${category}:${name}`
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey)
  }
  
  try {
    // Monta a query de busca
    const searchBody = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: name,
                fields: ['name^3', 'text'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ]
        }
      },
      size: 10
    }
    
    // Adiciona filtro de categoria se especificado
    if (category) {
      searchBody.query.bool.filter = [
        { term: { category: category } }
      ]
    }
    
    const url = `https://elasticsearch.aonprd.com/aon/_search`
    const body = JSON.stringify(searchBody)
    
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'elasticsearch.aonprd.com',
        path: '/aon/_search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 pf2e-tools'
        }
      }
      
      const req = https.request(options, (res) => {
        const chunks = []
        res.on('data', chunk => { chunks.push(chunk) })
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        })
      })

      req.on('error', reject)
      req.setTimeout(10000, () => {
        req.destroy()
        reject(new Error('Timeout'))
      })
      
      req.write(body)
      req.end()
    })
    
    if (result.hits?.hits?.length > 0) {
      // Procura match exato primeiro
      const exactMatch = result.hits.hits.find(hit => {
        const hitName = hit._source?.name?.toLowerCase()
        return hitName === name.toLowerCase()
      })
      
      const bestHit = exactMatch || result.hits.hits[0]
      const source = bestHit._source
      
      // Extrai descrição limpa
      const description = extractMainDescription(source)
      
      CACHE.set(cacheKey, { name: source.name, description })
      return { name: source.name, description }
    }
    
    return null
  } catch (e) {
    console.error(`[searchAon] Erro buscando "${name}":`, e.message)
    return null
  }
}

// Busca descrição de feat
async function scrapeFeatDescription(featName) {
  console.log(`[scrapeFeat] Buscando: ${featName}`)

  // Tenta categorias em ordem; prefere match exato. Heritages como
  // "Running Animal" e features de classe vivem em outras categorias no AON.
  let bestResult = null
  for (const cat of ['feat', 'heritage', 'ancestry-feature', 'class-feature']) {
    const result = await searchAon(featName, cat)
    if (result?.description) {
      if (result.name?.toLowerCase() === featName.toLowerCase()) {
        bestResult = result
        break
      }
      if (!bestResult) bestResult = result
    }
  }

  if (bestResult?.description) {
    console.log(`[scrapeFeat] Encontrado: ${bestResult.name}`)
    const translated = await translateToPortuguese(bestResult.description)
    return translated || bestResult.description
  }

  console.log(`[scrapeFeat] Não encontrado no AON, usando fallback Groq: ${featName}`)
  return await generateFallbackDescription(featName, 'feat')
}

// Busca descrição genérica (habilidades, ancestries, etc.)
async function scrapeGenericDescription(name) {
  console.log(`[scrapeGeneric] Buscando: ${name}`)

  // Limpa o nome: remove "(imprecise) 30 feet" e similares
  const cleanedName = name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\d+\s*feet?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Busca em cascata por categoria
  const categoriesToTry = ['class-feature', 'feat', 'action', null]
  let bestResult = null

  for (const cat of categoriesToTry) {
    const result = await searchAon(cleanedName, cat)
    if (result?.description) {
      // Prefere match exato de nome
      if (result.name?.toLowerCase() === cleanedName.toLowerCase()) {
        bestResult = result
        break
      }
      if (!bestResult) bestResult = result
    }
  }

  if (bestResult?.description) {
    console.log(`[scrapeGeneric] Encontrado "${bestResult.name}": ${bestResult.description.substring(0, 60)}...`)
    const translated = await translateToPortuguese(bestResult.description)
    return translated || bestResult.description
  }

  console.log(`[scrapeGeneric] Não encontrado no AON, usando fallback Groq: ${name}`)
  return await generateFallbackDescription(cleanedName, 'special')
}

// Busca descrição detalhada de magia
async function scrapeSpellDescription(spellName) {
  console.log(`[scrapeSpell] Buscando: ${spellName}`)

  const cacheKey = `spell:${spellName}`
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey)
  }

  try {
    // Tenta múltiplas categorias: spell → cantrip → focus
    let source = null
    for (const cat of ['spell', 'cantrip', 'focus']) {
      const searchBody = {
        query: {
          bool: {
            must: [{ multi_match: { query: spellName, fields: ['name^3'], type: 'best_fields' } }],
            filter: [{ term: { category: cat } }]
          }
        },
        size: 5
      }

      const result = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'elasticsearch.aonprd.com',
          path: '/aon/_search',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 pf2e-tools' }
        }
        const req = https.request(options, (res) => {
          const chunks = []
          res.on('data', chunk => { chunks.push(chunk) })
          res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (e) { reject(e) } })
        })
        req.on('error', reject)
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
        req.write(JSON.stringify(searchBody))
        req.end()
      })

      if (result.hits?.hits?.length > 0) {
        const exact = result.hits.hits.find(h => h._source?.name?.toLowerCase() === spellName.toLowerCase())
        if (exact) { source = exact._source; break }
        if (!source) source = result.hits.hits[0]._source
      }
    }

    if (source) {
      // Prefere os campos *_raw do AON (ex.: "30 feet" em vez de só "30").
      // Quando o campo é numérico ou array, fallback para conversão simples.
      const rangeStr = source.range_raw || (source.range != null ? String(source.range) : null)
      const areaStr = source.area_raw || (Array.isArray(source.area) ? source.area.join(', ') : (source.area || null))
      const targetsStr = source.targets_raw || source.targets || source.target || null
      const durationStr = source.duration_raw || (source.duration != null ? String(source.duration) : null)
      const defenseStr = source.saving_throw || source.save || source.defense || null

      const spellData = {
        name: source.name,
        // Rank base da magia no AON — o client usa para calcular heightening.
        level: typeof source.level === 'number' ? source.level : null,
        // Padrão de heighten do AON (ex. ["+1"]), quando o texto não for parseável.
        heighten: Array.isArray(source.heighten) && source.heighten.length > 0 ? source.heighten : undefined,
        actions: source.actions || source.action || null,
        traits: source.trait || source.tradition || [],
        range: rangeStr,
        area: areaStr,
        targets: targetsStr,
        duration: durationStr,
        defense: defenseStr,
        description: cleanAonText(source.text || source.markdown || ''),
        damage: source.damage || null,
        damageType: source.damage_type || null,
        heightened: source.heightened || null
      }

      if (spellData.description) {
        const translated = await translateToPortuguese(spellData.description)
        spellData.description = translated || spellData.description
      }

      // Tradução leve dos metadados curtos (range/area/duration/etc.) via
      // dicionário compartilhado (api/_lib/metadata-i18n.js), para não gastar
      // chamadas Groq em strings padronizadas como "30 feet".
      spellData.range = translateMetadata(spellData.range)
      spellData.area = translateMetadata(spellData.area)
      spellData.targets = translateMetadata(spellData.targets)
      spellData.duration = translateMetadata(spellData.duration)
      spellData.defense = translateMetadata(spellData.defense)

      console.log(`[scrapeSpell] Encontrado: ${source.name} (${spellData.actions || '?'} ações)`)
      CACHE.set(cacheKey, spellData)
      return spellData
    }

    // Fallback: gera descrição via Groq
    console.log(`[scrapeSpell] Não encontrado no AON, usando fallback Groq: ${spellName}`)
    const fallbackDesc = await generateFallbackDescription(spellName, 'spell')
    if (fallbackDesc) {
      const spellData = { name: spellName, level: null, actions: null, traits: [], range: null, area: null, targets: null, duration: null, defense: null, description: fallbackDesc, damage: null, damageType: null, heightened: null }
      CACHE.set(cacheKey, spellData)
      return spellData
    }

    return null
  } catch (e) {
    console.error(`[scrapeSpell] Erro:`, e.message)
    return null
  }
}

// Busca e extrai stats de companheiro animal via AON + Groq
async function scrapeCompanionStats(animalName) {
  console.log(`[scrapeCompanion] Buscando: ${animalName}`)

  const cacheKey = `companion:${animalName}`
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)

  // No AON, animal companions ficam na categoria 'animal-companion' (ex.: "Bear",
  // "Wolf"). Sem o filtro, a busca por "Bear" retorna a creature-family ou o feat
  // genérico "Animal Companion".
  let bestMatch = await searchAon(animalName, 'animal-companion')
  if (!bestMatch?.description) {
    // Fallback: busca sem categoria, prefere match exato.
    const fallback = await searchAon(animalName)
    if (fallback?.description) bestMatch = fallback
  }

  if (!bestMatch?.description) {
    console.log(`[scrapeCompanion] Não encontrado: ${animalName}`)
    return null
  }

  if (!GROQ_API_KEY) return null

  const prompt = `Você é um especialista em Pathfinder 2e. A partir deste texto de companheiro animal, extraia os dados e retorne APENAS JSON válido. Traduza os campos de texto para português brasileiro.

Formato obrigatório:
{
  "size": "Small",
  "speed": 35,
  "attacks": [{"name": "Jaws", "damage": "1d8 P", "traits": []}],
  "supportBenefit": "(descrição em pt-BR)",
  "advancedManeuver": "(descrição em pt-BR ou null)"
}

Regras:
- size: tamanho base do companheiro
- speed: apenas o número em pés
- attacks: todos os ataques com nome, dado de dano e tipo (P/S/B)
- supportBenefit: benefício de suporte em português
- advancedManeuver: manobra avançada em português, ou null

Texto:
${bestMatch.description.substring(0, 2000)}`

  try {
    const raw = await fetchGroq(prompt, 0.1)
    const jsonMatch = raw?.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.size || !parsed.attacks || !parsed.supportBenefit) return null

    const stats = {
      size: String(parsed.size),
      speed: Number(parsed.speed) || 25,
      attacks: Array.isArray(parsed.attacks) ? parsed.attacks.map(a => ({
        name: String(a.name || ''),
        damage: String(a.damage || ''),
        traits: Array.isArray(a.traits) ? a.traits.map(String) : []
      })) : [],
      supportBenefit: String(parsed.supportBenefit),
      advancedManeuver: parsed.advancedManeuver ? String(parsed.advancedManeuver) : null
    }

    console.log(`[scrapeCompanion] Extraído: ${animalName} (${stats.size}, ${stats.speed} pés)`)
    CACHE.set(cacheKey, stats)
    return stats
  } catch (e) {
    console.error(`[scrapeCompanion] Erro ao parsear JSON:`, e.message)
    return null
  }
}

// Lê o body de uma requisição POST como JSON
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

// ============================================================================
// SERVIDOR HTTP
// ============================================================================

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = parsedUrl.pathname
  
  // Health check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      status: 'ok', 
      hasApiKey: !!GROQ_API_KEY,
      cacheSize: CACHE.size,
      translationCacheSize: TRANSLATION_CACHE.size,
      failedTranslations: FAILED_TRANSLATIONS.size
    }))
    return
  }
  
  // Limpa cache
  if (pathname === '/api/clear-cache' && req.method === 'POST') {
    CACHE.clear()
    TRANSLATION_CACHE.clear()
    FAILED_TRANSLATIONS.clear()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', message: 'Cache limpo' }))
    return
  }
  
  // Busca feat
  if (pathname === '/api/feat') {
    const name = parsedUrl.searchParams.get('name')
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing name parameter' }))
      return
    }
    
    try {
      const description = await scrapeFeatDescription(name)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ name, description }))
    } catch (e) {
      console.error('[/api/feat] Error:', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }
  
  // Busca genérica (habilidades especiais, etc.)
  if (pathname === '/api/search') {
    const name = parsedUrl.searchParams.get('name')
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing name parameter' }))
      return
    }
    
    try {
      const description = await scrapeGenericDescription(name)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ name, description }))
    } catch (e) {
      console.error('[/api/search] Error:', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }
  
  // Busca magia (retorna objeto completo com actions, traits, etc.)
  if (pathname === '/api/spell') {
    const name = parsedUrl.searchParams.get('name')
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing name parameter' }))
      return
    }
    
    try {
      const spellData = await scrapeSpellDescription(name)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      // Retorna o objeto completo da magia (não apenas description)
      res.end(JSON.stringify(spellData || { name, description: null }))
    } catch (e) {
      console.error('[/api/spell] Error:', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }
  
  // Companheiro animal (único)
  if (pathname === '/api/companion') {
    const name = parsedUrl.searchParams.get('name')
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing name parameter' }))
      return
    }
    try {
      const stats = await scrapeCompanionStats(name)
      if (!stats) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Companheiro não encontrado' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(stats))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // Batch: múltiplos companheiros animais
  if (pathname === '/api/companions' && req.method === 'POST') {
    let body
    try { body = await readBody(req) } catch { body = {} }
    const names = body?.names
    if (!Array.isArray(names) || !names.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Campo "names" deve ser um array não-vazio' }))
      return
    }
    try {
      const results = {}
      for (const name of names) {
        const stats = await scrapeCompanionStats(name)
        if (stats) results[name] = stats
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(results))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // Batch: múltiplos talentos
  if (pathname === '/api/feats' && req.method === 'POST') {
    let body
    try { body = await readBody(req) } catch { body = {} }
    const names = body?.names
    if (!Array.isArray(names) || !names.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Campo "names" deve ser um array não-vazio' }))
      return
    }
    try {
      const CONCURRENCY = 3
      const results = {}
      for (let i = 0; i < names.length; i += CONCURRENCY) {
        const chunk = names.slice(i, i + CONCURRENCY)
        const resolved = await Promise.all(chunk.map(async n => {
          const description = await scrapeFeatDescription(n)
          return { name: n, description }
        }))
        resolved.forEach(r => { results[r.name] = { name: r.name, description: r.description } })
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(results))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // Batch: múltiplas habilidades especiais
  if (pathname === '/api/searches' && req.method === 'POST') {
    let body
    try { body = await readBody(req) } catch { body = {} }
    const names = body?.names
    if (!Array.isArray(names) || !names.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Campo "names" deve ser um array não-vazio' }))
      return
    }
    try {
      const CONCURRENCY = 3
      const results = {}
      for (let i = 0; i < names.length; i += CONCURRENCY) {
        const chunk = names.slice(i, i + CONCURRENCY)
        const resolved = await Promise.all(chunk.map(async n => {
          const description = await scrapeGenericDescription(n)
          return { name: n, description }
        }))
        resolved.forEach(r => { results[r.name] = { name: r.name, description: r.description } })
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(results))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // Batch: múltiplas magias
  if (pathname === '/api/spells' && req.method === 'POST') {
    let body
    try { body = await readBody(req) } catch { body = {} }
    const names = body?.names
    if (!Array.isArray(names) || !names.length) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Campo "names" deve ser um array não-vazio' }))
      return
    }
    try {
      const CONCURRENCY = 3
      const results = {}
      for (let i = 0; i < names.length; i += CONCURRENCY) {
        const chunk = names.slice(i, i + CONCURRENCY)
        const resolved = await Promise.all(chunk.map(async n => {
          const spellData = await scrapeSpellDescription(n)
          return spellData || { name: n, description: null }
        }))
        resolved.forEach(r => { results[r.name] = r })
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(results))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`api listening on http://localhost:${PORT}`)
  if (!GROQ_API_KEY) {
    console.log('⚠️  GROQ_API_KEY não configurada - traduções desabilitadas')
  } else {
    console.log('✓ GROQ_API_KEY configurada - traduções habilitadas')
  }
})
