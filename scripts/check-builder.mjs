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
S('item caseiro com números: arma e armadura passam; dado e categoria inválidos caem',
    { ...empty, inventory: [
        { key: 'inv-1', item: 'custom:braco-sonico', qty: 1, acquired: 'given', customName: 'Braço Sônico', custom: { weapon: { name: 'Braço Sônico', die: 'd6', damageType: 'sonic', category: 'simple' } } },
        { key: 'inv-2', item: 'custom:veste', qty: 1, acquired: 'given', custom: { armor: { category: 'light', ac: 1, dexCap: 5 }, weapon: { die: 'd7', category: 'simple' } } },
    ] },
    { ...empty, inventory: [
        { key: 'inv-1', item: 'custom:braco-sonico', qty: 1, acquired: 'given', customName: 'Braço Sônico', custom: { weapon: { name: 'Braço Sônico', die: 'd6', damageType: 'sonic', category: 'simple' } } },
        { key: 'inv-2', item: 'custom:veste', qty: 1, acquired: 'given', custom: { armor: { category: 'light', ac: 1, dexCap: 5 } } },
    ] })
S('talento caseiro guarda o nome; talento do catálogo não',
    { ...empty, choices: { 'skill-feat-4': { id: 'custom:cognitive-crossover', name: 'Cognitive Crossover' }, 'class-feat-1': { id: 'feat:feat-1', name: 'x' } } },
    { ...empty, choices: { 'skill-feat-4': { id: 'custom:cognitive-crossover', name: 'Cognitive Crossover' }, 'class-feat-1': { id: 'feat:feat-1' } } })
S('origem caseira: nome, PV, tamanho e deslocamento; tamanho inválido cai',
    { ...empty, origin: { ancestry: 'custom:android', custom: { ancestry: { name: 'Android', hp: 8, size: 'enorme', speed: 25 }, background: { name: 'Lesser Scion' }, heritage: {} } } },
    { ...empty, origin: { ancestry: 'custom:android', custom: { ancestry: { name: 'Android', hp: 8, speed: 25 }, background: { name: 'Lesser Scion' } } } })
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
S('fórmulas: repetida e fora do formato saem', { ...empty, formulas: ['item:equipment-1', 'item:equipment-1', 'Lantern'] }, { ...empty, formulas: ['item:equipment-1'] })
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

// --- Motor (F3) contra o recorte fixo do catálogo ---------------------------------------------------------------------
const { compileBuild, proficiencyBonus } = await import('../src/modules/character-builder/engine/compile.ts')
const { attributeScore } = await import('../src/modules/character-builder/engine/attributes.ts')
const { readFileSync, readdirSync } = await import('node:fs')
const fixture = JSON.parse(readFileSync(new URL('./rules-data/fixture.json', import.meta.url), 'utf8')).lists
const { buildRulesIndex } = await import('../src/modules/character-builder/engine/rulesIndex.ts')
const rules = buildRulesIndex(Object.values(fixture).filter(Array.isArray), fixture['core/languages'])
const find = (list, name) => fixture[list].find((e) => e.name === name)
const ctx = { rules }
const base = (over = {}) => ({ ...serverSanitize.emptyBuildState('Teste', fixture.version ?? ''), ...over })

console.log('Motor: Humano Guerreiro nível 1 (Player Core)')
const human = find('core/ancestries', 'Human')
const fighter = find('core/classes', 'Fighter')
const artist = find('core/backgrounds', 'Artist')
const hf = base({
    origin: { ancestry: human.id, background: artist.id },
    class: { id: fighter.id, keyAttribute: 'str' },
    choices: {
        'boosts-ancestry': { boosts: ['str', 'con'] },
        'boosts-background': { boosts: ['dex', 'str'] },
        'boosts-1': { boosts: ['str', 'dex', 'con', 'wis'] },
        'class-skill-1': { skills: ['skill:athletics'] },
        'skills-1': { skills: ['skill:intimidation', 'skill:survival', 'lore:warfare'] },
    },
})
const out = compileBuild(hf, ctx)
expect('Humano tem dois boosts livres', human.ancestry.boosts, ['free', 'free'])
expect('atributos', out.attributes.mod, { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 })
// PV = 8 (Humano) + (10 Guerreiro + 2 CON) × 1 (Player Core pg. 91).
expect('PV', out.stats.hp.total, 20)
// CA = 10 + DES 2 + treinado em defesa sem armadura (1 + 2) (Player Core pg. 271).
expect('CA sem armadura', out.stats.ac.total, 15)
// Fortitude e Reflexos peritos (1 + 4), Vontade treinada (1 + 2), Percepção perita (Player Core pg. 26 e 25).
expect('Fortitude', out.stats.fortitude.total, 7)
expect('Reflexos', out.stats.reflex.total, 7)
expect('Vontade', out.stats.will.total, 4)
expect('Percepção', out.stats.perception.total, 6)
// CD de classe = 10 + treinado (3) + FOR 4 (Player Core pg. 27).
expect('CD de classe', out.stats.classDC?.total, 17)
expect('velocidade', out.stats.speed.total, 25)
expect('perícias treinadas', Object.entries(out.skills.rank).filter(([, r]) => r === 1).map(([k]) => k).sort(), ['athletics', 'crafting', 'intimidation', 'survival'])
expect('Lores', out.skills.lores.map((l) => l.name).sort(), ['Art', 'Warfare'])
expect('pendências: herança, talentos do nível 1 e a escolha do Specialty Crafting (do Artist)', out.pending.map((p) => p.key).sort(), ['ancestry-feat-1', 'awarded:feat-5216/choice:specialtyCrafting', 'class-feat-1', 'heritage'])
expect('sem avisos de boost', out.warnings.filter((w) => w.code.startsWith('BOOST')), [])
expect('bônus de proficiência destreinado = 0', proficiencyBonus(0, 5), 0)
expect('bônus de proficiência mestre no 7 = 13', proficiencyBonus(3, 7), 13)

console.log('Motor: casos de borda')
const dwarf = find('core/ancestries', 'Dwarf')
const alt = compileBuild(base({ origin: { ancestry: dwarf.id, alternateBoosts: true }, choices: { 'boosts-ancestry': { boosts: ['str', 'int'] } } }), ctx)
expect('boosts alternativos tiram o flaw do Anão', alt.attributes.mod.cha, 0)
expect('…e trocam os fixos por dois livres', [alt.attributes.mod.str, alt.attributes.mod.con, alt.attributes.mod.int], [1, 0, 1])
const flaw = compileBuild(base({ origin: { ancestry: dwarf.id, voluntaryFlaws: ['cha'] } }), ctx)
expect('flaw voluntário no mesmo atributo do flaw da ancestralidade avisa', flaw.warnings.some((w) => w.code === 'FLAW_TWICE'), true)
const dup = compileBuild({ ...hf, choices: { ...hf.choices, 'boosts-1': { boosts: ['str', 'str', 'con', 'wis'] } } }, ctx)
expect('boost repetido no grupo avisa (não trava)', dup.warnings.some((w) => w.code === 'BOOST_DUPLICATE' && w.ref === 'boosts-1'), true)
const badBg = compileBuild({ ...hf, choices: { ...hf.choices, 'boosts-background': { boosts: ['str', 'con'] } } }, ctx)
expect('background sem DES/CAR avisa', badBg.warnings.some((w) => w.code === 'BOOST_NOT_ALLOWED'), true)
// Parcial: em +4 o boost marca parcial; o segundo sobe para +5 (Player Core pg. 17).
const lvl10 = compileBuild({ ...hf, level: 10, choices: { ...hf.choices, 'boosts-5': { boosts: ['str', 'dex', 'con', 'int'] }, 'boosts-10': { boosts: ['str', 'dex', 'con', 'int'] } } }, ctx)
expect('parcial no 5, +5 no 10', lvl10.attributes.mod.str, 5)
expect('pontuação do export com parcial = 19', attributeScore(4, true), 19)
expect('INT que sobe no 5 e no 10 abre perícia e idioma', lvl10.pending.filter((p) => p.key.startsWith('skills-int-')).map((p) => p.key).sort(), ['skills-int-10', 'skills-int-5'])
const over = compileBuild({ ...hf, choices: { ...hf.choices, 'skill-increase-3': { skills: ['skill:athletics'] }, 'skill-increase-5': { skills: ['skill:athletics'] } }, level: 5 }, ctx)
expect('aumento de perícia para mestre antes do 7 avisa', over.warnings.some((w) => w.code === 'SKILL_RANK_CAP' && w.ref === 'skill-increase-5'), true)
const overlap = compileBuild({ ...hf, origin: { ...hf.origin, background: find('core/backgrounds', 'Warrior').id }, choices: { ...hf.choices, 'boosts-background': { boosts: ['str', 'con'] } } }, ctx)
const warriorSkills = find('core/backgrounds', 'Warrior').background.skills
if (warriorSkills.map((s) => s.toLowerCase()).includes('athletics')) {
    expect('treino repetido (background + classe) vira perícia livre a mais', overlap.pending.find((p) => p.key === 'skills-1')?.missing, 1)
}
const orphan = compileBuild({ ...hf, choices: { ...hf.choices, 'boosts-15': { boosts: ['str'] } } }, ctx)
expect('escolha de nível acima do atual fica, com aviso de órfã', orphan.warnings.some((w) => w.code === 'ORPHAN_CHOICE' && w.ref === 'boosts-15'), true)
const cavern = find('core/heritages', 'Cavern Elf')
expect('herança traz a ancestralidade (Foundry)', cavern.heritage.ancestry, 'Elf')
expect('herança versátil não tem ancestralidade', find('core/heritages', 'Aiuvarin').heritage.ancestry, undefined)
expect('herança de outra ancestralidade avisa', compileBuild({ ...hf, origin: { ...hf.origin, heritage: cavern.id } }, ctx).warnings.some((w) => w.code === 'HERITAGE_MISMATCH'), true)
expect('herança versátil serve para o Humano', compileBuild({ ...hf, origin: { ...hf.origin, heritage: find('core/heritages', 'Aiuvarin').id } }, ctx).warnings.some((w) => w.code === 'HERITAGE_MISMATCH'), false)
const otherBook = { ...serverStore.DEFAULT_MESA_RULES, sources: { allow: ['source:source-1'] } }
expect('livro não liberado na mesa avisa', compileBuild(hf, { rules, mesaRules: otherBook }).warnings.some((w) => w.code === 'SOURCE_NOT_ALLOWED'), true)
const noBooks = { ...serverStore.DEFAULT_MESA_RULES, sources: { allow: [] } }
expect('mesa sem livros escolhidos não avisa por livro', compileBuild(hf, { rules, mesaRules: noBooks }).warnings.some((w) => w.code === 'SOURCE_NOT_ALLOWED'), false)

