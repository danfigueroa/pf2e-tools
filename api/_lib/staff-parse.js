// Bastões (staves) do Archives of Nethys: uma entrada, vários degraus.
//
// O AON guarda a FAMÍLIA inteira num único documento: pedir "Staff of Healing
// (Greater)" devolve um `markdown` com base (item 4), Greater (8), Major (12) e
// True (16) empilhados. Jogado no parse genérico de prosa, isso virava um
// parágrafo único com os preços e as magias dos quatro degraus colados — quem
// tem o Greater na ficha lia magias de rank 7 que não possui.
//
// Aqui o documento é quebrado por degrau e a lista de magias é montada pela
// regra do bastão (GM Core p. 278): um bastão contém as magias do próprio
// degrau **mais as de todos os degraus inferiores**, e nunca as dos superiores.
//
// Parse determinístico sobre o INGLÊS canônico, como `aon-parse.js` — nada aqui
// depende da tradução. Nomes de magia ficam em inglês porque é por eles que a
// UI busca a descrição na AON (e é o que a aba de Magias já mostra).

/** `<title level="2" right="Item 8">Nome</title>` — um por degrau. */
const TITLE_RE = /<title\s*([^>]*?)>\s*([\s\S]*?)\s*<\/title>/gi

/** `<li>**2nd** [_clear mind_](/Spells.aspx?ID=1469), heal</li>` */
const RANK_LI_RE = /<li>\s*\*\*([^*]+)\*\*\s*([\s\S]*?)<\/li>/gi

function attr(attrs, name) {
  const m = String(attrs).match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'))
  return m ? m[1].trim() : ''
}

