// Testes do Criador de Personagem sem rede nem banco (PLANO-DE-TESTES). Por enquanto: os PARES cliente × servidor
// (regra global 7) rodando os mesmos casos — `sanitizeBuildState`, `sanitizeMesaRules`/padrões e o slug do build.
// O motor (F3+) entra aqui, contra `scripts/rules-data/fixture.json`.
//
//   node scripts/check-builder.mjs
//
// Sai com código diferente de zero na falha.

import { register } from 'node:module'
import { isDeepStrictEqual } from 'node:util'

register('./ts-loader.mjs', import.meta.url)

const serverSanitize = await import('../api/_lib/build-sanitize.js')
const serverStore = await import('../api/_lib/build-store.js')
const clientSanitize = await import('../src/modules/character-builder/sanitize.ts')
const clientRules = await import('../src/modules/character-builder/mesaRules.ts')
const { buildSlugFromName: clientSlug } = await import('../src/modules/character-viewer/charId.ts')

let failures = 0
let passed = 0
function expect(name, got, want) {
    if (isDeepStrictEqual(got, want)) {
        passed += 1
        return
    }
    failures += 1
    console.log(`  FAIL ${name}\n    veio:     ${JSON.stringify(got)}\n    esperava: ${JSON.stringify(want)}`)
}

/** Os dois lados dão o mesmo resultado E o esperado (quando há). */
function pair(name, server, client, input, want) {
    const a = server(structuredClone(input))
    const b = client(structuredClone(input))
    expect(`${name} (cliente = servidor)`, b, a)
    if (want !== undefined) expect(name, a, want)
}

const empty = serverSanitize.emptyBuildState('Ana', '2026.11.2')

console.log('sanitizeBuildState')
const S = (name, input, want) => pair(name, serverSanitize.sanitizeBuildState, clientSanitize.sanitizeBuildState, input, want)
S('vazio volta igual', empty, empty)
S('não-objeto → null', 'x', null)
S('array → null', [], null)
S('sem nome → null', { level: 3 }, null)
S('nome só espaço → null', { name: '   ' }, null)
S('nome longo demais → null', { name: 'x'.repeat(81) }, null)
S('padrões preenchidos', { name: ' Ana ' }, { ...empty, rulesVersion: '' })
S('nível fora de 1–20 vira 1', { ...empty, level: 21 }, empty)
S('nível não inteiro vira 1', { ...empty, level: 2.5 }, empty)
S('campo desconhecido sai', { ...empty, hacker: true, origin: { ancestry: 'ancestry:ancestry-59', x: 1 } },
    { ...empty, origin: { ancestry: 'ancestry:ancestry-59' } })
S('id fora do formato sai', { ...empty, origin: { ancestry: 'Human', background: 'background:background-406' } },
    { ...empty, origin: { background: 'background:background-406' } })
S('escolhas: cada forma', {
    ...empty,
    choices: {
        'class-feat-1': { id: 'feat:feat-4387', qualifier: 'skill:athletics' },
        'boosts-1': { boosts: ['str', 'dex', 'xxx', 'con'] },
        'skills-1': { skills: ['skill:athletics', 'skill:athletics', 'Arcana'] },
        'lore-1': { lore: ' Alcohol ' },
        'class-choice:weapon-group': { value: 'sword' },
        'ancestry-feat-1/grant:feat': { id: 'feat:feat-1' },
        'BAD KEY': { id: 'feat:feat-1' },
        'vazio-1': {},
        'id-ruim-1': { id: 'feat 1' },
    },
}, {
    ...empty,
    choices: {
        'class-feat-1': { id: 'feat:feat-4387', qualifier: 'skill:athletics' },
        'boosts-1': { boosts: ['str', 'dex', 'con'] },
        'skills-1': { skills: ['skill:athletics'] },
        'lore-1': { lore: 'Alcohol' },
        'class-choice:weapon-group': { value: 'sword' },
        'ancestry-feat-1/grant:feat': { id: 'feat:feat-1' },
    },
})
S('variantes e mítico', { ...empty, options: { variants: { freeArchetype: true, foo: true, abp: 'sim' }, mythic: { enabled: true, rank: 11 } } },
    { ...empty, options: { variants: { freeArchetype: true }, mythic: { enabled: true } } })
