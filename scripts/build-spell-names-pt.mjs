// Atualiza os nomes de exibição em português com o catálogo publicado. Preserva as traduções já revisadas no arquivo.
// node --env-file=.env scripts/build-spell-names-pt.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { runChainedPrompt, hasTranslationKey } from '../api/_lib/aon.js'
import { currentRulesVersion } from '../api/_lib/rules-core.js'
import { readPublishedRuleFile } from '../api/_lib/rules-store.js'

const output = new URL('../src/modules/character-builder/components/spellNames.pt.json', import.meta.url)
const previous = JSON.parse(await readFile(output, 'utf8').catch((e) => {
    if (e.code === 'ENOENT') return '{}'
    throw e
}))
const version = await currentRulesVersion()
const manifest = await readPublishedRuleFile(version, 'manifest.json')
const paths = Object.keys(manifest.files).filter((path) => path.startsWith('spells/'))
const lists = await Promise.all(paths.map((path) => readPublishedRuleFile(version, `${path}.json`)))
const names = [...new Set(lists.flat().filter((e) => e.type === 'spell' || e.type === 'ritual').map((e) => e.name))].sort()
if (!names.length) throw new Error('Catálogo sem magias ou rituais')
const missing = names.filter((name) => !Object.hasOwn(previous, name))
if (missing.length && !hasTranslationKey()) throw new Error('Sem chave de tradução')

function decode(text, length) {
    try {
        const data = JSON.parse(String(text ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''))
        return Array.isArray(data) && data.length === length && data.every((name) => typeof name === 'string' &&
            name.trim() === name && name.length > 0 && name.length <= 120 && !/[\r\n<>*]/.test(name)) ? data : null
    } catch { return null }
}

async function translate(batch) {
    const prompt = `Traduza os títulos de magias e rituais de Pathfinder 2e para português brasileiro. Traduza o sentido do título, mantendo nomes próprios de pessoas e lugares. Use linguagem natural e concisa. Convenções: Cantrip = Truque, Fireball = Bola de Fogo, Force Barrage = Barragem de Força, Heal = Curar, Harm = Ferir, Void = Vazio. Retorne apenas um array JSON de ${batch.length} strings, na mesma ordem da entrada, sem índices, explicações ou marcação.\n\n${JSON.stringify(batch)}`
    const response = await runChainedPrompt(prompt, { clean: false, maxTokens: 4096, validate: (text) => !!decode(text, batch.length) })
    const translations = decode(response, batch.length)
    if (translations) {
        for (const [j, name] of batch.entries()) previous[name] = translations[j]
    } else if (batch.length > 1) {
        const half = Math.ceil(batch.length / 2)
        await translate(batch.slice(0, half))
        await translate(batch.slice(half))
    }
}

for (let i = 0; i < missing.length; i += 50) {
    await translate(missing.slice(i, i + 50))
    const sorted = Object.fromEntries(Object.entries(previous).sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1))
    await writeFile(output, JSON.stringify(sorted, null, 2) + '\n')
    console.log(`${names.filter((name) => Object.hasOwn(previous, name)).length}/${names.length} títulos disponíveis`)
}
const unresolved = names.filter((name) => !Object.hasOwn(previous, name))
if (unresolved.length) throw new Error(`Faltam ${unresolved.length} títulos: ${unresolved.join(', ')}`)
console.log(`${names.length} nomes cobertos no catálogo ${version}`)
