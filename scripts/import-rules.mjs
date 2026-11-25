// Importa a base de regras da AON para o banco (BASE-DE-REGRAS §3) e a mecânica do Foundry (FONTES-DE-DADOS §4).
//
//   node --env-file=.env scripts/import-rules.mjs --remaster              # todos os livros Remaster
//   node --env-file=.env scripts/import-rules.mjs --source "Player Core"  # um livro (repita para mais)
//   node --env-file=.env scripts/import-rules.mjs --remaster --check      # só compara com a AON, não grava
//   node --env-file=.env scripts/import-rules.mjs --mechanics-only        # refaz só a mecânica do Foundry (versão nova)
//   node --env-file=.env scripts/import-rules.mjs --resume <job>          # retoma uma importação que caiu
//   node --env-file=.env scripts/import-rules.mjs --packages-only         # regera os pacotes da versão atual
//
// Roda na máquina de quem administra, sem o limite de 60 s da Vercel. Usa o mesmo núcleo da tela da F1B
// (`api/_lib/rules-platform.js`: os mesmos passos, sem o prazo de 60 s); só o script roda a mecânica do Foundry,
// que precisa do tarball. Reimportar sem mudança na AON = 0 alteradas (idempotente pelo `hash`).

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readRuleSourcesPage } from '../api/_lib/rules-import.js'
import { normalizeRuleSource } from '../api/_lib/rules-normalize.js'
import { publishRuleCatalog, runRuleImportStep, startRuleImport } from '../api/_lib/rules-platform.js'
import { buildFoundryMechanics, checkProgression } from '../api/_lib/rules-foundry.js'
import { buildRulePackages } from '../api/_lib/rules-packages.js'
import {
    latestRuleCatalogVersion, listRuleSources, ruleEntriesForMatching, ruleEntriesForPackages, ruleMechanicsById,
    saveFoundryMechanics, saveRuleSources, updateRuleImportJob, uploadRulePackages,
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

const curatedTables = () => ({ spellSlots: readTable('spell-slots'), wealth: readTable('wealth'), exports: readTable('exports') })

/** Pacotes da versão atual regenerados por inteiro (`--packages-only`, depois de mudar as tabelas curadas). */
async function publishPackages(version) {
    const [entries, mechanics, sources] = await Promise.all([ruleEntriesForPackages(), ruleMechanicsById(), listRuleSources()])
    const { files, manifest } = buildRulePackages({
        version, entries, mechanics, tables: curatedTables(),
        sources: sources.filter((source) => ['imported', 'outdated'].includes(source.status) && source.our_count > 0),
    })
    await uploadRulePackages(version, files)
    const sizes = Object.values(manifest.files).map((file) => file.bytes)
    console.log(`Pacotes ${version}: ${Object.keys(files).length} arquivos, ${(sizes.reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB`)
}

async function main() {
    if (mechanicsOnly) {
        // Mecânica nova = versão nova (o caminho dos pacotes é imutável no CDN e no aparelho).
        const mechanics = await importMechanics()
        await publishRuleCatalog({ tables: curatedTables(), summary: { mechanics }, log: console.log })
        return
    }
    if (packagesOnly) {
        const version = await latestRuleCatalogVersion()
        if (!version) throw new Error('Nenhuma versão do catálogo ainda: importe um livro primeiro')
        await publishPackages(version)
        return
    }
    console.log('Lendo os livros da AON…')
    const sources = await readAllSources()
    await saveRuleSources(sources)
    let jobId = resumeId
    if (!jobId) {
        const wanted = new Set(values('--source'))
        const unknown = [...wanted].filter((name) => !sources.some((source) => source.name === name))
        if (unknown.length) throw new Error(`Livro desconhecido na AON: ${unknown.join(', ')}`)
        const targets = sources.filter((source) => (flag('--remaster') && source.remaster) || wanted.has(source.name))
        if (!targets.length) throw new Error('Nada a importar: use --remaster, --source "<livro>" ou --resume <job>')
        jobId = await startRuleImport(targets.map((source) => source.aon_id))
    } else {
        await updateRuleImportJob(jobId, { status: 'running', finished_at: null })
    }
    console.log(`${checkOnly ? 'check' : 'importação'}: job ${jobId}`)

    // Os mesmos passos da tela da plataforma, sem prazo.
    try {
        const job = await runRuleImportStep(jobId, { checkOnly, log: console.log })
        const { counts } = job
        if (!checkOnly) {
            const mechanics = await importMechanics()
            const changedSomething = counts.new + counts.changed + counts.removed > 0
            const report = { ...job.report, mechanics }
            if (changedSomething) {
                report.catalog = await publishRuleCatalog({
                    jobId, tables: curatedTables(), since: job.started_at, log: console.log,
                    summary: { totals: counts, sources: job.sources.map((id) => job.report.sources?.[id]?.name ?? id) },
                })
            }
            await updateRuleImportJob(jobId, { status: 'done', report, cursor: { ...job.cursor, phase: 'done' }, finished_at: new Date().toISOString() })
        }
        console.log(`\nTotal: ${counts.new} novas, ${counts.changed} alteradas, ${counts.same} sem mudança, ${counts.removed} removidas, ${counts.invalid} inválidas`)
    } catch (error) {
        await updateRuleImportJob(jobId, { status: 'failed', finished_at: new Date().toISOString() })
        console.error(`\nFalhou; retome com: node --env-file=.env scripts/import-rules.mjs --resume ${jobId}`)
        throw error
    }
}

await main()
