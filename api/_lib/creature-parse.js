// Parse do stat block de criatura publicado no campo `markdown` do índice da AON.
//
// A busca já traz o documento inteiro: `searchAonRaw` não manda `_source`
// filtrado, então o markdown chega de graça junto com os campos estruturados.
// Nada aqui faz requisição nem passa pela cadeia de tradução.
//
// O dialeto é o mesmo pseudo-XML que `staff-parse.js` já enfrenta — <title>,
// <row>, <column>, `**Rótulo**` e link markdown. Por cima dele, o stat block
// tem uma estrutura de TRÊS SEÇÕES separadas por `---`:
//
//   [0] identidade  traços, Perception, Languages, Skills, atributos, Items
//   [1] defesa      AC, Fort/Ref/Will, HP, Immunities/Weaknesses/Resistances
//   [2] ofensiva    Speed, Melee/Ranged, blocos de conjuração
//
// Habilidades especiais aparecem nas TRÊS seções (Smoke Vision na primeira,
// Frightful Presence na segunda, Breath Weapon na terceira), então quem
// procurasse habilidade só depois de `**Speed**` perderia metade delas — foi o
// que aconteceu no primeiro corte deste arquivo.
//
// Toda seção ilegível devolve vazio em vez de chute — mesma política do bastão
// sem lista legível em `staff-parse.js`.

/** Só a PRIMEIRA ocorrência de um nome vira link no AON; o resto vem em itálico. */
function stripMarkup(text) {
  return String(text || '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*/g, '')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tira os links ANTES de qualquer coisa que conte parênteses.
 * `([arcane](/Traits.aspx?ID=11), [aura](…))` tem parêntese dentro da URL, e um
 * `\(([^)]*)\)` ingênuo fecha no primeiro deles e devolve lixo. Já aconteceu.
 */
function delink(text) {
  return String(text || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
}

/** `<actions string="Two Actions" />` → 'Two Actions'. */
function readActions(chunk) {
  const m = /<actions\s+string="([^"]+)"/i.exec(chunk || '')
  return m ? m[1] : null
}

function splitTraits(raw) {
  if (!raw) return []
  return stripMarkup(raw)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Recorta o corpo do stat block: começa no <title level="2" right="Creature N">
 * e termina no <aside> ou <document>, que trazem variantes e listas de magias
 * de família — parecidos com ficha, mas não são esta ficha.
 */
function statblockBody(markdown) {
  const md = String(markdown || '')
  const start = md.search(/<title\s+level="2"[^>]*right="Creature/i)
  if (start < 0) return null
  const body = md.slice(start)
  const cut = body.search(/<aside>|<document\s/i)
  return cut > 0 ? body.slice(0, cut) : body
}

/**
 * Normaliza para uma linha por informação: `<br />` separa habilidades no bloco
 * defensivo e precisa virar quebra de linha ANTES de qualquer varredura.
 */
function normalize(section) {
  return String(section || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:row|column)[^>]*>/gi, '\n')
}

/** As três seções do stat block, separadas por `---` em linha própria. */
function sections(body) {
  const parts = normalize(body).split(/\n\s*---\s*\n/)
  return {
    identity: parts[0] || '',
    defense: parts[1] || '',
    offense: parts.slice(2).join('\n') || '',
    all: parts.join('\n'),
  }
}

/** Valor de `**Rótulo** …`, seguindo pelas linhas que não abrem outro rótulo. */
function labelValue(text, label) {
  const re = new RegExp(
    `\\*\\*${label}\\*\\*\\s*([^\\n]*(?:\\n(?!\\s*\\*\\*|\\s*-\\s|\\s*$)[^\\n]*)*)`,
    'i',
  )
  const m = re.exec(text)
  if (!m) return null
  return stripMarkup(m[1]) || null
}

/**
 * "3d12+15 piercing plus 2d6 fire" →
 *   { formula: '3d12+15', type: 'piercing', riders: 'plus 2d6 fire' }
 *
 * Dano principal e riders são separados de propósito: reescalar a string
 * inteira estragaria o `plus 2d6 fire`, que é escolha de design da criatura e
 * não segue a tabela de dano de ataque.
 */
function parseDamage(raw) {
  const text = String(raw || '').trim()
  if (!text) return null

  // O AON escreve o modificador negativo com TRAVESSÃO, e não com um só: "1d6–1"
  // (en-dash), "1d4—1" (em-dash) e o sinal de menos aparecem todos. Um `[+-]`
  // ingênuo não casa nenhum, e o golpe saía sem fórmula nenhuma.
  const normalized = text.replace(/[\u2012-\u2015\u2212]/g, '-')

  // Dado (`3d12+15`) ou dano fixo (`1 piercing`, comum em nível -1 e 0).
  // Golpe sem número — "attach", "tongue grab" — não tem fórmula mesmo: vira
  // rider e passa intacto pela escala.
  const m = /^(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+([a-zA-Z][a-zA-Z, ]*?)?(?=\s+(?:plus|and)\b|;|$)/.exec(normalized)
  if (!m) return { formula: null, type: null, riders: text, raw: text }
  return {
    formula: m[1].replace(/\s+/g, ''),
    type: (m[2] || '').trim() || null,
    riders: normalized.slice(m[0].length).trim() || null,
    raw: text,
  }
}

/**
 * Golpes, só na seção ofensiva. Cada bloco vai de `**Melee**`/`**Ranged**` até
 * o PRÓXIMO rótulo em negrito no início de linha — inclusive
 * `**Arcane Innate Spells**`, que num primeiro corte era engolido junto com a
 * lista de magias dentro do dano do último golpe.
 */
function parseStrikes(offense) {
  const strikes = []
  // Sem flag `m`: aqui `$` precisa significar FIM DA ENTRADA, senão o último
  // golpe se perde. E `**Damage**` começa em linha própria, então não pode
  // contar como fronteira — do contrário todo golpe sai sem dano.
  const re = /(?:^|\n)\s*\*\*(Melee|Ranged)\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?!Damage\*\*)|$)/g
  for (const match of offense.matchAll(re)) {
    const chunk = match[2]
    const damageAt = chunk.search(/\*\*Damage\*\*/i)
    const head = delink(damageAt >= 0 ? chunk.slice(0, damageAt) : chunk)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/,\s*$/, '')
      .trim()

    const m = /^(.*?)\s*([+-]\d+)\s*(?:\(([^)]*)\))?/.exec(head)
    if (!m) continue

    const damageRaw = damageAt >= 0
      ? stripMarkup(chunk.slice(damageAt)).replace(/^Damage\s*/i, '')
      : ''

    strikes.push({
      category: match[1].toLowerCase(),
      name: m[1].trim(),
      bonus: parseInt(m[2], 10),
      actions: readActions(chunk),
      traits: splitTraits(m[3]),
      damage: parseDamage(damageRaw),
    })
  }
  return strikes
}