console.log('F9.10: permissão de legado por livro')
{
    const legacyBook = 'source:source-1'
    const remasterBook = 'source:source-2'
    const settings = { ...serverStore.DEFAULT_MESA_RULES, sources: { allow: [remasterBook], legacy: [legacyBook] } }
    R('lista de legado valida e remove duplicatas', { sources: { allow: [remasterBook], legacy: [legacyBook, 'errado', legacyBook] } }, settings)
    const old = { id: 'spell:spell-1', name: 'Teste', type: 'spell', remaster: false, source: { id: legacyBook } }
    expect('liberação independente do Remaster', clientRules.allowedAtTable(old, settings), true)
    expect('negação explícita prevalece', clientRules.allowedAtTable(old, { ...settings, sources: { ...settings.sources, deny: [legacyBook] } }), false)
    expect('regras antigas respeitam interruptor e lista', [clientRules.allowedAtTable(old, { ...noBooks, legacy: true }),
        clientRules.allowedAtTable(old, { ...settings, legacy: true, sources: { allow: [remasterBook] } })], [true, false])
    const spell = { ...hf, spellcasting: { class: { prepared: { 1: [old.id, old.id] } } } }
    const spellRules = { ...rules, get: (id) => id === old.id ? old : rules.get(id) }
    const count = (mesaRules) => compileBuild(spell, { rules: spellRules, mesaRules }).warnings.filter((w) => w.code === 'LEGACY_NOT_ALLOWED' && w.entryId === old.id).length
    expect('magia preparada duas vezes avisa uma vez e o livro liberado resolve', [count(noBooks), count(settings)], [1, 0])
}

console.log('F9.10: vínculos da AON nos pacotes')
{
    const { buildRulePackages } = await import('../api/_lib/rules-packages.js')
    const row = (n, remaster, extra = {}) => ({
        id: 'feat:feat-' + n, aon_id: 'feat-' + n, category: 'feat', name: 'Teste ' + n,
        source_id: remaster ? 'source-2' : 'source-1', remaster, traits: ['General'], data: {}, ...extra,
    })
    const entries = [row(1, false, { data: { remaster_ids: ['feat-3', 'feat-4', 'feat-5', 'spell-9', 'feat-99'] } }),
        row(2, false), row(3, true, { legacy_ids: ['feat-1'] }), row(4, true), row(5, true, { removed_at: '2026-01-01' }),
        row(6, true, { name: 'Teste 2' }), row(9, true, { id: 'spell:spell-9', aon_id: 'spell-9', category: 'spell' })]
    const { files } = buildRulePackages({ version: 'test', entries, mechanics: new Map(), sources: [], tables: {} })
    const links = JSON.parse(files['core/remaster.json'])
    expect('pacote liga todos os sucessores da AON da categoria que estão publicados', links.map((l) => [l.id, l.targets.map((t) => [t.id, t.list])]),
        [['feat:feat-1', [['feat:feat-3', 'feats/general'], ['feat:feat-4', 'feats/general']]]])
    expect('seletor recebe indicação da revisão publicada', JSON.parse(files['feats/general.json']).find((e) => e.aon.id === 'feat-1').superseded, true)
    const { chosenRuleIds, convertRuleIds, legacyLinks, pickerEditions } = await import('../src/modules/character-builder/remaster.ts')
    const legacyBook = 'source:source-1'
    const remasterBook = 'source:source-2'
    const settings = { ...serverStore.DEFAULT_MESA_RULES, sources: { allow: [remasterBook], legacy: [legacyBook] } }
    const list = JSON.parse(files['feats/general.json'])
    const old = list.find((e) => e.aon.id === 'feat-2')
    const revised = list.find((e) => e.aon.id === 'feat-3')
    expect('busca pelo nome legado alcança o sucessor com vínculo só de ida', list.find((e) => e.aon.id === 'feat-4').previousNames, ['Teste 1'])
    const offer = (rules, exceptions) => pickerEditions(list, rules, exceptions).map((e) => e.id)
    expect('seletor omite o legado substituído e mantém homônimo sem vínculo', [offer(settings).includes('feat:feat-1'), offer(settings).includes(old.id)], [false, true])
    expect('legado só no livro liberado, inclusive sem as regras carregadas', [offer(noBooks).includes(old.id), offer(null).includes(old.id)], [false, false])
    expect('exceção do personagem libera o livro para esta escolha', offer(noBooks, new Set([old.id])).includes(old.id), true)
    expect('pacote anterior usa legacy_id e rejeita referência a outra categoria', legacyLinks([revised, { ...revised, id: 'feat:feat-12', replaces: 'class-1' }]).map((l) => l.id), ['feat:feat-1'])

    const legacy = 'spell:spell-1', next = 'spell:spell-2'
    const draft = { ...empty, name: legacy, choices: { pick: { id: legacy, qualifier: legacy }, text: { value: legacy } },
        inventory: [{ key: legacy, item: legacy, qty: 3, acquired: 'given', customName: legacy, container: legacy, material: { id: legacy }, runes: { property: [legacy] } }],
        companions: [{ key: legacy, kind: 'other', name: legacy, type: legacy, choices: { x: { id: legacy } } }],
        spellcasting: { class: { prepared: { 1: [legacy, next, legacy] }, repertoire: { 1: [next, legacy] }, signature: [legacy], spellbook: [legacy] } },
        origin: { deity: legacy, languages: [legacy] }, class: { id: legacy, dual: legacy }, formulas: [legacy, next] }
    const changed = convertRuleIds(draft, new Map([[legacy, next]]))
    expect('varre os campos de referência', [...chosenRuleIds(changed)], [next])
    expect('preserva chaves, quantidade e texto livre', [changed.name, changed.inventory[0].key, changed.inventory[0].container, changed.inventory[0].customName, changed.inventory[0].qty,
        changed.companions[0].name, changed.companions[0].key, changed.choices.pick.qualifier, changed.choices.text.value], [legacy, legacy, legacy, legacy, 3, legacy, legacy, legacy, legacy])
    expect('preserva espaços preparados repetidos e deduplica coleções', [changed.spellcasting.class.prepared[1], changed.spellcasting.class.repertoire[1], changed.formulas],
        [[next, next, next], [next], [next]])
    expect('conversão mantém o rascunho anterior intacto e é idempotente', [draft.spellcasting.class.prepared[1], convertRuleIds(changed, new Map([[legacy, next]]))], [[legacy, next, legacy], changed])
}

console.log('Motor: atributos do elenco (gabarito: export do Pathbuilder)')
const ATTR = { Str: 'str', Dex: 'dex', Con: 'con', Int: 'int', Wis: 'wis', Cha: 'cha' }
const lower = (list) => (list ?? []).map((a) => ATTR[a])
let castChecked = 0
for (const file of readdirSync(new URL('../public/characters/', import.meta.url)).filter((f) => f.endsWith('.json'))) {
    const b = JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')).build
    const anc = find('core/ancestries', b.ancestry)
    const bg = find('core/backgrounds', b.background)
    const cls = find('core/classes', b.class)
    if (!anc || !bg || !cls) {
        console.log(`  --   ${b.name}: ${[!anc && b.ancestry, !bg && b.background, !cls && b.class].filter(Boolean).join(', ')} fora do catálogo Remaster (legado)`)
        continue
    }
    const bd = b.abilities.breakdown
    if (![bd.ancestryFree, bd.ancestryBoosts, bd.backgroundBoosts, bd.classBoosts].some((g) => g?.length)) {
        console.log(`  --   ${b.name}: export sem a memória dos boosts de origem e classe (atributos editados à mão no Pathbuilder)`)
        continue
    }
    const listedFlaws = anc.ancestry.flaws ?? []
    const alternate = (bd.ancestryBoosts ?? []).length === 0 && (anc.ancestry.boosts ?? []).some((x) => x !== 'free')
    const state = base({
        level: b.level,
        origin: { ancestry: anc.id, background: bg.id, alternateBoosts: alternate || undefined, voluntaryFlaws: lower(bd.ancestryFlaws).filter((f) => !listedFlaws.includes(f)) },
        class: { id: cls.id, keyAttribute: lower(bd.classBoosts)[0] },
        choices: Object.fromEntries([
            ['boosts-ancestry', { boosts: lower(bd.ancestryFree) }],
            ['boosts-background', { boosts: lower(bd.backgroundBoosts) }],
            ...Object.entries(bd.mapLevelledBoosts).map(([lvl, list]) => [`boosts-${lvl}`, { boosts: lower(list) }]),
        ]),
    })
    const got = compileBuild(state, ctx).attributes
    const scores = Object.fromEntries(Object.keys(got.mod).map((a) => [a, attributeScore(got.mod[a], got.partial[a])]))
    const want = Object.fromEntries(Object.keys(got.mod).map((a) => [a, b.abilities[a]]))
    expect(`${b.name}: atributos`, scores, want)
    expect(`${b.name}: PV da ancestralidade e da classe`, [anc.ancestry.hp, cls.class.hp], [b.attributes.ancestryhp, b.attributes.classhp])
    castChecked++
}
expect('elenco conferido (ao menos 5 personagens Remaster)', castChecked >= 5, true)

