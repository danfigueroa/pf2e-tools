// Os NÚMEROS de uma magia e como cada entrada de heightening mexe neles.
//
// Feito sobre o inglês canônico, antes da tradução: os números nunca passam
// pelo LLM, e o resultado (`scaling`) não depende de idioma. Quem aplica no
// rank conjurado é o cliente (`character-viewer/heightening.ts`).
//
// **Conservador de propósito**: uma cláusula de heightening só vira conta
// quando acha dono sem ambiguidade. Entrada que não fecha inteira fica
// `resolved: false` e continua aparecendo como texto — número errado na mesa é
// pior que número nenhum (mesma política de `creature-core.js`).
//
// O teste que vale é `scripts/check-heightening.mjs`, contra o índice inteiro.

const DAMAGE_TYPES = [
  'fire', 'cold', 'electricity', 'acid', 'sonic', 'force', 'vitality', 'void', 'mental', 'poison',
  'bludgeoning', 'piercing', 'slashing', 'spirit', 'bleed', 'precision', 'positive', 'negative',
  'chaotic', 'evil', 'good', 'lawful', 'untyped',
]
const TYPE_RE = new RegExp(`\\b(${DAMAGE_TYPES.join('|')})\\b`, 'gi')

const DICE = String.raw`(\d+)d(\d+)(?:\s*\+\s*(\d+))?`

/** Tipos de dano citados num trecho, em minúsculas. */
function typesIn(text) {
  return [...new Set((String(text).match(TYPE_RE) || []).map((t) => t.toLowerCase()))]
}

/**
 * Componentes numéricos da prosa, na ordem em que aparecem.
 * `nth`/`occurrences`: posição desta fórmula entre as fórmulas IGUAIS da prosa
 * — é como o cliente acha o mesmo número no texto traduzido.
 */
export function extractComponents(prose) {
  const text = String(prose || '')
  const found = []

  // Dados: dano, cura ou PV temporários, conforme o que vem logo depois.
  const diceRe = new RegExp(`\\b${DICE}`, 'g')
  for (let m; (m = diceRe.exec(text));) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 70)
    const dmg = after.match(/^\s+(persistent\s+)?((?:[a-z]+(?:,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+))*?[a-z]+\s+)?damage\b/i)
    const hp = after.match(/^\s+(?:(temporary)\s+)?Hit Points\b/i)
    let kind = null
    let types = []
    let persistent = false
    if (dmg) {
      kind = 'damage'
      persistent = Boolean(dmg[1])
      types = typesIn(dmg[2] || '')
    } else if (hp) {
      kind = hp[1] ? 'tempHp' : 'healing'
    }
    if (!kind) continue
    found.push({
      at: m.index, formula: m[0].replace(/\s+/g, ''), kind, types, persistent,
      count: Number(m[1]), faces: Number(m[2]), flat: m[3] ? Number(m[3]) : 0,
    })
  }

  // Dano fixo, sem dado: "2 persistent bleed damage", "2 cold damage".
  const flatRe = /(?<![\dd+−-])\b(\d+)\s+(persistent\s+)?(?:([a-z]+)\s+)?damage\b/gi
  for (let m; (m = flatRe.exec(text));) {
    const types = typesIn(m[3] || '')
    if (m[3] && types.length === 0) continue // "10 extra damage"? fica de fora
    if (Number(m[1]) === 0) continue
    found.push({
      at: m.index, formula: m[1], kind: 'damage', types, persistent: Boolean(m[2]),
      count: 0, faces: 0, flat: Number(m[1]),
    })
  }

  // Números com nome: Dureza, resistência, fraqueza, PV temporários fixos e a
  // cura extra de uma variante ("increase the Hit Points restored by 8").
  const named = [
    [/\bHardness\s+(\d+)/gi, 'hardness'],
    [/\bresistance\s+(\d+)/gi, 'resistance'],
    [/\bweakness\s+(\d+)/gi, 'weakness'],
    [/\b(\d+)\s+temporary Hit Points/gi, 'tempHp'],
    [/\bHit Points restored by\s+(\d+)/gi, 'healingExtra'],
  ]
  for (const [re, kind] of named) {
    for (let m; (m = re.exec(text));) {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40)
      found.push({
        at: m.index + m[0].lastIndexOf(m[1]), formula: m[1], kind,
        types: kind === 'resistance' || kind === 'weakness' ? typesIn(after.match(/^\s*(?:against|to)\s+([a-z, ]+)/i)?.[1] || '') : [],
        persistent: false, count: 0, faces: 0, flat: Number(m[1]),
      })
    }
  }

  found.sort((a, b) => a.at - b.at)
  const seen = new Map()
  const totals = new Map()
  for (const c of found) totals.set(c.formula, (totals.get(c.formula) || 0) + 1)
  return found.map((c, i) => {
    const nth = seen.get(c.formula) || 0
    seen.set(c.formula, nth + 1)
    const { at: _at, ...rest } = c
    return { id: i, ...rest, nth, occurrences: totals.get(c.formula) }
  })
}