/** Cabeçalho de bloco de conjuração: "Arcane Innate Spells", "Divine Prepared Spells"… */
const CASTING_LABEL = /^((?:[A-Z][A-Za-z]*\s+)*(?:Innate|Prepared|Spontaneous|Focus)\s+Spells|Rituals?)$/

/**
 * Blocos de conjuração. Só a DC e o ataque são estruturados — a LISTA DE
 * MAGIAS não é reescalada, então basta preservá-la.
 *
 * As magias vêm na LINHA SEGUINTE ao `- **rank**`, não na mesma:
 *   - **Cantrips (6th)**
 *   [Detect Magic](…), [Read Aura](…)
 */
function parseSpellcasting(offense) {
  const blocks = []
  const lines = offense.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    const head = /^\s*\*\*([^*]+?)\s*\*\*\s*(.*)$/.exec(lines[i])
    if (!head || !CASTING_LABEL.test(head[1].trim())) continue

    const meta = stripMarkup(head[2])
    const dc = /DC\s*(\d+)/i.exec(meta)
    const attack = /attack\s*([+-]\d+)/i.exec(meta)
    const groups = []

    for (i += 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (/^\s*\*\*/.test(line)) { i -= 1; break }
      const g = /^\s*-\s*\*\*([^*]+)\*\*\s*(.*)$/.exec(line)
      if (g) {
        groups.push({ rank: g[1].trim(), spells: splitSpells(g[2]) })
      } else if (groups.length > 0 && line.trim()) {
        groups[groups.length - 1].spells.push(...splitSpells(line))
      }
    }

    blocks.push({
      label: head[1].trim(),
      dc: dc ? parseInt(dc[1], 10) : null,
      attack: attack ? parseInt(attack[1], 10) : null,
      groups,
    })
  }
  return blocks
}

const splitSpells = (raw) =>
  stripMarkup(raw).split(',').map((s) => s.trim()).filter(Boolean)

/** Rótulos de ficha — tudo que NÃO está aqui e tem prosa depois é habilidade. */
const KNOWN_LABELS = new Set([
  'source', 'perception', 'languages', 'skills', 'items', 'ac', 'fort', 'ref',
  'will', 'hp', 'speed', 'melee', 'ranged', 'damage', 'immunities', 'weaknesses',
  'resistances', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'creature family',
  'recall knowledge', 'unspecific lore', 'specific lore',
])

/** Graus de sucesso: sub-partes de uma habilidade, nunca habilidade própria. */
const OUTCOME_LABELS = new Set([
  'critical success', 'success', 'failure', 'critical failure', 'effect',
])

