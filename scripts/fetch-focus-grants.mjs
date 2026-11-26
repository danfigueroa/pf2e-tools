// Gera `src/modules/character-builder/engine/focusGrants.gen.ts`: que característica de classe, subclasse e talento
// concede qual magia de foco, lido do texto da AON (Remaster). O catálogo não traz a concessão (o Foundry quase nunca a
// põe em regra), e sem ela a aba Magias do Criador ficava sem as magias de foco da classe.
//
//   node scripts/fetch-focus-grants.mjs            grava a tabela
//   node scripts/fetch-focus-grants.mjs --dry      só mostra o que mudaria
//
// Regras de leitura (confira o diff!):
// - Lista rotulada da subclasse ("**Initial** [X]", "**Advanced Revelation Spell** [Y]", "**Grave Spell** [Z]"): o
//   rótulo diz o degrau (inicial, avançado, maior).
// - Texto corrido: "You learn/gain the [X] …" na mesma frase concede no degrau inicial; "your choice of [X] or [Y]" e
//   "Choose either [X] or …" viram escolha (`choice`), que o jogador faz na aba Magias.
// - Escola arcana: a primeira magia da escola é a inicial e a segunda a avançada (Player Core pg. 195–197).
// - Duas magias de foco na mesma frase com "or"/"either" ("You learn either [X] or [Y]") são escolha.
// - Rótulo com "(Level N)" (psi cantrips mais fundos do Psychic) só concede a partir do nível N (`atLevel`).
// - Link para a magia antiga (legado) vale a revisada que a substitui.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ES = 'https://elasticsearch.aonprd.com/aon/_search'
const OUT = fileURLToPath(new URL('../src/modules/character-builder/engine/focusGrants.gen.ts', import.meta.url))
const dry = process.argv.includes('--dry')

async function all(query, fields) {
    const out = []
    for (let from = 0; from < 10000; from += 1000) {
        const body = { size: 1000, from, query, _source: fields }
        const res = await fetch(ES, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        const json = await res.json()
        if (!json.hits) throw new Error(`AON: ${JSON.stringify(json).slice(0, 300)}`)
        out.push(...json.hits.hits.map((h) => h._source))
        if (json.hits.hits.length < 1000) break
    }
    return out
}

// Magias de foco revisadas: traço Focus, ou truque de classe sem tradição (as composições do Bard são "Cantrip").
const spells = await all({ term: { category: 'spell' } }, ['id', 'name', 'trait', 'tradition', 'spell_type', 'remaster_id', 'legacy_id'])
const isFocus = (s) => (s.trait ?? []).includes('Focus') || s.spell_type === 'Focus'
    || ((s.trait ?? []).includes('Cantrip') && !(s.tradition ?? []).length)
const focus = new Map()
for (const s of spells) if (!s.remaster_id && isFocus(s)) focus.set(s.id, s)
// Link antigo → revisada (a AON ainda aponta para o id do legado em parte do texto).
const legacyTo = new Map()
for (const s of focus.values()) for (const old of s.legacy_id ?? []) legacyTo.set(old, s.id)
const resolve = (num) => focus.has(`spell-${num}`) ? `spell-${num}` : legacyTo.get(`spell-${num}`)

const SKIP = new Set(['spell', 'creature', 'npc', 'hazard', 'equipment', 'sidebar', 'action', 'archetype', 'class', 'rules',
    'creature-family', 'creature-theme-template', 'trait', 'source', 'deity', 'ritual', 'weapon', 'armor', 'shield', 'monster-family'])
const docs = (await all({ bool: { must: [{ match_phrase: { markdown: 'Spells.aspx' } }] } }, ['id', 'name', 'category', 'markdown', 'remaster_id']))
    .filter((d) => !d.remaster_id && !SKIP.has(d.category))

const tierOf = (label) => /greater/i.test(label) ? 'greater' : /advanced/i.test(label) ? 'advanced' : 'initial'
const plain = (md) => md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[_*]/g, '')
const CHOICE = /\b(?:your choice of|choose (?:either|one|from|between)|one of the following)\b[^.]*$/i
const GRANT = /\b(?:you\s+(?:also\s+)?(?:gain|learn|get)|gains?\s+the|learns?\s+the)\b[^.]*$/i