const AMOUNT_RE = new RegExp(`\\b(by|to)\\s+(?:${DICE}|(\\d+))\\b`, 'gi')
const TYPED_DICE_RE = new RegExp(`(\\d+d\\d+(?:\\s*\\+\\s*\\d+)?)\\s+(${DAMAGE_TYPES.join('|')})\\b`, 'gi')

function toAmount(mode, raw) {
  const m = String(raw).match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/)
  return m
    ? { mode, count: Number(m[1]), faces: Number(m[2]), flat: m[3] ? Number(m[3]) : 0 }
    : { mode, count: 0, faces: 0, flat: Number(raw) }
}

/**
 * Os valores de uma cláusula. "by 1d12 electricity and 1d4 sonic" são DOIS
 * valores, cada um com o próprio tipo — ler só o "by 1d12" perdia o sônico.
 */
function amountsIn(clause) {
  const first = clause.search(AMOUNT_RE)
  if (first < 0) return []
  const typed = [...clause.slice(first).matchAll(TYPED_DICE_RE)]
  if (typed.length >= 2) {
    const mode = /^to\b/i.test(clause.slice(first)) ? 'set' : 'add'
    return typed.map((m) => ({ ...toAmount(mode, m[1].replace(/\s+/g, '')), types: [m[2].toLowerCase()] }))
  }
  return [...clause.matchAll(AMOUNT_RE)].map((m) =>
    toAmount(m[1].toLowerCase() === 'to' ? 'set' : 'add', m[2] ? `${m[2]}d${m[3]}${m[4] ? `+${m[4]}` : ''}` : m[5]))
}

/**
 * Número na cláusula que nenhum valor explica ("by 10 on a failure, or 5 on a
 * success"; "Hardness 4, and the damage increases to 3d4"). Com ele, a conta
 * ficaria pela metade — melhor deixar a entrada como texto. "1-action",
 * "2- and 3-action" e ranks ("4th") não contam.
 */
function hasStrayNumber(clause, amounts) {
  const nums = [...clause.matchAll(/\b\d+(?:d\d+(?:\s*\+\s*\d+)?)?\b(?!\s*-|\s*(?:st|nd|rd|th)\b)/gi)]
  return nums.length > amounts.length
}

/**
 * Quebra a entrada em cláusulas, cada uma com valor. Pedaço sem valor ("The
 * slashing damage, initial electricity damage,") é sujeito da cláusula
 * seguinte, não uma cláusula própria — mas só dentro da mesma frase: uma frase
 * inteira sem valor ("You can target 3 creatures") é efeito que não vira conta.
 */
function clausesOf(text) {
  const out = []
  let leftover = ''
  for (const sentence of String(text).split(/(?<=\.)\s+(?=[A-Z])/)) {
    const pieces = sentence.split(/;\s*|,?\s+and\s+(?=the\b|its\b|each\b|increase)|,\s+and\s+/i)
    let pending = ''
    for (const piece of pieces) {
      const joined = pending ? `${pending} and ${piece}` : piece
      if (amountsIn(joined).length > 0) { out.push(joined); pending = '' } else pending = joined
    }
    if (pending.replace(/[.\s]/g, '')) leftover += pending
  }
  return { clauses: out, leftover: leftover.trim() }
}

/** Filtro de persistente: "persistent" sozinho pega só os persistentes; sem
 *  ele, prefere os iniciais; "initial … and persistent" ou "bludgeoning damage
 *  and persistent fire damage" pega os dois. */
function byPersistence(pool, s) {
  const persistent = /\bpersistent\b/.test(s)
  const both = /\binitial\b/.test(s) || /\band\b/.test(s)
  if (persistent && !both) return pool.filter((c) => c.persistent)
  if (!persistent && pool.some((c) => !c.persistent)) return pool.filter((c) => !c.persistent)
  return pool
}

const GENERIC_SUBJECT = new Set([
  'the', 'damage', 'initial', 'each', 'and', 'increase', 'increases', 'amount', 'of', 'healing', 'or',
  'all', 'spell', 's', 'spells', 'its', 'total', 'both',
])

/** Número de um componente numa frase que não virou cláusula: aí sim a conta ficaria pela metade. */
const COMPONENT_WORD = /\b(damage|hardness|resistance|weakness|hit points|healing)\b/i

