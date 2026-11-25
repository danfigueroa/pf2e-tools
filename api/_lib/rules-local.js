// A base local antes da AON (F10.4): o catálogo importado (`rules_entries.aon_source`) devolve o mesmo documento que
// a busca da AON, no mesmo formato de hit (`{ _source }`). Os parsers de descrição (`feat-core.js`, `spells-core.js`,
// `gear-core.js`) consultam aqui primeiro, por nome exato, e caem na AON quando o banco não tem a entrada (livro
// legado, categoria não importada). `scripts/check-local-aon.mjs` prova que a escolha e o texto são os mesmos.
//
// `RULES_LOCAL=0` desliga (tudo volta para a AON ao vivo), sem mexer no código.

import { searchAon } from './aon.js'
import { pickBestHit } from './aon-parse.js'
import { supabase } from './supabase.js'

const MAX_HITS = 60
// Por função quente: o catálogo só muda numa importação, e um minuto de atraso não importa.
const TTL_MS = 60_000
const cache = new Map()

export function localEnabled() {
    return process.env.RULES_LOCAL !== '0' && !!supabase()
}

const hitOf = (row) => ({ _source: { ...row.aon_source, ...(row.markdown ? { markdown: row.markdown } : {}) }, _local: true })
const sameName = (hit, name) => hit?._source?.name?.trim().toLowerCase() === String(name).trim().toLowerCase()
const escapeLike = (value) => String(value).replace(/[\\%_]/g, (c) => `\\${c}`)

async function cached(key, load) {
    const hit = cache.get(key)
    if (hit && hit.at > Date.now() - TTL_MS) return hit.value
    const value = await load()
    cache.set(key, { at: Date.now(), value })
    if (cache.size > 2000) cache.delete(cache.keys().next().value)
    return value
}

/** Entradas do catálogo com este nome (sem diferenciar maiúsculas), na categoria da AON (`null` = qualquer). */
export async function localHitsByName(name, category = null) {
    const term = String(name || '').trim()
    if (!term || !localEnabled()) return []
    return cached(`n:${category}:${term.toLowerCase()}`, async () => {
        let query = supabase().from('rules_entries').select('aon_source, markdown')
            .ilike('name', escapeLike(term)).is('removed_at', null).not('aon_source', 'is', null)
            // Desempate estável do `pickBestHit` (mesma data): a entrada principal antes das variantes (`-1839` × `-1839-1600`).
            .order('aon_id').limit(MAX_HITS)
        if (category) query = query.eq('category', category)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        return (data ?? []).map(hitOf)
    })
}

/** Entradas do catálogo com estes nomes exatos (o `terms name.keyword` da AON), numa categoria. */
export async function localHitsByNames(category, names) {
    const list = [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))]
    if (list.length === 0 || !localEnabled()) return []
    return cached(`s:${category}:${list.slice().sort().join('|')}`, async () => {
        const { data, error } = await supabase().from('rules_entries').select('aon_source, markdown')
            .eq('category', category).in('name', list).is('removed_at', null).not('aon_source', 'is', null).order('aon_id').limit(list.length * 4)
        if (error) throw new Error(error.message)
        return (data ?? []).map(hitOf)
    })
}

/**
 * A melhor entrada para `name`, categoria por categoria na ordem dada (a mais provável primeiro): o nome exato no
 * catálogo vale primeiro; sem ele, a busca da AON de sempre. Falha do banco não derruba nada: segue a AON.
 * `local: false` força só a AON (o teste compara os dois caminhos).
 */
export async function bestAonHit(name, categories, { className = null, item = false, local = localEnabled() } = {}) {
    let best = null
    for (const cat of categories) {
        // Sem categoria é a rede de segurança: a AON devolve as 10 mais relevantes e o catálogo devolveria toda entrada de
        // nome exato de qualquer categoria ("Occult" traço × exemplar dracônico). Ali vale a AON, como sempre.
        if (local && cat) {
            const hits = await localHitsByName(name, cat).catch((error) => {
                console.error('[rules-local] busca no catálogo falhou, segue a AON:', error.message)
                return []
            })
            const pick = pickBestHit(hits, name, className, item)
            if (pick && sameName(pick, name)) return pick
        }
        // Característica de classe: uma entrada por classe, e as Remaster ficavam depois das 10 primeiras (legado).
        const results = await searchAon(name, cat, cat === 'class-feature' ? MAX_HITS : 10)
        const pick = pickBestHit(results, name, className, item)
        if (pick && sameName(pick, name)) return pick
        if (!best && pick) best = pick
    }
    return best
}
