// Resolução de companheiro animal, compartilhada entre as funções serverless
// (api/companion.js, api/companions.js) e o servidor de dev (server/index.mjs).
//
// Busca no AON e extrai os stats via LLM, que devolve JSON — por isso usa
// runChainedPrompt com `clean: false`: a limpeza de prosa corromperia o JSON.
// A cadeia de fallback é a mesma da tradução, então um provedor fora do ar (ou
// um modelo aposentado) não derruba a aba de Pets.

import { searchAon, cleanAonText, runChainedPrompt } from './aon.js'

const PROMPT_HEADER = `Você é um especialista em Pathfinder 2e. A partir deste texto de companheiro animal, extraia os dados e retorne APENAS JSON válido. Traduza os campos de texto para português brasileiro.

Formato obrigatório:
{
  "size": "Pequeno",
  "speed": 35,
  "attacks": [{"name": "Mandíbulas", "damage": "1d8 perfurante", "traits": []}],
  "supportBenefit": "(descrição em pt-BR)",
  "advancedManeuver": "(descrição em pt-BR ou null)"
}

Regras (todos os campos de texto em português brasileiro — são exibidos direto na ficha):
- size: tamanho base do companheiro (Pequeno, Médio, Grande, …)
- speed: apenas o número em pés (velocidade de caminhada principal)
- attacks[].name: nome do ataque em português (ex.: "Mandíbulas", "Garras")
- attacks[].damage: dado + tipo de dano por extenso (ex.: "1d8 perfurante")
- supportBenefit: benefício de suporte
- advancedManeuver: manobra avançada, ou null se não houver

Texto:
`

// No AON, companheiros animais ficam na categoria 'animal-companion' (ex.:
// "Bear", "Wolf"). Sem o filtro, a busca por "Bear" cai na creature-family ou
// no feat genérico "Animal Companion".
async function findCompanion(name) {
  const lower = String(name).toLowerCase()

  const byCategory = await searchAon(name, 'animal-companion', 10)
  const exact = byCategory.find(r => r._source?.name?.toLowerCase() === lower)
  if (exact) return exact
  if (byCategory.length > 0) return byCategory[0]

  for (const query of [`${name} animal companion`, name]) {
    const results = await searchAon(query, null, 10)
    const match = results.find(r => {
      const n = (r._source?.name || '').toLowerCase()
      return n.includes(lower) && n.includes('companion')
    }) || results.find(r => r._source?.name?.toLowerCase() === lower)
    if (match) return match
  }

  return null
}

export async function resolveCompanion(name, translationEnabled) {
  if (!translationEnabled) return null

  const best = await findCompanion(name)
  if (!best) return null

  const rawText = cleanAonText(best._source.text || best._source.markdown || '')
  if (!rawText) return null

  const raw = await runChainedPrompt(`${PROMPT_HEADER}${rawText.substring(0, 2000)}`, {
    // 2048, não 512: modelos de reasoning (gpt-oss) gastam o orçamento de saída
    // pensando antes de escrever, e com 512 o JSON vinha vazio — era isso que
    // deixava a aba de Pets sem stats.
    maxTokens: 2048,
    clean: false,
    validate: t => /\{[\s\S]*\}/.test(t),
  })
  if (!raw) return null

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.size || !parsed.attacks || !parsed.supportBenefit) return null

    return {
      size: String(parsed.size),
      speed: Number(parsed.speed) || 25,
      attacks: Array.isArray(parsed.attacks) ? parsed.attacks.map(a => ({
        name: String(a.name || ''),
        damage: String(a.damage || ''),
        traits: Array.isArray(a.traits) ? a.traits.map(String) : [],
      })) : [],
      supportBenefit: String(parsed.supportBenefit),
      advancedManeuver: parsed.advancedManeuver ? String(parsed.advancedManeuver) : null,
    }
  } catch {
    return null
  }
}
