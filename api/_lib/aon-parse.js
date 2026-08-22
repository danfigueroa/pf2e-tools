// Parse determinístico e escolha de hit para QUALQUER entrada do AON (magias,
// talentos, features de classe, ações). Feito sobre o INGLÊS canônico — nada
// aqui depende da tradução.
//
// O campo _source.text do AON tem estrutura regular:
//   <nome + ações + Source + metadados> --- <prosa> [--- Heightened (+1) ...]
// com separadores " --- " (cercados de espaços, não de newlines).

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

// Divide o _source.text em { sourceBook, proseEN, heightenedEntries }.
// Nunca trunca: se a estrutura não for reconhecida, o texto inteiro vira prosa.
export function parseAonText(rawText) {
  const text = String(rawText || '').trim()
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

function extractSourceBook(block) {
  const m = String(block).match(/Source\s+(.+?)\s+pg\.\s*(\d+)/i)
  return m ? `${m[1].trim()}, p. ${m[2]}` : ''
}
