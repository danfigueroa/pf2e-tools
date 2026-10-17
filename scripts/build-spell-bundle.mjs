// Gera os pacotes de magias pré-traduzidas da campanha: `public/spells/<slug>.json`.
//
//   node --env-file=.env scripts/build-spell-bundle.mjs                 # presets do repositório
//   node --env-file=.env scripts/build-spell-bundle.mjs --published https://<app>.vercel.app
//   node --env-file=.env scripts/build-spell-bundle.mjs --all           # retraduz tudo
//
// Por quê: o elenco é pequeno e as magias de cada um mudam pouco, mas toda
// ficha aberta num aparelho novo refazia busca na AON + tradução por LLM para
// as mesmas magias. Resolvidas uma vez aqui, elas viram arquivo estático no CDN
// e a aba de Magias abre pronta. O app carrega o pacote ao abrir a ficha
// (`loadSpellBundle` em `src/services/descriptions.ts`); o que faltar segue pela API.
//
// - O payload é o MESMO da API (`resolveSpells`, o núcleo do `api/spells.js`),
//   com `scaling` e tudo — o app não sabe de onde a magia veio.
// - Os nomes saem de `characterSpellNames`, a mesma função do "Carregar todas".
// - O pacote leva a `CACHE_VERSION` do cliente. Subiu a versão (o payload mudou
//   de forma)? O app passa a ignorar os pacotes, e este script, sem `--all`,
//   percebe e refaz tudo.
// - Incremental por padrão: magia que já está no pacote (na versão certa) fica
//   como está. Rodar de novo depois de um level-up traduz só as novas, e o diff
//   mostra só elas — retraduzir tudo trocaria palavras ao acaso a cada rodada.
// - `--published` usa a ficha PUBLICADA pela mesa quando houver (é a de agora:
//   o level-up chega por lá, não pelo arquivo do repositório) e inclui os
//   personagens publicados que não são preset.
// - Nunca grava inglês: magia que ficou com `translationPending` depois de três
//   passadas fica de fora (o app a busca pela API) e o script sai com código 1.

import { register } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

register('./ts-loader.mjs', import.meta.url)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'spells')

const { parseCharacterJson } = await import('../src/modules/character-sheet/types.ts')
const { characterSpellNames } = await import('../src/modules/character-viewer/spellNames.ts')
const { CAMPAIGN_PRESETS } = await import('../src/modules/character-viewer/campaignPresets.ts')
const { charSlugFromName } = await import('../src/modules/character-viewer/charId.ts')
const { CACHE_VERSION } = await import('../src/services/descriptions.ts')
const { resolveSpells } = await import('../api/_lib/spells-core.js')
const { hasTranslationKey } = await import('../api/_lib/aon.js')

const args = process.argv.slice(2)
const all = args.includes('--all')
const publishedAt = args.includes('--published') ? args[args.indexOf('--published') + 1] : null
if (args.includes('--published') && !publishedAt) {
  console.error('Uso: --published https://<app>.vercel.app')
  process.exit(2)
}

if (!hasTranslationKey()) {
  console.error('Sem GEMINI_API_KEY/GROQ_API_KEY: o pacote sairia em inglês. Rode com --env-file=.env.')
  process.exit(2)
}

const GROUP = 6
const PASSES = 3

// --- Quais fichas ------------------------------------------------------------

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

/** `[{ slug, name, json }]`: presets do repositório, trocados pela versão publicada quando pedida. */
async function characters() {
  const out = new Map()
  for (const preset of CAMPAIGN_PRESETS) {
    const json = JSON.parse(readFileSync(join(ROOT, 'public', 'characters', preset.filename), 'utf8'))
    out.set(charSlugFromName(preset.sheetName), { name: preset.name, json, from: preset.filename })
  }
  if (publishedAt) {
    const base = publishedAt.replace(/\/$/, '')
    const { sheets } = await getJson(`${base}/api/state?sheets=1`)
    for (const summary of sheets ?? []) {
      const { sheet } = await getJson(`${base}/api/state?sheet=${encodeURIComponent(summary.slug)}`)
      if (!sheet?.json) continue
      const known = out.get(summary.slug)
      out.set(summary.slug, { name: known?.name ?? summary.name, json: sheet.json, from: 'publicada' })
    }
  }
  return [...out].map(([slug, c]) => ({ slug, ...c }))
}

// --- Resolução ---------------------------------------------------------------

function readBundle(slug) {
  const path = join(OUT_DIR, `${slug}.json`)
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

/** Mesmo critério do cliente (`prefetchSpellDescriptions`) para aceitar uma magia. */
const usable = (spell) =>
  !!spell && typeof spell.description === 'string' && spell.description.trim().length > 0 && !spell.translationPending

/** Magias traduzidas nesta rodada, por nome — o Heal do Ceros serve ao Thalos. */
const resolved = new Map()

async function resolveAll(names) {
  let pending = names.filter((n) => !resolved.has(n))
  for (let pass = 0; pass < PASSES && pending.length > 0; pass++) {
    for (let i = 0; i < pending.length; i += GROUP) {
      const group = pending.slice(i, i + GROUP)
      const out = await resolveSpells(group, true)
      out.forEach((spell, k) => { if (usable(spell)) resolved.set(group[k], spell) })
      process.stdout.write('.')
    }
    pending = pending.filter((n) => !resolved.has(n))
  }
  return pending
}

// --- Principal -----------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })
let failed = false

for (const c of await characters()) {
  const build = parseCharacterJson(c.json)
  const names = characterSpellNames(build).sort((a, b) => a.localeCompare(b))
  if (names.length === 0) {
    console.log(`${c.name}: sem magias`)
    continue
  }

  const previous = readBundle(c.slug)
  const reuse = !all && previous?.version === CACHE_VERSION ? previous.spells ?? {} : {}
  for (const n of names) if (usable(reuse[n]) && !resolved.has(n)) resolved.set(n, reuse[n])

  process.stdout.write(`${c.name} (${c.from}): ${names.length} magias `)
  const missing = await resolveAll(names)
  console.log(missing.length ? ` faltaram ${missing.length}: ${missing.join(', ')}` : ' ok')
  if (missing.length) failed = true

  // Ordem alfabética: o diff de uma rodada para outra mostra só o que mudou.
  const spells = Object.fromEntries(names.filter((n) => resolved.has(n)).map((n) => [n, resolved.get(n)]))
  const body = { version: CACHE_VERSION, character: build.name, spells }
  writeFileSync(join(OUT_DIR, `${c.slug}.json`), JSON.stringify(body, null, 1) + '\n')
}

process.exit(failed ? 1 : 0)
