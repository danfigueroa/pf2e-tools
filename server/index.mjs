import 'dotenv/config'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const CACHE = new Map()
const TRANSLATION_CACHE = new Map()

// Faz requisição POST para a API do Groq (gratuita e rápida!)
function fetchGroq(prompt) {
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
      temperature: 0.3,
      max_tokens: 1024
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
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
    req.write(body)
    req.end()
  })
}

// Traduz texto de inglês para português usando Groq (Llama 3.1) com contexto de PF2e
async function translateToPortuguese(text, itemType = 'item') {
  if (!text || text.length < 10) return text
  if (!GROQ_API_KEY) {
    console.log('[translate] Sem GROQ_API_KEY, retornando texto original')
    return text
  }
  
  // Verifica cache
  const cacheKey = text.substring(0, 150)
  if (TRANSLATION_CACHE.has(cacheKey)) {
    return TRANSLATION_CACHE.get(cacheKey)
  }
  
  const prompt = `Você é um tradutor especializado em Pathfinder 2nd Edition Remaster (PF2e).

CONTEXTO:
- Pathfinder 2e é um RPG de mesa da Paizo
- Use a terminologia oficial em português quando existir
- Mantenha termos técnicos de jogo em inglês quando não houver tradução consagrada (ex: "Hit Points", "AC", "DC")

TERMOS COMUNS:
- feat = talento, spell = magia, action = ação, reaction = reação
- saving throw = teste de resistência, damage = dano, healing = cura
- creature = criatura, ally = aliado, enemy = inimigo, target = alvo
- range = alcance, duration = duração, trigger = gatilho

TIPO DE ITEM: ${itemType}

TEXTO PARA TRADUZIR:
${text}

Responda APENAS com a tradução em português brasileiro, sem explicações.`

  try {
    const translated = await fetchGroq(prompt)
    
    if (translated && translated.length > 10) {
      TRANSLATION_CACHE.set(cacheKey, translated)
      console.log(`[translate] OK: "${text.substring(0, 40)}..." -> "${translated.substring(0, 40)}..."`)
      return translated
    }
    return text
  } catch (e) {
    console.error('[translate] Error:', e.message)
    return text
  }
}

// Usa a API Elasticsearch da AON
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
      reject(new Error('Request timeout'))
    })
  })
}

// Busca na API Elasticsearch da AON
async function searchAon(query, category = null) {
  const q = encodeURIComponent(query)
  let url = `https://elasticsearch.aonprd.com/aon/_search?q=${q}&size=30`
  
  try {
    const data = await fetchJson(url)
    const hits = data.hits?.hits || []
    
    // Filtra por categoria se especificada
    let filtered = hits
    if (category) {
      filtered = hits.filter(h => h._source?.category === category)
    }
    
    // Procura match exato pelo nome (case insensitive)
    const queryLower = query.toLowerCase().trim()
    const exact = filtered.find(h => {
      const name = (h._source?.name || '').toLowerCase().trim()
      return name === queryLower
    })
    
    if (exact) {
      console.log(`[searchAon] Match exato para "${query}": ${exact._source?.name}`)
      return exact._source
    }
    
    // Se não encontrou exato, tenta match parcial
    const partial = filtered.find(h => {
      const name = (h._source?.name || '').toLowerCase()
      return name.includes(queryLower) || queryLower.includes(name)
    })
    
    if (partial) {
      console.log(`[searchAon] Match parcial para "${query}": ${partial._source?.name}`)
      return partial._source
    }
    
    console.log(`[searchAon] Nenhum match para "${query}"`)
    return null
  } catch (e) {
    console.error(`[searchAon] Error: ${e.message}`)
    return null
  }
}

// Busca descrição de um Feat usando a API Elasticsearch
async function scrapeFeatDescription(name) {
  if (CACHE.has(`feat:${name}`)) return CACHE.get(`feat:${name}`)
  
  try {
    const result = await searchAon(name, 'feat')
    
    if (!result) {
      CACHE.set(`feat:${name}`, null)
      return null
    }
    
    // Extrai a descrição do markdown ou text
    let description = result.text || result.markdown || ''
    
    // Remove tags HTML e limpa
    description = description
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Limita o tamanho
    if (description.length > 400) {
      description = description.slice(0, 397) + '...'
    }
    
    // Traduz para português
    if (description) {
      description = await translateToPortuguese(description, 'talento (feat)')
    }
    
    console.log(`[scrapeFeat] Found "${name}": ${description?.substring(0, 100)}...`)
    
    CACHE.set(`feat:${name}`, description || null)
    return description || null
    
  } catch (e) {
    console.error(`[scrapeFeat] Error for "${name}":`, e.message)
    CACHE.set(`feat:${name}`, null)
    return null
  }
}

