import 'dotenv/config'
import http from 'node:http'
import { URL } from 'node:url'
import { resolveSpell } from '../api/_lib/spells-core.js'
import { resolveFeat, resolveSpecial } from '../api/_lib/feat-core.js'
import { resolveCompanion } from '../api/_lib/companion-core.js'
import { resolveCreatures } from '../api/_lib/creature-core.js'
import { resolveMonster } from '../api/_lib/monster-core.js'
import { hasTranslationKey } from '../api/_lib/aon.js'
import {
  readCharacter,
  writeField,
  isValidSlug,
  isValidField,
  isStoreConfigured,
  MAX_FIELD_BYTES,
} from '../api/_lib/table-store.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001
// Gate de tradução: as chaves em si (GEMINI_API_KEY / GROQ_API_KEY) são lidas
// por provedor dentro de api/_lib/aon.js.
const TRANSLATION_ENABLED = hasTranslationKey()
const CACHE = new Map()


// Talentos e habilidades especiais: mesma resolução do serverless
// (api/_lib/feat-core.js). Aqui só entra o cache em memória do dev server —
// payloads com translationPending (ex.: 429 do Groq) NÃO são cacheados, para
// que a próxima consulta retraduza em vez de fixar o inglês.
async function resolveEntryCached(name, kind) {
  const cacheKey = `${kind}:${name}`
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)

  const resolver = kind === 'feat' ? resolveFeat : resolveSpecial
  const entry = await resolver(name, TRANSLATION_ENABLED)
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
    const spellData = await resolveSpell(spellName, TRANSLATION_ENABLED)
    // Tradução pendente (ex.: 429 do Groq) → não cachear, retenta na próxima.
    if (spellData && !spellData.translationPending) CACHE.set(cacheKey, spellData)
    return spellData
  } catch (e) {
    console.error(`[spell] Erro:`, e.message)
    return null
  }
}

// Companheiros animais: mesma resolução do serverless
// (api/_lib/companion-core.js). Aqui só entra o cache em memória do dev server.
async function resolveCompanionCached(animalName) {
  const cacheKey = `companion:${animalName}`
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)

  const stats = await resolveCompanion(animalName, TRANSLATION_ENABLED)
  if (stats) {
    console.log(`[companion] ${animalName}: ${stats.size}, ${stats.speed} pés`)
    CACHE.set(cacheKey, stats)
  } else {
    console.log(`[companion] Não resolvido: ${animalName}`)
  }
  return stats
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
      hasApiKey: TRANSLATION_ENABLED,
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
      const stats = await resolveCompanionCached(name)
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

  // Busca de criaturas (gerenciador de iniciativa) — só dados estruturados,
  // sem passar pela cadeia de tradução.
  if (pathname === '/api/creature') {
    // Modo ficha completa (?name=). Vive no MESMO endpoint que a busca porque o
    // plano Hobby da Vercel só permite 12 funções serverless — ver api/creature.js.
    const name = (parsedUrl.searchParams.get('name') || '').trim()
    if (name) {
      try {
        const monster = await resolveMonster(name)
        if (!monster) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Criatura não encontrada' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(monster))
      } catch (e) {
        console.error('[/api/creature?name] Error:', e)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
      return
    }

    const term = (parsedUrl.searchParams.get('q') || '').trim()
    const level = (name) => {
      const raw = parsedUrl.searchParams.get(name)
      if (raw === null || raw.trim() === '') return null
      const n = parseInt(raw, 10)
      return Number.isFinite(n) ? n : null
    }
    const minLevel = level('minLevel')
    const maxLevel = level('maxLevel')

    if (!term && minLevel === null && maxLevel === null) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Informe um nome ou uma faixa de nível' }))
      return
    }
    try {
      const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 8
      const offset = parseInt(parsedUrl.searchParams.get('offset'), 10) || 0
      const page = await resolveCreatures(term, limit, { minLevel, maxLevel, offset })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(page))
    } catch (e) {
      console.error('[/api/creature] Error:', e)
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
        const stats = await resolveCompanionCached(name)
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

  // Estado compartilhado da mesa (PV, slots, foco, condições).
  // Mesma persistência do serverless (api/_lib/table-store.js) — aqui só entra
  // o roteamento.
  if (pathname === '/api/state') {
    res.setHeader('Cache-Control', 'no-store')

    if (req.method === 'GET') {
      const char = parsedUrl.searchParams.get('char')
      if (!isValidSlug(char)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Parâmetro "char" inválido' }))
        return
      }
      try {
        const fields = await readCharacter(char)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ char, fields, storeReady: isStoreConfigured() }))
      } catch (e) {
        console.error('[/api/state] Erro ao ler:', e)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Erro ao ler o estado da mesa' }))
      }
      return
    }

    if (req.method === 'POST') {
      const { char, field, data } = await readBody(req)
      if (!isValidSlug(char)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Campo "char" inválido' }))
        return
      }
      if (!isValidField(field)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Campo "field" inválido' }))
        return
      }
      if (data === undefined) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Campo "data" ausente' }))
        return
      }
      if (JSON.stringify(data).length > MAX_FIELD_BYTES) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Estado grande demais' }))
        return
      }
      try {
        const updatedAt = await writeField(char, field, data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, updatedAt, storeReady: isStoreConfigured() }))
      } catch (e) {
        console.error('[/api/state] Erro ao gravar:', e)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Erro ao gravar o estado da mesa' }))
      }
      return
    }

    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`api listening on http://localhost:${PORT}`)
  const providers = ['GEMINI_API_KEY', 'GROQ_API_KEY'].filter(k => process.env[k])
  if (providers.length === 0) {
    console.log('⚠️  Nenhuma chave (GEMINI_API_KEY / GROQ_API_KEY) - traduções desabilitadas')
  } else {
    console.log(`✓ Traduções habilitadas via: ${providers.join(', ')}`)
  }
})
