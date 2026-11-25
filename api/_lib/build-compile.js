// O retrato do "Aplicar na mesa" calculado no servidor (F10.1): o motor do Criador (pacote gerado de
// `src/modules/character-builder/engine/`, ver `scripts/build-engine.mjs`) compila o `BuildState` SALVO com o catálogo
// publicado, o conteúdo e as regras da mesa. Assim a ficha da mesa não depende de números que o cliente mandou.
import { compileFromCatalog } from './builder-engine.gen.js'
import { currentRulesVersion } from './rules-core.js'
import { readPublishedRuleFile } from './rules-store.js'
import { listHomebrew } from './homebrew-store.js'
import { readMesaRules } from './build-store.js'
import { isSupabaseConfigured } from './supabase.js'

// Listas da versão atual, entre chamadas da mesma função quente (uma versão por vez: o catálogo pesa ~5 MB).
let cache = { version: null, lists: new Map() }

function readerFor(version) {
    if (cache.version !== version) cache = { version, lists: new Map() }
    const lists = cache.lists
    return {
        read: (path) => {
            if (!lists.has(path)) {
                const pending = readPublishedRuleFile(version, `${path}.json`).catch(() => null)
                lists.set(path, pending)
                // Falha não fica no cache: a próxima aplicação tenta de novo.
                void pending.then((v) => { if (v === null) lists.delete(path) })
            }
            return lists.get(path)
        },
    }
}

/**
 * `{ sheet }` = o retrato `{ success, build }` do servidor; `null` = não deu para calcular aqui (sem Supabase, sem
 * catálogo publicado ou erro do motor) — quem chama segue com o do cliente e registra.
 */
export async function serverSheet(mesa, build) {
    if (!isSupabaseConfigured()) return null
    const version = await currentRulesVersion().catch(() => null)
    if (!version) return null
    const [homebrew, mesaRules] = await Promise.all([
        listHomebrew(mesa).then((rows) => rows.map((r) => r.entry)).catch(() => []),
        readMesaRules(mesa).then((r) => r.rules),
    ])
    const out = await compileFromCatalog(build.state, { reader: readerFor(version), mesaRules, homebrew, buildId: build.id })
    return { sheet: out.sheet, version }
}

/** O que diverge entre o retrato do cliente e o do servidor, só nos números (para o registro). */
export function sheetDivergence(client, server) {
    const keys = ['level', 'abilities', 'proficiencies', 'attributes', 'acTotal']
    const diff = keys.filter((k) => JSON.stringify(client?.[k] ?? null) !== JSON.stringify(server?.[k] ?? null))
    const attacks = (b) => (b?.weapons ?? []).map((w) => `${w.name}:${w.attack}:${w.damageBonus}`).sort().join('|')
    if (attacks(client) !== attacks(server)) diff.push('weapons')
    return diff
}
