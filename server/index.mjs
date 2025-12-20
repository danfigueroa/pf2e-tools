import http from 'node:http'
import { URL } from 'node:url'
import * as cheerio from 'cheerio'

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'pf2e-tools/1.0 (+https://localhost)'
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return await res.text()
}

const CACHE = new Map()

async function scrapeFeatDescription(name) {
  if (CACHE.has(`feat:${name}`)) return CACHE.get(`feat:${name}`)
  const q = encodeURIComponent(name)
  const searchUrl = `https://2e.aonprd.com/Search.aspx?q=${q}`
  const html = await fetchHtml(searchUrl)
  const $ = cheerio.load(html)
  let featHref = null
  $('a[href*="/Feats.aspx?ID="]').each((_, el) => {
    const text = $(el).text().trim()
    const href = $(el).attr('href') || ''
    if (!href.includes('/Feats.aspx?ID=')) return
    if (!featHref) featHref = href
    if (text.toLowerCase() === name.trim().toLowerCase()) {
      featHref = href
      return false
    }
  })
  if (!featHref) { CACHE.set(`feat:${name}`, null); return null }
  const detailUrl = featHref.startsWith('http') ? featHref : `https://2e.aonprd.com/${featHref.replace(/^\//, '')}`
  const detailHtml = await fetchHtml(detailUrl)
  const $$ = cheerio.load(detailHtml)
  const main = $$('#main')
  let description = ''
  const metaDesc = $$('meta[name="description"]').attr('content') || ''
  if (metaDesc && metaDesc.trim().length > 40) { CACHE.set(`feat:${name}`, metaDesc.trim()); return metaDesc.trim() }
  const ld = $$('script[type="application/ld+json"]').first().text()
  if (ld) {
    try {
      const obj = JSON.parse(ld)
      const d = (obj && (obj.description || (obj[0]?.description))) || ''
      if (d && d.trim().length > 40) { CACHE.set(`feat:${name}`, String(d).trim()); return String(d).trim() }
    } catch {}
  }
  const paras = main.find('p').map((_, el) => $$(el).text().replace(/\s+/g, ' ').trim()).get()
  const filtered = paras.filter((t) => t.length > 60 && !t.includes('|') && !/^Prerequisites?:/i.test(t) && !/^Requirements?:/i.test(t) && !/^Frequency:/i.test(t) && !/^Trigger:/i.test(t) && !/^Source:/i.test(t))
  if (filtered.length) description = filtered.slice(0, 2).join(' ')
  if (!description) description = main.text().replace(/\s+/g, ' ').trim().slice(0, 600)
  CACHE.set(`feat:${name}`, description || null)
  return description || null
}

// Busca genérica na AON para qualquer tipo de conteúdo (class features, specials, etc.)
async function scrapeGenericDescription(name) {
  if (CACHE.has(`generic:${name}`)) return CACHE.get(`generic:${name}`)
  const q = encodeURIComponent(name)
  const searchUrl = `https://2e.aonprd.com/Search.aspx?q=${q}`
  
  try {
    const html = await fetchHtml(searchUrl)
    const $ = cheerio.load(html)
    
    // Procura o primeiro resultado que corresponda ao nome
    let bestHref = null
    let bestMatch = false
    
    // Procura em várias categorias de links
    $('a').each((_, el) => {
      const text = $(el).text().trim()
      const href = $(el).attr('href') || ''
      
      // Ignora links de navegação e busca
      if (!href || href.startsWith('#') || href.includes('Search.aspx')) return
      if (!href.includes('.aspx?ID=')) return
      
      // Match exato tem prioridade
      if (text.toLowerCase() === name.trim().toLowerCase()) {
        bestHref = href
        bestMatch = true
        return false
      }
      
      // Primeiro resultado válido como fallback
      if (!bestHref && text.toLowerCase().includes(name.trim().toLowerCase().split(' ')[0])) {
        bestHref = href
      }
    })
    
    if (!bestHref) { 
      CACHE.set(`generic:${name}`, null)
      return null 
    }
    
    const detailUrl = bestHref.startsWith('http') ? bestHref : `https://2e.aonprd.com/${bestHref.replace(/^\//, '')}`
    const detailHtml = await fetchHtml(detailUrl)
    const $$ = cheerio.load(detailHtml)
    
    let description = ''
    
    // Tenta pegar a meta description
    const metaDesc = $$('meta[name="description"]').attr('content') || ''
    if (metaDesc && metaDesc.trim().length > 30) {
      description = metaDesc.trim()
    }
    
    // Se não encontrou, tenta JSON-LD
    if (!description) {
      const ld = $$('script[type="application/ld+json"]').first().text()
      if (ld) {
        try {
          const obj = JSON.parse(ld)
          const d = (obj && (obj.description || (obj[0]?.description))) || ''
          if (d && d.trim().length > 30) description = String(d).trim()
        } catch {}
      }
    }
    
    // Se não encontrou, pega o texto do main
    if (!description) {
      const main = $$('#main')
      const paras = main.find('p').map((_, el) => $$(el).text().replace(/\s+/g, ' ').trim()).get()
      const filtered = paras.filter((t) => 
        t.length > 40 && 
        !t.includes('|') && 
        !/^Source:/i.test(t) &&
        !/^Prerequisites?:/i.test(t)
      )
      if (filtered.length) {
        description = filtered.slice(0, 2).join(' ')
      }
    }
    
    // Limita o tamanho
    if (description && description.length > 300) {
      description = description.slice(0, 297) + '...'
    }
    
    CACHE.set(`generic:${name}`, description || null)
    return description || null
    
  } catch (e) {
    CACHE.set(`generic:${name}`, null)
    return null
  }
}

