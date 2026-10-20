// Gera os pacotes de descrições pré-traduzidas da campanha:
// `public/descriptions/<slug>.json`, com magias, talentos, habilidades e itens.
//
//   node --env-file=.env scripts/build-description-bundle.mjs                 # presets do repositório
//   node --env-file=.env scripts/build-description-bundle.mjs --published https://<app>.vercel.app
//   node --env-file=.env scripts/build-description-bundle.mjs --all           # retraduz tudo
//
// Por quê: o elenco é pequeno e o que cada ficha descreve muda pouco, mas toda
// ficha aberta num aparelho novo refazia busca na AON + tradução por LLM a cada
// toque num talento, habilidade, item ou magia. Resolvido uma vez aqui, vira
// arquivo estático no CDN e toda aba abre pronta. O app carrega o pacote ao
// abrir a ficha (`loadDescriptionBundle` em `src/services/descriptions.ts`); o
// que faltar segue pela API. A ficha PUBLICADA não depende deste script: o
// servidor mantém o pacote dela sozinho (`api/_lib/sheet-descriptions.js`).
//
// - O payload é o MESMO da API (`resolveSpells`, `resolveFeats`,
//   `resolveSpecials`) — o app não sabe de onde a descrição veio.
// - Os nomes saem de `characterDescriptionNames`, com as mesmas funções das abas.
// - O pacote leva a `CACHE_VERSION` do cliente. Subiu a versão (o payload mudou
//   de forma)? O app passa a ignorar os pacotes, e este script, sem `--all`,
//   percebe e refaz tudo.
// - Incremental por padrão: o que já está no pacote (na versão certa) fica como
//   está. Rodar de novo depois de um level-up traduz só o novo, e o diff mostra
//   só isso — retraduzir tudo trocaria palavras ao acaso a cada rodada.
// - Os presets de TODAS as mesas (`PRESETS_BY_MESA`): o pacote é do personagem,
//   não da mesa.
// - `--published` usa a ficha PUBLICADA pela mesa quando houver e inclui os
//   personagens publicados que não são preset — de cada mesa.
// - Nunca grava inglês: o que ficou com `translationPending` depois de três
//   passadas fica de fora (o app busca pela API) e o script sai com código 1.

import { register } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

register('./ts-loader.mjs', import.meta.url)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'descriptions')
// Pacotes da primeira versão (só magias): reaproveitados para não retraduzir.
const LEGACY_SPELLS_DIR = join(ROOT, 'public', 'spells')

const { parseCharacterJson } = await import('../src/modules/character-sheet/types.ts')
const { characterDescriptionNames } = await import('../src/modules/character-viewer/descriptionNames.ts')
const { PRESETS_BY_MESA } = await import('../src/modules/character-viewer/campaignPresets.ts')
const { MESAS } = await import('../src/services/mesa.ts')
const { charSlugFromName } = await import('../src/modules/character-viewer/charId.ts')
const { CACHE_VERSION } = await import('../src/services/descriptions.ts')
const { resolveSpells } = await import('../api/_lib/spells-core.js')
const { resolveFeats, resolveSpecials } = await import('../api/_lib/feat-core.js')
const { hasTranslationKey } = await import('../api/_lib/aon.js')

const RESOLVERS = { spell: resolveSpells, feat: resolveFeats, special: resolveSpecials, item: resolveSpecials }
const KINDS = Object.keys(RESOLVERS)
const KIND_LABEL = { spell: 'magias', feat: 'talentos', special: 'habilidades', item: 'itens' }

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
  for (const preset of Object.values(PRESETS_BY_MESA).flat()) {
    const json = JSON.parse(readFileSync(join(ROOT, 'public', 'characters', preset.filename), 'utf8'))
    out.set(charSlugFromName(preset.sheetName), { name: preset.name, json, from: preset.filename })
  }
  if (publishedAt) {
    const base = publishedAt.replace(/\/$/, '')
    for (const mesa of MESAS) {
      // A legada vai sem `mesa=`, como o app manda (ver `stateApi`).
      const scope = mesa.legacy ? '' : `&mesa=${encodeURIComponent(mesa.id)}`
      const { sheets } = await getJson(`${base}/api/state?sheets=1${scope}`)
      for (const summary of sheets ?? []) {
        const { sheet } = await getJson(`${base}/api/state?sheet=${encodeURIComponent(summary.slug)}${scope}`)
        if (!sheet?.json) continue
        const known = out.get(summary.slug)
        out.set(summary.slug, { name: known?.name ?? summary.name, json: sheet.json, from: `publicada (${mesa.nome})` })
      }
    }
  }
  return [...out].map(([slug, c]) => ({ slug, ...c }))
}

// --- Resolução ---------------------------------------------------------------

function readJson(path) {
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

/** O que já estava pronto para este personagem, por tipo (pacote atual ou o antigo, só de magias). */
function previousEntries(slug) {
  const current = readJson(join(OUT_DIR, `${slug}.json`))
  if (current?.version === CACHE_VERSION && current.entries) return current.entries
  const legacy = readJson(join(LEGACY_SPELLS_DIR, `${slug}.json`))
  if (legacy?.version === CACHE_VERSION && legacy.spells) return { spell: legacy.spells }
  return {}
}

/** Mesmo critério do cliente para guardar uma descrição no cache. */
const usable = (entry) =>
  !!entry && typeof entry.description === 'string' && entry.description.trim().length > 0 && !entry.translationPending

/** Traduzido nesta rodada, por tipo e nome — o Shield Block do Ghan Buri serve ao Thalos. */
const resolved = Object.fromEntries(KINDS.map((k) => [k, new Map()]))

async function resolveAll(kind, names) {
  let pending = names.filter((n) => !resolved[kind].has(n))
  for (let pass = 0; pass < PASSES && pending.length > 0; pass++) {
    for (let i = 0; i < pending.length; i += GROUP) {
      const group = pending.slice(i, i + GROUP)
      const out = await RESOLVERS[kind](group, true)
      out.forEach((entry, k) => { if (usable(entry)) resolved[kind].set(group[k], entry) })
      process.stdout.write('.')
    }
    pending = pending.filter((n) => !resolved[kind].has(n))
  }
  return pending
}

// --- Principal -----------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })
let failed = false

for (const c of await characters()) {
  const build = parseCharacterJson(c.json)
  const names = characterDescriptionNames(build)
  const reuse = all ? {} : previousEntries(c.slug)

  console.log(`${c.name} (${c.from})`)
  const entries = {}
  for (const kind of KINDS) {
    const list = [...names[kind]].sort((a, b) => a.localeCompare(b))
    for (const n of list) if (usable(reuse[kind]?.[n]) && !resolved[kind].has(n)) resolved[kind].set(n, reuse[kind][n])
    process.stdout.write(`  ${KIND_LABEL[kind]}: ${list.length} `)
    const missing = await resolveAll(kind, list)
    console.log(missing.length ? ` faltaram ${missing.length}: ${missing.join(', ')}` : ' ok')
    if (missing.length) failed = true
    // Ordem alfabética: o diff de uma rodada para outra mostra só o que mudou.
    entries[kind] = Object.fromEntries(list.filter((n) => resolved[kind].has(n)).map((n) => [n, resolved[kind].get(n)]))
  }

  const body = { version: CACHE_VERSION, character: build.name, entries }
  writeFileSync(join(OUT_DIR, `${c.slug}.json`), JSON.stringify(body, null, 1) + '\n')
}

process.exit(failed ? 1 : 0)