const table = {}
for (const d of docs) {
    const md = d.markdown ?? ''
    const grants = { initial: [], advanced: [], greater: [], choice: [] }
    const atLevel = {}
    const links = [...md.matchAll(/\[([^\]]+)\]\(\/Spells\.aspx\?ID=(\d+)\)/g)]
    const found = links.map((m) => ({ m, id: resolve(m[2]) })).filter((x) => x.id)
    if (!found.length) continue
    if (d.category === 'arcane-school') {
        const ids = [...new Set(found.map((x) => x.id))]
        if (ids[0]) grants.initial.push(ids[0])
        if (ids[1]) grants.advanced.push(ids[1])
    } else {
        // A frase de cada link: duas magias de foco ligadas por "or"/"either" na mesma frase são escolha.
        const sentenceOf = (i) => {
            const start = Math.max(md.lastIndexOf('. ', i), md.lastIndexOf('\n', i)) + 1
            const ends = [md.indexOf('. ', i), md.indexOf('\n', i)].filter((x) => x >= 0)
            return [start, ends.length ? Math.min(...ends) : md.length]
        }
        const perSentence = new Map()
        for (const { m } of found) {
            const key = sentenceOf(m.index).join(':')
            perSentence.set(key, (perSentence.get(key) ?? 0) + 1)
        }
        for (const { m, id } of found) {
            const [start, end] = sentenceOf(m.index)
            const sentence = plain(md.slice(start, end))
            const alternative = (perSentence.get(`${start}:${end}`) ?? 0) > 1 && /\b(?:or|either)\b/i.test(sentence)
            const before = md.slice(Math.max(0, m.index - 500), m.index)
            const label = /\*\*([^*]+)\*\*\s*$/.exec(before)?.[1]
            if (label && /spell|initial|advanced|greater|cantrip|hex/i.test(label)) {
                const at = /\(level (\d+)\)/i.exec(label)
                if (at) atLevel[`spell:${id}`] = Number(at[1])
                grants[tierOf(label)].push(id)
            } else if (!label && (alternative || CHOICE.test(plain(before))) && GRANT.test(plain(before)) || !label && CHOICE.test(plain(before))) grants.choice.push(id)
            else if (!label && GRANT.test(plain(before))) grants.initial.push(id)
        }
    }
    const clean = Object.fromEntries(Object.entries(grants).map(([k, v]) => [k, [...new Set(v)].map((x) => `spell:${x}`)]).filter(([, v]) => v.length))
    if (Object.keys(atLevel).length) clean.atLevel = atLevel
    if (Object.keys(clean).length) table[d.id] = clean
}

const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
const names = Object.fromEntries([...focus.values()].map((s) => [`spell:${s.id}`, s.name]))
const body = `// GERADO por scripts/fetch-focus-grants.mjs a partir do texto da AON. Não edite: rode o script e confira o diff.
/* i18n-ignore-file */
// id da AON (característica de classe, subclasse ou talento) → magias de foco concedidas, por degrau.
export const FOCUS_GRANTS: Record<string, { initial?: string[]; advanced?: string[]; greater?: string[]; choice?: string[]; atLevel?: Record<string, number> }> = ${JSON.stringify(sorted, null, 4)}
`
const before = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
console.log(`${Object.keys(sorted).length} entradas concedem foco (${docs.length} documentos lidos, ${focus.size} magias de foco).`)
if (dry) {
    for (const [id, g] of Object.entries(sorted)) {
        const d = docs.find((x) => x.id === id)
        console.log(`${id} ${d?.name} → ${Object.entries(g).filter(([k]) => k !== 'atLevel').map(([k, v]) => `${k}: ${v.map((x) => names[x]).join(', ')}`).join(' | ')}`)
    }
} else if (before !== body) {
    writeFileSync(OUT, body)
    console.log(`gravado: ${OUT}`)
} else console.log('sem mudança')