console.log('Motor: slots de talento do elenco (M2, gabarito: export do Pathbuilder)')
// As duas mesas usam Free Archetype e Mítico (F0.3). Ancestry Paragon fica desligado: o elenco usa o TALENTO geral
// "Ancestral Paragon", não a variante (com ela, sobrariam slots no 3/7/11… em todos).
const castMesa = { ...serverStore.DEFAULT_MESA_RULES, variants: { ...serverStore.DEFAULT_MESA_RULES.variants, freeArchetype: true, mythic: { enabled: true, progression: 'level' } } }
const SLOT_LABEL = [[/^Free Archetype (\d+)$/, 'archetype'], [/^Mythic Feat (\d+)$/, 'mythic'], [/^Skill Feat (\d+)$/, 'skill'], [/^Skill Lessons (\d+)$/, 'skill'], [/^General Feat (\d+)$/, 'general'], [/^Combat Flexibility$/, 'flexibility']]
let unknownFeats = 0
for (const file of readdirSync(new URL('../public/characters/', import.meta.url)).filter((x) => x.endsWith('.json'))) {
    const b = JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')).build
    const cls = find('core/classes', b.class)
    if (!cls) continue
    const choices = {}
    for (const ft of b.feats) {
        const label = ft[4]
        if (!label || ft[5] === 'childChoice' || label === 'Heritage Feat' || label.startsWith('BACKGROUND_')) continue
        let key = null
        for (const [re, kind] of SLOT_LABEL) { const m = re.exec(label); if (m) key = `${kind}-feat-${m[1] ?? ft[3]}` }
        let m = new RegExp(`^${b.class} Feat (\\d+)$`).exec(label)
        if (m) key = `class-feat-${m[1]}`
        m = /^(.+) Feat (\d+)$/.exec(label)
        if (!key && m) key = `ancestry-feat-${m[2]}`
        if (!key) continue
        const entry = rules.byName(ft[0], 'feat')
        if (entry) choices[key] = { id: entry.id }
        else unknownFeats++
        choices[`__expect:${key}`] = true
    }
    const expected = Object.keys(choices).filter((k) => k.startsWith('__expect:')).map((k) => k.slice(9))
    for (const k of Object.keys(choices)) if (k.startsWith('__expect:')) delete choices[k]
    const fa = expected.some((k) => k.startsWith('archetype-'))
    const state = base({ level: b.level, class: { id: cls.id }, origin: { ancestry: find('core/ancestries', b.ancestry)?.id }, choices, options: { variants: { freeArchetype: fa } } })
    const out = compileBuild(state, { rules, mesaRules: castMesa })
    const got = out.featSlots.filter((x) => x.level <= b.level).map((x) => x.key).sort()
    expect(`${b.name}: slots de talento iguais aos do Pathbuilder`, got, [...expected].sort())
    const phantom = out.pending.filter((p) => /-feat-\d+$/.test(p.key) && choices[p.key])
    expect(`${b.name}: nenhuma pendência fantasma nos slots preenchidos`, phantom.map((p) => p.key), [])
}
console.log(`  (${unknownFeats} talentos do elenco fora do recorte Remaster: conteúdo legado)`)

console.log('Motor: progressão da classe e talentos (proficiências por nível)')
{
    const { characterActions } = await import('../src/modules/character-builder/sections/characterActions.ts')
    const { BOUNTY_HUNTER_DEDICATION, MONSTER_HUNTER } = await import('../src/modules/character-builder/engine/feats.ts')
    const hunter = find('core/classes', 'Ranger')
    const huntPrey = find('core/actions', 'Hunt Prey')
    const grantHuntPrey = { key: 'GrantItem', uuid: 'Compendium.pf2e.actionspf2e.Item.Hunt Prey' }
    const bounty = { id: BOUNTY_HUNTER_DEDICATION, name: 'Bounty Hunter Dedication', type: 'feat', level: 2, aon: { id: 'feat-6281' },
        remaster: true, source: { id: 'source:source-227', page: 191 }, traits: ['Archetype', 'Dedication'], rules: [
            grantHuntPrey, { key: 'GrantItem', uuid: 'Compendium.pf2e.feats-srd.Item.Monster Hunter', grantId: MONSTER_HUNTER, predicate: ['feature:hunt-prey'] },
        ] }
    const monster = { id: MONSTER_HUNTER, name: 'Monster Hunter', type: 'feat', level: 1, aon: { id: 'feat-4863' },
        remaster: true, source: { id: huntPrey.source.id, page: 157 }, traits: ['Ranger'] }
    const rangerDedication = { ...bounty, id: 'feat:feat-5087', name: 'Ranger Dedication', aon: { id: 'feat-5087' }, rules: [grantHuntPrey] }
    const actionIndex = buildRulesIndex([[bounty, monster, rangerDedication], ...Object.values(fixture).filter(Array.isArray)], fixture['core/languages'])
    const bountyBuild = (classId, level = 2, extra = {}) => base({ level, class: { id: classId }, choices: { 'class-feat-2': { id: bounty.id }, ...extra } })
    const summarize = (state) => {
        const compiled = compileBuild(state, { rules: actionIndex })
        const actions = characterActions({ state, compiled, index: actionIndex }, fixture['core/actions'])
        return { compiled, actions, hunt: actions.find((a) => a.entry.id === huntPrey.id) }
    }
    const fighterBounty = summarize(bountyBuild(fighter.id))
    expect('Bounty Hunter concede Hunt Prey de 1 ação', fighterBounty.hunt?.entry.actions, '1')
    expect('Bounty Hunter sem Hunt Prey prévio não recebe Monster Hunter', fighterBounty.compiled.taken.some((t) => t.entry.id === monster.id), false)
    expect('Bounty Hunter ainda planejado não concede Hunt Prey', summarize(bountyBuild(fighter.id, 1)).hunt, undefined)
    const rangerBounty = summarize(bountyBuild(hunter.id))
    expect('Patrulheiro tem Hunt Prey e ganha a melhoria Monster Hunter', rangerBounty.hunt?.monsterHunter, true)
    expect('Hunt Prey aparece uma vez com as duas fontes', rangerBounty.hunt?.sources.map((s) => s.name), [hunter.name, bounty.name])
    expect('Monster Hunter é melhoria e não ação à parte', rangerBounty.actions.some((a) => a.entry.id === monster.id), false)
    expect('Bounty Hunter também reconhece a ação da Ranger Dedication anterior',
        summarize(bountyBuild(fighter.id, 4, { 'class-feat-2': { id: rangerDedication.id }, 'class-feat-4': { id: bounty.id } })).hunt?.monsterHunter, true)
    expect('Reactive Strike do Guerreiro aparece como reação', fighterBounty.actions.find((a) => a.entry.name === 'Reactive Strike')?.entry.actions, 'reaction')
}
const ghan = JSON.parse(readFileSync(new URL('../public/characters/ghanburi10.json', import.meta.url), 'utf8')).build
const f10 = compileBuild(base({ level: 10, class: { id: fighter.id } }), ctx)
const P = ghan.proficiencies
expect('Fighter 10: Percepção, salvaguardas, armas e armaduras iguais ao Ghan Buri', {
    perception: f10.proficiency.perception, fortitude: f10.proficiency.fortitude, reflex: f10.proficiency.reflex, will: f10.proficiency.will,
    simple: f10.proficiency.attacks.simple, martial: f10.proficiency.attacks.martial, heavy: f10.proficiency.defenses.heavy, unarmored: f10.proficiency.defenses.unarmored,
}, { perception: P.perception / 2, fortitude: P.fortitude / 2, reflex: P.reflex / 2, will: P.will / 2, simple: P.simple / 2, martial: P.martial / 2, heavy: P.heavy / 2, unarmored: P.unarmored / 2 })
const toughness = rules.byName('Toughness', 'feat')
const fleet = rules.byName('Fleet', 'feat')
const withFeats = compileBuild({ ...hf, level: 3, choices: { ...hf.choices, 'general-feat-3': { id: toughness.id } } }, ctx)
// Toughness: PV máximo + nível (FlatModifier "@actor.level").
expect('Toughness soma o nível aos PV', withFeats.stats.hp.total - compileBuild({ ...hf, level: 3 }, ctx).stats.hp.total, 3)
expect('Fleet soma 5 ao deslocamento', compileBuild({ ...hf, level: 3, choices: { ...hf.choices, 'general-feat-3': { id: fleet.id } } }, ctx).stats.speed.total, 30)
const canny = rules.byName('Canny Acumen', 'feat')
const cannyOut = compileBuild({ ...hf, level: 3, choices: { ...hf.choices, 'general-feat-3': { id: canny.id }, 'general-feat-3/choice:cannyAcumen': { value: 'system.saves.will.rank' } } }, ctx)
expect('Canny Acumen (escolha Vontade) deixa Vontade perita', cannyOut.proficiency.will, 2)
expect('Canny Acumen sem escolha vira pendência', compileBuild({ ...hf, level: 3, choices: { ...hf.choices, 'general-feat-3': { id: canny.id } } }, ctx).pending.some((p) => p.key === 'general-feat-3/choice:cannyAcumen'), true)
const battleMed = rules.byName('Battle Medicine', 'feat')
const bm = compileBuild({ ...hf, level: 2, choices: { ...hf.choices, 'skill-feat-2': { id: battleMed.id } } }, ctx)
expect('Battle Medicine sem treino em Medicina reprova o pré-requisito', bm.warnings.some((w) => w.code === 'PREREQ_FAIL' && w.ref === 'skill-feat-2'), true)
// O pré-requisito vale com os números finais: perícia dada por ajuste à mão (a importação da Ficha) aprova o talento.
const bmAdj = compileBuild({ ...hf, level: 2, choices: { ...hf.choices, 'skill-feat-2': { id: battleMed.id } },
    manual: { adjustments: [{ id: 'imp-skill-medicine', label: 'Medicina', reason: 'teste', effect: { kind: 'proficiency', target: 'skill:medicine', value: 1 } }] } }, ctx)
