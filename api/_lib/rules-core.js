// Leitura do catálogo pela API (BASE-DE-REGRAS §5 e §7): rota de reserva dos pacotes do Storage e busca livre.
// Mora em `api/search.js` (limite de 12 funções). O caminho normal do Criador é o pacote no Storage, sem função.
import { supabase } from './supabase.js'
import { latestRuleCatalogVersion } from './rules-store.js'

const VERSION_RE = /^\d{4}\.\d{2}\.\d+$/
const LIST_RE = /^(core|feats|spells|items|companions|other)(\/[a-z0-9-]{1,60}){1,2}$/
const VERSION_TTL_MS = 60_000

let versionCache = { value: null, at: 0 }

/** Versão atual do catálogo (vai no `?me=1`), com cache curto; sem banco ou sem importação, null. */
export async function currentRulesVersion() {
    if (!supabase()) return null
    if (Date.now() - versionCache.at < VERSION_TTL_MS) return versionCache.value
    try {
        versionCache = { value: await latestRuleCatalogVersion(), at: Date.now() }
    } catch {
        return versionCache.value
    }
    return versionCache.value
}

/**
 * `?rules=<lista>&v=<versão>` → o mesmo JSON do pacote do Storage; `?rules=search&q=` → até 30 entradas pelo nome.
 * Devolve `{ status, body, cache }`; quem chama escreve a resposta (Vercel e dev server).
 */
export async function resolveRulesRequest({ rules, v, q, limit }) {
    const db = supabase()
    if (!db) return { status: 503, body: { error: 'Base de regras indisponível' } }
    if (rules === 'search') {
        const term = String(q ?? '').trim().slice(0, 60)
        if (term.length < 2) return { status: 400, body: { error: 'Busca curta demais' } }
        const size = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 30)
        const { data, error } = await db.from('rules_entries')
            .select('id, name, category, level, rarity, traits, source_id, remaster')
            .ilike('name', `%${term.replace(/[%_\\]/g, (char) => `\\${char}`)}%`)
            .is('removed_at', null)
            .order('remaster', { ascending: false })
            .order('name')
            .limit(size)
        if (error) throw new Error(error.message)
        return {
            status: 200,
            cache: 'public, max-age=300',
            body: { results: data.map(({ category, source_id, ...row }) => ({ ...row, type: category, source: `source:${source_id}` })) },
        }
    }
    const list = String(rules ?? '')
    if (list !== 'manifest' && !LIST_RE.test(list)) return { status: 400, body: { error: 'Lista de regras inválida' } }
    const version = v ? String(v) : await currentRulesVersion()
    if (!version || !VERSION_RE.test(version)) return { status: 400, body: { error: 'Versão do catálogo inválida' } }
    const { data, error } = await db.storage.from('rules').download(`${version}/${list}.json`)
    if (error || !data) return { status: 404, body: { error: 'Lista de regras não encontrada' } }
    return {
        status: 200,
        // Pedido com a versão é imutável; sem ela, a resposta muda na próxima importação.
        cache: v ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
        body: JSON.parse(await data.text()),
    }
}
