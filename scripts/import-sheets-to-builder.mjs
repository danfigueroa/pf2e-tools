// Carga única Ficha Virtual → Criador: toda ficha publicada que ainda não tem build ganha um, com o mesmo slug (o
// estado da mesa continua ligado), o dono da ficha e marcado como aplicado. É o mesmo caminho que o servidor faz sozinho
// quando chega uma ficha nova do Pathbuilder (`importSheetToBuild`).
//
//   node --env-file=.env scripts/import-sheets-to-builder.mjs [--mesa <id>] [--dry]
//
// `--dry` só lista o que faria. Idempotente: ficha que já tem build fica como está.
import { MESA_IDS } from '../api/_lib/mesas.js'
import { listSheets, readSheet } from '../api/_lib/sheet-store.js'
import { listBuilds } from '../api/_lib/build-store.js'
import { importSheetToBuild } from '../api/_lib/build-compile.js'

const cli = process.argv.slice(2)
const dry = cli.includes('--dry')
const only = cli.includes('--mesa') ? cli[cli.indexOf('--mesa') + 1] : null
let failed = 0

for (const mesa of MESA_IDS.filter((m) => !only || m === only)) {
    const [sheets, builds] = await Promise.all([listSheets(mesa), listBuilds(mesa)])
    const taken = new Set(builds.filter((b) => !b.deletedAt).map((b) => b.slug))
    const todo = sheets.filter((s) => !taken.has(s.slug))
    console.log(`\n${mesa}: ${sheets.length} fichas, ${taken.size} já no Criador, ${todo.length} a importar`)
    for (const s of todo) {
        if (dry) { console.log(`  · ${s.slug} (${s.className} ${s.level})`); continue }
        try {
            const sheet = await readSheet(mesa, s.slug)
            const out = await importSheetToBuild(mesa, s.slug, sheet.json, { ownerId: s.ownerId })
            if (!out) { failed++; console.log(`  ✗ ${s.slug}: sem catálogo publicado ou slug ocupado`); continue }
            const miss = out.report.notFound.length ? ` · fora do catálogo: ${out.report.notFound.join(', ')}` : ''
            console.log(`  ✓ ${s.slug} → build ${out.id}${miss}`)
        } catch (e) {
            failed++
            console.log(`  ✗ ${s.slug}: ${e instanceof Error ? e.message : e}`)
        }
    }
}
process.exit(failed ? 1 : 0)
