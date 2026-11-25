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
    expect('mil moedas = 1 Volume (Player Core pg. 269)', compileBuild({ ...hf, money: { pp: 0, gp: 1999, sp: 0, cp: 0 } }, ctx).equipment.bulk.coins, 1)
}

console.log('Paridade com o elenco (importar → recompilar → exportar) e invariantes do contrato (CONTRATO-FICHA §8)')
{
    const { importPathbuilder } = await import('../src/modules/character-builder/engine/import.ts')
    const { exportBuild } = await import('../src/modules/character-builder/engine/export.ts')
    const { parseCharacterJson } = await import('../src/pathbuilder/types.ts')
    const known = JSON.parse(readFileSync(new URL('./rules-data/parity-known.json', import.meta.url), 'utf8'))
    const pctx = { rules, mesaRules: castMesa, tables, classOptions: fixture['core/class-features'] }
    let resolved = 0
    for (const file of readdirSync(new URL('../public/characters/', import.meta.url)).filter((x) => x.endsWith('.json'))) {
        const b = JSON.parse(readFileSync(new URL(`../public/characters/${file}`, import.meta.url), 'utf8')).build
        const { state } = importPathbuilder(b, pctx)
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
        cmp('focusPoints', ex.focusPoints, b.focusPoints)
        const allowed = known[b.name] ?? {}
        expect(`${b.name}: nenhuma diferença nova (parity-known.json)`, diffs.filter((d) => !(d in allowed)), [])
        resolved += Object.keys(allowed).filter((k) => !diffs.includes(k)).length
    }
    if (resolved) console.log(`  (${resolved} diferença(s) conhecida(s) já resolvida(s): apague-as do parity-known.json)`)
}

console.log(failures === 0 ? `\n${passed} conferências ok.` : `\n${failures} falha(s), ${passed} ok.`)
process.exit(failures === 0 ? 0 : 1)
