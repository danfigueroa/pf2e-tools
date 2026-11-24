// Gera as tabelas curadas do Criador a partir do índice da AON:
// - scripts/rules-data/spell-slots.json: magias por dia de cada classe conjuradora Remaster, da tabela
//   "Your Level | Cantrips | 1st…" no markdown da classe;
// - scripts/rules-data/wealth.json: "Table 10-10: Character Wealth" (GM Core pg. 61, rules-2662).
//
// Rode à mão: `node scripts/fetch-rules-tables.mjs` (confira o diff e a conferência com o elenco no fim).
//
// POR QUE BUSCAR EM VEZ DE DIGITAR: são ~16 tabelas de 20 × 11 números; digitados à mão erram em silêncio e o Criador
// daria slot errado. A AON publica as mesmas tabelas. Os benefícios de arquétipo não têm tabela: vêm do texto de
// "Spellcasting Archetypes" (Player Core pg. 215), transcrito em ARCHETYPE abaixo.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, 'rules-data/spell-slots.json')
const WEALTH_OUT = resolve(HERE, 'rules-data/wealth.json')
const CAST = resolve(HERE, '../public/characters')
const ES = 'https://elasticsearch.aonprd.com/aon/_search'

// Player Core pg. 215, "Spellcasting Archetypes" (/Rules.aspx?ID=2132): o nível do personagem em que cada benefício
// dá um slot de cada rank. A dedicação dá só truques (o número está no talento de dedicação de cada arquétipo).
const ARCHETYPE = {
    source: 'Player Core pg. 215',
    basic: { 4: 1, 6: 2, 8: 3 },
    expert: { 12: 4, 14: 5, 16: 6 },
    master: { 18: 7, 20: 8 },
}

/** "5" → 5; "2*" → 5 com nota; "2+2" → [2, 2] (Animist: classe + aparição); "—" → 0. */
function cell(raw) {
    const value = raw.replace(/&nbsp;/g, ' ').trim()
    const note = (value.match(/[*†‡]+/g) ?? []).join('') || null
    const bare = value.replace(/[*†‡\s]/g, '')
    if (!bare || /^[—–-]+$/.test(bare)) return { value: 0, note }
    if (/^\d+\+\d+$/.test(bare)) return { value: bare.split('+').map(Number), note }
    if (/^\d+$/.test(bare)) return { value: Number(bare), note }
    throw new Error(`célula ilegível: ${raw}`)
}

function slotTable(markdown) {
    const match = /<table><thead><tr><th>Your Level<\/th><th>Cantrips<\/th>(.*?)<\/thead>(.*?)<\/table>/s.exec(markdown ?? '')
    if (!match) return null
    const ranks = [...match[1].matchAll(/<th>(\d+)(?:st|nd|rd|th)<\/th>/g)].map((m) => Number(m[1]))
    const perDay = {}
    const notes = {}
    for (const row of match[2].matchAll(/<tr><td>(\d+)<\/td>(.*?)<\/tr>/gs)) {
        const level = Number(row[1])
        const cells = [...row[2].matchAll(/<td>([^<]*)<\/td>/g)].map((m) => cell(m[1]))
        if (cells.length !== ranks.length + 1) throw new Error(`nível ${level}: ${cells.length} colunas para ${ranks.length} ranks`)
        perDay[level] = cells.map((part) => part.value)
        cells.forEach((part, rank) => {
            if (part.note) (notes[level] ??= {})[rank] = part.note
        })
    }
    if (Object.keys(perDay).length !== 20) throw new Error('tabela sem as 20 linhas')
    return { maxRank: Math.max(...ranks), perDay, notes }
}

async function search(body) {
    const response = await fetch(ES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'PF2e rules catalog' },
        body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`AON: ${response.status}`)
    return (await response.json()).hits.hits.map((hit) => hit._source)
}

const gp = (raw) => Number(raw.replace(/[,\s]|gp/g, ''))

/** Table 10-10: Character Wealth → { nível: { items: { nível do item: quantidade }, currency, lumpSum } }, em po. */
function wealthTable(markdown) {
    const start = markdown.indexOf('Table 10-10: Character Wealth')
    const table = /<table>(.*?)<\/table>/s.exec(markdown.slice(start))?.[1]
    if (start < 0 || !table) throw new Error('Character Wealth: tabela não encontrada')
    const levels = {}
    for (const row of table.matchAll(/<tr><td>(\d+)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)) {
        const items = Object.fromEntries([...row[2].matchAll(/\*\*(\d+)(?:st|nd|rd|th)\*\*: (\d+)/g)].map((m) => [m[1], Number(m[2])]))
        levels[row[1]] = { items, currency: gp(row[3]), lumpSum: gp(row[4]) }
    }
    if (Object.keys(levels).length !== 20) throw new Error('Character Wealth: tabela sem as 20 linhas')
    return levels
}

const [wealthRule] = await search({ size: 1, query: { bool: { filter: [{ term: { 'id.keyword': 'rules-2662' } }] } }, _source: ['name', 'markdown', 'primary_source_raw'] })
if (wealthRule?.name !== 'Treasure for New Characters') throw new Error('AON: rules-2662 mudou de nome; confira a tabela')
writeFileSync(WEALTH_OUT, `${JSON.stringify({ aon_id: 'rules-2662', source: wealthRule.primary_source_raw, unit: 'gp', levels: wealthTable(wealthRule.markdown) }, null, 2)}\n`)
console.log(`Character Wealth → ${WEALTH_OUT}`)

const classes = {}
for (const entry of await search({
    size: 100,
    sort: [{ 'id.keyword': 'asc' }],
    query: { bool: { filter: [{ term: { category: 'class' } }], must_not: [{ exists: { field: 'remaster_id' } }] } },
    _source: ['id', 'name', 'markdown', 'primary_source_raw'],
})) {
    const table = slotTable(entry.markdown)
    if (!table) continue
    if (classes[entry.name]) throw new Error(`classe repetida sem remaster_id: ${entry.name}`)
    classes[entry.name] = { aon_id: entry.id, source: entry.primary_source_raw, ...table }
}

const sorted = Object.fromEntries(Object.entries(classes).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(OUT, `${JSON.stringify({ classes: sorted, archetype: ARCHETYPE }, null, 2)}\n`)
console.log(`${Object.keys(sorted).length} classes conjuradoras → ${OUT}`)

// Conferência com o elenco: o perDay que o Pathbuilder exportou para o conjurador da própria classe.
for (const file of readdirSync(CAST).filter((name) => name.endsWith('.json'))) {
    const { build } = JSON.parse(readFileSync(resolve(CAST, file), 'utf8'))
    const caster = build.spellCasters.find((part) => part.name === build.class && !part.innate)
    const table = sorted[build.class]
    if (!caster || !table) continue
    const ours = table.perDay[build.level].map((value) => Array.isArray(value) ? value[0] + value[1] : value)
    const diff = ours.map((value, rank) => value === (caster.perDay[rank] ?? 0) ? null : `${rank}: AON ${value} × export ${caster.perDay[rank]}`).filter(Boolean)
    console.log(`${file} ${build.class} ${build.level}: ${diff.length ? diff.join('; ') : 'bate'}`)
}
