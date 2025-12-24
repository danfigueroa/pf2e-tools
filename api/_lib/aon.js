// Funções compartilhadas para busca no Archives of Nethys

// Cache em memória (nota: cada invocação serverless pode ter seu próprio cache)
const cache = new Map()

// Limpa texto do AON removendo tags e entidades HTML
export function cleanAonText(text) {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extrai a descrição principal removendo metadados
export function extractMainDescription(text, maxLength = 600) {
  if (!text) return ''
  
  let cleaned = cleanAonText(text)
  
  // Remove padrões de metadados comuns
  cleaned = cleaned
    .replace(/^(Fonte|Source):?\s*[^.]+\./i, '')
    .replace(/\b(Fonte|Source)\s+[A-Z][^.]+\.\s*/g, '')
    .replace(/\bpg\.\s*\d+\s*/g, '')
    .replace(/\b\d+\.\d+\s*/g, '')
    .replace(/\b(PFS|Standard|Limited|Restricted)\b/gi, '')
    .replace(/Pré-requisitos?:?\s*[^.]+\./gi, '')
    .replace(/Prerequisites?:?\s*[^.]+\./gi, '')
    .replace(/Frequen(cy|cia):?\s*[^.]+\./gi, '')
    .replace(/Trigger:?\s*[^.]+\./gi, '')
    .replace(/Gatilho:?\s*[^.]+\./gi, '')
    .replace(/(Leads to|Leva a)\.{3}[^.]*\.?/gi, '')
    .replace(/---/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Remove prefixo repetido do nome
  const firstDash = cleaned.indexOf(' --- ')
  if (firstDash > 0 && firstDash < 100) {
    cleaned = cleaned.substring(firstDash + 5).trim()
  }
  
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

// Traduz texto para português usando Groq
export async function translateToPortuguese(text, apiKey) {
  if (!text || !apiKey) return text
  
  const prompt = `Traduza para português brasileiro o seguinte texto de RPG Pathfinder 2e. Mantenha termos técnicos em inglês quando apropriado (como "flat-footed", "flanking"). Retorne APENAS a tradução, sem explicações:\n\n${text}`
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        temperature: 0.3
      })
    })
    
    if (!response.ok) {
      console.error('Groq API error:', response.status)
      return text
    }
    
    const data = await response.json()
    let translated = data.choices?.[0]?.message?.content?.trim()
    
    if (!translated) return text
    
    translated = cleanTranslation(translated)
    
    // Validação básica
    if (translated.length < text.length * 0.3) {
      return text
    }
    
    return translated
  } catch (error) {
    console.error('Translation error:', error)
    return text
  }
}

export function getCache() {
  return cache
}

export function clearCache() {
  cache.clear()
}