/** Título vem como link markdown no nível 1 e texto puro nos degraus. */
function titleName(inner) {
  return String(inner)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** `right="Item 8"` → 8. `"Item 4+"` é o cabeçalho da família, não um degrau. */
function itemLevel(right) {
  const m = String(right).match(/Item\s+(-?\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

/** 'Cantrip' → 0, '3rd' → 3. Rótulo desconhecido devolve null e a linha é ignorada. */
function parseRank(label) {
  const t = String(label).trim().toLowerCase()
  if (/^cantrips?$/.test(t)) return 0
  const m = t.match(/^(\d+)\s*(?:st|nd|rd|th)?$/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return n >= 0 && n <= 10 ? n : null
}

/**
 * A AON linka só a PRIMEIRA aparição de cada magia no documento; as repetições
 * vêm em itálico puro (`_darkvision_`) ou texto cru (`heal`). Os três casos
 * viram o mesmo nome.
 */
function parseSpellNames(raw) {
  return String(raw)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[*_]/g, '')
    .split(',')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Prosa de um degrau: o que vem depois do `---` e antes da lista de magias. */
function sectionProse(body) {
  const afterRule = body.split(/\n\s*---\s*\n/).slice(1).join('\n') || body
  return afterRule
    .split(/<ul>/i)[0]
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sectionRanks(body) {
  const ranks = []
  RANK_LI_RE.lastIndex = 0
  let m
  while ((m = RANK_LI_RE.exec(body)) !== null) {
    const rank = parseRank(m[1])
    if (rank === null) continue
    const names = parseSpellNames(m[2])
    if (names.length > 0) ranks.push({ rank, names })
  }
  return ranks
}

/**
 * Quebra o `markdown` de um bastão em `{ intro, tiers }`.
 *
 * `intro` é a prosa da família (a descrição do bastão em si, sem os degraus) —
 * é ela que substitui a prosa do parse genérico, que vinha com tudo colado.
 * `tiers` sai ordenado por nível de item.
 *
 * Bastão de degrau único (só `<title level="1">`) tem a lista de magias na
 * própria seção da família, então ela mesma vira o degrau.
 */
export function parseStaffDoc(markdown) {
  const md = String(markdown || '')
  if (!md.trim()) return null

  const sections = []
  TITLE_RE.lastIndex = 0
  let m
  while ((m = TITLE_RE.exec(md)) !== null) {
    sections.push({
      level: parseInt(attr(m[1], 'level'), 10) || 1,
      itemLevel: itemLevel(attr(m[1], 'right')),
      name: titleName(m[2]),
      // Onde o `<title>` começa e onde termina: o corpo de uma seção vai do fim
      // do próprio título até o COMEÇO do título seguinte. Cortar no fim do
      // seguinte deixava o nome do próximo degrau grudado na prosa.
      titleStart: m.index,
      bodyStart: m.index + m[0].length,
    })
  }
  if (sections.length === 0) return null

  sections.forEach((s, i) => {
    s.body = md.slice(s.bodyStart, i + 1 < sections.length ? sections[i + 1].titleStart : md.length)
  })

  const family = sections[0]
  // "Craft Requirements: Supply one casting of all listed ranks…" fecha a
  // entrada de TODO bastão. É nota de criação de item, não de uso na mesa, e
  // ainda casava com o rótulo "Requisitos" do parse de metadados do drawer,
  // saindo quebrada ("Requisitos. de Craft Fornecer uma conjuração…").
  const intro = sectionProse(family.body)
    .replace(/\s*Craft Requirements\b[\s\S]*$/i, '')
    .trim()

  const tierSections = sections.filter((s) => s.level >= 2 && s.itemLevel !== null)
  const asTier = (s) => ({
    name: s.name,
    level: s.itemLevel,
    price: (s.body.match(/\*\*Price\*\*\s*([^\n*]+)/i)?.[1] || '').trim() || null,
    effect: sectionProse(s.body),
    ranks: sectionRanks(s.body),
  })

  const tiers = tierSections.length > 0
    ? tierSections.map(asTier).sort((a, b) => a.level - b.level)
    : [{ ...asTier(family), effect: '' }]

  // Sem nenhuma lista de magias não é um bastão que sabemos ler (a entrada do
  // Staff of Providence, p.ex., não traz lista) — melhor devolver null e deixar
  // o caminho genérico agir do que inventar estrutura vazia.
  if (!tiers.some((t) => t.ranks.length > 0)) return null

  return { intro, tiers }
}

/** Só bastões: o resto do inventário segue pelo caminho genérico. */
export function isStaff(source) {
  if (!source) return false
  if (String(source.item_category || '').toLowerCase() === 'staves') return true
  const traits = Array.isArray(source.trait) ? source.trait : []
  return traits.some((t) => String(t).toLowerCase() === 'staff')
}

/**
 * Monta a lista de magias do degrau que o personagem realmente possui.
 *
 * O degrau é escolhido pelo NOME pedido ("Staff of Healing (Greater)"), com o
 * nível do hit como desempate — é o único jeito de distinguir os degraus, que
 * compartilham a mesma URL no AON.
 *
 * As magias acumulam para BAIXO (GM Core p. 278), então cada linha carrega o
 * degrau de onde veio: quem lê a ficha precisa saber que *stabilize* é do
 * bastão base e *cleanse affliction* é do Greater.
 *
 * @returns {null | { tierName, tierLevel, price, effect, ranks, tiers }}
 */
export function staffForTier(source, requestedName) {
  if (!isStaff(source)) return null
  const doc = parseStaffDoc(source.markdown)
  if (!doc) return null

  const wanted = String(requestedName || '').trim().toLowerCase()
  const hitName = String(source.name || '').trim().toLowerCase()
  const hitLevel = typeof source.level === 'number' ? source.level : null

  const owned =
    doc.tiers.find((t) => t.name.toLowerCase() === wanted)
    || doc.tiers.find((t) => t.name.toLowerCase() === hitName)
    || (hitLevel !== null ? doc.tiers.find((t) => t.level === hitLevel) : null)
    // Último recurso: o degrau mais alto que o nível do hit alcança.
    || [...doc.tiers].reverse().find((t) => hitLevel === null || t.level <= hitLevel)
    || doc.tiers[0]

  const included = doc.tiers.filter((t) => t.level <= owned.level)

  // Um rank pode receber magias de mais de um degrau, então a fusão é por rank
  // e a deduplicação por nome dentro dele (a AON repete *heal* de propósito,
  // mas nunca duas vezes no mesmo rank).
  const byRank = new Map()
  for (const tier of included) {
    for (const { rank, names } of tier.ranks) {
      if (!byRank.has(rank)) byRank.set(rank, { rank, spells: [], seen: new Set() })
      const bucket = byRank.get(rank)
      for (const name of names) {
        const key = name.toLowerCase()
        if (bucket.seen.has(key)) continue
        bucket.seen.add(key)
        bucket.spells.push({ name, tierLevel: tier.level })
      }
    }
  }

  const ranks = [...byRank.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(({ rank, spells }) => ({ rank, spells }))

  if (ranks.length === 0) return null

  return {
    tierName: owned.name,
    tierLevel: owned.level,
    price: owned.price,
    effect: owned.effect,
    ranks,
    tiers: included.map((t) => ({ name: t.name, level: t.level })),
    intro: doc.intro,
  }
}
