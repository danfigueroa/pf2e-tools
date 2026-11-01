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

// --- Quando um acerto APROXIMADO ainda é a mesma coisa ----------------------------------------------
//
// A busca da AON é difusa: sem o nome exato ela devolve o melhor acerto de QUALQUER nome, e o app o
// aceitava — "Reincarnation Feat" (a vaga da Fleshwarp no Pathbuilder) virava "Feast", "Emotionally Unaware"
// virava "Master Strike", "Will" (a escolha do Path to Perfection) virava "Iron Will". Um acerto só vale
// quando os nomes são COMPATÍVEIS: as palavras de um estão todas no outro ("Cognitive Crossover" ↔
// "Kreighton's Cognitive Crossover", "Studious Spell: Blur" ↔ "Studious Spell"). Sem isso, a coisa não tem
// entrada na AON e a ficha diz isso, em vez de mostrar a regra de outra.
// (`namesCompatible` em `src/services/descriptions.ts` é a mesma conta — mudou uma, muda a outra.)

const STOP_WORDS = new Set(['of', 'the', 'a', 'an', 'and', 'for', 'to', 'in', 'on', 'or'])

function nameTokens(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+\s*feet?/gi, ' ')
    .replace(/['’]s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP_WORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
}

// Entradas genéricas: um acerto MAIS CURTO nessas categorias é a palavra solta, não a coisa pedida
// ("Card Sharp's Escape" → a ação Escape, "Basic Finisher" → o traço Finisher, "Thief Racket" → o exemplo de build Thief).
const GENERIC_CATEGORIES = new Set(['trait', 'action', 'class-sample', 'skill', 'rules', 'condition', 'background', 'deity', 'ancestry', 'creature', 'creature-family', 'language', 'plane', 'source', 'article'])
// No equipamento, o que sobra do nome pedido só pode ser o grau ("Box of Unspoiling II" ↔ "Box of Unspoiling (Type II)").
const GRADE_WORDS = new Set(['i', 'ii', 'iii', 'iv', 'v', 'type', 'lesser', 'minor', 'moderate', 'greater', 'major', 'true', 'standard'])
// Categorias de item: nelas o nome mais curto só vale se o que sobra for o grau ('Shadow Weaver' não é a runa 'Shadow (Major)').
const ITEM_CATEGORIES = new Set(['equipment', 'item-bonus', 'weapon', 'armor', 'shield', 'rune'])

/**
 * O acerto `found` (de categoria `category`) é a coisa pedida? Mesmas palavras; ou o pedido é o FIM do
 * achado (um prefixo próprio: "Kreighton's Cognitive Crossover", "Shory Aeromancer"); ou o achado é o
 * COMEÇO ou o FIM do pedido ("Studious Spell" para "Studious Spell: Blur", "Doctrine" para "Second
 * Doctrine"), desde que não seja uma entrada genérica. O meio não vale ("Instinct" ≠ "Giant Instinct
 * Specialization Ability"), nem um sufixo novo ("Spellbook Prodigy" ≠ "Spellbook").
 */
export function namesCompatible(requested, found, category, item = false) {
  const a = nameTokens(requested)
  const b = nameTokens(found)
  if (a.length === 0 || b.length === 0) return false
  if (a.length === b.length) return a.every((t) => b.includes(t))
  const isPrefix = (short, long) => short.every((t, i) => long[i] === t)
  const isSuffix = (short, long) => short.every((t, i) => long[long.length - short.length + i] === t)
  if (a.length < b.length) return isSuffix(a, b)
  if (!isPrefix(b, a) && !isSuffix(b, a)) return false
  const cat = String(category || '').toLowerCase()
  if (GENERIC_CATEGORIES.has(cat)) return false
  // Item: o achado mais curto tem de ser item também ("Shadow Weaver", a armadura do Eldarion, não é a linhagem Shadow).
  if (item && !ITEM_CATEGORIES.has(cat)) return false
  if (ITEM_CATEGORIES.has(cat)) return a.filter((t) => !b.includes(t)).every((t) => GRADE_WORDS.has(t))
  return true
}

const classesOf = (source) => (Array.isArray(source?.class) ? source.class : [source?.class]).filter(Boolean).map((c) => String(c).toLowerCase())

// Escolhe o melhor hit do Elasticsearch para um nome:
// - só matches exatos de nome quando existirem;
// - descarta docs legacy renomeados, MAS mantém-os quando são a única opção
//   (ex.: a ficha lista "Power Attack", cujo nome remaster é "Vicious Swing");
// - prefere a versão Remaster (primary_source "Player Core*"), senão a de
//   release_date mais recente;
// - com `className`, entre os exatos vale o da classe (característica que várias classes têm);
// - sem match exato, o primeiro hit de nome COMPATÍVEL (`namesCompatible`); se nenhum for, `null`.
export function pickBestHit(hits, name, className = null, item = false) {
  if (!Array.isArray(hits) || hits.length === 0) return null
  const lower = String(name).toLowerCase()
  const exact = hits.filter(h => h._source?.name?.toLowerCase() === lower)
  if (exact.length === 0) {
    const compatible = hits.filter((h) => namesCompatible(name, h._source?.name, h._source?.category, item))
    return compatible.find((h) => !isLegacy(h._source)) ?? compatible[0] ?? null
  }

  // Característica que várias classes têm com o MESMO nome ("Weapon Expertise", "Expert Spellcaster"): vale a da
  // classe do personagem — o texto muda (armas simples do Druida × marciais do Magus; a tradição do Bardo).
  const hint = className ? String(className).toLowerCase() : null
  const ofClass = hint ? exact.filter(h => classesOf(h._source).includes(hint)) : []
  const scoped = ofClass.length > 0 ? ofClass : exact

  const current = scoped.filter(h => !isLegacy(h._source))
  const pool = current.length > 0 ? current : scoped

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
