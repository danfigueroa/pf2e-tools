// O retrato do "Aplicar na mesa" calculado no servidor (F10.1): o motor do Criador (pacote gerado de
// `src/modules/character-builder/engine/`, ver `scripts/build-engine.mjs`) compila o `BuildState` SALVO com o catálogo
// publicado, o conteúdo e as regras da mesa. Assim a ficha da mesa não depende de números que o cliente mandou.
import { compileFromCatalog, importFromCatalog } from './builder-engine.gen.js'
import { currentRulesVersion } from './rules-core.js'
import { readPublishedRuleFile } from './rules-store.js'
import { listHomebrew } from './homebrew-store.js'
import { createBuild, linkPublishedBuild, listBuilds, readBuild, readMesaRules, saveBuild } from './build-store.js'
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

/**
 * Ficha Virtual → Criador: a ficha que chegou do Pathbuilder (ou já estava na mesa) vira o build de mesmo slug, para a
 * evolução seguir no Criador. Sem build, cria (dono = o da ficha) e liga como aplicado; com build, troca as escolhas pelas
 * da ficha nova (os detalhes do Criador, como o retrato, ficam) e liga de novo. `null` = sem catálogo publicado.
 */
export async function importSheetToBuild(mesa, slug, json, { ownerId = null, by = null } = {}) {
    if (!isSupabaseConfigured()) return null
    const version = await currentRulesVersion().catch(() => null)
    if (!version) return null
    const [homebrew, mesaRules, builds] = await Promise.all([
        listHomebrew(mesa).then((rows) => rows.map((r) => r.entry)).catch(() => []),
        readMesaRules(mesa).then((r) => r.rules),
        listBuilds(mesa),
    ])
    const out = await importFromCatalog(json, { reader: readerFor(version), mesaRules, homebrew })
    const state = { ...out.state, rulesVersion: out.state.rulesVersion || version }
    const existing = builds.find((b) => b.slug === slug && !b.deletedAt)
    if (!existing) {
        const created = await createBuild(mesa, { slug, state, className: out.className, ownerId, by })
        if (!created) return null
        await linkPublishedBuild(mesa, slug, created.id, by)
        return { id: created.id, created: true, report: out.report }
    }
    const full = await readBuild(mesa, existing.id)
    const details = { ...(state.details ?? {}), ...(full?.state?.details ?? {}) }
    const saved = await saveBuild(mesa, existing.id, existing.rev, { state: { ...state, name: full?.state?.name || state.name, details }, className: out.className, by })
    if (saved) await linkPublishedBuild(mesa, slug, existing.id, by)
    return { id: existing.id, created: false, report: out.report }
}