expect('treino em Medicina por ajuste aprova o Battle Medicine', bmAdj.warnings.some((w) => w.code === 'PREREQ_FAIL' && w.ref === 'skill-feat-2'), false)
{
    const { evaluatePrereqs } = await import('../src/modules/character-builder/engine/prereqs.ts')
    const pctx = { level: 10, has: new Set(['giant', 'divine font']), skillRank: (s) => ({ nature: 3, occultism: 3 })[s] ?? 0, loreRank: () => 0, stat: {}, attribute: {} }
    const res = (t, extra = {}) => evaluatePrereqs(t, { ...pctx, ...extra }).result
    expect('série com "or" é uma alternativa só ("A, B, or C")', res('Master in Occultism, Master in Nature, or Master in Religion'), 'ok')
    expect('a opção sem rank herda o da anterior ("master in Nature, Occultism, or Religion")', res('master in Religion, Occultism, or Arcana'), 'ok')
    expect('vírgula sem "or" continua exigindo os dois', res('master in Nature, master in Religion'), 'fail')
    expect('subclasse pelo nome da opção ("Giant instinct")', res('Giant instinct'), 'ok')
    expect('fonte divina: qualquer uma das duas', res('harmful font or healing font'), 'ok')
    expect('"can\'t have a patron deity" com divindade reprova', res('can’t have a patron deity', { deity: 'deity:1' }), 'fail')
}
{
    // Pedido de descrição: a opção do catálogo vai com a categoria da AON (o material "Bone" ≠ o fascínio "Bone").
    const { descriptionRequest } = await import('../src/modules/character-builder/components/descriptionRequest.ts')
    const { splitCategoryTag } = await import('../api/_lib/feat-core.js')
    const bone = { id: 'grim-fascination:grim-fascination-1', name: 'Bone', type: 'grim-fascination', aon: { id: 'grim-fascination-1' }, source: { id: 's' }, remaster: true }
    expect('opção de classe pede com a categoria', descriptionRequest(bone), { type: 'special', name: 'Bone [grim-fascination]' })
    expect('talento continua pelo nome', descriptionRequest({ ...bone, type: 'feat', level: 2 }).name, 'Bone')
    expect('o servidor separa a etiqueta e só aceita categoria conhecida', [splitCategoryTag('Bone [grim-fascination]'), splitCategoryTag('Bone [qualquer-coisa]')], [{ name: 'Bone', category: 'grim-fascination' }, null])
}
const wrong = compileBuild({ ...hf, level: 2, choices: { ...hf.choices, 'class-feat-2': { id: toughness.id } } }, ctx)
expect('talento geral no slot de classe avisa', wrong.warnings.some((w) => w.code === 'WRONG_SLOT'), true)

const versatile = find('core/heritages', 'Versatile Human')
const vh = compileBuild({ ...hf, origin: { ...hf.origin, heritage: versatile.id } }, ctx)
expect('Versatile Human abre a escolha de talento geral', vh.featChildren.some((c) => c.kind === 'feat' && c.parent.startsWith('awarded:')), true)
const cavernOut = compileBuild({ ...hf, origin: { ancestry: find('core/ancestries', 'Elf').id, heritage: find('core/heritages', 'Cavern Elf').id, background: artist.id } }, ctx)
expect('Cavern Elf dá visão no escuro (Sense da herança)', cavernOut.senses.some((x) => /darkvision/i.test(x)), true)
expect('aviso igual não repete', new Set(vh.warnings.map((w) => w.code + w.message)).size, vh.warnings.length)

console.log('Magias: conjurador da classe contra o export (F5)')
const tables = fixture['core/tables']
const ctxSpells = { rules, tables, classOptions: fixture['core/class-features'] }
for (const [file, extraCantrips] of [['thalos10.json', 0], ['woyd7.json', 0], ['nathaniel10.json', 0], ['loki7.json', 1]]) {
    const b = JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')).build
    const cls = find('core/classes', b.class)
    const exp = b.spellCasters.find((c) => c.name === b.class)
    const key = lower(b.abilities.breakdown.classBoosts)[0]
    const out = compileBuild(base({ level: b.level, class: { id: cls.id, keyAttribute: key } }), ctxSpells)
    const caster = out.casters[0]
    expect(`${b.name}: tradição e tipo`, [caster?.tradition, caster?.type], [exp.magicTradition, exp.spellcastingType])
    expect(`${b.name}: atributo de conjuração`, caster?.attribute, exp.ability)
    // Cleric: a proficiência de conjuração segue a doutrina, que ainda não é calculada (aviso no motor).
    if (b.class !== 'Cleric') expect(`${b.name}: proficiência de conjuração`, caster?.rank, exp.proficiency / 2)
    // Loki tem um truque a mais que vem de talento, não da tabela (achado da F1).
    const want = [...exp.perDay]
    want[0] -= extraCantrips
    expect(`${b.name}: magias por dia (tabela da AON)`, caster?.perDay.slice(0, want.length), want)
}
const alarm = fixture['spells/arcane'].find((x) => x.name === 'Alarm')
const wizard = find('core/classes', 'Wizard') ?? find('core/classes', 'Magus')
const alarmOut = compileBuild(base({ level: 1, class: { id: wizard.id, keyAttribute: 'int' }, spellcasting: { class: { prepared: { 1: [alarm.id] } } } }), ctxSpells)
expect('magia da lista certa não avisa tradição (a AON grava "Arcane")', alarmOut.warnings.some((w) => w.code === 'SPELL_TRADITION'), false)
const focusList = fixture['spells/focus']
const focusSpells = focusList.filter((x) => !(x.traits ?? []).includes('Cantrip')).slice(0, 4).map((x) => x.id)
const fOut = compileBuild({ ...hf, spellcasting: { focus: { repertoire: { 1: focusSpells } } } }, ctxSpells)
expect('pool de foco = magias de foco, até 3 (Player Core pg. 298)', fOut.focus.points, Math.min(3, focusSpells.length))
// Magias conhecidas pela regra de cada classe (texto da AON de "Spellcasting", "Spellbook", "Familiar", "Dirge" e "Spell Repertoire").
const knownOf = (className, level, keyAttribute) => {
    const cls = find('core/classes', className)
    if (!cls) return undefined
    return compileBuild(base({ level, class: { id: cls.id, keyAttribute } }), ctxSpells).casters[0]?.known
}
expect('Cleric conhece a lista divina inteira (Player Core pg. 108)', knownOf('Cleric', 1, 'wis')?.kind, 'list')
expect('Wizard: grimório com 10 truques e 5 magias no 1º nível (Player Core pg. 192)', [knownOf('Wizard', 1, 'int')?.cantrips, knownOf('Wizard', 1, 'int')?.spells], [10, 5])
expect('Wizard: duas magias a mais por nível (5 + 2 × 4 no 5º)', knownOf('Wizard', 5, 'int')?.spells, 13)
if (find('core/classes', 'Witch')) expect('Witch: o familiar é o livro (Player Core pg. 178)', [knownOf('Witch', 1, 'int')?.kind, knownOf('Witch', 1, 'int')?.cantrips], ['book', 10])
// Elevação sem ganho (Player Core pg. 297): Echo Jump (rank 3, Heightened +2) num espaço de rank 4 vale, mas avisa; no 5, ganha.
{
    const wiz = find('core/classes', 'Wizard')
    const at = (rank) => compileBuild(base({ level: 9, class: { id: wiz.id, keyAttribute: 'int' }, spellcasting: { class: { prepared: { [rank]: ['spell:spell-2481'] } } } }), ctxSpells)
        .warnings.some((w) => w.code === 'HEIGHTEN_NO_GAIN')
    expect('Echo Jump (+2) no rank 4: aviso de elevação sem ganho', at(4), true)
    expect('Echo Jump (+2) no rank 5: ganha, sem aviso', at(5), false)
}
// Foco concedido pelo texto da AON (focusGrants.gen.ts): Grave Spells dá Necrotic Bomb e os truques Create Thrall e
// Thrall Charge, e a fascinação Bone dá Bone Spear ("you start with a focus pool of 2 Focus Points", Impossible Magic pg. 27).
{
    const necro = find('core/classes', 'Necromancer')
    const out = compileBuild(base({ level: 1, class: { id: necro.id, keyAttribute: 'int' }, choices: { 'class-choice:grim-fascination': { id: 'grim-fascination:grim-fascination-2' } } }), ctxSpells)
    expect('Necromancer 1 (Bone): 4 magias de foco concedidas', out.focus.granted.map((g) => g.from).sort(), ['Bone', 'Grave Spells', 'Grave Spells', 'Grave Spells'])
    const sorc = find('core/classes', 'Sorcerer')
    const s1 = compileBuild(base({ level: 1, class: { id: sorc.id, keyAttribute: 'cha' }, choices: { 'class-choice:bloodline': { id: 'bloodline:bloodline-19' } } }), ctxSpells)
    expect('Sorcerer Aberrant 1: só a magia inicial da linhagem (Player Core 2 pg. 149)', s1.focus.granted.length, 1)
    const witch = find('core/classes', 'Witch')
    const w1 = compileBuild(base({ level: 1, class: { id: witch.id, keyAttribute: 'int' } }), ctxSpells)
    expect('Witch: Hex Spells pede a escolha entre os dois hexes', w1.pending.some((p) => p.key === 'focus-choice:class-feature-773'), true)
}
if (find('core/classes', 'Bard')) {
    const bard = compileBuild(base({ level: 5, class: { id: find('core/classes', 'Bard').id, keyAttribute: 'cha' } }), ctxSpells).casters[0]
    expect('Bard: repertório = espaços da tabela por rank (Player Core pg. 94)', bard?.known?.perRank, bard?.perDay)
}

