// Importa a base de regras da AON para o banco (BASE-DE-REGRAS §3) e a mecânica do Foundry (FONTES-DE-DADOS §4).
//
//   node --env-file=.env scripts/import-rules.mjs --remaster              # todos os livros Remaster
//   node --env-file=.env scripts/import-rules.mjs --source "Player Core"  # um livro (repita para mais)
//   node --env-file=.env scripts/import-rules.mjs --remaster --check      # só compara com a AON, não grava
//   node --env-file=.env scripts/import-rules.mjs --mechanics-only        # refaz só a mecânica do Foundry
//   node --env-file=.env scripts/import-rules.mjs --resume <job>          # retoma uma importação que caiu
//   node --env-file=.env scripts/import-rules.mjs --packages-only         # regera os pacotes da versão atual
//
// Roda na máquina de quem administra, sem o limite de 60 s da Vercel. Usa o mesmo núcleo da tela da F1B
// (`api/_lib/rules-*.js`). Reimportar sem mudança na AON = 0 alteradas (idempotente pelo `hash`).

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readRuleEntriesPage, readRuleSourcesPage } from '../api/_lib/rules-import.js'
import { normalizeRuleEntry, normalizeRuleSource, RULE_CATEGORIES } from '../api/_lib/rules-normalize.js'
import { buildFoundryMechanics, checkProgression } from '../api/_lib/rules-foundry.js'
import { buildRulePackages } from '../api/_lib/rules-packages.js'
import {
    createRuleCatalogVersion, latestRuleCatalogVersion, listRuleSources, markRuleEntriesRemoved, readRuleImportJob,
    ruleEntriesForMatching, ruleEntriesForPackages, ruleEntryHashes, ruleMechanicsById, saveFoundryMechanics,
    saveRuleEntries, saveRuleSources, startRuleImportJob, updateRuleImportJob, updateRuleSource, uploadRulePackages,
} from '../api/_lib/rules-store.js'
import { FOUNDRY_REF, loadFoundryPacks } from './rules-data/foundry-packs.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const readTable = (name) => JSON.parse(readFileSync(resolve(HERE, `rules-data/${name}.json`), 'utf8'))
const CORRECTIONS = readTable('corrections')

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const values = (name) => args.flatMap((arg, i) => arg === name && args[i + 1] ? [args[i + 1]] : [])
const checkOnly = flag('--check')
const mechanicsOnly = flag('--mechanics-only')
const resumeId = values('--resume')[0] ?? null
const packagesOnly = flag('--packages-only')

async function readAllSources() {
    const sources = []
    let after = null
    do {
        const page = await readRuleSourcesPage(after)
        for (const entry of page.entries) sources.push(normalizeRuleSource(entry))
        after = page.nextCursor
    } while (after)
    return sources
}

/** Pagina o livro inteiro, compara pelo `hash` e grava só o que mudou. */
async function importSource(source, jobId, startAfter) {
    const known = await ruleEntryHashes(source.aon_id)
    const seen = new Set()
    const counts = { new: 0, changed: 0, same: 0, removed: 0, invalid: 0 }
    const invalid = []
    let after = startAfter
    do {
        const page = await readRuleEntriesPage(source.name, RULE_CATEGORIES, after)
        const changed = []
        for (const entry of page.entries) {
            let row
            try {
                row = normalizeRuleEntry(entry, source)
            } catch (error) {
                counts.invalid++
                invalid.push(`${entry?.id}: ${error.message}`)
                continue
            }
            seen.add(row.aon_id)
            const previous = known.get(row.aon_id)
            if (previous && previous.hash === row.hash && !previous.removed) counts.same++
            else {
                counts[previous ? 'changed' : 'new']++
                changed.push(row)
            }
        }
        if (!checkOnly && changed.length) await saveRuleEntries(changed)
        after = page.nextCursor
        if (jobId) await updateRuleImportJob(jobId, { cursor: { source: source.aon_id, after } })
    } while (after)
    // Retomada no meio do livro não viu a primeira parte: não dá para concluir o que sumiu.
    const gone = startAfter ? [] : [...known].filter(([id, state]) => !seen.has(id) && !state.removed).map(([id]) => id)
    counts.removed = gone.length
    if (!checkOnly) {
        if (gone.length) await markRuleEntriesRemoved(gone)
        const now = new Date().toISOString()
        await updateRuleSource(source.aon_id, {
            aon_count: seen.size + counts.invalid,
            our_count: seen.size + [...known].filter(([id, state]) => !seen.has(id) && !state.removed && !gone.includes(id)).length,
            status: 'imported',
            checked_at: now,
            imported_at: now,
        })
    }
    return { counts, invalid }
}

