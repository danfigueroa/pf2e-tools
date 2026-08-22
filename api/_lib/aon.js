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

  // AON separa o bloco de metadados da descrição com <hr> (campo `markdown`)
  // ou com "---" (campo `text`, onde o separador vem inline, sem quebra de linha).
  // Split aqui ANTES de cleanAonText para não precisar remover campos via regex.
  // Só o PRIMEIRO separador divide: os seguintes (ex.: antes de "Heightened")
  // fazem parte da descrição e são preservados.
  const sepMatch = text.match(/<hr\s*\/?>|(?:^|\s)-{3,}(?:\s|$)/i)
  const hasSeparator = Boolean(sepMatch)
  if (sepMatch) {
    text = text.substring(sepMatch.index + sepMatch[0].length)
  }

  let cleaned = cleanAonText(text)

  // Fallback para entradas SEM separador: remove os campos de metadados por
  // rótulo. É heurístico e perigoso — rótulos como "Target", "Range", "Cast" e
  // "Trigger" também ocorrem em prosa legítima ("If the target is…"), e aí o
  // regex come o resto da frase. Por isso só roda quando não houve separador.
  if (!hasSeparator) {
    cleaned = cleaned
      .replace(/\bPré-requisitos?\b:?\s*[^.]+\./gi, '')
      .replace(/\bPrerequisites?\b:?\s*[^.]+\./gi, '')
      .replace(/\bFrequen(?:cy|cia)\b:?\s*[^.]+\./gi, '')
      .replace(/\bTriggers?\b:?\s*[^.]+\./gi, '')
      .replace(/\bGatilhos?\b:?\s*[^.]+\./gi, '')
      .replace(/\bCast\b:?\s+[^.]+\.?\s*/gi, '')
      .replace(/\bTraditions?\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\bBloodlines?\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\bSubclasses?\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\bRange\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\bArea\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\bTargets?\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\bDuration\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\b(?:Saving Throw|Defense)\b:?\s+[^.\n]+\.?\s*/gi, '')
      .replace(/\bComponents?\b:?\s+[^.\n]+\.?\s*/gi, '')
  }

  // Limpeza sempre segura (refs bibliográficas, separadores, resíduos)
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
    .replace(/(Leads to|Leva a)\.{3}[^.]*\.?/gi, '')
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

// ---- Fila global de chamadas ao Groq ---------------------------------------
// Serializa e espaça as chamadas para respeitar o rate limit (TPM/RPM) do tier
// gratuito. Sem isso, cargas em lote ("Carregar todas") disparam dezenas de
// traduções em rajada e quase todas caem em 429 → fallback EN.
const GROQ_MIN_INTERVAL_MS = 800
let groqChain = Promise.resolve()
let lastGroqCallAt = 0

function scheduleGroqCall(fn) {
  const run = async () => {
    const wait = lastGroqCallAt + GROQ_MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    lastGroqCallAt = Date.now()
    return fn()
  }
  const p = groqChain.then(run, run)
  groqChain = p.catch(() => {})
  return p
}

async function callGroq(prompt, apiKey, { model = 'llama-3.3-70b-versatile', maxTokens = 2048 } = {}) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3
    })
  })

  if (!response.ok) {
    const transient = response.status === 429 || response.status >= 500
    // 400/404 = modelo inválido ou descontinuado. NÃO é transitório (esperar não
    // ajuda), mas também não pode abortar a cadeia: o próximo modelo da lista
    // pode estar ativo. Foi exatamente isso que travou tudo em inglês quando o
    // Groq aposentou o llama-3.3-70b-versatile.
    const badModel = response.status === 400 || response.status === 404
    const retryAfter = Number(response.headers.get('retry-after')) || 0
    throw Object.assign(new Error(`Groq ${response.status} (${model})`), { transient, badModel, status: response.status, retryAfter })
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim()
}

// Traduz texto para português usando Groq. Tenta o modelo principal 2x e cai
// para o gpt-oss-20b (mais rápido e com rate limit separado) antes de desistir.
// ATENÇÃO: o Groq aposenta modelos sem aviso — quando TODOS os modelos desta
// lista devolvem 404, nada é traduzido e a ficha inteira volta em inglês.
// Confira em https://console.groq.com/docs/models ou GET /openai/v1/models.
const TRANSLATION_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']

