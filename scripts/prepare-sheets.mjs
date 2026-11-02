// Deixa PRONTO no banco tudo o que cada ficha publicada precisa da AON e da tradução: as descrições
// (magias, talentos, habilidades, itens, dádivas de relíquia) e as consultas de armas, armaduras,
// consumíveis e escudos. É o que a publicação faz sozinha; este script cobre as fichas que entraram
// por outro caminho (semeadura, JSON antigo). Incremental: só gasta tradução com o que falta.
// Uso: node --env-file=.env scripts/prepare-sheets.mjs [mesa] [slug] [--lang en] [--guides-en]
//   --lang en     monta o pacote de descrições em INGLÊS (texto da AON, sem tradução)
//   --guides-en   gera o guia "Como Jogar" em inglês das fichas que ainda não o têm (a publicação já gera os
//                 dois; isto cobre as publicadas antes do inglês)
import { register } from 'node:module'

register('./ts-loader.mjs', import.meta.url)

const { parseCharacterJson } = await import('../src/pathbuilder/types.ts')
const { characterDescriptionNames } = await import('../src/modules/character-viewer/descriptionNames.ts')
const { CACHE_VERSION } = await import('../src/services/descriptions.ts')
const { MESAS } = await import('../src/services/mesa.ts')
const { listSheets, readSheet } = await import('../api/_lib/sheet-store.js')
const { buildSheetDescriptions } = await import('../api/_lib/sheet-descriptions.js')
const { warmSheetLookups } = await import('../api/_lib/sheet-warm.js')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const lang = argv.includes('--lang') ? argv[argv.indexOf('--lang') + 1] : 'pt'
const [onlyMesa, onlySlug] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--lang')
const guidesEn = flag('--guides-en')
let pendingAny = false
for (const mesa of MESAS.map((m) => m.id).filter((id) => !onlyMesa || id === onlyMesa)) {
  for (const { slug } of await listSheets(mesa)) {
    if (onlySlug && slug !== onlySlug) continue
    const sheet = await readSheet(mesa, slug)
    const names = characterDescriptionNames(parseCharacterJson(sheet.json))
    if (guidesEn) {
      await englishGuide(mesa, slug, sheet)
      continue
    }
    let remaining = 1
    let rounds = 0
    let added = 0
    while (remaining > 0 && rounds++ < 20) {
      const r = await buildSheetDescriptions(mesa, slug, names, CACHE_VERSION, lang)
      if (r.busy) { await new Promise((res) => setTimeout(res, 5000)); continue }
      const round = Object.values(r.added ?? {}).reduce((n, o) => n + Object.keys(o).length, 0)
      added += round
      remaining = r.remaining ?? 0
      if (round === 0) break // sem progresso: o que sobrou a AON não resolve
    }
    await warmSheetLookups(sheet.json)
    if (remaining > 0) pendingAny = true
    console.log(`${mesa}/${slug}: +${added} descrições${remaining > 0 ? `, faltam ${remaining}` : ', completa'}`)
  }
}
process.exit(pendingAny ? 1 : 0)

/** O guia em inglês, gerado da ficha (base: o curado em inglês), sem mexer no português. */
async function englishGuide(mesa, slug, sheet) {
  if (sheet.guide?.en?.markdown) { console.log(`${mesa}/${slug}: guia em inglês já existe`); return }
  const { generateGuide } = await import('../api/_lib/guide-core.js')
  const { saveGuide } = await import('../api/_lib/sheet-store.js')
  const { curatedBase } = await import('../src/modules/character-viewer/combatGuides.ts')
  const base = curatedBase(parseCharacterJson(sheet.json)).en
  const en = await generateGuide(sheet.json, base, 'en')
  if (!en) { pendingAny = true; console.log(`${mesa}/${slug}: a IA não devolveu o guia em inglês`); return }
  const saved = await saveGuide(mesa, slug, sheet.publishedAt, null, { en, current: sheet.guide })
  console.log(`${mesa}/${slug}: ${saved ? 'guia em inglês gravado' : 'a ficha mudou no meio — rode de novo'}`)
}