console.log('Equipamento: Ghan Buri (gabarito: export do Pathbuilder) e regras de carga')
{
    const gb = JSON.parse(readFileSync(new URL('../public/characters/ghanburi10.json', import.meta.url), 'utf8')).build
    const bd = gb.abilities.breakdown
    const item = (name, type) => rules.byName(name, type)
    const state = base({
        level: gb.level,
        origin: { ancestry: find('core/ancestries', gb.ancestry)?.id, background: find('core/backgrounds', gb.background)?.id },
        class: { id: fighter.id, keyAttribute: 'str' },
        choices: {
            'boosts-ancestry': { boosts: lower(bd.ancestryFree) },
            'boosts-background': { boosts: lower(bd.backgroundBoosts) },
            ...Object.fromEntries(Object.entries(bd.mapLevelledBoosts).map(([lvl, list]) => [`boosts-${lvl}`, { boosts: lower(list) }])),
            'class-choice:weapon-group-5': { value: 'hammer' },
        },
        inventory: [
            { key: 'inv-1', item: item('Warhammer', 'weapon').id, qty: 1, acquired: 'given', equipped: true, runes: { potency: 2, striking: 1 } },
            { key: 'inv-2', item: item("Hero's Plate").id, qty: 1, acquired: 'given', worn: true, runes: { potency: 1, resilient: 1 } },
            { key: 'inv-3', item: item('Fortress Shield').id, qty: 1, acquired: 'given', worn: true },
        ],
        money: { pp: 0, gp: 15, sp: 0, cp: 0 },
    })
    const out = compileBuild(state, ctx)
    const hammer = out.equipment.strikes.find((x) => x.name === 'Warhammer')
    const want = gb.weapons.find((w) => w.name === 'Warhammer')
    expect('Warhammer: ataque (mestre pelo grupo martelo, FOR, +2)', hammer?.attack, want.attack)
    expect('Warhammer: dano fixo (FOR + especialização de mestre)', hammer?.damageBonus, want.damageBonus)
    expect('Warhammer: dado e dados (striking)', [hammer?.die, hammer?.dice], [want.die, 2])
    expect('CA com Hero\'s Plate +1 (base Full Plate)', out.stats.ac.total, gb.acTotal.acTotal)
    expect('resiliente soma 1 nas salvaguardas', out.stats.fortitude.parts.find((x) => /resil/i.test(x.label))?.value, gb.mods.Fortitude['Item Bonus'])
    expect('escudo fica fora da CA', out.equipment.shield?.ac, Number(gb.acTotal.shieldBonus))
    expect('punho do catálogo entra nos golpes', out.equipment.strikes[0]?.name, 'Fist')
    const heavy = compileBuild({ ...state, inventory: Array.from({ length: 12 }, (_, i) => ({ key: `p-${i}`, item: item('Full Plate').id, qty: 1, acquired: 'bought' })) }, ctx)
    expect('carga acima de 10 + FOR avisa', heavy.warnings.some((w) => w.code === 'OVER_BULK'), true)
    expect('compra acima do dinheiro avisa', heavy.warnings.some((w) => w.code === 'NEGATIVE_MONEY'), true)
    // ABP (GM Core pg. 83, nível 10): ataque +2, dois dados, defesa +1, salvaguarda +1, Percepção +1 — sem runa nenhuma.
    const noRunes = { ...state, options: { variants: { abp: true } }, inventory: state.inventory.map((i) => ({ ...i, runes: {} })) }
    const abpOut = compileBuild(noRunes, ctx)
    const abpHammer = abpOut.equipment.strikes.find((x) => x.name === 'Warhammer')
    expect('ABP: martelo sem runa com o ataque e os dados do +2 Striking', [abpHammer?.attack, abpHammer?.dice], [want.attack, 2])
    expect('ABP: CA igual à do Hero\'s Plate +1', abpOut.stats.ac.total, gb.acTotal.acTotal)
    expect('ABP: Percepção ganha +1 no nível 7+', abpOut.stats.perception.total - out.stats.perception.total, 1)
    expect('mil moedas = 1 Volume (Player Core pg. 269)', compileBuild({ ...hf, money: { pp: 0, gp: 1999, sp: 0, cp: 0 } }, ctx).equipment.bulk.coins, 1)
    // Preço de runa (GM Core pg. 223–224): o item vale a base + cada runa no degrau atual; preços do catálogo da AON.
    // "Striking" é também o grupo sem preço: vale a variante com preço.
    const rune = (id, name, level, gp, sub = 'Fundamental Weapon Runes') => ({ id, name, type: 'equipment', level, rarity: 'common', traits: [], source: { id: 'source:test' }, aon: { id }, remaster: true,
        item: { category: 'Runes', subcategory: sub, ...(gp ? { price: { gp } } : {}) } })
    const runeRules = buildRulesIndex([...Object.values(fixture).filter(Array.isArray), [
        rune('item:equipment-2829', 'Striking', 4, 0), rune('item:equipment-2829-2659', 'Striking', 4, 65),
        rune('item:equipment-2830-2663', 'Weapon Potency (+2)', 10, 935), rune('item:equipment-2838-x', 'Flaming', 8, 500, 'Weapon Property Runes'),
    ]], fixture['core/languages'])
    const hammerId = item('Warhammer', 'weapon').id
    const bought = compileBuild({ ...state, inventory: [{ key: 'inv-1', item: hammerId, qty: 1, acquired: 'bought', equipped: true, runes: { potency: 2, striking: 1, property: ['item:equipment-2838-x'] } }], money: { pp: 0, gp: 2000, sp: 0, cp: 0 } }, { rules: runeRules })
    const warhammerGp = rules.get(hammerId)?.item?.price?.gp ?? 0
    expect('runas compradas saem do dinheiro (+2, Striking, Flaming)', bought.equipment.money.spent, warhammerGp + 935 + 65 + 500)
    expect('runa fundamental usa a variante com preço', bought.equipment.items[0].runes.map((r) => r.price), [935, 65, 500])
    const given = compileBuild({ ...state, inventory: [{ key: 'inv-1', item: hammerId, qty: 1, acquired: 'given', runes: { potency: 2 } }] }, { rules: runeRules })
    expect('item ganho não desconta as runas', given.equipment.money.spent, 0)
    // Dedicação multiclasse (Wizard Dedication, Player Core pg. 223): a escola escolhida não dá as habilidades dela —
    // a School of Unified Magical Theory não pede o talento de wizard extra.
    const wizDed = compileBuild({ ...hf, level: 2, options: { variants: { freeArchetype: true } },
        choices: { ...hf.choices, 'archetype-feat-2': { id: 'feat:feat-5106' }, 'archetype-feat-2/choice:arcaneSchool': { id: 'arcane-school:arcane-school-21' } } }, ctx)
    expect('escola da Wizard Dedication não pede o talento da Unified Magical Theory', wizDed.pending.filter((p) => p.key.startsWith('archetype-feat-2/')).map((p) => p.key), [])
    expect('a escola continua escolhida (membro, para os talentos)', wizDed.taken.some((t) => t.entry.id === 'arcane-school:arcane-school-21'), true)
    // Conteúdo caseiro (custom:): origem e talento fora do catálogo contam como escolhidos e vão ao retrato pelo nome.
    const homemade = compileBuild({ ...hf, origin: { ...hf.origin, ancestry: 'custom:android', custom: { ancestry: { name: 'Android', hp: 8, size: 'medium', speed: 25 } } },
        choices: { ...hf.choices, 'ancestry-feat-1': { id: 'custom:radiant-circuitry', name: 'Radiant Circuitry' } } }, ctx)
    expect('ancestralidade caseira não fica pendente e dá os PV do export', [homemade.pending.some((p) => p.key === 'ancestry'), homemade.stats.hp.parts.find((p) => /ancestr/i.test(p.label))?.value], [false, 8])
    expect('talento caseiro ocupa o slot de ancestralidade', homemade.pending.some((p) => p.key === 'ancestry-feat-1'), false)
}

