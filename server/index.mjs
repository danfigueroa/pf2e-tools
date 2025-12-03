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
  if (CACHE.has(name)) return CACHE.get(name)
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
  if (!featHref) { CACHE.set(name, null); return null }
  const detailUrl = featHref.startsWith('http') ? featHref : `https://2e.aonprd.com/${featHref.replace(/^\//, '')}`
  const detailHtml = await fetchHtml(detailUrl)
  const $$ = cheerio.load(detailHtml)
  const main = $$('#main')
  let description = ''
  const metaDesc = $$('meta[name="description"]').attr('content') || ''
  if (metaDesc && metaDesc.trim().length > 40) { CACHE.set(name, metaDesc.trim()); return metaDesc.trim() }
  const ld = $$('script[type="application/ld+json"]').first().text()
  if (ld) {
    try {
      const obj = JSON.parse(ld)
      const d = (obj && (obj.description || (obj[0]?.description))) || ''
      if (d && d.trim().length > 40) { CACHE.set(name, String(d).trim()); return String(d).trim() }
    } catch {}
  }
  const paras = main.find('p').map((_, el) => $$(el).text().replace(/\s+/g, ' ').trim()).get()
  const filtered = paras.filter((t) => t.length > 60 && !t.includes('|') && !/^Prerequisites?:/i.test(t) && !/^Requirements?:/i.test(t) && !/^Frequency:/i.test(t) && !/^Trigger:/i.test(t) && !/^Source:/i.test(t))
  if (filtered.length) description = filtered.slice(0, 2).join(' ')
  if (!description) description = main.text().replace(/\s+/g, ' ').trim().slice(0, 600)
  CACHE.set(name, description || null)
  return description || null
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
