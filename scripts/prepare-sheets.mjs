// Deixa PRONTO no banco tudo o que cada ficha publicada precisa da AON e da tradução: as descrições
// (magias, talentos, habilidades, itens, dádivas de relíquia) e as consultas de armas, armaduras,
// consumíveis e escudos. É o que a publicação faz sozinha; este script cobre as fichas que entraram
// por outro caminho (semeadura, JSON antigo). Incremental: só gasta tradução com o que falta.
// Uso: node --env-file=.env scripts/prepare-sheets.mjs [mesa] [slug]
import { register } from 'node:module'

register('./ts-loader.mjs', import.meta.url)

const { parseCharacterJson } = await import('../src/pathbuilder/types.ts')
const { characterDescriptionNames } = await import('../src/modules/character-viewer/descriptionNames.ts')
const { CACHE_VERSION } = await import('../src/services/descriptions.ts')
const { MESAS } = await import('../src/services/mesa.ts')
const { listSheets, readSheet } = await import('../api/_lib/sheet-store.js')
const { buildSheetDescriptions } = await import('../api/_lib/sheet-descriptions.js')
const { warmSheetLookups } = await import('../api/_lib/sheet-warm.js')

const [onlyMesa, onlySlug] = process.argv.slice(2)
let pendingAny = false
for (const mesa of MESAS.map((m) => m.id).filter((id) => !onlyMesa || id === onlyMesa)) {
  for (const { slug } of await listSheets(mesa)) {
    if (onlySlug && slug !== onlySlug) continue
    const sheet = await readSheet(mesa, slug)
    const names = characterDescriptionNames(parseCharacterJson(sheet.json))
    let remaining = 1
    let rounds = 0
    let added = 0
    while (remaining > 0 && rounds++ < 20) {
      const r = await buildSheetDescriptions(mesa, slug, names, CACHE_VERSION)
      if (r.busy) { await new Promise((res) => setTimeout(res, 5000)); continue }
      added += Object.values(r.added ?? {}).reduce((n, o) => n + Object.keys(o).length, 0)
      remaining = r.remaining ?? 0
    }
    await warmSheetLookups(sheet.json)
    if (remaining > 0) pendingAny = true
    console.log(`${mesa}/${slug}: +${added} descrições${remaining > 0 ? `, faltam ${remaining}` : ', completa'}`)
  }
}
process.exit(pendingAny ? 1 : 0)
