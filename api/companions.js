// Batch endpoint: busca stats de múltiplos companheiros animais
import { searchAon, cleanAonText } from './_lib/aon.js'

async function extractCompanionStats(name, rawText, apiKey) {
  if (!apiKey || !rawText) return null

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
- size: use o tamanho base do companheiro
- speed: apenas o número em pés
- attacks: todos os ataques com nome, dado de dano e tipo (P/S/B)
- supportBenefit: benefício de suporte em português
- advancedManeuver: manobra avançada em português, ou null

Texto:
${rawText.substring(0, 2000)}`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 512,
        temperature: 0.1
      })
    })

    if (!response.ok) return null
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return null

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.size || !parsed.attacks || !parsed.supportBenefit) return null

    return {
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
  } catch {
    return null
  }
}

async function resolveCompanion(name, apiKey) {
  let bestMatch = null
  for (const query of [`${name} animal companion`, name]) {
    const results = await searchAon(query, null, 10)
    const match = results.find(r => {
      const n = (r._source.name || '').toLowerCase()
      return n.includes(name.toLowerCase()) && n.includes('companion')
    }) || results.find(r => r._source.name?.toLowerCase() === name.toLowerCase())
    if (match) { bestMatch = match; break }
  }

  if (!bestMatch) return null

  const source = bestMatch._source
  const rawText = cleanAonText(source.text || source.markdown || '')
  return await extractCompanionStats(name, rawText, apiKey)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let names
  try {
    names = req.body?.names
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'Campo "names" deve ser um array não-vazio' })
    }
  } catch {
    return res.status(400).json({ error: 'Body inválido' })
  }

  const apiKey = process.env.GROQ_API_KEY

  try {
    // Um por vez (cada chamada já é pesada por incluir AON + Groq)
    const results = {}
    for (const name of names) {
      const stats = await resolveCompanion(name, apiKey)
      if (stats) results[name] = stats
    }
    return res.status(200).json(results)
  } catch (error) {
    console.error('Companions batch API error:', error)
    return res.status(500).json({ error: 'Erro ao buscar companheiros' })
  }
}
