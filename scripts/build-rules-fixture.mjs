// Gera scripts/rules-data/fixture.json: um recorte FIXO do catálogo para o `check-builder` rodar sem rede nem banco
// (BASE-DE-REGRAS §9, PLANO-DE-TESTES). Vem dos pacotes publicados de uma versão (Storage), não da AON.
//
//   node --env-file=.env scripts/build-rules-fixture.mjs [versão]   # sem versão: a mais recente
//
// Entram inteiras as listas pequenas que o motor sempre lê (classes, ancestralidades, idiomas, tabelas, livros). Das
// outras, só o que os 10 personagens do elenco usam (pelo nome ou nome legado) e as características de classe que a
// progressão das classes deles aponta. Regere quando o catálogo mudar e confira o diff.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { latestRuleCatalogVersion } from '../api/_lib/rules-store.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, 'rules-data/fixture.json')
const CAST = resolve(HERE, '../public/characters')
const WHOLE = ['core/classes', 'core/ancestries', 'core/languages', 'core/sources', 'core/tables']
const FILTERED = ['core/heritages', 'core/backgrounds', 'core/class-features', 'core/deities', 'core/archetypes',
    'feats/general', 'feats/skill', 'feats/mythic', 'spells/arcane', 'spells/divine', 'spells/occult', 'spells/primal',
    'spells/focus', 'items/weapons', 'items/armor', 'items/shields', 'items/worn', 'items/held', 'items/consumables',
    'items/runes', 'items/gear']

const base = process.env.SUPABASE_URL
if (!base) throw new Error('Falta SUPABASE_URL no .env')
const version = process.argv[2] ?? await latestRuleCatalogVersion()
const fetchList = async (list) => {
    const res = await fetch(`${base}/storage/v1/object/public/rules/${version}/${list}.json`)
    if (!res.ok) throw new Error(`${list}: HTTP ${res.status}`)
    return res.json()
}

// Nomes que o elenco usa, em minúsculas (o Pathbuilder grava o nome canônico em inglês).
const names = new Set()
const add = (value) => typeof value === 'string' && value.trim() && names.add(value.trim().toLowerCase())
const builds = readdirSync(CAST).filter((file) => file.endsWith('.json')).map((file) => JSON.parse(readFileSync(resolve(CAST, file), 'utf8')).build)
for (const build of builds) {
    for (const key of ['class', 'dualClass', 'ancestry', 'heritage', 'background', 'deity']) add(build[key])
    for (const feat of build.feats) add(Array.isArray(feat) ? feat[0] : feat?.name)
    for (const special of build.specials) add(special)
    for (const caster of build.spellCasters) for (const rank of caster.spells) rank.list.forEach(add)
    for (const tradition of Object.values(build.focus ?? {})) {
        for (const focus of Object.values(tradition)) [...(focus.focusCantrips ?? []), ...(focus.focusSpells ?? [])].forEach(add)
    }
    for (const [item] of build.equipment) add(item)
    for (const weapon of build.weapons) add(weapon.name)
    for (const armor of build.armor) add(armor.name)
}

const lists = {}
for (const list of WHOLE) lists[list] = await fetchList(list)
const castClasses = new Set(builds.map((build) => build.class.toLowerCase()))
const featureIds = new Set(lists['core/classes'].filter((entry) => castClasses.has(entry.name.toLowerCase()))
    .flatMap((entry) => entry.class?.features ?? []).map((feature) => feature.id).filter(Boolean))
const used = (entry) => names.has(entry.name.toLowerCase()) || (entry.legacyNames ?? []).some((name) => names.has(name.toLowerCase()))
    || featureIds.has(entry.id)
// Talentos de ancestralidade e de arquétipo: varre todas as listas do manifesto e guarda só o que o elenco usa.
const manifest = await fetchList('manifest')
const scanned = Object.keys(manifest.files).filter((list) => /^feats\/(ancestry|archetype)\//.test(list) || list === 'core/actions' || list === 'feats/other')
for (const list of [...FILTERED, ...scanned]) {
    // Opções de subclasse (doutrina, racket, instinto…) entram todas: o export as nomeia com o tipo junto.
    const kept = (await fetchList(list)).filter((e) => used(e) || (list === 'core/class-features' && e.type !== 'class-feature'))
    if (kept.length || FILTERED.includes(list)) lists[list] = kept
}
// Itens específicos usam os números da base (Hero's Plate → Full Plate) e o punho é o desarmado padrão: entram também.
for (const entry of Object.values(lists).filter(Array.isArray).flat()) {
    for (const base of [entry.item?.baseItem ?? []].flat()) names.add(String(base).toLowerCase())
}
names.add('fist')
for (const list of ['items/weapons', 'items/armor', 'items/shields']) {
    const all = await fetchList(list)
    lists[list] = [...new Map([...lists[list], ...all.filter(used)].map((e) => [e.id, e])).values()]
}
for (const className of castClasses) {
    const list = `feats/class/${className.replace(/[^a-z0-9]+/g, '-')}`
    lists[list] = (await fetchList(list)).filter(used)
}

writeFileSync(OUT, `${JSON.stringify({ version, generatedFrom: 'Storage rules/<versão>', lists }, null, 1)}\n`)
const counts = Object.entries(lists).map(([list, entries]) => `${list} ${Array.isArray(entries) ? entries.length : 'obj'}`)
const found = new Set(Object.values(lists).filter(Array.isArray).flat().flatMap((entry) => [entry.name, ...(entry.legacyNames ?? [])].map((name) => name?.toLowerCase())))
const missing = [...names].filter((name) => !found.has(name)).sort()
console.log(`fixture ${version}: ${(readFileSync(OUT).length / 1024).toFixed(0)} KB\n  ${counts.join('\n  ')}`)
console.log(`Nomes do elenco sem entrada no recorte (${missing.length}): ${missing.join(', ')}`)
