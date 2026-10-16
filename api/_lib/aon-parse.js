// Parse determinístico e escolha de hit para QUALQUER entrada do AON (magias,
// talentos, features de classe, ações). Feito sobre o INGLÊS canônico — nada
// aqui depende da tradução.
//
// O campo _source.text do AON TINHA estrutura regular:
//   <nome + ações + Source + metadados> --- <prosa> [--- Heightened (+1) ...]
// com separadores " --- ". Hoje o separador só vem no `markdown` — ver
// `parseAonText`.

// Entradas legacy (pré-Remaster) apontam para a versão nova por remaster_id
// (talentos/features) ou remaster_name (magias).
function isLegacy(source) {
  return (Array.isArray(source?.remaster_id) && source.remaster_id.length > 0)
    || (Array.isArray(source?.remaster_name) && source.remaster_name.length > 0)
}

// Escolhe o melhor hit do Elasticsearch para um nome:
// - só matches exatos de nome quando existirem;
// - descarta docs legacy renomeados, MAS mantém-os quando são a única opção
//   (ex.: a ficha lista "Power Attack", cujo nome remaster é "Vicious Swing");
// - prefere a versão Remaster (primary_source "Player Core*"), senão a de
//   release_date mais recente;
// - sem match exato, devolve o primeiro hit (fuzzy).
export function pickBestHit(hits, name) {
  if (!Array.isArray(hits) || hits.length === 0) return null
  const lower = String(name).toLowerCase()
  const exact = hits.filter(h => h._source?.name?.toLowerCase() === lower)
  if (exact.length === 0) return hits[0]

  const current = exact.filter(h => !isLegacy(h._source))
  const pool = current.length > 0 ? current : exact

  const remaster = pool.find(h => /^player core/i.test(h._source.primary_source || ''))
  if (remaster) return remaster

  return [...pool].sort((a, b) =>
    String(b._source.release_date || '').localeCompare(String(a._source.release_date || '')),
  )[0]
}

// Divide a entrada em { sourceBook, proseEN, heightenedEntries }.
// Nunca trunca: se a estrutura não for reconhecida, o texto inteiro vira prosa.
//
// **O AON parou de mandar o "---" no campo `text`** (out/2026): o texto passou
// a vir corrido, com o cabeçalho colado na prosa e o "Heightened (+1)" no fim.
// O separador só existe no `markdown`, por isso ele é a fonte preferida quando
// o `text` não tem estrutura. Sem isso, toda magia chegava sem entradas de
// heightening e o dano nunca era recalculado para o rank conjurado.
export function parseAonText(rawText, markdown) {
  const text = String(rawText || '').trim()
  if (!/\s---\s/.test(text) && markdown && /\n---\n/.test(markdown)) {
    return parseAonMarkdown(markdown)
  }
  if (!text) return { sourceBook: '', proseEN: '', heightenedEntries: [], structured: false }

  const parts = text.split(/\s*---\s*/).map(p => p.trim()).filter(Boolean)
  const heightenedEntries = []
  let metaBlock = ''
  const proseParts = []
  let structured = false

  if (parts.length === 1) {
    proseParts.push(parts[0])
  } else {
    structured = true
    metaBlock = parts[0]
    for (const part of parts.slice(1)) {
      if (/^Heightened\s*\(/i.test(part)) {
        // Um bloco pode concatenar várias entradas "Heightened (...)".
        for (const chunk of part.split(/(?=Heightened\s*\()/i)) {
          const m = chunk.trim().match(/^Heightened\s*\(([^)]+)\)\s*(.*)$/is)
          if (m) heightenedEntries.push({ level: m[1].trim(), text: m[2].trim() })
        }
      } else {
        proseParts.push(part)
      }
    }
  }

  return {
    sourceBook: extractSourceBook(metaBlock || text),
    proseEN: proseParts.join('\n\n'),
    heightenedEntries,
    // false = não havia separador "---"; a prosa é o texto bruto (pode conter
    // o bloco de metadados e tags HTML) e precisa de limpeza pelo chamador.
    structured,
  }
}

// Markdown do AON → texto corrido, no mesmo formato que o `text` tinha quando
// trazia o "---": uma linha só, sem marcação. Os ícones de ação viram rótulo
// ("Two Actions: …"), senão as variantes do Heal perdiam a quantidade de ações.
export function markdownToProse(md) {
  return String(md || '')
    .replace(/<actions string="([^"]+)"\s*\/>/gi, ' $1: ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(?:column|row|traits|trait|title|aside|ul|li|p|b|i|strong|em)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,;:)'’s])/g, '$1$2')
    .replace(/^\s*-\s+/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
}

function parseAonMarkdown(markdown) {
  const sections = String(markdown).split(/\n\s*---\s*\n/)
  const metaBlock = markdownToProse(sections[0])
  const heightenedEntries = []
  const proseParts = []
  for (const section of sections.slice(1)) {
    const trimmed = section.trim()
    if (/^\*\*Heightened\s*\(/i.test(trimmed)) {
      for (const chunk of trimmed.split(/(?=\*\*Heightened\s*\()/i)) {
        const m = markdownToProse(chunk).match(/^Heightened\s*\(([^)]+)\)\s*(.*)$/is)
        if (m) heightenedEntries.push({ level: m[1].trim(), text: m[2].trim() })
      }
    } else {
      const prose = markdownToProse(trimmed)
      if (prose) proseParts.push(prose)
    }
  }
  return {
    sourceBook: extractSourceBook(metaBlock),
    proseEN: proseParts.join('\n\n'),
    heightenedEntries,
    structured: true,
  }
}

function extractSourceBook(block) {
  const m = String(block).match(/Source\s+(.+?)\s+pg\.\s*(\d+)/i)
  return m ? `${m[1].trim()}, p. ${m[2]}` : ''
}
