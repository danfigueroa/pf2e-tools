// F10.4: o catálogo local (`rules_entries.aon_source`, `rules-local.js`) escolhe a mesma entrada e dá o mesmo texto que
// a AON? Para cada nome de descrição do elenco (`public/characters`), roda a escolha do pipeline (`bestAonHit`, a mesma
// de `feat-core.js` e `spells-core.js`) só na AON e com o catálogo primeiro, e compara entrada, documento e parse. As
// armas e armaduras passam pelo `gear-core.js` dos dois jeitos.
//
//   node --env-file=.env scripts/check-local-aon.mjs          # relatório; sai ≠ 0 se alguma entrada coberta divergir
//   node --env-file=.env scripts/check-local-aon.mjs --verbose # lista o que só a AON tem
import { register } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'

register('./ts-loader.mjs', import.meta.url)
const { parseAonText } = await import('../api/_lib/aon-parse.js')
const { bestAonHit } = await import('../api/_lib/rules-local.js')
const { resolveGearDirect } = await import('../api/_lib/gear-core.js')
const { aonSource } = await import('../api/_lib/rules-normalize.js')
const { sameJson } = await import('../api/_lib/json.js')
const { supabase } = await import('../api/_lib/supabase.js')
const { parseCharacterJson } = await import('../src/pathbuilder/types.ts')
const { characterDescriptionNames } = await import('../src/modules/character-viewer/descriptionNames.ts')

const verbose = process.argv.includes('--verbose')
const db = supabase()
if (!db) { console.error('Sem Supabase: rode com --env-file=.env'); process.exit(1) }

// As mesmas listas de categorias do pipeline (feat-core.js; a magia é a de spells-core.js).
const { LOOKUP_CATEGORIES } = await import('../api/_lib/feat-core.js')
const CATEGORIES = { feat: LOOKUP_CATEGORIES.feat, special: LOOKUP_CATEGORIES.special, item: LOOKUP_CATEGORIES.item, spell: ['spell', 'cantrip', 'focus'] }
const clean = (name) => String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\d+\s*feet?/gi, '').replace(/\s+/g, ' ').trim()

const wanted = new Map()
const gearNames = new Set()
for (const file of readdirSync(new URL('../public/characters/', import.meta.url)).filter((f) => f.endsWith('.json'))) {
    const build = parseCharacterJson(JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')))
    for (const [type, names] of Object.entries(characterDescriptionNames(build))) {
        if (!CATEGORIES[type]) continue
        for (const name of names) wanted.set(`${type}:${name}`, { type, name })
    }
    for (const w of build.weapons ?? []) gearNames.add(w.name)
    for (const a of build.armor ?? []) gearNames.add(a.name)
}

const counts = { total: 0, local: 0, same: 0, differs: 0, aonOnly: 0, none: 0, docSame: 0 }
const differs = []
const aonOnly = []
// Duas escolhas por nome, pelo mesmo caminho do `prepareEntry` (feat-core.js): o nome cru primeiro quando a limpeza
// muda algo, a classe do parêntese como dica; só a AON (como era) e o catálogo primeiro (como fica).
const CLASSES = new Set(['alchemist', 'animist', 'barbarian', 'bard', 'champion', 'cleric', 'commander', 'druid', 'exemplar', 'fighter',
    'guardian', 'gunslinger', 'inventor', 'investigator', 'kineticist', 'magus', 'monk', 'necromancer', 'oracle', 'psychic', 'ranger',
    'rogue', 'runesmith', 'sorcerer', 'summoner', 'swashbuckler', 'thaumaturge', 'witch', 'wizard'])
const hintOf = (name) => { const m = /\(([^)]+)\)\s*$/.exec(name); return m && CLASSES.has(m[1].trim().toLowerCase()) ? m[1].trim() : null }
const exact = (hit, name) => hit?._source?.name?.trim().toLowerCase() === String(name).trim().toLowerCase()
const pick = async (name, cats, local, item) => {
    const full = String(name).trim()
    const short = clean(full) || full
    const opts = { className: hintOf(full), item, local, exactOnly: LOOKUP_CATEGORIES.exactOnly }
    let best = full !== short ? await bestAonHit(full, cats, opts) : null
    if (!exact(best, full)) {
        const alt = await bestAonHit(short, cats, opts)
        if (exact(alt, short)) best = alt
        else if (!best) best = alt
    }
    return best
}
const items = [...wanted.values()]
for (let i = 0; i < items.length; i += 6) {
    await Promise.all(items.slice(i, i + 6).map(async ({ type, name }) => {
        counts.total++
        const isItem = type === 'item'
        const [remote, local] = await Promise.all([pick(name, CATEGORIES[type], false, isItem), pick(name, CATEGORIES[type], true, isItem)])
        if (!remote && !local) { counts.none++; return }
        if (!local?._local) { counts.aonOnly++; aonOnly.push(`${type} ${name} → ${remote?._source?.id} (${remote?._source?.primary_source ?? '?'})`) }
        else counts.local++
        const parse = (hit) => (hit ? parseAonText(hit._source.text || '', hit._source.markdown) : null)
        const sameEntry = remote?._source?.id === local?._source?.id
        const sameDoc = sameEntry && sameJson(aonSource(remote._source), aonSource(local._source))
            && (remote._source.markdown?.trim() || null) === (local._source.markdown ?? null)
        if (sameDoc) counts.docSame++
        if (sameEntry && sameJson(parse(remote), parse(local))) counts.same++
        else {
            counts.differs++
            differs.push(`${type} ${name}: AON ${remote?._source?.id ?? '—'} × local ${local?._source?.id ?? '—'}${sameEntry ? ' (parse diferente)' : ''}`)
        }
    }))
}

// Armas e armaduras do inventário (`gear-core.js`): o mesmo resultado com e sem o catálogo.
process.env.RULES_LOCAL = '0'
const gearRemote = await resolveGearDirect([...gearNames])
delete process.env.RULES_LOCAL
const gearLocal = await resolveGearDirect([...gearNames])
const gearDiff = [...gearNames].filter((n) => !sameJson(gearRemote[n] ?? null, gearLocal[n] ?? null))

console.log(`Descrições do elenco: ${counts.total} nomes. Escolha e texto iguais com e sem o catálogo: ${counts.same};`
    + ` diferentes: ${counts.differs}. Vieram do catálogo: ${counts.local} (documento idêntico ao da AON: ${counts.docSame});`
    + ` só da AON: ${counts.aonOnly}; sem entrada: ${counts.none}.`)
console.log(`Equipamento do elenco: ${gearNames.size} nomes, ${gearNames.size - gearDiff.length} iguais com e sem o catálogo.`)
for (const line of differs) console.log('  DIFERE', line)
for (const name of gearDiff) console.log('  DIFERE equipamento', name, JSON.stringify(gearRemote[name] ?? null), '×', JSON.stringify(gearLocal[name] ?? null))
if (verbose) for (const line of aonOnly) console.log('  só da AON', line)
process.exit(counts.differs || gearDiff.length ? 1 : 0)
