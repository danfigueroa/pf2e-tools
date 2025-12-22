import 'dotenv/config'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

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
      model: 'llama-3.1-8b-instant',
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
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
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
  
  return text
    // Remove prefixos comuns do LLM
    .replace(/^(Tradução|Translation|TRADUÇÃO|Aqui está|Here is|Here's|TIPO:[^\n]*|Tradução em português:?|Portuguese:?|Resposta:?)\s*/gi, '')
    // Remove aspas no início/fim
    .replace(/^["']|["']$/g, '')
    // Remove linhas vazias no início
    .replace(/^\s*\n+/, '')
    // Remove caracteres de controle
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    // Normaliza espaços múltiplos
    .replace(/\s{3,}/g, ' ')
    // Corrige espaçamento estranho de letras (F a ç a -> Faça)
    .replace(/(\w)\s+(?=\w\s+\w\s+\w)/g, '$1')
    .trim()
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

// Gera o prompt de tradução otimizado
function getTranslationPrompt(text) {
  // Prompt simples e direto para evitar que o modelo retorne o prompt
  return `Translate to Brazilian Portuguese. Only output the translation, nothing else:

${text}`
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

// ============================================================================
// API DE BUSCA (AON Elasticsearch)
// ============================================================================

// Limpa o texto da AON removendo tags HTML/XML e metadata
function cleanAonText(text) {
  if (!text) return ''
  
  return text
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
    .trim()
}

// Extrai apenas o texto principal da descrição, removendo duplicatas
function extractMainDescription(source) {
  let parts = []
  
  // Nome (apenas uma vez)
  if (source.name) {
    parts.push(source.name)
  }
  
  // Fonte
  if (source.source) {
    parts.push(`Fonte: ${source.source}`)
    if (source.page) {
      parts[parts.length - 1] += ` pg. ${source.page}`
    }
  }
  
  // Pré-requisitos
  if (source.prerequisites) {
    parts.push(`Pré-requisitos: ${source.prerequisites}`)
  }
  
  // Texto principal - prioriza 'text', depois 'markdown'
  let mainText = ''
  if (source.text) {
    mainText = cleanAonText(source.text)
  } else if (source.markdown) {
    mainText = source.markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links markdown
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/#+\s*/g, '') // Remove headers
    mainText = cleanAonText(mainText)
  }
  
  if (mainText) {
    parts.push('---')
    parts.push(mainText)
  }
  
  return parts.join(' ')
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
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
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
  
  const result = await searchAon(featName, 'feat')
  if (result?.description) {
    console.log(`[scrapeFeat] Encontrado: ${result.name}`)
    
    // Traduz a descrição
    const translated = await translateToPortuguese(result.description)
    // Se a tradução falhou, retorna o original em inglês (melhor que nada)
    return translated || result.description
  }
  
  console.log(`[scrapeFeat] Não encontrado: ${featName}`)
  return null
}

// Busca descrição genérica (habilidades, ancestries, etc.)
async function scrapeGenericDescription(name) {
  console.log(`[scrapeGeneric] Buscando: ${name}`)
  
  const result = await searchAon(name)
  if (result?.description) {
    console.log(`[scrapeGeneric] Encontrado "${result.name}": ${result.description.substring(0, 60)}...`)
    
    // Traduz a descrição
    const translated = await translateToPortuguese(result.description)
    // Se a tradução falhou, retorna o original em inglês
    return translated || result.description
  }
  
  console.log(`[scrapeGeneric] Não encontrado: ${name}`)
  return null
}

// Busca descrição de magia
async function scrapeSpellDescription(spellName) {
  console.log(`[scrapeSpell] Buscando: ${spellName}`)
  
  const result = await searchAon(spellName, 'spell')
  if (result?.description) {
    console.log(`[scrapeSpell] Encontrado: ${result.name}`)
    return result.description // Magias não são traduzidas por serem muito técnicas
  }
  
  console.log(`[scrapeSpell] Não encontrado: ${spellName}`)
  return null
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
  
  // Busca magia
  if (pathname === '/api/spell') {
    const name = parsedUrl.searchParams.get('name')
    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing name parameter' }))
      return
    }
    
    try {
      const description = await scrapeSpellDescription(name)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ name, description }))
    } catch (e) {
      console.error('[/api/spell] Error:', e)
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
