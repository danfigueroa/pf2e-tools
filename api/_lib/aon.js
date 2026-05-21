// Funções compartilhadas para busca no Archives of Nethys

// Cache em memória (nota: cada invocação serverless pode ter seu próprio cache)
const cache = new Map()

// Limpa texto do AON removendo tags e entidades HTML
export function cleanAonText(text) {
  if (!text) return ''
  return text
    // Inserir pontuação ao fechar blocos para que itens de lista/parágrafo não fiquem
    // colados (ex.: "<li>1</li><li>2</li>" não vire "1 2" sem separador semântico)
    .replace(/<\/(li|p|h[1-6]|tr|td|th|div)>/gi, '. ')
    .replace(/<br\s*\/?>(?!\s*<)/gi, '. ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\.\s*\.\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extrai a descrição principal removendo metadados
export function extractMainDescription(text, maxLength = 2000) {
  if (!text) return ''

  // AON usa <hr> para separar o bloco de metadados da descrição.
  // Split aqui ANTES de cleanAonText para não precisar remover campos via regex.
  const hrMatch = text.match(/<hr\s*\/?>/i)
  if (hrMatch) {
    text = text.substring(hrMatch.index + hrMatch[0].length)
  } else {
    // Fallback: markdown usa separador \n---\n
    const mdParts = text.split(/\n-{3,}\n/)
    if (mdParts.length > 1) {
      text = mdParts.slice(1).join('\n---\n')
    }
  }

  let cleaned = cleanAonText(text)

  // Remove padrões de metadados comuns (fallback para quando <hr> não existir)
  cleaned = cleaned
    // Source/Fonte com livro + "pg./p. NN" — alta confiança
    .replace(/\b(?:Fonte|Source)s?:?\s+[^.\n]+?\s+p(?:g)?\.\s*\d+\s*/gi, ' ')
    // Source/Fonte com livro terminado por separador --- ou em-dash
    .replace(/\b(?:Fonte|Source)s?:?\s+[^.\n]+?(?=\s*(?:---+|[—–]+))/gi, ' ')
    // Source/Fonte: <livro>. (com colon e ponto final)
    .replace(/^(Fonte|Source):?\s*[^.]+\./i, '')
    .replace(/\b(Fonte|Source)\s+[A-Z][^.]+\.\s*/g, '')
    // Refs de página soltas
    .replace(/\bp(?:g)?\.\s*\d+\s*/g, '')
    .replace(/\b\d+\.\d+\s*/g, '')
    // Referências a livros do PF2e (ex.: "Player Core 2 250", "Core Rulebook 320")
    .replace(/\b(Player Core|Core Rulebook|Advanced Player'?s? Guide|Secrets of Magic|Guns and Gears|Dark Archive|Book of the Dead|Rage of Elements|Treasure Vault|Gamemastery Guide|Bestiary(?:\s\d)?)(?:\s\d)?\s+\d{1,4}\b/gi, '')
    .replace(/\b(PFS|Standard|Limited|Restricted)\b/gi, '')
    .replace(/Pré-requisitos?:?\s*[^.]+\./gi, '')
    .replace(/Prerequisites?:?\s*[^.]+\./gi, '')
    .replace(/Frequen(cy|cia):?\s*[^.]+\./gi, '')
    .replace(/Trigger:?\s*[^.]+\./gi, '')
    .replace(/Gatilho:?\s*[^.]+\./gi, '')
    .replace(/(Leads to|Leva a)\.{3}[^.]*\.?/gi, '')
    // Metadados de magia que aparecem como texto inline no AON antes da descrição
    .replace(/\bCast:?\s+[^.]+\.?\s*/gi, '')
    .replace(/\bTraditions?:?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\bBloodlines?:?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\bSubclasses?:?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\bRange:?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\bArea:?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\bTargets?:?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\bDuration:?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\b(?:Saving Throw|Defense):?\s+[^.\n]+\.?\s*/gi, '')
    .replace(/\bComponents?:?\s+[^.\n]+\.?\s*/gi, '')
    // Separadores temáticos (--- e em/en-dash)
    .replace(/\s*-{2,}\s*/g, ' ')
    .replace(/\s*[—–]+\s*/g, ' ')
    // Remove marcadores de lista órfãos: "1." / "1)" no início, ou após ponto/quebra
    // (somente quando seguidos de letra maiúscula — evita atingir "1d6", "+2", "5 feet")
    .replace(/(^|[.;:!?]\s)\d{1,2}[.)]\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕ])/g, '$1')
    // Número órfão no início (resíduo de "Source ... pg." ou ref de livro removida)
    .replace(/^\s*\d{1,4}\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕ])/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength - 3) + '...'
  }

  return cleaned
}

// Busca no Elasticsearch do AON
export async function searchAon(query, category = null, limit = 5) {
  const cacheKey = `search:${query}:${category}:${limit}`
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }
  
  try {
    const searchBody = {
      size: limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: query,
                fields: ['name^10', 'name.keyword^15', 'text', 'markdown'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ]
        }
      }
    }
    
    if (category) {
      searchBody.query.bool.filter = [{ term: { category: category } }]
    }
    
    const response = await fetch('https://elasticsearch.aonprd.com/aon/_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    })
    
    if (!response.ok) {
      throw new Error(`AON search failed: ${response.status}`)
    }
    
    const data = await response.json()
    const results = data.hits?.hits || []
    
    cache.set(cacheKey, results)
    return results
  } catch (error) {
    console.error('AON search error:', error)
    return []
  }
}

