// Garante que todo personagem fixo (`public/characters/`) esteja publicado no banco da mesa dele.
// Só publica o que FALTA — nunca sobrescreve uma ficha já publicada (level-up, correção).
// Uso: node --env-file=.env scripts/seed-presets.mjs [--dry]
import { readFileSync } from 'node:fs'
import { publishSheet, readSheet, sheetInfo, slugFromName } from '../api/_lib/sheet-store.js'

const dry = process.argv.includes('--dry')
const src = readFileSync(new URL('../src/modules/character-viewer/campaignPresets.ts', import.meta.url), 'utf8')
const block = src.slice(src.indexOf('PRESETS_BY_MESA'))
let failed = 0
for (const m of block.matchAll(/'([a-z0-9-]+)':\s*\[([\s\S]*?)\n  \]/g)) {
  const mesa = m[1]
  for (const f of m[2].matchAll(/filename:\s*'([^']+)'/g)) {
    const json = JSON.parse(readFileSync(new URL(`../public/characters/${f[1]}`, import.meta.url), 'utf8'))
    const info = sheetInfo(json)
    if (!info) { console.log(`${mesa}/${f[1]}: JSON sem build — pulado`); failed++; continue }
    const slug = slugFromName(json.build.name)
    if (await readSheet(mesa, slug)) { console.log(`${mesa}/${slug}: já está no banco`); continue }
    if (dry) { console.log(`${mesa}/${slug}: faltaria publicar`); continue }
    await publishSheet(mesa, slug, json)
    console.log(`${mesa}/${slug}: publicada`)
  }
}
process.exit(failed ? 1 : 0)
