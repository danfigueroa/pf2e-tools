// F10.4, passo 1: a base local (`rules_entries.aon_source`) devolve o mesmo documento que a busca da AON? Para cada nome
// de descrição do elenco (`public/characters`), acha a entrada na AON como o pipeline acha (`feat-core.js`,
// `spells-core.js`: categorias na mesma ordem, `pickBestHit`) e compara o `_source` com o da mesma entrada no banco.
// Documento igual = parse igual. Nada é trocado na plataforma: é a prova antes de mudar a fonte.
//
//   node --env-file=.env scripts/check-local-aon.mjs          # relatório; sai ≠ 0 se alguma entrada coberta divergir
//   node --env-file=.env scripts/check-local-aon.mjs --verbose # lista o que o banco não cobre
import { register } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'

register('./ts-loader.mjs', import.meta.url)
const { searchAon } = await import('../api/_lib/aon.js')
const { pickBestHit, parseAonText } = await import('../api/_lib/aon-parse.js')
const { aonSource } = await import('../api/_lib/rules-normalize.js')
const { sameJson } = await import('../api/_lib/json.js')
const { supabase } = await import('../api/_lib/supabase.js')
const { parseCharacterJson } = await import('../src/pathbuilder/types.ts')
const { characterDescriptionNames } = await import('../src/modules/character-viewer/descriptionNames.ts')

const verbose = process.argv.includes('--verbose')
const db = supabase()
if (!db) { console.error('Sem Supabase: rode com --env-file=.env'); process.exit(1) }

// As mesmas listas de categorias do pipeline (feat-core.js e spells-core.js).
const CATEGORIES = {
    feat: ['feat', 'heritage', 'ancestry-feature', 'class-feature', 'action'],
    special: ['class-feature', 'feat', 'action', 'ancestry-feature', 'heritage', 'equipment', null],
    item: ['class-feature', 'feat', 'action', 'ancestry-feature', 'heritage', 'equipment', null],
    spell: ['spell', 'cantrip', 'focus'],
}
const clean = (name) => String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\d+\s*feet?/gi, '').replace(/\s+/g, ' ').trim()

async function aonHit(name, categories) {
    let best = null
    for (const cat of categories) {
        const pick = pickBestHit(await searchAon(name, cat, cat === 'class-feature' ? 60 : 10), name)
        if (pick && pick._source?.name?.toLowerCase() === name.toLowerCase()) return pick
        if (!best && pick) best = pick
    }
    return best
}

const wanted = new Map()
for (const file of readdirSync(new URL('../public/characters/', import.meta.url)).filter((f) => f.endsWith('.json'))) {
    const build = parseCharacterJson(JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')))
    for (const [type, names] of Object.entries(characterDescriptionNames(build))) {
        if (!CATEGORIES[type]) continue
        for (const name of names) wanted.set(`${type}:${name}`, { type, name })
    }
}

const counts = { total: 0, covered: 0, same: 0, differs: 0, notInDb: 0, noSource: 0, notOnAon: 0 }
const differs = []
const missing = []
const items = [...wanted.values()]
for (let i = 0; i < items.length; i += 6) {
    await Promise.all(items.slice(i, i + 6).map(async ({ type, name }) => {
        counts.total++
        const hit = await aonHit(clean(name) || name, CATEGORIES[type]) ?? await aonHit(name, CATEGORIES[type])
        if (!hit) { counts.notOnAon++; return }
        const id = hit._source.id
        const { data: row } = await db.from('rules_entries').select('aon_source, markdown').eq('aon_id', id).maybeSingle()
        if (!row) { counts.notInDb++; missing.push(`${type} ${name} → ${id} (${hit._source.primary_source ?? '?'})`); return }
        if (!row.aon_source) { counts.noSource++; return }
        counts.covered++
        const local = { ...row.aon_source, markdown: row.markdown ?? undefined }
        const sameDoc = sameJson(aonSource(hit._source), row.aon_source) && (hit._source.markdown?.trim() || null) === (row.markdown ?? null)
        const sameParse = sameJson(parseAonText(hit._source.text || '', hit._source.markdown), parseAonText(local.text || '', local.markdown))
        if (sameDoc && sameParse) counts.same++
        else { counts.differs++; differs.push(`${type} ${name} → ${id}: ${sameParse ? 'documento' : 'parse'} diferente`) }
    }))
}

console.log(`Nomes do elenco: ${counts.total}. Na AON e no banco com documento: ${counts.covered}`
    + ` (iguais ${counts.same}, diferentes ${counts.differs}). Fora do banco: ${counts.notInDb} (legado ou categoria não importada);`
    + ` no banco sem documento: ${counts.noSource}; sem entrada na AON: ${counts.notOnAon}.`)
for (const line of differs) console.log('  DIFERE', line)
if (verbose) for (const line of missing) console.log('  fora do banco', line)
process.exit(counts.differs ? 1 : 0)