console.log('Ajustes manuais (F8.3): entram nos números, sempre com aviso')
{
    const adj = compileBuild({ ...hf, manual: {
        extraBoosts: { 1: ['int'] },
        extraFeatSlots: [{ level: 1, kind: 'general' }],
        adjustments: [{ id: 'a1', label: 'Bênção', reason: 'Presente do GM', effect: { kind: 'hp', value: 5 } },
            { id: 'a2', label: 'Anel', reason: 'Item caseiro', effect: { kind: 'resistance', target: 'fire', value: 5 } }],
    } }, ctx)
    expect('boost extra soma na INT', adj.attributes.mod.int, 1)
    expect('ajuste de PV soma', adj.stats.hp.total, out.stats.hp.total + 5)
    expect('resistência de ajuste aparece', adj.resistances.includes('fire 5'), true)
    expect('slot de talento extra vira pendência', adj.pending.some((p) => p.key === 'extra-general-feat-1-1'), true)
    expect('ajustes avisam', adj.warnings.filter((w) => w.code.startsWith('MANUAL')).length >= 3, true)
}

console.log('Exceção do GM (F8.5): incomum avisa; liberado para o personagem, não')
{
    const uncommon = Object.values(fixture).filter(Array.isArray).flat().find((e) => e.type === 'feat' && e.rarity === 'uncommon' && (e.level ?? 0) <= 2 && (e.traits ?? []).includes('General'))
    if (uncommon) {
        const rulesAsk = { ...serverStore.DEFAULT_MESA_RULES, rarity: { uncommon: 'ask', rare: 'ask' } }
        const st = { ...hf, level: 3, choices: { ...hf.choices, 'general-feat-3': { id: uncommon.id } } }
        expect(`${uncommon.name} incomum avisa`, compileBuild(st, { rules, mesaRules: rulesAsk }).warnings.some((w) => w.code === 'RARITY_ASK' && w.entryId === uncommon.id), true)
        const withException = { ...rulesAsk, exceptions: [{ buildId: '00000000-0000-4000-8000-000000000000', ids: [uncommon.id] }] }
        expect(`${uncommon.name} liberado não avisa`, compileBuild(st, { rules, mesaRules: withException, buildId: '00000000-0000-4000-8000-000000000000' }).warnings.some((w) => w.code === 'RARITY_ASK'), false)
        expect(`${uncommon.name}: exceção de outro personagem não vale`, compileBuild(st, { rules, mesaRules: withException, buildId: '00000000-0000-4000-8000-000000000001' }).warnings.some((w) => w.code === 'RARITY_ASK'), true)
    }
}

console.log('Paridade com o elenco (importar → recompilar → exportar) e invariantes do contrato (CONTRATO-FICHA §8)')
{
    const SKILLS = ['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine', 'nature', 'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery']
    const { importPathbuilder } = await import('../src/modules/character-builder/engine/import.ts')
    const { exportBuild } = await import('../src/modules/character-builder/engine/export.ts')
    const { parseCharacterJson } = await import('../src/pathbuilder/types.ts')
    const known = JSON.parse(readFileSync(new URL('./rules-data/parity-known.json', import.meta.url), 'utf8'))
    const pctx = { rules, mesaRules: castMesa, tables, classOptions: fixture['core/class-features'] }
    let resolved = 0
    for (const file of readdirSync(new URL('../public/characters/', import.meta.url)).filter((x) => x.endsWith('.json'))) {
        const b = JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')).build
        const { state } = importPathbuilder(b, pctx, { reconcile: false })
        expect(`${b.name}: o estado importado passa no sanitizador`, serverSanitize.sanitizeBuildState(state) !== null, true)
        const out = compileBuild(state, pctx)
        const doc = exportBuild(state, out, { rules })
        let parsed = null
        try { parsed = parseCharacterJson(doc) } catch { /* invariante 1 */ }
        expect(`${b.name}: parseCharacterJson aceita o retrato`, parsed !== null, true)
        expect(`${b.name}: retrato até 64 KB`, JSON.stringify(doc).length <= 64 * 1024, true)
        const a = doc.build.acTotal
        expect(`${b.name}: CA = 10 + proficiência + atributo + item`, a.acTotal, 10 + a.acProfBonus + a.acAbilityBonus + a.acItemBonus)
        const ex = doc.build
        const diffs = []
        const cmp = (label, x, w) => { if (JSON.stringify(x) !== JSON.stringify(w)) diffs.push(label) }
        for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha']) cmp(k, ex.abilities[k], b.abilities[k])
        for (const k of Object.keys(b.proficiencies)) cmp(`prof.${k}`, ex.proficiencies[k] ?? 0, b.proficiencies[k])
        cmp('acTotal', ex.acTotal.acTotal, b.acTotal?.acTotal)
        for (const w of b.weapons) { const m = ex.weapons.find((x) => x.name === w.name); cmp(`weapon ${w.name}`, m ? [m.attack, m.damageBonus] : null, [w.attack, w.damageBonus]) }
        const cc = b.spellCasters.find((c) => c.name === b.class)
        if (cc) cmp('perDay', ex.spellCasters.find((c) => c.name === b.class)?.perDay, cc.perDay)
        // Conjuradores de arquétipo (Player Core pg. 215): tradição, tipo e espaços por dia.
        for (const ac of b.spellCasters.filter((c) => /^Archetype /.test(c.name))) {
            const m = ex.spellCasters.find((c) => c.name === ac.name)
            cmp(`arch ${ac.name}`, m ? [m.magicTradition, m.spellcastingType, m.perDay] : null, [ac.magicTradition, ac.spellcastingType, ac.perDay])
        }
        cmp('focusPoints', ex.focusPoints, b.focusPoints)
        const allowed = known[b.name] ?? {}
        expect(`${b.name}: nenhuma diferença nova (parity-known.json)`, diffs.filter((d) => !(d in allowed)), [])
        const gone = Object.keys(allowed).filter((k) => !diffs.includes(k))
        resolved += gone.length
        if (gone.length) console.log(`  resolvida(s) em ${b.name}: ${gone.join(', ')}`)
        // Com a reconciliação (o padrão da importação), o que o motor não calcula vira ajuste e os números batem com a Ficha.
        const rec = importPathbuilder(b, pctx).state
        const recDoc = exportBuild(rec, compileBuild(rec, pctx), { rules }).build
        const mods = (ab) => ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => Math.floor((ab[k] - 10) / 2))
        expect(`${b.name}: importado, os modificadores batem com a Ficha`, mods(recDoc.abilities), mods(b.abilities))
        expect(`${b.name}: importado, a CA não fica abaixo da Ficha`, recDoc.acTotal.acTotal >= b.acTotal.acTotal, true)
        expect(`${b.name}: importado, nenhuma perícia abaixo da Ficha`, SKILLS.filter((k) => (recDoc.proficiencies[k] ?? 0) < (b.proficiencies[k] ?? 0)), [])
        expect(`${b.name}: importado, toda arma da Ficha continua no retrato`, b.weapons.filter((w) => !recDoc.weapons.some((x) => x.name === w.name)).map((w) => w.name), [])
        expect(`${b.name}: importado, todo item da Ficha continua no retrato`, b.equipment.filter(([n]) => !recDoc.equipment.some(([x]) => x === n) && !recDoc.armor.some((a) => a.name === n)).map(([n]) => n), [])
    }
    if (resolved) console.log(`  (${resolved} diferença(s) conhecida(s) já resolvida(s): apague-as do parity-known.json)`)
}