async function importMechanics() {
    console.log(`\nMecânica do Foundry (${FOUNDRY_REF.slice(0, 12)})…`)
    const [{ docs, sha256 }, entries] = await Promise.all([loadFoundryPacks(), ruleEntriesForMatching()])
    const { rows, report } = buildFoundryMechanics(docs, entries, CORRECTIONS)
    const saved = await saveFoundryMechanics(rows)
    console.log(`${docs.length} documentos, ${report.matched} casados, ${report.ambiguous.length} ambíguos, ${report.unmatched.length} sem par; ${saved.saved} linhas gravadas (${saved.skippedManual} manuais preservadas); tarball sha256 ${sha256.slice(0, 16)}`)
    console.log('Não suportados mais frequentes:', Object.entries(report.unsupported).slice(0, 10).map(([key, n]) => `${key} ${n}`).join(', '))
    const byId = new Map(entries.map((entry) => [entry.aon_id, entry]))
    const problems = rows.filter((row) => row.progression).flatMap((row) => {
        const entry = byId.get(row.aon_id)
        const missing = row.progression.features.filter((feature) => !feature.aon_id).map((feature) => `${entry.name} ${feature.level}: "${feature.name}" sem entrada na AON`)
        return [...checkProgression(entry.name, row.progression, entry.markdown).filter((line) => !line.includes('fora da linha')), ...missing]
    })
    console.log(problems.length ? `Progressão:\n  ${problems.join('\n  ')}` : 'Progressão: níveis de talento e de perícia batem com a AON em todas as classes')
    return { matched: report.matched, ambiguous: report.ambiguous.length, unmatched: report.unmatched.length, saved: saved.saved, sha256 }
}

/** Pacotes por lista da versão no Storage (BASE-DE-REGRAS §5). */
async function publishPackages(version) {
    const [entries, mechanics, sources] = await Promise.all([ruleEntriesForPackages(), ruleMechanicsById(), listRuleSources()])
    const tables = { spellSlots: readTable('spell-slots'), wealth: readTable('wealth'), exports: readTable('exports') }
    const { files, manifest } = buildRulePackages({
        version, entries, mechanics, tables,
        sources: sources.filter((source) => source.status === 'imported' && source.our_count > 0),
    })
    await uploadRulePackages(version, files)
    const sizes = Object.values(manifest.files).map((file) => file.bytes)
    const biggest = Object.entries(manifest.files).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 5)
        .map(([list, file]) => `${list} ${(file.bytes / 1024).toFixed(0)} KB`)
    console.log(`Pacotes ${version}: ${Object.keys(files).length} arquivos, ${(sizes.reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB; maiores: ${biggest.join(', ')}`)
    return manifest
}

async function main() {
    if (mechanicsOnly || packagesOnly) {
        if (mechanicsOnly) await importMechanics()
        const version = await latestRuleCatalogVersion()
        if (!version) throw new Error('Nenhuma versão do catálogo ainda: importe um livro primeiro')
        await publishPackages(version)
        return
    }
    const resumed = resumeId ? await readRuleImportJob(resumeId) : null
    console.log('Lendo os livros da AON…')
    const sources = await readAllSources()
    if (!checkOnly) await saveRuleSources(sources)
    const wanted = new Set(values('--source'))
    const targets = sources
        .filter((source) => resumed ? resumed.sources.includes(source.aon_id) : (flag('--remaster') && source.remaster) || wanted.has(source.name))
        .sort((a, b) => a.aon_id.localeCompare(b.aon_id, 'en', { numeric: true }))
    const unknown = [...wanted].filter((name) => !sources.some((source) => source.name === name))
    if (unknown.length) throw new Error(`Livro desconhecido na AON: ${unknown.join(', ')}`)
    if (!targets.length) throw new Error('Nada a importar: use --remaster, --source "<livro>" ou --resume <job>')

    const imported = new Set((await listRuleSources()).filter((source) => source.status === 'imported').map((source) => source.aon_id))
    const kind = checkOnly ? 'check' : targets.every((source) => imported.has(source.aon_id)) ? 'reimport' : 'import'
    const jobId = resumed?.id ?? await startRuleImportJob(kind, targets.map((source) => source.aon_id))
    if (resumed) await updateRuleImportJob(jobId, { status: 'running', finished_at: null })
    console.log(`${kind}: ${targets.length} livro(s), job ${jobId}`)

    const totals = { new: 0, changed: 0, same: 0, removed: 0, invalid: 0 }
    const report = { sources: {} }
    try {
        let skipping = Boolean(resumed?.cursor?.source)
        for (const source of targets) {
            if (skipping && source.aon_id !== resumed.cursor.source) continue
            const startAfter = skipping ? resumed.cursor.after ?? null : null
            skipping = false
            const { counts, invalid } = await importSource(source, jobId, startAfter)
            for (const key of Object.keys(totals)) totals[key] += counts[key]
            report.sources[source.aon_id] = { name: source.name, ...counts, ...(invalid.length ? { invalid: invalid.slice(0, 20) } : {}) }
            console.log(`${source.name}: ${counts.new} novas, ${counts.changed} alteradas, ${counts.same} sem mudança, ${counts.removed} removidas${counts.invalid ? `, ${counts.invalid} inválidas` : ''}`)
        }
        if (!checkOnly) report.mechanics = await importMechanics()
        const changedSomething = totals.new + totals.changed + totals.removed > 0
        if (!checkOnly && changedSomething) {
            const version = await createRuleCatalogVersion(jobId, { totals, sources: targets.map((source) => source.name) })
            console.log(`Catálogo: versão ${version}`)
            await publishPackages(version)
        }
        await updateRuleImportJob(jobId, { status: 'done', counts: totals, report, finished_at: new Date().toISOString() })
        console.log(`\nTotal: ${totals.new} novas, ${totals.changed} alteradas, ${totals.same} sem mudança, ${totals.removed} removidas, ${totals.invalid} inválidas`)
    } catch (error) {
        await updateRuleImportJob(jobId, { status: 'failed', counts: totals, report: { ...report, error: error.message }, finished_at: new Date().toISOString() })
        console.error(`\nFalhou; retome com: node --env-file=.env scripts/import-rules.mjs --resume ${jobId}`)
        throw error
    }
}

await main()