// Busca genérica na AON para qualquer tipo de conteúdo
async function scrapeGenericDescription(name) {
  if (CACHE.has(`generic:${name}`)) return CACHE.get(`generic:${name}`)
  
  try {
    // Busca sem filtro de categoria
    const result = await searchAon(name, null)
    
    if (!result) {
      CACHE.set(`generic:${name}`, null)
      return null
    }
    
    let description = result.text || result.markdown || ''
    
    // Remove tags HTML e limpa
    description = description
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Limita o tamanho
    if (description.length > 300) {
      description = description.slice(0, 297) + '...'
    }
    
    // Traduz para português
    if (description) {
      description = await translateToPortuguese(description, 'habilidade especial de classe')
    }
    
    console.log(`[scrapeGeneric] Found "${name}": ${description?.substring(0, 80)}...`)
    
    CACHE.set(`generic:${name}`, description || null)
    return description || null
    
  } catch (e) {
    console.error(`[scrapeGeneric] Error for "${name}":`, e.message)
    CACHE.set(`generic:${name}`, null)
    return null
  }
}

// Busca informações detalhadas de uma magia usando a API Elasticsearch
async function scrapeSpellDescription(name) {
  if (CACHE.has(`spell:${name}`)) return CACHE.get(`spell:${name}`)
  
  try {
    const result = await searchAon(name, 'spell')
    
    if (!result) {
      CACHE.set(`spell:${name}`, null)
      return null
    }
    
    const spellData = { name }
    
    // Ações
    if (result.actions) {
      const actionsMap = {
        'Single Action': '1',
        'Two Actions': '2', 
        'Three Actions': '3',
        'Reaction': 'reaction',
        'Free Action': 'free',
        'One to Two Actions': '1 to 2',
        'One to Three Actions': '1 to 3',
        'Two to Three Actions': '2 to 3'
      }
      spellData.actions = actionsMap[result.actions] || result.actions_number?.toString() || null
    }
    
    // Traits
    if (result.trait) {
      spellData.traits = Array.isArray(result.trait) ? result.trait.slice(0, 6) : [result.trait]
    }
    
    // Range
    if (result.range) spellData.range = result.range
    
    // Area
    if (result.area) spellData.area = result.area
    
    // Targets
    if (result.targets) spellData.targets = result.targets
    
    // Duration
    if (result.duration) spellData.duration = result.duration
    
    // Defense
    if (result.saving_throw || result.defense) {
      spellData.defense = result.saving_throw || result.defense
    }
    
    // Descrição
    let description = result.text || result.markdown || ''
    description = description
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (description.length > 400) {
      description = description.slice(0, 397) + '...'
    }
    
    // Traduz para português
    if (description) {
      description = await translateToPortuguese(description, 'magia (spell)')
    }
    spellData.description = description
    
    // Tenta extrair dano do texto
    const damageMatch = description.match(/(\d+d\d+)\s*(vitality|void|fire|cold|electricity|acid|sonic|mental|poison|force|bleed|slashing|piercing|bludgeoning)?/i)
    if (damageMatch) {
      spellData.damage = damageMatch[1]
      if (damageMatch[2]) spellData.damageType = damageMatch[2].toLowerCase()
    }
    
    // Heightened
    if (result.heightened) {
      spellData.heightened = result.heightened
    } else {
      // Tenta extrair do texto
      const heightened = {}
      const heightenedMatches = description.matchAll(/Heightened\s*\(([^)]+)\)\s*([^H\.]+)/gi)
      for (const match of heightenedMatches) {
        const level = match[1].trim()
        const effect = match[2].trim().slice(0, 100)
        heightened[level] = effect
      }
      if (Object.keys(heightened).length) spellData.heightened = heightened
    }
    
    console.log(`[scrapeSpell] Found "${name}": actions=${spellData.actions}, traits=${spellData.traits?.length || 0}`)
    
    CACHE.set(`spell:${name}`, spellData)
    return spellData
    
  } catch (e) {
    console.error(`[scrapeSpell] Error for "${name}":`, e.message)
    CACHE.set(`spell:${name}`, null)
    return null
  }
}

function json(res, code, data) {
  const body = JSON.stringify(data)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*'
  })
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    if (req.method === 'GET' && url.pathname === '/api/feat') {
      const name = url.searchParams.get('name') || ''
      if (!name) return json(res, 400, { error: 'missing name' })
      const desc = await scrapeFeatDescription(name)
      return json(res, 200, { name, description: desc })
    }
    if (req.method === 'GET' && url.pathname === '/api/search') {
      const name = url.searchParams.get('name') || ''
      if (!name) return json(res, 400, { error: 'missing name' })
      const desc = await scrapeGenericDescription(name)
      return json(res, 200, { name, description: desc })
    }
    if (req.method === 'GET' && url.pathname === '/api/spell') {
      const name = url.searchParams.get('name') || ''
      if (!name) return json(res, 400, { error: 'missing name' })
      const spellData = await scrapeSpellDescription(name)
      return json(res, 200, spellData || { name, description: null })
    }
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
      return json(res, 200, { ok: true })
    }
    res.writeHead(404)
    res.end('not found')
  } catch (e) {
    json(res, 500, { error: String(e && e.message ? e.message : e) })
  }
})

server.listen(PORT, () => {
  process.stdout.write(`api listening on http://localhost:${PORT}\n`)
})