// Arquétipos de classe: escolhas e efeitos no mesmo caminho que salva, reabre e publica o personagem.
{
    console.log('Arquétipos de classe (War of Immortals pg. 60 e Battlecry! pg. 68)')
    const { exportBuild } = await import('../src/modules/character-builder/engine/export.ts')
    const { importPathbuilder } = await import('../src/modules/character-builder/engine/import.ts')
    const draft = (cls, arch, level, choices = {}) => base({ class: { id: cls.id }, level,
        choices: { 'class-archetype': { id: rules.byName(arch, 'archetype').id }, ...choices } })
    const barbarian = find('core/classes', 'Barbarian')
    const blood = draft(barbarian, 'Bloodrager', 1)
    const compile = (s) => compileBuild(serverSanitize.sanitizeBuildState(s), ctxSpells)
    const one = compile(blood)
    expect('treinos iniciais substituídos', [one.skills.rank.athletics, one.skills.rank.medicine, one.skillSlots.find((s) => s.key === 'skills-1').count], [1, 1, 2])
    expect('instinto fixo e nenhuma dedicação no nível 1', [one.classChoices.find((s) => s.type === 'instinct').chosen,
        one.taken.some((t) => t.entry.name === 'Bloodrager Dedication')], ['instinct:instinct-14', false])
    expect('nível 2 vazio pede a dedicação no slot de classe', compile({ ...blood, level: 2 }).pending.find((p) => p.key === 'class-feat-2').label, 'Bloodrager Dedication')
    const picks = { 'class-feat-2': { id: 'feat:feat-7239' }, 'class-feat-2/choice:skill': { value: 'religion' } }
    const two = compile(draft(barbarian, 'Bloodrager', 2, picks))
    expect('dedicação ocupa um só slot e dá dois truques divinos com Carisma', [two.taken.filter((t) => t.entry.id === 'feat:feat-7239').length,
        two.casters[0].perDay[0], two.casters[0].tradition, two.casters[0].attribute, two.skills.rank.religion], [1, 2, 'divine', 'cha', 1])
    const overlapping = compile(draft(barbarian, 'Bloodrager', 2, { ...picks, 'skills-1': { skills: ['skill:religion'] },
        'skills-dedication-2': { skills: ['skill:nature'] } }))
    expect('treino repetido da dedicação dá uma perícia livre', overlapping.skills.rank.nature, 1)
    const bloodSheet = exportBuild(draft(barbarian, 'Bloodrager', 2, picks), two, { rules }).build
    const imported = compile(importPathbuilder(bloodSheet, ctxSpells).state)
    expect('reimporta a tradição antes de reconstruir os treinos livres', [imported.casters[0].tradition,
        imported.skillSlots.some((s) => s.key === 'skills-dedication-2')], ['divine', false])
    const full = compile(draft(barbarian, 'Bloodrager', 20, { ...picks, 'class-feat-4': { id: 'feat:feat-7241' },
        'class-feat-12': { id: 'feat:feat-7245' }, 'class-feat-18': { id: 'feat:feat-7246' } }))
    expect('Exultant Blood Magic dobra os espaços de rank 1–8 e mantém os truques', [full.casters[0].rank, full.casters[0].perDay], [3, [2,2,2,2,2,2,2,2,2,0,0]])
    const free = compile({ ...blood, level: 2, options: { variants: { freeArchetype: true } },
        choices: { ...blood.choices, 'class-feat-2': { id: fleet.id }, 'archetype-feat-2': picks['class-feat-2'] } })
    expect('Arquétipo Livre não substitui o talento de classe exigido', free.warnings.some((w) => w.code === 'CLASS_DEDICATION'), true)
    const previous = find('core/class-features', 'School of Mentalism')
    const war = draft(wizard, 'War Mage', 11, { 'class-choice:arcane-school': { id: previous.id }, 'class-feat-2': { id: 'feat:feat-7976' } })
    const warOut = compile(war)
    expect('War Mage: armaduras e armas no nível 11', [warOut.proficiency.defenses.light, warOut.proficiency.defenses.medium,
        warOut.proficiency.defenses.unarmored, warOut.proficiency.attacks.martial], [2, 2, 2, 2])
    const sheet = exportBuild(war, warOut, { rules }).build
    expect('retrato usa a escola do arquétipo e remove as características substituídas', [sheet.specials.includes('War Magic'),
        sheet.specials.includes('School of Battle Magic'), sheet.specials.includes(previous.name), sheet.specials.includes('Arcane Thesis'),
        sheet.specials.includes('Arcane Bond'), warOut.classFeatures.some((f) => f.name === 'Defensive Robes')], [true,true,false,false,false,false])
    expect('Shield Block concedido e Additional Lore (Warfare) progride', [sheet.feats.some((f) => f[0] === 'Shield Block'), sheet.lores.find(([n]) => n === 'Warfare')], [true, ['Warfare', 6]])
    expect('exportar e reimportar recupera o arquétipo', importPathbuilder(sheet, ctxSpells).state.choices['class-archetype'], war.choices['class-archetype'])
    expect('remover o arquétipo recupera a escola anterior', compile({ ...war, choices: { 'class-choice:arcane-school': { id: previous.id } } }).classChoices[0].chosen, previous.id)
    const otherLore = compile({ ...war, choices: { ...war.choices, 'skills-1': { skills: ['lore:warfare'] }, 'skills-dedication-2': { skills: ['lore:sailing'] } } })
    expect('treino anterior em Warfare Lore concede outro Lore', otherLore.skills.lores.find((l) => l.key === 'lore:sailing')?.rank, 1)
    expect('retrato próprio preserva a escola guardada', importPathbuilder(sheet, ctxSpells).state.choices['class-choice:arcane-school'], { id: previous.id })
    const changed = compile({ ...war, class: { id: fighter.id } })
    expect('trocar a classe desativa o arquétipo e preserva a escolha como órfã', [changed.classFeatures.some((f) => f.name === 'War Magic'),
        changed.warnings.some((w) => w.code === 'ORPHAN_CHOICE' && w.ref === 'class-archetype')], [false,true])

    // Runelord (Rival Academies pg. 114): escola fixa, polearm/spear marciais no rank simples, Thassilonian, Personal Rune
    // no lugar da Arcane Thesis e Advanced School Spell no 8º.
    const weapons = (fixture['items/weapons'] ?? []).filter((e) => ['Glaive', 'Trident'].includes(e.name))
    const armed = { inventory: weapons.map((w, i) => ({ key: `inv-${i}`, item: w.id, qty: 1, acquired: 'given', equipped: true })) }
    const rune = { ...draft(wizard, 'Runelord', 8, { 'class-feat-2': { id: 'feat:feat-7482' } }), ...armed }
    const runeOut = compile(rune)
    const plain = compile({ ...rune, choices: {} })
    const attack = (out, name) => out.equipment.strikes.find((x) => x.name === name)?.attack
    expect('Runelord: escola Thassilonian fixa', runeOut.classChoices.find((c) => c.type === 'arcane-school')?.chosen, 'arcane-school:arcane-school-25')
    expect('Runelord: Glaive e Trident treinados (+nível+2 sobre o destreinado)', weapons.map((w) => attack(runeOut, w.name) - attack(plain, w.name)), [10, 10])
    const runeSheet = exportBuild(rune, runeOut, { rules }).build
    expect('Runelord: Thassilonian, Personal Rune e Advanced School Spell no 8º', [runeSheet.languages.includes('Thassilonian'),
        runeOut.classFeatures.some((f) => f.name === 'Personal Rune'), runeOut.classFeatures.some((f) => f.name === 'Arcane Thesis'),
        runeSheet.feats.some((f) => f[0] === 'Advanced School Spell')], [true, true, false, true])
    expect('Runelord: sem Advanced School Spell antes do 8º', compile({ ...rune, level: 7 }).taken.some((t) => t.entry.id === 'feat:feat-5036'), false)
    expect('Runelord: exportar e reimportar recupera o arquétipo', importPathbuilder(runeSheet, ctxSpells).state.choices['class-archetype'], rune.choices['class-archetype'])
    const thassWithout = compile(base({ class: { id: wizard.id }, level: 1, choices: { 'class-choice:arcane-school': { id: 'arcane-school:arcane-school-25' } } }))
    expect('escola Thassilonian sem o arquétipo avisa', thassWithout.warnings.some((w) => w.code === 'CLASS_ARCHETYPE_REQUIRED'), true)

    // Palatine Detective (Divine Mysteries pg. 288): Esoterica fixa, Occultism ou Religion e Quick Identification.
    const investigator = find('core/classes', 'Investigator')
    const pal = draft(investigator, 'Palatine Detective', 2, { 'class-feat-2': { id: 'feat:feat-7557' }, 'skills-esoterica': { skills: ['skill:religion'] } })
    const palOut = compile(pal)
    expect('Palatine: Esoterica fixa e Religion treinada pela escolha', [palOut.classChoices.find((c) => c.type === 'methodology')?.chosen, palOut.skills.rank.religion,
        palOut.skillSlots.find((x) => x.key === 'skills-esoterica')?.options], ['methodology:methodology-9', 1, ['skill:occultism', 'skill:religion']])
    expect('Palatine: Quick Identification concedido; truques inatos avisam', [palOut.taken.some((t) => t.entry.id === 'feat:feat-5195'),
        palOut.warnings.some((w) => w.code === 'UNSUPPORTED_EFFECT' && w.message.includes('Esoterica'))], [true, true])
    expect('Palatine: a escolha de perícia pendente quando vazia', compile({ ...pal, choices: { ...pal.choices, 'skills-esoterica': undefined } }).pending.some((x) => x.key === 'skills-esoterica'), true)
}