const isKnownLabel = (name) => {
  const n = name.toLowerCase().trim()
  return KNOWN_LABELS.has(n) || n.startsWith('recall knowledge')
}

/**
 * Habilidades especiais, varridas nas três seções. A prosa sai CRUA de
 * propósito: o usuário optou por manter as habilidades em inglês e sem
 * reescala, então o texto do AON é o texto final.
 */
function parseAbilities(text) {
  const abilities = []
  // `\Z` NÃO existe em JavaScript — vira o literal "Z", e a última habilidade
  // de toda ficha era descartada em silêncio. Sem a flag `m`, `$` é o fim da
  // entrada, que é o que se quer aqui.
  const re = /(?:^|\n)\s*\*\*([^*\n]+?)\s*\*\*\s*([\s\S]*?)(?=\n\s*\*\*|$)/g

  for (const match of text.matchAll(re)) {
    // O nome costuma vir linkado (`**[Ferocity](/MonsterAbilities.aspx?ID=63)**`).
    const name = stripMarkup(match[1])
    if (!name || isKnownLabel(name) || CASTING_LABEL.test(name)) continue

    const rest = delink(match[2])
    const actions = readActions(rest)

    // Traços vêm entre parênteses logo no começo — depois do delink, para o
    // parêntese da URL não fechar o grupo cedo demais.
    const withoutActions = rest.replace(/<actions[^>]*>/gi, ' ')
    const traitMatch = /^\s*\(([^)]*)\)\s*;?\s*/.exec(withoutActions)
    const traits = traitMatch ? splitTraits(traitMatch[1]) : []
    const body = traitMatch ? withoutActions.slice(traitMatch[0].length) : withoutActions
    const prose = stripMarkup(body)

    // Grau de sucesso é PARTE da habilidade anterior, não habilidade nova — sem
    // isso o gambá vira dono de "Spray Musk" mais quatro habilidades chamadas
    // "Sucesso", "Falha"…
    if (OUTCOME_LABELS.has(name.toLowerCase()) && abilities.length > 0) {
      const prev = abilities[abilities.length - 1]
      prev.text = `${prev.text} ${name}: ${prose}`.trim()
      continue
    }

    // Prosa vazia é legítima: Ferocity, Grab e afins são só nome + ação, e o
    // GM consulta a regra à parte. Descartá-las apagava habilidade de verdade.
    abilities.push({ name, actions, traits, text: prose })
  }
  return abilities
}

/**
 * DCs de Recall Knowledge, que ficam ANTES da ficha e sobem com o nível.
 * A perícia vem na linha seguinte ao nome: `**Recall Knowledge - Dragon**\n(Arcana): DC 32`.
 */
function parseRecallKnowledge(markdown) {
  const out = []
  const text = delink(String(markdown || ''))
  const re = /\*\*(Recall Knowledge[^*]*|Unspecific Lore|Specific Lore)\*\*\s*(?:\(([^)]*)\))?\s*:?\s*DC\s*(\d+)/gi
  for (const m of text.matchAll(re)) {
    out.push({
      label: m[1].replace(/\s+/g, ' ').trim(),
      skill: m[2] ? m[2].trim() : null,
      dc: parseInt(m[3], 10),
    })
  }
  return out
}

/**
 * @returns {null|object} `null` quando o documento não tem stat block legível —
 *   o consumidor segue pelos campos estruturados do índice, sem inventar nada.
 */
export function parseCreatureStatblock(markdown) {
  const body = statblockBody(markdown)
  if (!body) return null

  const s = sections(body)
  const perception = labelValue(s.identity, 'Perception')

  return {
    traits: [...body.matchAll(/<trait\s+label="([^"]+)"/gi)].map((m) => m[1]),
    // "+8; darkvision, scent (imprecise) 30 feet" — o bônus já vem estruturado
    // do índice, então aqui só interessa a parte dos sentidos.
    sensesRaw: perception ? (perception.split(';').slice(1).join(';').trim() || null) : null,
    languagesRaw: labelValue(s.identity, 'Languages'),
    skillsRaw: labelValue(s.identity, 'Skills'),
    itemsRaw: labelValue(s.identity, 'Items'),
    speedRaw: labelValue(s.offense, 'Speed'),
    immunitiesRaw: labelValue(s.defense, 'Immunities'),
    weaknessesRaw: labelValue(s.defense, 'Weaknesses'),
    resistancesRaw: labelValue(s.defense, 'Resistances'),
    strikes: parseStrikes(s.offense),
    spellcasting: parseSpellcasting(s.offense),
    abilities: parseAbilities(s.all),
    recallKnowledge: parseRecallKnowledge(markdown),
  }
}
