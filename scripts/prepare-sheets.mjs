// Deixa PRONTO no banco tudo o que cada ficha publicada precisa da AON e da tradução: as descrições
// (magias, talentos, habilidades, itens, dádivas de relíquia) e as consultas de armas, armaduras,
// consumíveis e escudos. É o que a publicação faz sozinha; este script cobre as fichas que entraram
// por outro caminho (semeadura, JSON antigo). Incremental: só gasta tradução com o que falta.
// Uso: node --env-file=.env scripts/prepare-sheets.mjs [mesa] [slug] [--lang en] [--guides-en] [--guides-pt]
//   --lang en     monta o pacote de descrições em INGLÊS (texto da AON, sem tradução)
//   --guides-en   gera o guia "Como Jogar" em inglês das fichas que ainda não o têm
//   --guides-pt   o mesmo em português
// A publicação (preparada, `api/_lib/sheet-draft.js`) já sai com tudo isso; o script cobre as fichas
// publicadas antes dela, que podem ter ficado sem guia ou com o pacote pela metade.
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
const guideLangs = [...(flag('--guides-pt') ? ['pt'] : []), ...(flag('--guides-en') ? ['en'] : [])]
let pendingAny = false
for (const mesa of MESAS.map((m) => m.id).filter((id) => !onlyMesa || id === onlyMesa)) {
  for (const { slug } of await listSheets(mesa)) {
    if (onlySlug && slug !== onlySlug) continue
    const sheet = await readSheet(mesa, slug)
    const names = characterDescriptionNames(parseCharacterJson(sheet.json))
    if (guideLangs.length > 0) {
      for (const guideLang of guideLangs) await missingGuide(mesa, slug, guideLang)
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

/** O guia de um idioma, gerado da ficha (base: o curado daquele idioma), sem mexer no outro. */
async function missingGuide(mesa, slug, guideLang) {
  const label = guideLang === 'en' ? 'em inglês' : 'em português'
  // Relida a cada idioma: o português gravado antes entra no `current` do inglês.
  const sheet = await readSheet(mesa, slug)
  const has = guideLang === 'en' ? sheet.guide?.en?.markdown : sheet.guide?.markdown
  if (has) { console.log(`${mesa}/${slug}: guia ${label} já existe`); return }
  const { generateGuide } = await import('../api/_lib/guide-core.js')
  const { saveGuide } = await import('../api/_lib/sheet-store.js')
  const { curatedBase } = await import('../src/modules/character-viewer/combatGuides.ts')
  const base = curatedBase(parseCharacterJson(sheet.json))[guideLang]
  const text = await generateGuide(sheet.json, base, guideLang)
  if (!text) { pendingAny = true; console.log(`${mesa}/${slug}: a IA não devolveu o guia ${label}`); return }
  const saved = guideLang === 'en'
    ? await saveGuide(mesa, slug, sheet.publishedAt, null, { en: text, current: sheet.guide })
    : await saveGuide(mesa, slug, sheet.publishedAt, text, { current: sheet.guide })
  console.log(`${mesa}/${slug}: ${saved ? `guia ${label} gravado` : 'a ficha mudou no meio — rode de novo'}`)
}