// Limpa tradução de problemas comuns
export function cleanTranslation(text) {
  if (!text) return ''
  
  let cleaned = text
    .replace(/^(Tradução|Translation|TRADUÇÃO|Aqui está|Here is|Here's|TIPO:[^\n]*|Tradução em português:?|Portuguese:?|Resposta:?)\s*/gi, '')
    .replace(/^["']|["']$/g, '')
    .replace(/^\s*\n+/, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  
  // Remove caracteres vietnamitas/estranhos
  const charMap = {
    'ỹ': 'y', 'Ỹ': 'Y', 'ỳ': 'y', 'Ỳ': 'Y', 'ỷ': 'y', 'ỵ': 'y',
    'ẵ': 'ã', 'Ẵ': 'Ã', 'ặ': 'a', 'Ặ': 'A', 'ắ': 'á', 'ằ': 'à', 'ẳ': 'a', 'ẫ': 'ã',
    'ề': 'ê', 'Ề': 'Ê', 'ể': 'ê', 'Ể': 'Ê', 'ễ': 'ê', 'ệ': 'ê', 'ế': 'é',
    'ị': 'i', 'Ị': 'I', 'ỉ': 'i', 'ĩ': 'i',
    'ọ': 'o', 'Ọ': 'O', 'ỏ': 'o', 'ố': 'ô', 'ồ': 'ô', 'ổ': 'ô', 'ỗ': 'ô', 'ộ': 'ô',
    'ụ': 'u', 'Ụ': 'U', 'ử': 'u', 'Ử': 'U', 'ũ': 'u', 'ủ': 'u', 'ứ': 'u', 'ừ': 'u',
    'ơ': 'o', 'Ơ': 'O', 'ư': 'u', 'Ư': 'U', 'ờ': 'o', 'ớ': 'o', 'ở': 'o',
  }
  
  cleaned = cleaned.replace(/[\u1E00-\u1EFF]/g, (char) => charMap[char] || '')
  
  // Corrige espaçamento letra por letra
  cleaned = cleaned.replace(/\b([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])\s+([a-záàâãéêíóôõúç])(\s+[a-záàâãéêíóôõúç])*/gi, (match) => {
    return match.replace(/\s+/g, '')
  })
  
  cleaned = cleaned.replace(/[ỹỳỷỵ]+/g, 'y')
  cleaned = cleaned.replace(/(.)\1{3,}/g, '$1$1')
  cleaned = cleaned.replace(/\s{2,}/g, ' ')
  
  return cleaned.trim()
}

// Traduz texto para português usando Groq, com 1 retry para falhas transitórias
export async function translateToPortuguese(text, apiKey) {
  if (!text || !apiKey) return text

  const prompt = `Traduza para português brasileiro o seguinte texto de RPG Pathfinder 2e. Mantenha termos técnicos em inglês quando apropriado (como "flat-footed", "flanking"). Retorne APENAS a tradução, sem explicações:\n\n${text}`

  const attempt = async () => {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const transient = response.status === 429 || response.status >= 500
      throw Object.assign(new Error(`Groq ${response.status}`), { transient, status: response.status })
    }

    const data = await response.json()
    const translated = data.choices?.[0]?.message?.content?.trim()
    if (!translated) throw Object.assign(new Error('Resposta vazia'), { transient: true })
    return cleanTranslation(translated)
  }

  for (let i = 0; i < 2; i++) {
    try {
      const translated = await attempt()
      // Validação básica — se devolver muito menos que o original é provável que tenha
      // sido truncado/erro de tradução. Retentar uma vez antes de cair no original.
      if (translated.length < text.length * 0.3 && i === 0) continue
      return translated
    } catch (error) {
      if (error?.transient && i === 0) {
        await new Promise(r => setTimeout(r, 400))
        continue
      }
      console.error('Translation error:', error?.message || error)
      return text
    }
  }
  return text
}

// Gera descrição via Groq quando o item não é encontrado no AON
export async function generateFallbackDescription(name, itemType, apiKey) {
  if (!name || !apiKey) return null

  const typeLabel = {
    feat: 'talento',
    spell: 'magia',
    'class-feature': 'habilidade de classe',
    special: 'habilidade especial',
  }[itemType] || 'habilidade'

  const prompt = `Em 1-2 frases curtas em português brasileiro, descreva o que é "${name}" no RPG Pathfinder 2e (${typeLabel}). Seja direto e objetivo. Retorne APENAS a descrição, sem formatação.`

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 256,
        temperature: 0.3
      })
    })

    if (!response.ok) return null

    const data = await response.json()
    let result = data.choices?.[0]?.message?.content?.trim()
    if (!result || result.length < 10) return null

    return cleanTranslation(result)
  } catch {
    return null
  }
}

export function getCache() {
  return cache
}

export function clearCache() {
  cache.clear()
}