S('inventário: chave repetida e contêiner de si mesmo', {
    ...empty,
    inventory: [
        { key: 'inv-1', item: 'item:equipment-2700', qty: 1, container: 'inv-1', runes: { potency: 5, striking: 1 }, acquired: 'given' },
        { key: 'inv-1', item: 'item:equipment-1', qty: 2 },
        { key: 'inv-2', item: 'item:equipment-3', qty: -1 },
        { key: 'inv-3', item: 'item:equipment-4', qty: 3, material: { id: 'item:equipment-9', grade: 'top' }, weapon: { overrides: { attack: 99 } } },
    ],
}, {
    ...empty,
    inventory: [
        { key: 'inv-1', item: 'item:equipment-2700', qty: 1, acquired: 'given', runes: { striking: 1 } },
        { key: 'inv-3', item: 'item:equipment-4', qty: 3, acquired: 'bought', material: { id: 'item:equipment-9' } },
    ],
})
S('dinheiro: negativo e texto viram 0', { ...empty, money: { gp: 15, sp: -1, cp: '3' } }, { ...empty, money: { pp: 0, gp: 15, sp: 0, cp: 0 } })
S('magias: preparadas repetem, grimório não', {
    ...empty,
    spellcasting: { class: { prepared: { 1: ['spell:spell-1', 'spell:spell-1'], 11: ['spell:spell-2'] }, spellbook: ['spell:spell-1', 'spell:spell-1'] } },
}, { ...empty, spellcasting: { class: { prepared: { 1: ['spell:spell-1', 'spell:spell-1'] }, spellbook: ['spell:spell-1'] } } })
S('manual e ajustes', {
    ...empty,
    manual: {
        attributeOverride: { str: 4, foo: 1, dex: 40 },
        extraBoosts: { 5: ['str'], 21: ['dex'] },
        extraFeatSlots: [{ level: 3, kind: 'general' }, { level: 3, kind: 'mythic' }],
        adjustments: [{ id: 'adj-1', label: 'Bênção', reason: 'Presente do GM', effect: { kind: 'resistance', target: 'fire', value: 5 } },
            { id: 'adj-2', label: 'X', reason: '', effect: { kind: 'hp' } }],
    },
}, {
    ...empty,
    manual: {
        attributeOverride: { str: 4 },
        extraBoosts: { 5: ['str'] },
        extraFeatSlots: [{ level: 3, kind: 'general' }],
        adjustments: [{ id: 'adj-1', label: 'Bênção', reason: 'Presente do GM', effect: { kind: 'resistance', target: 'fire', value: 5 } }],
    },
})
S('companheiros, detalhes e histórico', {
    ...empty,
    companions: [{ key: 'pet-1', kind: 'familiar', name: 'Pip', choices: { 'ability-1': { value: 'darkvision' } } }, { key: 'pet-2', kind: 'dragon', name: 'X' }],
    details: { age: '27', portrait: 'https://exemplo/img.webp', mood: 'x' },
    history: [{ at: '2026-11-24T10:00:00Z', by: 'gm', note: 'Retreino', kind: 'retrain' }, { at: 'ontem', by: 'gm', note: 'x', kind: 'retrain' }],
}, {
    ...empty,
    companions: [{ key: 'pet-1', kind: 'familiar', name: 'Pip', choices: { 'ability-1': { value: 'darkvision' } } }],
    details: { age: '27', portrait: 'https://exemplo/img.webp' },
    history: [{ at: '2026-11-24T10:00:00Z', by: 'gm', note: 'Retreino', kind: 'retrain' }],
})
S('versão do catálogo fora do formato sai', { ...empty, rulesVersion: 'latest' }, { ...empty, rulesVersion: '' })
const big = { ...empty, spellcasting: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, { spellbook: Array.from({ length: 300 }, (_, j) => `spell:spell-${i}${j}`) }])) }
expect('tamanho: cliente = servidor', clientSanitize.buildBytes(clientSanitize.sanitizeBuildState(big)), serverSanitize.buildBytes(serverSanitize.sanitizeBuildState(big)))
expect('build grande passa do teto', serverSanitize.buildBytes(serverSanitize.sanitizeBuildState(big)) > serverSanitize.MAX_BUILD_BYTES, true)
expect('teto igual nos dois', clientSanitize.MAX_BUILD_BYTES, serverSanitize.MAX_BUILD_BYTES)
expect('emptyBuildState igual nos dois', clientSanitize.emptyBuildState('Ana', 'v'), serverSanitize.emptyBuildState('Ana', 'v'))

