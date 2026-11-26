// Carga do catálogo inteiro no banco: a descrição (o MESMO payload da API) de toda magia, talento, item e opção de
// origem/classe do catálogo publicado vai para a tabela global `descriptions`, em português e em inglês. Depois disso,
// abrir qualquer entrada no Criador ou na Ficha lê do banco (`description-store.js`), sem AON nem tradutor.
//
//   node --env-file=.env scripts/warm-catalog-descriptions.mjs [--lang pt|en] [--kind spell|feat|item|special] [--limit N]
//
// - Retomável: o que já está no banco (na `CACHE_VERSION` atual) é pulado; pode parar e rodar de novo.
// - Português em grupos de 6 por chamada ao tradutor (o mesmo `resolveSpells`/`resolveEntries` da API); nunca grava
//   inglês de tradução que falhou (`translationPending`): fica para a próxima passada.
// - Inglês é o texto da AON como está, sem LLM.
import { register } from 'node:module'
register('./ts-loader.mjs', import.meta.url)

const { CACHE_VERSION } = await import('../src/services/descriptions.ts')
const { currentRulesVersion } = await import('../api/_lib/rules-core.js')
const { readPublishedRuleFile } = await import('../api/_lib/rules-store.js')
const { resolveSpells } = await import('../api/_lib/spells-core.js')
const { resolveFeats, resolveItems, resolveSpecials } = await import('../api/_lib/feat-core.js')
const { hasTranslationKey } = await import('../api/_lib/aon.js')
const { writeStoredDescriptions } = await import('../api/_lib/description-store.js')
const { supabase } = await import('../api/_lib/supabase.js')

const cli = process.argv.slice(2)
const arg = (k) => (cli.includes(k) ? cli[cli.indexOf(k) + 1] : null)
const LANGS = arg('--lang') ? [arg('--lang')] : ['en', 'pt']
const KINDS = arg('--kind') ? [arg('--kind')] : ['spell', 'feat', 'special', 'item']
const LIMIT = arg('--limit') ? Number(arg('--limit')) : Infinity

const ITEM_TYPES = new Set(['equipment', 'weapon', 'armor', 'shield'])
/** O mesmo pedido que a tela faz (`descriptionRequest` do seletor). */
const kindOf = (e) => (e.type === 'spell' ? 'spell' : e.type === 'feat' ? 'feat' : ITEM_TYPES.has(e.type) ? 'item' : 'special')

const version = await currentRulesVersion()
const manifest = await readPublishedRuleFile(version, 'manifest.json')
const names = { spell: new Set(), feat: new Set(), item: new Set(), special: new Set() }
const LIST_RE = /^(spells|feats|items|companions)\/|^core\/(ancestries|heritages|backgrounds|classes|class-features|archetypes|deities)$/
for (const path of Object.keys(manifest.files).filter((p) => LIST_RE.test(p))) {
    const list = await readPublishedRuleFile(version, `${path}.json`).catch(() => null)
    if (!Array.isArray(list)) continue
    for (const e of list) if (e?.name && !String(e.id).startsWith('mesa:')) names[kindOf(e)].add(e.name)
}
console.log(`catálogo ${version} · descrições ${CACHE_VERSION} ·`, Object.fromEntries(Object.entries(names).map(([k, v]) => [k, v.size])))

async function known(lang, kind, list) {
    const out = new Set()
    for (let i = 0; i < list.length; i += 200) {
        const { data, error } = await supabase().from('descriptions').select('name')
            .eq('version', CACHE_VERSION).eq('lang', lang).eq('kind', kind).in('name', list.slice(i, i + 200))
        if (error) throw error
        for (const r of data) out.add(r.name)
    }
    return out
}

const RESOLVE = {
    spell: (n, t, l) => resolveSpells(n, t, l),
    feat: (n, t, l) => resolveFeats(n, t, l),
    item: (n, t, l) => resolveItems(n, t, l),
    special: (n, t, l) => resolveSpecials(n, t, l),
}

for (const lang of LANGS) {
    const translate = lang === 'pt' && hasTranslationKey()
    if (lang === 'pt' && !translate) { console.error('Sem chave de tradução: o português fica para depois.'); continue }
    for (const kind of KINDS) {
        const all = [...names[kind]].sort()
        const have = await known(lang, kind, all)
        const todo = all.filter((n) => !have.has(n)).slice(0, LIMIT)
        console.log(`\n[${lang}/${kind}] ${have.size} no banco, ${todo.length} a resolver`)
        const GROUP = lang === 'pt' ? 6 : 12
        let saved = 0, pending = 0, empty = 0
        const started = Date.now()
        for (let i = 0; i < todo.length; i += GROUP) {
            const group = todo.slice(i, i + GROUP)
            try {
                const out = await RESOLVE[kind](group, translate, lang)
                const bag = Object.fromEntries(group.map((n, k) => [n, out[k]]))
                for (const p of Object.values(bag)) { if (p?.translationPending) pending++; else if (!p?.description) empty++ }
                saved += await writeStoredDescriptions(CACHE_VERSION, lang, kind, bag)
            } catch (e) {
                console.log(`  ! grupo ${i}: ${e instanceof Error ? e.message : e}`)
            }
            if ((i / GROUP) % 10 === 0) {
                const done = Math.min(i + GROUP, todo.length)
                const rate = done / Math.max(1, (Date.now() - started) / 1000)
                console.log(`  ${done}/${todo.length} · gravadas ${saved} · pendentes ${pending} · sem texto ${empty} · ~${Math.round((todo.length - done) / Math.max(rate, 0.01) / 60)} min`)
            }
        }
        console.log(`[${lang}/${kind}] gravadas ${saved}, pendentes de tradução ${pending}, sem texto na AON ${empty}`)
    }
}
process.exit(0)
