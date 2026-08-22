import 'dotenv/config'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import { resolveSpell } from '../api/_lib/spells-core.js'
import { resolveFeat, resolveSpecial } from '../api/_lib/feat-core.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const CACHE = new Map()

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

// Talentos e habilidades especiais: mesma resolução do serverless
// (api/_lib/feat-core.js). Aqui só entra o cache em memória do dev server —
// payloads com translationPending (ex.: 429 do Groq) NÃO são cacheados, para
// que a próxima consulta retraduza em vez de fixar o inglês.
async function resolveEntryCached(name, kind) {
  const cacheKey = `${kind}:${name}`
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)

  const resolver = kind === 'feat' ? resolveFeat : resolveSpecial
  const entry = await resolver(name, GROQ_API_KEY)
  if (entry && !entry.translationPending) CACHE.set(cacheKey, entry)
  return entry
}

// Busca descrição detalhada de magia
// Resolução de magias delegada ao núcleo compartilhado com o serverless
// (api/_lib/spells-core.js) — mesma busca, parse estrutural e tradução.
// Aqui só entra o cache em memória do dev server.
async function resolveSpellCached(spellName) {
  const cacheKey = `spell:${spellName}`
  if (CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey)
  }
  console.log(`[spell] Buscando: ${spellName}`)
  try {
    const spellData = await resolveSpell(spellName, GROQ_API_KEY)
    // Tradução pendente (ex.: 429 do Groq) → não cachear, retenta na próxima.
    if (spellData && !spellData.translationPending) CACHE.set(cacheKey, spellData)
    return spellData
  } catch (e) {
    console.error(`[spell] Erro:`, e.message)
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
      cacheSize: CACHE.size
    }))
    return
  }
  
  // Limpa cache
  if (pathname === '/api/clear-cache' && req.method === 'POST') {
    CACHE.clear()
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
      const feat = await resolveEntryCached(name, 'feat')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(feat || { name, description: null }))
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
      const entry = await resolveEntryCached(name, 'special')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(entry || { name, description: null }))
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
      const spellData = await resolveSpellCached(name)
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
          return (await resolveEntryCached(n, 'feat')) || { name: n, description: null }
        }))
        resolved.forEach((r, idx) => { results[chunk[idx]] = r })
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
          return (await resolveEntryCached(n, 'special')) || { name: n, description: null }
        }))
        resolved.forEach((r, idx) => { results[chunk[idx]] = r })
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
          const spellData = await resolveSpellCached(n)
          return spellData || { name: n, description: null }
        }))
        // Chavear pelo nome de INPUT (não pelo nome do AON), como no serverless —
        // senão o frontend não encontra magias cujo nome o AON normalizou.
        resolved.forEach((r, idx) => { results[chunk[idx]] = r })
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