/** Para quem vai cada valor da cláusula, ou `null` se não fechar sem dúvida. */
function assign(clause, components) {
  const amounts = amountsIn(clause)
  if (amounts.length === 0 || hasStrayNumber(clause, amounts)) return null
  const subject = clause.slice(0, clause.search(AMOUNT_RE)) || clause
  const s = subject.toLowerCase()

  // Valores com tipo próprio ("1d12 electricity and 1d4 sonic"): cada um acha
  // o seu componente pelo tipo e pelas faces.
  if (amounts[0].types) {
    const out = []
    for (const a of amounts) {
      const pool = byPersistence(components.filter((c) =>
        c.kind === 'damage' && c.faces === a.faces && c.types.includes(a.types[0])), s)
      if (pool.length === 0) return null
      out.push(...pool.map((c) => ({ id: c.id, mode: a.mode, count: a.count, faces: a.faces, flat: a.flat })))
    }
    return out
  }

  const types = typesIn(s)
  const mentionsHealing = /\bheal|hit points restored/.test(s)
  const mentionsDamage = /\bdamage\b/.test(s) || types.length > 0

  const dice = amounts[0].count > 0
  if (amounts.some((a) => (a.count > 0) !== dice)) return null

  let pool
  if (dice) {
    if (amounts.some((a) => a.faces !== amounts[0].faces)) return null
    if (!mentionsHealing && !mentionsDamage) return null
    pool = components.filter((c) => c.count > 0 && c.faces === amounts[0].faces).filter((c) =>
      (mentionsHealing && (c.kind === 'healing' || c.kind === 'tempHp')) ||
      (mentionsDamage && c.kind === 'damage'))
  } else {
    // Números com nome: "all resistances and weaknesses increase by 1" pega os dois.
    const kinds = [
      [/\bhardness\b/, 'hardness'], [/\bresistance/, 'resistance'], [/\bweakness/, 'weakness'],
    ].filter(([re]) => re.test(s)).map(([, k]) => k)
    if (kinds.length) pool = components.filter((c) => kinds.includes(c.kind))
    else if (/temporary hit points/.test(s)) pool = components.filter((c) => c.kind === 'tempHp' && c.count === 0)
    else if (mentionsHealing) pool = components.filter((c) => c.kind === 'healingExtra')
    else if (mentionsDamage) pool = components.filter((c) => c.kind === 'damage' && c.count === 0)
    else return null
  }

  if (types.length > 0 && pool.some((c) => c.kind === 'damage' || c.kind === 'resistance' || c.kind === 'weakness')) {
    // A cura não tem tipo: "healing or fire damage" filtra só o lado do dano.
    pool = pool.filter((c) => c.kind === 'healing' || c.types.some((t) => types.includes(t)))
  }
  pool = byPersistence(pool, s)

  if (pool.length === 0) return null
  // Mais de um dano candidato e nenhum tipo que os distinga: só vale se o sujeito
  // for genérico ("The damage increases by 1d6" — todo dano da magia). Um
  // sujeito qualificado ("the maximum damage from the scale explosion") fala
  // de UM deles, e não há como saber qual.
  const sameKind = pool.filter((c) => c.kind === 'damage').length > 1
  if (sameKind && types.length === 0 && amounts.length === 1) {
    const words = s.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
    if (words.some((w) => !GENERIC_SUBJECT.has(w))) return null
  }
  if (amounts.length === 1) return pool.map((c) => ({ id: c.id, ...amounts[0] }))
  // Vários valores sem distinção de sujeito ("by 1d6 for the 1-action version,
  // or by 2d6 for the 2- and 3-action versions"): pareiam em ordem.
  if (amounts.length === pool.length) return pool.map((c, i) => ({ id: c.id, ...amounts[i] }))
  return null
}

/** Regra de cada entrada de heightening, na mesma ordem das entradas. */
export function heightenRules(entries, components) {
  return (entries || []).map((entry) => {
    const { clauses, leftover } = clausesOf(entry.text)
    const adds = []
    // `safe`: todo número da entrada achou dono — a conta entra. `resolved`:
    // além disso, nada sobrou de texto ("…, and the attack ignores cover") — a
    // entrada some da lista. Uma frase sem valor com número de componente
    // ("You can target 3 creatures" passa; "Hardness 4" não) derruba as duas.
    let safe = clauses.length > 0 && !(/\d/.test(leftover) && COMPONENT_WORD.test(leftover))
    const owner = new Map()
    clauses.forEach((clause, i) => {
      const got = assign(clause, components)
      if (!got) { safe = false; return }
      // Duas cláusulas no mesmo número ("initial damage by 2d6, and the
      // secondary damage by 1d6", com os dois do mesmo tipo) é sinal de que o
      // sujeito não foi entendido — não soma nenhuma das duas.
      if (got.some((a) => owner.has(a.id) && owner.get(a.id) !== i)) { safe = false; return }
      for (const a of got) owner.set(a.id, i)
      adds.push(...got)
    })
    // Tudo ou nada: entrada que não fechou inteira não mexe em número nenhum e
    // aparece como texto. Meia conta certa ao lado de meia conta errada não
    // tem como ser distinguida por quem lê a ficha.
    return { level: entry.level, adds: safe ? adds : [], safe, resolved: safe && !leftover }
  })
}

/** `scaling` do payload da magia. `null` quando não há número nenhum. */
export function buildScaling(proseEN, heightenedEntries) {
  const components = extractComponents(proseEN)
  if (components.length === 0) return null
  return { components, rules: heightenRules(heightenedEntries, components) }
}
