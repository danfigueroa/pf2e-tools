// Sanidade do heightening das magias, contra o índice inteiro da AON.
//
// Rode à mão: `node scripts/check-heightening.mjs`
//
// Três coisas, na ordem do que mais importa:
//   1. CASOS DO LIVRO — magias do grupo com o valor conferido à mão no rank em
//      que elas são conjuradas na mesa. Errar aqui é número errado na ficha.
//   2. IDENTIDADE — no próprio rank base, nenhum número muda. Se mudar, o
//      motor está somando heightening onde não devia.
//   3. MONOTONIA — subir de rank nunca baixa um número.
// E reporta a COBERTURA: quantas entradas "+N" viraram conta. A que não vira
// continua aparecendo como texto na ficha, então cobertura baixa é falta de
// conveniência, não erro.
//
// Sai com código ≠ 0 se 1, 2 ou 3 quebrar. Não há framework de teste no
// repositório, por isso é script avulso (como o `check-scaling.mjs`).

import { register } from 'node:module'

register('./ts-loader.mjs', import.meta.url)

const { parseAonText } = await import('../api/_lib/aon-parse.js')
const { buildScaling } = await import('../api/_lib/spell-scaling.js')
const { scaleSpell, formatValue } = await import('../src/modules/character-viewer/heightening.ts')

/** [magia, rank conjurado, valores esperados por componente, na ordem da prosa] */
const BOOK = [
  ['Fireball', 5, ['10d6']],
  ['Ignition', 5, ['6d4', '5d4']],
  ['Daze', 5, ['3d6']],
  ['Live Wire', 5, ['3d4', '3d4', '3d4']],
  ['Ice Storm', 6, ['3d8', '3d8', '3']],
  ['Holy Light', 5, ['9d6', '9d6']],
  ['Blazing Bolt', 5, ['5d6', '10d6']],
  ['Heal', 5, ['5d8', '40']],
  ['Shield', 5, ['15']],
  ['Frostbite', 5, ['6d4', '5']],
  ['Thermal Stasis', 5, ['10', '10']],
  ['Gouging Claw', 5, ['6d6', '6d6', '6']],
  ['Soothing Mist', 5, ['5d8', '5d8', '5']],
  ['Electric Arc', 5, ['6d4']],
  ['Cinder Swarm', 5, ['5d6', '2d6', '5d6']],
]

async function allSpells() {
  const res = await fetch('https://elasticsearch.aonprd.com/aon/_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: 5000,
      query: {
        bool: {
          filter: [{ term: { category: 'spell' } }, { exists: { field: 'heighten' } }],
          must_not: [{ exists: { field: 'remaster_id' } }],
        },
      },
      _source: ['name', 'level', 'text', 'markdown'],
    }),
  })
  if (!res.ok) throw new Error(`AON ${res.status}`)
  const body = await res.json()
  const byName = new Map()
  for (const hit of body.hits.hits) if (!byName.has(hit._source.name)) byName.set(hit._source.name, hit._source)
  return byName
}

function spellOf(source) {
  const parsed = parseAonText(source.text || '', source.markdown)
  const scaling = buildScaling(parsed.proseEN, parsed.heightenedEntries)
  return { level: source.level, scaling, heightenedEntries: parsed.heightenedEntries }
}

const failures = []
const spells = await allSpells()
console.log(`${spells.size} magias com heightening no índice`)

// 1. Casos do livro.
for (const [name, rank, expected] of BOOK) {
  const source = spells.get(name)
  if (!source) { failures.push(`${name}: não achada no índice`); continue }
  const scaled = scaleSpell(spellOf(source), rank)
  const got = scaled ? scaled.components.map((c) => formatValue(c.value)) : []
  const ok = JSON.stringify(got) === JSON.stringify(expected)
  console.log(`${ok ? '✓' : '✗'} ${name} no ${rank}º: ${got.join(', ') || '(nada)'}${ok ? '' : `  — esperado ${expected.join(', ')}`}`)
  if (!ok) failures.push(`${name} no ${rank}º`)
}

// 2–3. Identidade, monotonia e cobertura no índice inteiro.
let entries = 0
let resolved = 0
let withNumbers = 0
for (const [name, source] of spells) {
  const spell = spellOf(source)
  if (!spell.scaling || typeof spell.level !== 'number') continue
  withNumbers++
  for (const rule of spell.scaling.rules) {
    if (!/^\+/.test(rule.level)) continue
    entries++
    if (rule.resolved) resolved++
  }
  const base = scaleSpell(spell, spell.level)
  if (base.components.some((c) => c.changed)) failures.push(`${name}: muda no próprio rank`)
  let prev = base.components
  for (let rank = spell.level + 1; rank <= 10; rank++) {
    const now = scaleSpell(spell, rank).components
    const shrank = now.find((c, i) => !c.uncertain && !prev[i].uncertain && c.value.count < prev[i].value.count || (c.value.count === prev[i].value.count && c.value.flat < prev[i].value.flat))
    if (shrank) { failures.push(`${name}: diminui no ${rank}º (${shrank.formula})`); break }
    prev = now
  }
}

console.log(`\n${withNumbers} magias com números na prosa`)
console.log(`cobertura: ${resolved}/${entries} entradas "+N" viraram conta (${Math.round((100 * resolved) / Math.max(1, entries))}%)`)

if (failures.length) {
  console.log(`\n${failures.length} falha(s):`)
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\nTudo certo.')