// F10.1: o servidor compila pelo pacote gerado, lendo lista por lista; tem de dar o mesmo retrato do editor.
{
    console.log('Compilação no servidor (pacote do motor)')
    const { bundleEngine, ENGINE_OUT } = await import('./build-engine.mjs')
    expect('api/_lib/builder-engine.gen.js em dia (node scripts/build-engine.mjs)', readFileSync(ENGINE_OUT, 'utf8') === await bundleEngine(), true)
    const gen = await import('../api/_lib/builder-engine.gen.js')
    const { compileFromCatalog } = await import('../src/modules/character-builder/engine/catalog.ts')
    const { importPathbuilder } = await import('../src/modules/character-builder/engine/import.ts')
    const pctx = { rules, mesaRules: castMesa, tables, classOptions: fixture['core/class-features'] }
    // `core/locations` do recorte: a primeira lista de cada entrada fora do núcleo (como o `rules-packages.js`).
    const locations = {}
    for (const [path, list] of Object.entries(fixture)) {
        if (!Array.isArray(list) || (path.startsWith('core/') && path !== 'core/deities')) continue
        for (const e of list) locations[e.id] ??= path
    }
    const reads = new Set()
    const reader = { read: async (path) => { reads.add(path); return path === 'core/tables' ? tables : path === 'core/locations' ? locations : fixture[path] ?? null } }
    const unresolved = (sheet) => JSON.stringify(sheet).match(/"(feat|spell|deity):[a-z]+-\d+"/g) ?? []
    for (const file of readdirSync(new URL('../public/characters/', import.meta.url)).filter((x) => x.endsWith('.json'))) {
        const b = JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')).build
        const { state } = importPathbuilder(b, pctx)
        const ts = (await compileFromCatalog(state, { reader, mesaRules: castMesa, buildId: 'b' })).sheet.build
        const server = (await gen.compileFromCatalog(state, { reader, mesaRules: castMesa, buildId: 'b' })).sheet.build
        expect(`${b.name}: pacote do servidor = motor TS`, JSON.stringify(server) === JSON.stringify(ts), true)
        // Escolhas salvas em listas que a carga habitual não traz resolvem pelo `core/locations` (nome, não id).
        const { covil, ...rest } = server
        expect(`${b.name}: nenhuma escolha fica como id no retrato`, unresolved(rest), [])
    }
    expect('o servidor lê as listas de item só para quem tem inventário', reads.has('items/weapons'), true)
    // Talento concedido por GrantItem numa lista que a classe não carrega: o pacote resolve o id (`grantId`) e o
    // `core/locations` traz a lista (o racket Avenger concede a Avenger Dedication, War of Immortals pg. 58).
    const rogue = find('core/classes', 'Rogue')
    const avenger = base({ class: { id: rogue.id, keyAttribute: 'dex' }, level: 1, choices: { 'class-choice:racket': { id: 'racket:racket-10' } } })
    const plain = compileBuild(serverSanitize.sanitizeBuildState(avenger), { rules: buildRulesIndex([fixture['core/classes'], fixture['core/class-features']], []), classOptions: fixture['core/class-features'] })
    expect('motor informa o talento concedido fora das listas', plain.missingRefs, ['feat:feat-7232'])
    const located = await gen.compileFromCatalog(serverSanitize.sanitizeBuildState(avenger), { reader, mesaRules: castMesa })
    expect('…e o servidor o busca pelo core/locations', [located.compiled.taken.some((t) => t.entry.id === 'feat:feat-7232'), located.compiled.missingRefs], [true, []])
}

// Copiar para outra mesa (9.6), no handler em memória (sem Supabase não há login: usuário local, GM).
{
    console.log('Copiar para outra mesa')
    const { handleBuildRequest } = await import('../api/_lib/build-handler.js')
    const made = await handleBuildRequest('arton-1515', 'POST', {}, { action: 'build-create', name: 'Teste Cópia' })
    const id = made.body.build?.id
    const copied = await handleBuildRequest('arton-1515', 'POST', {}, { action: 'build-copy', id, toMesa: 'casa-do-gordo' })
    expect('cópia nasce na outra mesa', [copied.status, copied.body.mesa, copied.body.build?.name], [200, 'casa-do-gordo', 'Teste Cópia'])
    expect('…com id próprio e sem o state na resposta', [copied.body.build?.id !== id, 'state' in (copied.body.build ?? {})], [true, false])
    const there = await handleBuildRequest('casa-do-gordo', 'GET', { builds: '1' }, null)
    expect('…e aparece na lista de lá', there.body.builds.some((b) => b.id === copied.body.build?.id), true)
    expect('mesma mesa → 400', (await handleBuildRequest('arton-1515', 'POST', {}, { action: 'build-copy', id, toMesa: 'arton-1515' })).status, 400)
}

// Conteúdo da mesa (9.1): o sanitizador só deixa o que o motor lê, e o id é do servidor.
{
    console.log('Conteúdo da mesa (homebrew)')
    const { sanitizeHomebrewEntry } = await import('../api/_lib/homebrew-store.js')
    const { handleBuildRequest } = await import('../api/_lib/build-handler.js')
    const feat = sanitizeHomebrewEntry('feat', { id: 'feat:1', name: '  Golpe da Casa ', level: 99, traits: ['General', 'General', 'x'.repeat(50)], actions: '2', hp: 999, prerequisites: { text: 'trained in Athletics' } }, 'abc')
    expect('talento: id do servidor, nível no teto, traços sem repetição', [feat.id, feat.name, feat.level, feat.traits.length, feat.actions, 'hp' in feat], ['mesa:abc', 'Golpe da Casa', 25, 2, '2', false])
    const bg = sanitizeHomebrewEntry('background', { name: 'Guarda da Torre', background: { boosts: ['str', 'con', 'luck'], skills: ['Athletics'], feats: ['Assurance'] } }, 'b')
    expect('background: dois boosts válidos e um livre (Player Core pg. 84)', bg.background, { boosts: ['str', 'con', 'free'], skills: ['Athletics'], feats: ['Assurance'] })
    const spell = sanitizeHomebrewEntry('spell', { name: 'Faísca', spell: { cantrip: true, traditions: ['arcane', 'cosmic'] } }, 's')
    expect('magia: truque no rank 1, tradição desconhecida sai', [spell.spell, spell.level], [{ rank: 1, traditions: ['arcane'], cantrip: true }, 1])
    expect('sem nome ou tipo desconhecido → null', [sanitizeHomebrewEntry('feat', { name: ' ' }, 'x'), sanitizeHomebrewEntry('class', { name: 'X' }, 'x')], [null, null])
    // Em memória (sem Supabase): usuário local, GM.
    const saved = await handleBuildRequest('arton-1515', 'POST', {}, { action: 'homebrew-save', kind: 'feat', entry: { name: 'Golpe da Casa', traits: ['General'] } })
    const list = await handleBuildRequest('arton-1515', 'GET', { homebrew: '1' }, null)
    expect('GM salva e a mesa lê', [saved.status, list.body.homebrew.some((h) => h.entry.id === `mesa:${saved.body.homebrew?.id}`)], [200, true])
    const { fetchHomebrew } = await import('../src/services/builds.ts')
    const originalFetch = globalThis.fetch
    try {
        globalThis.fetch = async (path) => {
            const url = new URL(path, 'http://localhost')
            if (url.pathname !== '/api/state') return new Response(null, { status: 404 })
            const result = await handleBuildRequest('arton-1515', 'GET', Object.fromEntries(url.searchParams), null)
            return Response.json(result.body, { status: result.status })
        }
        const read = await fetchHomebrew(true)
        expect('cliente lê conteúdo da mesa pela rota de estado', read.ok && read.value.some((r) => r.id === saved.body.homebrew.id), true)
    } finally { globalThis.fetch = originalFetch }
    expect('tipo inválido → 400', (await handleBuildRequest('arton-1515', 'POST', {}, { action: 'homebrew-save', kind: 'class', entry: { name: 'X' } })).status, 400)
    const del = await handleBuildRequest('arton-1515', 'POST', {}, { action: 'homebrew-delete', id: saved.body.homebrew?.id })
    expect('GM apaga', del.body.deleted, true)
    // No motor: o background caseiro dá a perícia e o talento; o talento caseiro cabe no slot geral do nível 3 e o
    // efeito dele vira aviso; regras de livros não barram o que é da mesa.
    const { allowedAtTable } = await import('../src/modules/character-builder/mesaRules.ts')
    const hbBg = sanitizeHomebrewEntry('background', { name: 'Guarda da Torre', background: { boosts: ['str', 'con'], skills: ['Athletics'], feats: ['Assurance'] } }, '00000000-0000-4000-8000-000000000001')
    const hbFeat = sanitizeHomebrewEntry('feat', { name: 'Vigia Incansável', level: 1, traits: ['General'], unsupported: ['+1 em Percepção para vigiar'] }, '00000000-0000-4000-8000-000000000002')
    const hbRules = buildRulesIndex([...Object.values(fixture).filter(Array.isArray), [hbBg, hbFeat]], fixture['core/languages'])
    const hbState = { ...hf, level: 3, origin: { ...hf.origin, background: hbBg.id }, choices: { ...hf.choices, 'boosts-background': { boosts: ['str', 'con'] }, 'general-feat-3': { id: hbFeat.id } } }
    const hbOut = compileBuild(serverSanitize.sanitizeBuildState(hbState), { rules: hbRules })
    expect('background da mesa: treina Athletics e dá Assurance', [hbOut.skills.rank.athletics >= 1, hbOut.taken.some((t) => t.entry.name === 'Assurance')], [true, true])
    expect('talento da mesa no slot geral, efeito vira aviso', [hbOut.taken.some((t) => t.entry.id === hbFeat.id), hbOut.warnings.some((w) => w.code === 'UNSUPPORTED_EFFECT' && w.message.includes('Vigia Incansável'))], [true, true])
    // Retrato: a linha do talento caseiro leva o id da mesa, e a Ficha a reconhece pela posição (homônimo oficial não).
    const { sheetHomebrewFeats } = await import('../src/modules/character-viewer/homebrewFeats.ts')
    const { exportBuild } = await import('../src/modules/character-builder/engine/export.ts')
    const hbSheet = exportBuild(serverSanitize.sanitizeBuildState(hbState), hbOut, { rules: hbRules, buildId: 'b' }).build
    const hbRefs = sheetHomebrewFeats(hbSheet)
    const hbIndex = [...hbRefs.keys()][0]
    expect('retrato: talento da mesa achado pela linha, com id e slot', [hbRefs.size, hbSheet.feats[hbIndex]?.[0], hbRefs.get(hbIndex)?.id, hbRefs.get(hbIndex)?.slot], [1, 'Vigia Incansável', hbFeat.id, 'general-feat-3'])
    expect('regras de livros não barram o conteúdo da mesa', allowedAtTable(hbFeat, { ...serverStore.DEFAULT_MESA_RULES, sources: { allow: ['source-1'], deny: [] } }), true)
}

console.log(failures === 0 ? `\n${passed} conferências ok.` : `\n${failures} falha(s), ${passed} ok.`)
process.exit(failures === 0 ? 0 : 1)