// Executa um prompt de tradução percorrendo a cadeia de modelos. `validate`
// rejeita respostas suspeitas (truncamento, marcadores perdidos) e força o
// próximo modelo. Devolve null quando todas as tentativas falham — quem chama
// decide o fallback (normalmente: manter o inglês e marcar translationPending).
async function runTranslationPrompt(prompt, apiKey, { maxTokens = 4096, validate } = {}) {
  for (let i = 0; i < TRANSLATION_MODELS.length; i++) {
    const isLast = i === TRANSLATION_MODELS.length - 1
    try {
      const raw = await scheduleGroqCall(() => callGroq(prompt, apiKey, { model: TRANSLATION_MODELS[i], maxTokens }))
      if (!raw) throw Object.assign(new Error('Resposta vazia'), { transient: true })
      const cleaned = cleanTranslation(raw)
      if (validate && !validate(cleaned) && !isLast) continue
      return cleaned
    } catch (error) {
      if ((error?.transient || error?.badModel) && !isLast) {
        if (error.badModel) {
          console.error(`Modelo indisponível no Groq: ${TRANSLATION_MODELS[i]} — tentando o próximo`)
          // Pula as repetições do mesmo modelo (a lista repete o principal só
          // para dar uma 2ª chance a falhas transitórias, não a um 404).
          while (i + 1 < TRANSLATION_MODELS.length && TRANSLATION_MODELS[i + 1] === TRANSLATION_MODELS[i]) i++
          continue
        }
        // 429: respeita o retry-after do Groq (com teto para não estourar o
        // timeout serverless); demais falhas transitórias esperam pouco.
        const waitMs = error?.status === 429
          ? Math.min((error.retryAfter || 2.5) * 1000, 4000)
          : 400
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }
      console.error('Translation error:', error?.message || error)
      return null
    }
  }
  return null
}

const TRANSLATION_PREAMBLE = 'Traduza para português brasileiro o texto de RPG Pathfinder 2e abaixo. Traduza TODA a prosa, inclusive graus de proficiência (trained → treinado, expert → perito, master → mestre, legendary → lendário) e vocabulário comum ("skill" → "perícia", "check" → "teste", "damage" → "dano"). Mantenha em inglês APENAS os nomes próprios (de magias, talentos, criaturas e livros) e os nomes de ações e condições do sistema: Strike, Stride, Step, Seek, Interact, Escape, Grapple, Demoralize, flat-footed, off-guard, flanking, grabbed, prone, frightened.'

export async function translateToPortuguese(text, apiKey) {
  if (!text || !apiKey) return text

  const prompt = `${TRANSLATION_PREAMBLE} Retorne APENAS a tradução, sem explicações:\n\n${text}`
  // Validação básica — se devolver muito menos que o original é provável que
  // tenha sido truncado/erro de tradução. Retentar antes de cair no original.
  const out = await runTranslationPrompt(prompt, apiKey, {
    validate: t => t.length >= text.length * 0.3,
  })
  return out || text
}

// Traduz VÁRIOS trechos numa única chamada ao Groq, usando marcadores <<N>>.
// Uma chamada por item (em vez de uma por campo) é o que mantém uma ficha
// inteira dentro do rate limit do tier gratuito.
//
// Devolve um array do mesmo tamanho da entrada: a tradução de cada trecho ou
// `null` quando o marcador não voltou / veio curto demais. Nunca devolve
// tradução parcial de um trecho — na dúvida, null e o chamador mantém o EN.
export async function translateSegments(segments, apiKey) {
  const out = segments.map(() => null)
  if (!apiKey) return out

  const present = segments
    .map((s, i) => ({ i, en: String(s || '').trim() }))
    .filter(x => x.en.length > 0)
  if (present.length === 0) return out

  if (present.length === 1) {
    const { i, en } = present[0]
    const translated = await translateToPortuguese(en, apiKey)
    if (translated && translated !== en && translated.trim().length >= en.length * 0.4) {
      out[i] = translated.trim()
    }
    return out
  }

  const body = present.map((x, n) => `<<${n + 1}>>\n${x.en}`).join('\n\n')
  const prompt = `${TRANSLATION_PREAMBLE} O conteúdo está dividido em ${present.length} segmentos; cada um começa com um marcador <<N>> em linha própria. Devolva os ${present.length} segmentos na MESMA ordem, cada um precedido pelo seu marcador <<N>> idêntico, sem comentários ou explicações:\n\n${body}`

  const raw = await runTranslationPrompt(prompt, apiKey, {
    maxTokens: 8192,
    validate: t => countMarkers(t, present.length) === present.length,
  })
  if (!raw) return out

  const parts = splitMarkers(raw, present.length)
  present.forEach((x, n) => {
    const t = parts[n]
    if (t && t.length >= x.en.length * 0.4) out[x.i] = t
  })
  return out
}

function markerHits(text, count) {
  const re = /<<\s*(\d+)\s*>>/g
  const hits = []
  let m
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1])
    if (n >= 1 && n <= count) hits.push({ n, end: re.lastIndex, start: m.index })
  }
  return hits
}

function countMarkers(text, count) {
  return new Set(markerHits(text, count).map(h => h.n)).size
}

function splitMarkers(text, count) {
  const parts = new Array(count).fill(null)
  const hits = markerHits(text, count)
  hits.forEach((h, idx) => {
    const stop = idx + 1 < hits.length ? hits[idx + 1].start : text.length
    parts[h.n - 1] = text.slice(h.end, stop).trim()
  })
  return parts
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
    const result = await scheduleGroqCall(() => callGroq(prompt, apiKey, { maxTokens: 256 }))
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