// Busca informações detalhadas de uma magia na AON
async function scrapeSpellDescription(name) {
  if (CACHE.has(`spell:${name}`)) return CACHE.get(`spell:${name}`)
  const q = encodeURIComponent(name)
  const searchUrl = `https://2e.aonprd.com/Search.aspx?q=${q}`
  
  try {
    const html = await fetchHtml(searchUrl)
    const $ = cheerio.load(html)
    
    // Procura link para a magia
    let spellHref = null
    $('a[href*="/Spells.aspx?ID="]').each((_, el) => {
      const text = $(el).text().trim()
      const href = $(el).attr('href') || ''
      if (!spellHref) spellHref = href
      if (text.toLowerCase() === name.trim().toLowerCase()) {
        spellHref = href
        return false
      }
    })
    
    if (!spellHref) {
      CACHE.set(`spell:${name}`, null)
      return null
    }
    
    const detailUrl = spellHref.startsWith('http') ? spellHref : `https://2e.aonprd.com/${spellHref.replace(/^\//, '')}`
    const detailHtml = await fetchHtml(detailUrl)
    const $$ = cheerio.load(detailHtml)
    
    const result = { name }
    
    // Extrai informações do texto da página
    const mainText = $$('#main').text()
    const mainHtml = $$('#main').html() || ''
    
    // Ações - procura por padrões como [one-action], [two-actions], etc
    if (mainHtml.includes('one-action') || mainText.includes('1 action')) result.actions = '1'
    else if (mainHtml.includes('two-actions') || mainText.includes('2 actions')) result.actions = '2'
    else if (mainHtml.includes('three-actions') || mainText.includes('3 actions')) result.actions = '3'
    else if (mainHtml.includes('reaction')) result.actions = 'reaction'
    else if (mainHtml.includes('free-action')) result.actions = 'free'
    
    // Traits
    const traits = []
    $$('a[href*="/Traits.aspx"]').each((_, el) => {
      const trait = $$(el).text().trim().toLowerCase()
      if (trait && !traits.includes(trait)) traits.push(trait)
    })
    if (traits.length) result.traits = traits.slice(0, 6)
    
    // Range
    const rangeMatch = mainText.match(/Range\s+([^;]+)/i)
    if (rangeMatch) result.range = rangeMatch[1].trim()
    
    // Area
    const areaMatch = mainText.match(/Area\s+([^;]+)/i)
    if (areaMatch) result.area = areaMatch[1].trim()
    
    // Targets
    const targetsMatch = mainText.match(/Targets?\s+([^;]+)/i)
    if (targetsMatch) result.targets = targetsMatch[1].trim()
    
    // Duration
    const durationMatch = mainText.match(/Duration\s+([^;]+)/i)
    if (durationMatch) result.duration = durationMatch[1].trim()
    
    // Defense/Saving Throw
    const defenseMatch = mainText.match(/Defense\s+([^;]+)/i) || mainText.match(/Saving Throw\s+([^;]+)/i)
    if (defenseMatch) result.defense = defenseMatch[1].trim()
    
    // Damage - procura padrões de dano
    const damageMatch = mainText.match(/(\d+d\d+)\s*(vitality|void|fire|cold|electricity|acid|sonic|mental|poison|force|bleed|persistent|slashing|piercing|bludgeoning)?/i)
    if (damageMatch) {
      result.damage = damageMatch[1]
      if (damageMatch[2]) result.damageType = damageMatch[2].toLowerCase()
    }
    
    // Heightened
    const heightened = {}
    const heightenedMatches = mainText.matchAll(/Heightened\s*\(([^)]+)\)\s*([^H]+)/gi)
    for (const match of heightenedMatches) {
      const level = match[1].trim()
      const effect = match[2].trim().slice(0, 100)
      heightened[level] = effect
    }
    if (Object.keys(heightened).length) result.heightened = heightened
    
    // Descrição - pega o texto principal
    const metaDesc = $$('meta[name="description"]').attr('content') || ''
    if (metaDesc && metaDesc.length > 30) {
      result.description = metaDesc.trim().slice(0, 400)
    } else {
      const paras = $$('#main p').map((_, el) => $$(el).text().replace(/\s+/g, ' ').trim()).get()
      const filtered = paras.filter((t) => 
        t.length > 30 && 
        !t.includes('Source') &&
        !t.startsWith('Range') &&
        !t.startsWith('Area') &&
        !t.startsWith('Duration') &&
        !t.startsWith('Targets')
      )
      if (filtered.length) {
        result.description = filtered.slice(0, 2).join(' ').slice(0, 400)
      }
    }
    
    CACHE.set(`spell:${name}`, result)
    return result
    
  } catch (e) {
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
    if (req.method === 'GET' && url.pathname === '/health') {
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