console.log('sanitizeMesaRules')
expect('padrões iguais nos dois', clientRules.DEFAULT_MESA_RULES, serverStore.DEFAULT_MESA_RULES)
const R = (name, input, want) => pair(name, serverStore.sanitizeMesaRules, clientRules.sanitizeMesaRules, input, want)
R('nada → padrão', null, structuredClone(serverStore.DEFAULT_MESA_RULES))
R('string → padrão', 'x', structuredClone(serverStore.DEFAULT_MESA_RULES))
R('valores válidos ficam', {
    sources: { allow: ['source:source-216', 'source:source-216', 'Player Core'], deny: ['source:source-1'] },
    legacy: true,
    rarity: { uncommon: 'allow', rare: 'deny' },
    variants: { freeArchetype: true, mythic: { enabled: true, progression: 'trials', destinyAsArchetype: false }, ancestralParagon: true, abp: 1 },
    startingLevel: 5,
    wealth: 'free',
    exceptions: [
        { buildId: '00000000-0000-4000-8000-000000000000', ids: ['feat:feat-1', 'x'], note: ' ok ' },
        { buildId: 'nao-e-uuid', ids: ['feat:feat-1'] },
        { buildId: '00000000-0000-4000-8000-000000000001', ids: [] },
    ],
}, {
    sources: { allow: ['source:source-216'], deny: ['source:source-1'] },
    legacy: true,
    rarity: { uncommon: 'allow', rare: 'deny' },
    variants: { freeArchetype: true, mythic: { enabled: true, progression: 'trials', destinyAsArchetype: false }, ancestralParagon: true, abp: false, pwl: false, dualClass: false, gradualBoosts: false },
    startingLevel: 5,
    wealth: 'free',
    exceptions: [{ buildId: '00000000-0000-4000-8000-000000000000', ids: ['feat:feat-1'], note: 'ok' }],
})
R('nível inicial fora da faixa volta a 1', { startingLevel: 0, rarity: { uncommon: 'talvez' } }, structuredClone(serverStore.DEFAULT_MESA_RULES))

console.log('slug do build')
for (const name of ['Ghan Buri', 'Thalos Alba', 'Ação Ágil', '', '   ', '!!!', `Nome ${'muito '.repeat(12)}longo`, 'a'.repeat(47) + ' b']) {
    expect(`slug "${name}" (cliente = servidor)`, clientSlug(name), serverStore.buildSlugFromName(name))
}
expect('alias mantém o slug antigo', serverStore.buildSlugFromName('Thalos Alba'), 'thalos')
expect('corta em 48 sem hífen no fim', serverStore.buildSlugFromName('a'.repeat(47) + ' b'), 'a'.repeat(47))
expect('acentos saem', serverStore.buildSlugFromName('Ação Ágil'), 'acao-agil')

console.log(failures === 0 ? `\n${passed} conferências ok.` : `\n${failures} falha(s), ${passed} ok.`)
process.exit(failures === 0 ? 0 : 1)
