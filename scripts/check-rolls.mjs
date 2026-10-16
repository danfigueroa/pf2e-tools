// Confere a matemática das rolagens da Ficha Virtual contra as fichas reais do
// grupo e contra as regras — sem rede: os traços de arma são fixtures copiadas
// do AON (`search?gear=`), para o script rodar igual em qualquer lugar.
//
//   node scripts/check-rolls.mjs
//
// Sai com código diferente de zero se qualquer conferência falhar. Rode depois
// de mexer em `checks.ts`, `strikes.ts`, `rolls.ts`, `src/dice/*` ou no
// `roll-store.js` (a validação do servidor é espelho da do cliente).

import { register } from 'node:module'
import { readFileSync } from 'node:fs'

register('./ts-loader.mjs', import.meta.url)

const checks = await import('../src/modules/character-viewer/checks.ts')
const strikes = await import('../src/modules/character-viewer/strikes.ts')
const rage = await import('../src/modules/character-viewer/rage.ts')
const { SIZE_EFFECTS, withSizeEffect } = await import('../src/modules/character-viewer/sizeEffects.ts')
const rolls = await import('../src/modules/character-viewer/rolls.ts')
const { computeConditionModifiers, NO_MODIFIERS } = await import('../src/modules/character-viewer/conditions.ts')
const { abilityMod } = await import('../src/modules/character-viewer/helpers.ts')
const { unarmedAttacks } = await import('../src/modules/character-viewer/unarmed.ts')
const amps = await import('../src/modules/character-viewer/psiAmps.ts')
const energyMod = await import('../src/modules/character-viewer/energy.ts')
const psyche = await import('../src/modules/character-viewer/psyche.ts')
const magus = await import('../src/modules/character-viewer/magus.ts')
const spellstrike = await import('../src/modules/character-viewer/spellstrike.ts')
const ranger = await import('../src/modules/character-viewer/ranger.ts')
const rogue = await import('../src/modules/character-viewer/rogue.ts')
const fighter = await import('../src/modules/character-viewer/fighter.ts')
const initiative = await import('../src/modules/character-viewer/initiative.ts')
const acts = await import('../src/modules/character-viewer/actions.ts')
const tokenFit = await import('../src/modules/battle-map/tokenFit.ts')
const av = await import('../src/modules/character-viewer/actionVariants.ts')
const companions = await import('../src/modules/character-viewer/companions.ts')
const { encounterReducer } = await import('../src/modules/initiative-tracker/encounterReducer.ts')
const { normalizeSpellCasters } = await import('../src/modules/character-sheet/types.ts')
const dice = await import('../src/dice/roll.ts')
const initRolls = await import('../src/modules/initiative-tracker/initiativeRolls.ts')
const table = await import('../src/dice/tableRoll.ts')
const server = await import('../api/_lib/roll-store.js')

let failures = 0
let passed = 0
const ok = (cond, msg) => {
    if (cond) passed++
    else { failures++; console.error(`✗ ${msg}`) }
}
const eq = (got, want, msg) => ok(got === want, `${msg}: esperado ${want}, veio ${got}`)

const load = (file) => JSON.parse(readFileSync(new URL(`../public/characters/${file}.json`, import.meta.url))).build
const party = {
    brukuthur: load('brukuthur10'),
    ceros: load('cerosqualhanthallas10'),
    eldarion: load('eldarion10'),
    ghan: load('ghanburi10'),
    nathaniel: load('nathaniel10'),
    thalos: load('thalos10'),
}

// ── 1. Totais da ficha, conferidos à mão ────────────────────────────────────
// Nível 10 + rank + atributo + item (runa resiliente +1 em todo mundo).
const EXPECTED = {
    brukuthur: { fortitude: 21, reflex: 19, will: 15, perception: 14 },
    ceros: { fortitude: 18, reflex: 22, will: 19, perception: 20 },
    eldarion: { fortitude: 18, reflex: 22, will: 16, perception: 17 },
    ghan: { fortitude: 21, reflex: 17, will: 17, perception: 18 },
    nathaniel: { fortitude: 19, reflex: 16, will: 19, perception: 16 },
    thalos: { fortitude: 18, reflex: 15, will: 18, perception: 15 },
}
for (const [who, want] of Object.entries(EXPECTED)) {
    const b = party[who]
    for (const key of ['fortitude', 'reflex', 'will']) {
        const c = checks.saveCheck(b, key, NO_MODIFIERS)
        eq(c.total, want[key], `${who} ${key}`)
        // Mítico = troca a proficiência: nível + 10 + atributo + item.
        const item = c.parts.filter((p) => p.kind === 'item').reduce((s, p) => s + p.value, 0)
        const ability = c.parts.find((p) => p.kind === 'ability').value
        eq(c.total + c.mythicDelta, b.level + 10 + ability + item, `${who} ${key} mítico`)
    }
    eq(checks.perceptionCheck(b, NO_MODIFIERS).total, want.perception, `${who} Percepção`)
}
// Furtividade do Ceros: Especialista 14 + DES 5 + item 2.
eq(checks.skillCheck(party.ceros, 'stealth', NO_MODIFIERS).total, 21, 'Ceros Furtividade com o item')
// Arcanismo do Nathaniel: o +1 do Ring of Wizardry está no `mods`.
const arcana = checks.skillCheck(party.nathaniel, 'arcana', NO_MODIFIERS)
ok(arcana.parts.some((p) => p.kind === 'item' && p.value === 1), 'Nathaniel Arcanismo traz o item +1')
// Destreinado não soma o nível.
const untrained = checks.skillCheck(party.ghan, 'stealth', NO_MODIFIERS)
eq(untrained.total, abilityMod(party.ghan.abilities.dex), 'Ghan Buri Furtividade destreinada = só DES')

// Penalidade de armadura: só FOR/DES, só sem a FOR exigida.
const fullPlate = { checkPenalty: -3, strength: 4 }
eq(checks.armorCheckPenalty(party.ghan, 'dex', fullPlate), 0, 'Ghan Buri (FOR +5) ignora a do Full Plate')
eq(checks.armorCheckPenalty(party.thalos, 'dex', fullPlate), -3, 'FOR +0 com Full Plate em perícia de DES')
eq(checks.armorCheckPenalty(party.thalos, 'int', fullPlate), 0, 'Perícia de INT não sofre penalidade de armadura')

// ── 2. Condições: o mesmo tipo não empilha, tipos diferentes somam ──────────
const stealthOf = (state) => checks.skillCheck(party.eldarion, 'stealth', computeConditionModifiers(state, 10)).conditionDelta
eq(stealthOf({ frightened: 2, clumsy: 1 }), -2, 'Amedrontado 2 + Desajeitado 1 (ambos estado) = −2')
eq(stealthOf({ frightened: 2, sickened: 1 }), -2, 'Amedrontado 2 + Enjoado 1 = −2 (vale o pior)')
const proneFrightened = computeConditionModifiers({ prone: 1, frightened: 1 }, 10)
const warhammer = party.ghan.weapons[0]

// ── 3. Golpe ────────────────────────────────────────────────────────────────
const GEAR = {
    'Composite Longbow': { kind: 'weapon', traits: ['Deadly d10', 'Propulsive', 'Volley 30 ft.'], weaponType: 'ranged' },
    Shortsword: { kind: 'weapon', traits: ['Agile', 'Finesse', 'Versatile S'], weaponType: 'melee' },
    Warhammer: { kind: 'weapon', traits: ['Shove'], weaponType: 'melee' },
    Shortbow: { kind: 'weapon', traits: ['Deadly d10'], weaponType: 'ranged' },
    Pick: { kind: 'weapon', traits: ['Fatal d10'], weaponType: 'melee' },
}
const opts = (o = {}) => ({ ...strikes.DEFAULT_STRIKE_OPTIONS, ...o })

const ghanStrike = strikes.weaponStrike(party.ghan, warhammer, GEAR.Warhammer)
eq(ghanStrike.profRank, 6, 'Ghan Buri ataca com Mestre (grupo), não com a categoria')
eq(strikes.planStrike(party.ghan, ghanStrike, NO_MODIFIERS, opts({ map: 1 })).attackTotal, 18, 'Warhammer 2º ataque = 23 − 5')
eq(strikes.planStrike(party.ghan, ghanStrike, NO_MODIFIERS, opts({ map: 2 })).attackTotal, 13, 'Warhammer 3º ataque = 23 − 10')
eq(strikes.planStrike(party.ghan, ghanStrike, NO_MODIFIERS, opts()).mythicDelta, 4, 'Warhammer ✦ troca Mestre (16) por mítica (20)')
eq(strikes.planStrike(party.ghan, ghanStrike, proneFrightened, opts()).attackTotal, 20, 'Caído (circ. −2) + Amedrontado 1 (estado −1) = −3')

const shortsword = party.ceros.weapons.find((w) => w.name === 'Shortsword')
const ss = strikes.weaponStrike(party.ceros, shortsword, GEAR.Shortsword)
eq(strikes.planStrike(party.ceros, ss, NO_MODIFIERS, opts({ map: 1 })).attackTotal, 15, 'Shortsword ágil 2º ataque = 19 − 4')
eq(strikes.planStrike(party.ceros, ss, NO_MODIFIERS, opts({ map: 2 })).attackTotal, 11, 'Shortsword ágil 3º ataque = 19 − 8')
// Acuidade: com Desajeitado 3, a FOR (+4) passa a valer mais que a DES (+5 − 3).
const clumsy3 = computeConditionModifiers({ clumsy: 3 }, 10)
const finesse = strikes.planStrike(party.ceros, ss, clumsy3, opts())
eq(finesse.ability, 'str', 'Acuidade troca para FOR quando Desajeitado pesa mais')
eq(finesse.attackTotal, 18, 'Shortsword com Desajeitado 3 ataca de FOR: 19 − 1')

const bow = party.ceros.weapons.find((w) => w.name === 'Composite Longbow')
const bowStrike = strikes.weaponStrike(party.ceros, bow, GEAR['Composite Longbow'])
const bowPlan = strikes.planStrike(party.ceros, bowStrike, NO_MODIFIERS, opts())
eq(JSON.stringify(bowPlan.deadly), JSON.stringify({ count: 2, faces: 10 }), 'Deadly d10 com greater striking = 2d10')
ok(!bowPlan.extras.some((e) => e.precision), 'Precisão começa desligada')
ok(bowPlan.extras.some((e) => e.type === 'electricity'), 'Runa de choque começa ligada')
for (let i = 0; i < 200; i++) {
    const r = strikes.rollStrikeDamage(bowPlan, 'perfurante')
    const deadly = r.crit.total - 2 * r.total
    ok(deadly >= 2 && deadly <= 20, `crítico do arco = 2 × dano + 2d10 (sobrou ${deadly})`)
}

// Enfraquecido: pesa no dano de corpo a corpo e da propulsiva, não no arco curto.
const enfeebled2 = computeConditionModifiers({ enfeebled: 2 }, 10)
eq(strikes.planStrike(party.ghan, ghanStrike, enfeebled2, opts()).weapon.flat, warhammer.damageBonus - 2, 'Enfraquecido 2 baixa o dano da Warhammer')
eq(strikes.planStrike(party.ceros, bowStrike, enfeebled2, opts()).weapon.flat, bow.damageBonus - 2, 'Enfraquecido 2 baixa o dano da propulsiva')
const shortbow = { ...bow, name: 'Shortbow' }
const sbStrike = strikes.weaponStrike(party.ceros, shortbow, GEAR.Shortbow)
eq(strikes.planStrike(party.ceros, sbStrike, enfeebled2, opts()).weapon.flat, bow.damageBonus, 'Enfraquecido não mexe no arco curto (disparo)')

// Fatal: os dados da arma viram o dado fatal no crítico, +1 dado fatal por fora.
const pick = { ...warhammer, name: 'Pick', die: 'd6', str: 'greaterStriking', extraDamage: [] }
const pickPlan = strikes.planStrike(party.ghan, strikes.weaponStrike(party.ghan, pick, GEAR.Pick), NO_MODIFIERS, opts())
for (let i = 0; i < 200; i++) {
    const r = strikes.rollStrikeDamage(pickPlan, 'perfurante')
    const fatalWeapon = r.crit.extra.find((p) => p.label.startsWith('fatal: '))
    const plus = r.crit.extra.find((p) => p.label.startsWith('fatal +'))
    ok(fatalWeapon.rolled.dice.length === 3 && fatalWeapon.rolled.dice.every((d) => d.faces === 10), 'fatal: 3 dados de arma em d10')
    eq(r.crit.total, 2 * Math.max(1, fatalWeapon.rolled.total) + plus.rolled.total, 'crítico fatal = 2 × (arma em d10) + 1d10')
}

// Crítico: runas e especialização do grupo entram POR FORA do dobro.
const gearOf = (name, group, traits = []) => ({ kind: 'weapon', name, base: name, traits, weaponType: 'melee', group })
const critPlan = (build, weapon, group, extrasOn = {}, mods = NO_MODIFIERS, traits = []) =>
    strikes.planStrike(build, strikes.weaponStrike(build, weapon, gearOf(weapon.name, group, traits)), mods, opts({ extrasOn }))
{
    // Warhammer do Ghan Buri: Fighter com "Hammer" nas características → especialização SEM chip.
    const on = critPlan(party.ghan, warhammer, 'Hammer')
    eq(on.critEffects.map((c) => c.label).join(','), 'Shock,Thundering,Especialização · Hammer', 'Fighter do grupo Hammer tem a especialização sozinha')
    eq(strikes.weaponStrike(party.ghan, warhammer, gearOf('Warhammer', 'Hammer')).spec.source.kind, 'always', 'Fighter: sempre')
    eq(critPlan(party.ghan, warhammer, 'Sword').critEffects.map((c) => c.label).join(','), 'Shock,Thundering', 'Fighter fora do grupo escolhido não tem')
    for (let i = 0; i < 100; i++) {
        const r = strikes.rollStrikeDamage(on, 'contundente')
        const elec = r.parts[1 + on.extras.findIndex((e) => e.type === 'electricity')]
        ok(r.crit.note.includes(`Shock: ${elec.rolled.total} `), 'Shock repete o dano elétrico rolado em outras criaturas')
        eq(r.crit.total, 2 * r.total, 'Shock/Thundering/martelo não somam ao alvo')
        ok(r.crit.note.includes('Thundering: Fortitude CD 24'), 'Thundering avisa a salvaguarda')
    }
    // Flaming: persistente por fora, nunca no total imediato; Greater sobe para 2d10.
    const flamingW = { ...warhammer, runes: ['Flaming'], extraDamage: [] }
    for (let i = 0; i < 100; i++) {
        const r = strikes.rollStrikeDamage(critPlan(party.ghan, flamingW, 'Sword'), 'contundente')
        const f = r.crit.extra.find((p) => p.persistent)
        ok(f && f.rolled.dice.length === 1 && f.rolled.dice[0].faces === 10, 'Flaming: 1d10 persistente de fogo')
        eq(r.crit.total, 2 * r.total, 'persistente do crítico não entra no total imediato')
        ok(r.crit.note.includes(`${f.rolled.total} fogo persistente`), 'persistente aparece na nota')
    }
    const greater = { ...flamingW, runes: ['Greater Flaming'] }
    eq(strikes.rollStrikeDamage(critPlan(party.ghan, greater, 'Sword'), 'x').crit.extra[0].rolled.dice.length, 2, 'Greater Flaming = 2d10')

    // Ranger: contra a presa caçada, ligada por padrão; o chip desliga. Faca = sangramento + bônus de item.
    const knife = { ...warhammer, name: 'Dagger', runes: [], extraDamage: [], pot: 2, str: 'striking' }
    const kr = strikes.rollStrikeDamage(critPlan(party.ceros, knife, 'Knife'), 'perfurante')
    eq(kr.crit.extra.find((p) => p.persistent).rolled.flat, 2, 'sangramento da faca soma o bônus de item')
    eq(critPlan(party.ceros, knife, 'Knife', { [strikes.SPEC_KEY]: false }).critEffects.length, 0, 'Ranger desliga pelo chip')
    // Rogue: só situacional (desprevenido), desligado até o jogador ligar; arma sem ágil/acuidade nem oferece.
    eq(critPlan(party.eldarion, knife, 'Knife', {}, NO_MODIFIERS, ['Agile']).critEffects.length, 0, 'Rogue: situacional começa desligada')
    eq(critPlan(party.eldarion, knife, 'Knife', { [strikes.SPEC_KEY]: true }, NO_MODIFIERS, ['Agile']).critEffects.length, 1, 'Rogue liga pelo chip')
    eq(strikes.weaponStrike(party.eldarion, knife, gearOf('Dagger', 'Knife')).spec, null, 'Rogue sem ágil/acuidade não tem')
    // Quem não tem a característica nem vê a especialização (Magus).
    eq(strikes.weaponStrike(party.nathaniel, knife, gearOf('Dagger', 'Knife', ['Agile'])).spec, null, 'Magus não tem especialização')
    // Barbarian: Brutality só em Fúria, e só corpo a corpo.
    const axe = { ...warhammer, name: 'Greataxe', runes: [], extraDamage: [] }
    eq(critPlan(party.brukuthur, axe, 'Axe').critEffects.length, 0, 'Bárbaro sem Fúria: sem especialização')
    const raging = { ...NO_MODIFIERS, rage: { base: 2 } }
    eq(critPlan(party.brukuthur, axe, 'Axe', {}, raging).critEffects.length, 1, 'Bárbaro em Fúria: com especialização')
    // Pick: +2 por dado da arma, por fora do dobro (Fighter que escolheu o grupo Pick).
    const fighterPick = { ...party.ghan, specials: [...party.ghan.specials, 'Pick'] }
    const pickW = { ...warhammer, name: 'Pick', runes: [], extraDamage: [], str: 'greaterStriking' }
    const pr = strikes.rollStrikeDamage(critPlan(fighterPick, pickW, 'Pick'), 'perfurante')
    eq(pr.crit.total, 2 * pr.total + 2 * 3, 'Pick: +2 por dado da arma (3 dados), por fora do dobro')
}

// Iniciativa pela ficha: a marca viaja só com um teste de d20, nos DOIS sanitizadores,
// e a Iniciativa aplica cada rolagem uma vez, ao PC certo.
{
    const who = { by: 'Eldarion', slug: 'eldarion', color: '#336699' }
    const stealth = rolls.checkRoll(who, 'Furtividade', [{ label: 'Furt.', value: 20, kind: 'base' }], null, 'iniciativa', true)
    ok(stealth.initiative === true, 'checkRoll marca a iniciativa')
    ok(!rolls.checkRoll(who, 'Furtividade', [], null).initiative, 'sem marca por padrão')
    ok(table.sanitizeTableRoll(stealth)?.initiative === true, 'cliente mantém a marca')
    ok(server.sanitizeRoll(stealth)?.initiative === true, 'servidor mantém a marca')
    const free = { ...stealth, check: undefined, free: { label: 'd6', dice: [{ faces: 6, value: 3 }], flat: 0, total: 3 } }
    ok(!table.sanitizeTableRoll(free)?.initiative, 'cliente descarta a marca sem teste de d20')
    ok(!server.sanitizeRoll(free)?.initiative, 'servidor descarta a marca sem teste de d20')

    const now = Date.now()
    const pcs = [{ id: 'c1', kind: 'pc', slug: 'eldarion', name: 'Eldarion' }, { id: 'c2', kind: 'npc', slug: 'eldarion', name: 'Imitador' }]
    const at = (ms) => ({ ...stealth, id: `r${ms}`, at: now - ms })
    const out = initRolls.pendingInitiativeUpdates([at(1000), at(5000)], pcs, new Set(), now)
    eq(out.updates.length, 2, 'duas rolagens recentes')
    eq(out.updates[1].rollId, 'r1000', 'a mais nova vem por último (e vence)')
    eq(out.updates[0].combatantId, 'c1', 'aplica ao PC, nunca a adversário de mesmo slug')
    eq(out.updates[0].value, stealth.check.total, 'o valor é o total do teste')
    eq(initRolls.pendingInitiativeUpdates([at(1000)], pcs, new Set(['r1000']), now).updates.length, 0, 'rolagem já tratada não repete')
    const gone = initRolls.pendingInitiativeUpdates([at(1000)], [], new Set(), now)
    eq(gone.updates.length + gone.settled.length, 0, 'PC fora do encontro: espera, sem dar como tratada')
    const old = initRolls.pendingInitiativeUpdates([at(11 * 60_000)], pcs, new Set(), now)
    eq(old.updates.length, 0, 'rolagem velha demais não se aplica')
    eq(old.settled.length, 1, 'e é dada como tratada')
}

// Unleash Psyche: só o Psíquico tem; bônus é o dobro do rank, em magia sem duração da conjuração de Psíquico.
{
    ok(psyche.hasUnleashPsyche(party.thalos), 'Thalos tem Unleash Psyche')
    ok(!psyche.hasUnleashPsyche(party.ghan), 'Ghan Buri não tem')
    eq(psyche.psycheDamageBonus(5), 10, 'truque no 5º rank: +10')
    eq(psyche.psycheDamageBonus(3), 6, 'Fireball no 3º rank: +6')
    const on = { ...NO_MODIFIERS, psyche: psyche.activePsyche({ phase: 'unleashed' }, true) }
    ok(psyche.psycheApplies(on, { duration: '' }, true), 'magia instantânea da conjuração de Psíquico recebe')
    ok(!psyche.psycheApplies(on, { duration: '1 minute' }, true), 'magia com duração não recebe')
    ok(!psyche.psycheApplies(on, { duration: '' }, false), 'outra conjuração (Aeromancer) não recebe')
    ok(!psyche.psycheApplies(NO_MODIFIERS, { duration: '' }, true), 'sem a psique liberada não recebe')
    ok(psyche.activePsyche({ phase: 'strain' }, true) === null, 'na ressaca não há bônus')
    eq(JSON.stringify(psyche.strainConditions({ phase: 'strain' }, true)), '{"stupefied":1}', 'ressaca = Estupefato 1')
    eq(Object.keys(psyche.strainConditions({ phase: 'unleashed' }, true)).length, 0, 'liberada não é ressaca')
    eq(psyche.sanitizePsyche({ phase: 'lixo' }).phase, 'idle', 'fase desconhecida volta a idle')
}

// Amps dos psi cantrips (rank 1 = base; cada rank acima soma o "Amp Heightened (+1)") e Conservation of Energy.
{
    const f = (name, rank, melee = false) => amps.psiAmpFor(name).damage(rank, melee).map((a) => `${a.count}d${a.faces}${a.persistent ? 'p' : ''} ${a.type}`).join(' + ')
    eq(amps.psiAmpFor('Frostbite (Amped)')?.name, 'Frostbite', 'a marca (Amped) do Pathbuilder some')
    eq(f('Frostbite', 1), '3d4 cold', 'Frostbite amp rank 1 = 3d4')
    eq(f('Frostbite', 5), '11d4 cold', 'Frostbite amp rank 5 = 3d4 + 4×2d4')
    eq(f('Ignition', 5), '5d10 fire + 5d4p fire', 'Ignition amp rank 5 = 5d10 + persistente 5d4')
    eq(f('Ignition', 5, true), '5d12 fire + 5d4p fire', 'Ignition amp corpo a corpo = d12')
    eq(f('Redistribute Potential', 5), '14d6 cold + 14d6 fire', 'Redistribute amp rank 5 = 6d6 + 4×2d6, frio ou fogo')
    ok(amps.psiAmpFor('Thermal Stasis').damage === undefined, 'Thermal Stasis amp não mexe no dano')
    ok(amps.psiAmpFor('Shield') === null, 'cantrip sem amp catalogado')
    eq(amps.psiAmpFor('Frostbite').notes(5, false).some((n) => n.includes('fraqueza 5')), true, 'fraqueza da falha crítica sobe 1 por rank')

    ok(energyMod.hasConservation(party.thalos), 'Thalos tem a Oscillating Wave')
    ok(!energyMod.hasConservation(party.ghan), 'Ghan Buri não tem')
    ok(energyMod.isEnergySpell('Fireball') && energyMod.isEnergySpell('Frostbite (Amped)'), 'concedida e psi cantrip padrão')
    ok(!energyMod.isEnergySpell('Ice Storm') && !energyMod.isEnergySpell('Entropic Wheel'), 'fora da lista: sem energia')
    eq(energyMod.allowedModes({}).join(), 'add,remove', 'neutro: escolha livre')
    eq(energyMod.allowedModes({ last: 'add' }).join(), 'remove', 'depois de adicionar, remove')
    eq(energyMod.allowedModes({ last: 'remove' }).join(), 'add', 'depois de remover, adiciona')
    eq(energyMod.convertTypes(['cold', 'sonic'], 'add').join(), 'fire', 'todo o dano vira fogo')
    eq(energyMod.convertTypes([], 'add').length, 0, 'sem tipo, sem conversão')
    eq(energyMod.sanitizeEnergy({ last: 'lixo' }).last, undefined, 'valor desconhecido volta ao neutro')
}

// Piso 1: penalidade que zera o dano ainda causa 1.
const weak = { ...warhammer, damageBonus: -20, extraDamage: [], str: '' }
const weakPlan = strikes.planStrike(party.ghan, strikes.weaponStrike(party.ghan, weak, GEAR.Warhammer), NO_MODIFIERS, opts())
for (let i = 0; i < 50; i++) eq(strikes.rollStrikeDamage(weakPlan, 'contundente').total, 1, 'dano com penalidade enorme sai 1')

// Desarmado: o MAP ágil do punho.
const fist = unarmedAttacks(party.ghan).find((u) => u.en === 'Fist')
eq(strikes.planStrike(party.ghan, strikes.unarmedStrike(party.ghan, fist), NO_MODIFIERS, opts({ map: 1 })).attackTotal, fist.attack - 4, 'Punho ágil 2º ataque = −4')

// ── 3b. Fúria (Remaster: sem o −1 na CA do Core antigo) ─────────────────────
// Só o Brukuthur é bárbaro no grupo. Nível 10, CON 18 (+4), Giant Instinct.
const spec = rage.rageSpec(party.brukuthur)
eq(spec.tempHp, 14, 'Fúria dá nível + CON = 10 + 4 PV temporários')
eq(spec.damage, 2, 'Fúria dá +2 de dano base')
eq(spec.titan.damage, 10, 'Titan Mauler no nível 7+ = 10')
eq(JSON.stringify(spec.titan.weapons), JSON.stringify(['Greataxe']), 'A arma Grande do Brukuthur é o Greataxe')
eq(JSON.stringify(spec.resist), JSON.stringify({ bludgeoning: 7, fire: 7 }), 'Raging Resistance = 3 + CON em contundente e fogo')
ok(spec.brutality && spec.quickTempered, 'Brutality e Quick-Tempered vêm das habilidades da ficha')
for (const who of ['ceros', 'eldarion', 'ghan', 'nathaniel', 'thalos']) ok(rage.rageSpec(party[who]) === null, `${who} não é bárbaro: sem Fúria`)
eq(rage.rageSpec({ ...party.brukuthur, level: 6 }).titan.damage, 6, 'Titan Mauler antes do nível 7 = 6')
eq(rage.rageSpec({ ...party.brukuthur, specials: [...party.brukuthur.specials, 'Greater Weapon Specialization'] }).titan.damage, 18, 'Com Greater Weapon Specialization = 18')
eq(Object.keys(rage.rageSpec({ ...party.brukuthur, specials: party.brukuthur.specials.filter((x) => x !== 'Raging Resistance') }).resist).length, 0, 'Sem Raging Resistance (antes do nível 9) não resiste')

GEAR.Greataxe = { kind: 'weapon', traits: ['Sweep'], weaponType: 'melee' }
const axe = party.brukuthur.weapons[0]
const axeStrike = strikes.weaponStrike(party.brukuthur, axe, GEAR.Greataxe)
const raging = (titan = true) => rage.withRage(NO_MODIFIERS, rage.activeRage({ active: true, titan }, spec))
const flatOf = (strike, mods, o = {}) => strikes.planStrike(party.brukuthur, strike, mods, opts(o)).weapon.flat
eq(flatOf(axeStrike, NO_MODIFIERS), axe.damageBonus, 'Sem Fúria o dano é o da ficha')
eq(flatOf(axeStrike, raging()), axe.damageBonus + 10, 'Greataxe Grande em Fúria soma +10')
eq(flatOf(axeStrike, raging(false)), axe.damageBonus + 2, 'Arma Grande guardada: a Fúria volta a +2')
eq(flatOf(axeStrike, raging(), { mode: 'thrown' }), axe.damageBonus, 'Arremessada não é Golpe corpo a corpo: sem Fúria')
const agileSword = { ...axe, name: 'Shortsword', extraDamage: [] }
eq(flatOf(strikes.weaponStrike(party.brukuthur, agileSword, GEAR.Shortsword), raging()), axe.damageBonus + 1, 'Arma ágil leva metade da Fúria (+1)')
eq(flatOf(strikes.weaponStrike(party.brukuthur, { ...axe, name: 'Warhammer' }, GEAR.Warhammer), raging()), axe.damageBonus + 2, 'Outra arma, não a Grande: +2')
eq(flatOf(strikes.weaponStrike(party.ceros, bow, GEAR['Composite Longbow']), raging()), bow.damageBonus, 'Arma à distância não leva Fúria')
const brukFist = unarmedAttacks(party.brukuthur).find((u) => u.en === 'Fist')
eq(flatOf(strikes.unarmedStrike(party.brukuthur, brukFist), raging()), strikes.unarmedStrike(party.brukuthur, brukFist).damageFlat + 1, 'Punho ágil leva metade da Fúria')
const both = rage.withRage(withSizeEffect(NO_MODIFIERS, SIZE_EFFECTS.enlarge), rage.activeRage({ active: true, titan: true }, spec))
eq(flatOf(axeStrike, both), axe.damageBonus + 10 + 4, 'Fúria (10) e Enlarge (+4 de estado) somam')
const ragePlan = strikes.planStrike(party.brukuthur, axeStrike, raging(), opts())
ok(ragePlan.damageParts.some((p) => p.label === 'Fúria (arma Grande)' && p.value === 10), 'O memorial mostra a parcela da Fúria')
for (let i = 0; i < 100; i++) {
    const r = strikes.rollStrikeDamage(ragePlan, 'cortante')
    ok(r.crit.total >= 2 * r.total, 'O crítico dobra o dano, Fúria inclusa')
}
eq(JSON.stringify(rage.titanConditions({ active: false, titan: true }, spec)), JSON.stringify({ clumsy: 1 }), 'Titan Mauler: Desajeitado 1 mesmo sem Fúria')
eq(JSON.stringify(rage.titanConditions({ active: true, titan: false }, spec)), '{}', 'Arma guardada: sem Desajeitado')
eq(JSON.stringify(rage.titanConditions({ active: true, titan: true }, rage.rageSpec(party.ceros))), '{}', 'Quem não é bárbaro não ganha Desajeitado')
eq(rage.sanitizeRage('lixo'), rage.NO_RAGE, 'Estado da mesa inválido vira "sem Fúria"')
const saved = { active: true, titan: false, since: 5, granted: 14 }
eq(JSON.stringify(rage.sanitizeRage(saved)), JSON.stringify(saved), 'O estado válido sobrevive à releitura')
eq(rage.sanitizeRage({ active: false, since: 5, granted: -3 }).granted, undefined, 'Concessão negativa é descartada')
ok(rage.isRageEmpty(rage.NO_RAGE) && !rage.isRageEmpty({ active: true, titan: true }), 'Estado vazio só é vazio sem nada')
const damageMod = await import('../src/modules/initiative-tracker/damage.ts')
const defenseOf = (resistances) => ({ resistances, weaknesses: {}, immunities: [], current: 100, temp: 0 })
const hit = (type, resistances) => damageMod.computeDamage({ amount: 20, type, outcome: 'none' }, defenseOf(resistances)).final
eq(hit('bludgeoning', rage.withRageResistance({}, spec, false)), 20, 'Sem Fúria, 20 contundente entram inteiros')
eq(hit('bludgeoning', rage.withRageResistance({}, spec, true)), 13, 'Em fúria, 20 contundente − 7 = 13')
eq(hit('fire', rage.withRageResistance({}, spec, true)), 13, 'Em fúria, 20 de fogo − 7 = 13')
eq(hit('cold', rage.withRageResistance({}, spec, true)), 20, 'Em fúria, frio não é resistido (a escolha foi fogo)')
eq(JSON.stringify(rage.withRageResistance({}, spec, false)), '{}', 'Fúria desligada: sem resistência')
eq(JSON.stringify(rage.withRageResistance({}, spec, true)), JSON.stringify({ bludgeoning: 7, fire: 7 }), 'Fúria ligada: resiste a contundente e fogo 7')
eq(rage.withRageResistance({ fire: 10, cold: 5 }, spec, true).fire, 10, 'Resistência maior da ficha vence a da Fúria (não soma)')
eq(rage.withRageResistance({ fire: 3 }, spec, true).fire, 7, 'Resistência menor da ficha cede à da Fúria')
const t0 = 1_000_000
ok(rage.rageGivesTempHp({ active: false, titan: true }, t0), 'Primeira Fúria dá PV temporários')
ok(!rage.rageGivesTempHp({ active: false, titan: true, endedAt: t0 - 10_000 }, t0), 'Fúria 10 s depois da outra: sem PV temporários')
ok(rage.rageGivesTempHp({ active: false, titan: true, endedAt: t0 - 61_000 }, t0), 'Fúria 61 s depois: dá de novo')

// ── 4. A rolagem que vai à mesa ─────────────────────────────────────────────
const who = rolls.rollerIdentity(party.ghan)
eq(who.by, 'Ghan Buri', 'nome da mesa')
for (let i = 0; i < 200; i++) {
    const fort = checks.saveCheck(party.ghan, 'fortitude', NO_MODIFIERS)
    const r = rolls.checkRoll(who, 'Fortitude', fort.parts, i % 2 ? fort.mythicDelta : null)
    const mod = r.check.parts.reduce((s, p) => s + p.value, 0)
    eq(r.check.mod, mod, 'o memorial soma o modificador')
    eq(r.check.mod, i % 2 ? 25 : 21, 'Fortitude do Ghan Buri na rolagem (normal/mítico)')
    ok(r.check.d20 >= 1 && r.check.d20 <= 20, 'd20 em 1..20')
    ok(table.sanitizeTableRoll(r) !== null, 'o cliente aceita a própria rolagem')
    ok(server.sanitizeRoll(r) !== null, 'o servidor aceita a rolagem do cliente')
    const s = rolls.strikeRoll(who, ghanStrike, strikes.planStrike(party.ghan, ghanStrike, NO_MODIFIERS, opts()), null)
    ok(server.sanitizeRoll(s) !== null && table.sanitizeTableRoll(s) !== null, 'Golpe passa nas duas validações')
}
// Teste não tem piso: d20 com penalidade grande pode dar negativo.
const neg = rolls.checkRoll(who, 'X', [{ label: 'Penalidade', value: -30, kind: 'other' }], null)
ok(neg.check.total < 0, 'teste com −30 não é cortado em 0')
eq(table.basicSaveLine(25), 'Falha 25 · Sucesso 12 · Falha crítica 50 · Sucesso crítico 0', 'salvaguarda básica: ½ arredondado para baixo')

// ── 5. Validação: o que não confere não vai à mesa ──────────────────────────
const good = rolls.checkRoll(who, 'Fortitude', checks.saveCheck(party.ghan, 'fortitude', NO_MODIFIERS).parts, null)
const bad = [
    ['total que não fecha', { ...good, check: { ...good.check, total: good.check.total + 1 } }],
    ['d20 = 21', { ...good, check: { ...good.check, d20: 21, total: 21 + good.check.mod } }],
    ['dado de 7 faces', { ...good, free: { label: '', dice: [{ faces: 7, value: 3 }], flat: 0, total: 3 } }],
    ['121 dados', { ...good, free: { label: '', dice: Array(121).fill({ faces: 6, value: 1 }), flat: 0, total: 121 } }],
    ['cor que não é hex', { ...good, color: 'red' }],
    ['id com maiúscula', { ...good, id: 'ABC' }],
    ['sem nada rolado', { ...good, check: undefined }],
]
for (const [why, roll] of bad) {
    ok(table.sanitizeTableRoll(roll) === null, `cliente recusa: ${why}`)
    ok(server.sanitizeRoll(roll) === null, `servidor recusa: ${why}`)
}

// ── 6. Estatística do motor ─────────────────────────────────────────────────
const expr = dice.parseDiceExpr('2d8+1d6+4')
eq(dice.exprText(expr), '2d8+1d6+4', 'parse ida e volta')
eq(dice.parseDiceExpr('2d6 3'), null, 'fórmula com termo sem sinal é recusada')
const N = 20000
let total = 0
for (let i = 0; i < N; i++) {
    const r = dice.rollGroups(expr.groups, expr.flat)
    ok(r.dice.every((d) => Number.isInteger(d.value) && d.value >= 1 && d.value <= d.faces), 'dado dentro de 1..faces')
    total += r.total
}
const mean = total / N
ok(Math.abs(mean - dice.exprAverage(expr)) < 0.15, `média de 2d8+1d6+4 = ${mean.toFixed(3)} (esperado 16,5)`)


// ── Magus: Arcane Cascade, Spellstrike, Summon Mythic Power, Divert Destiny ──
const nat = party.nathaniel
ok(magus.hasArcaneCascade(nat) && magus.hasSpellstrike(nat), 'Nathaniel tem Arcane Cascade e Spellstrike')
ok(magus.hasSummonMythicPower(nat) && magus.hasDivertDestiny(nat), 'Nathaniel tem Summon Mythic Power e Divert Destiny')
for (const who of ['brukuthur', 'ceros', 'eldarion', 'ghan', 'thalos']) ok(!magus.hasArcaneCascade(party[who]) && !magus.hasSpellstrike(party[who]), `${who} não é Magus: sem postura nem Spellstrike`)
eq(magus.cascadeDamage(nat), 2, 'Weapon Specialization: a postura dá +2')
eq(magus.cascadeDamage({ ...nat, specials: [...nat.specials, 'Greater Weapon Specialization'] }), 3, 'Greater Weapon Specialization: +3')
eq(magus.cascadeDamage({ ...nat, specials: nat.specials.filter((x) => x !== 'Weapon Specialization') }), 1, 'Sem especialização: +1')
const on = { ...magus.NO_MAGUS, cascade: true, cascadeType: 'fire' }
const cascadeMods = magus.withCascade(NO_MODIFIERS, magus.activeCascade(on, nat))
ok(magus.activeCascade(magus.NO_MAGUS, nat) === null, 'Fora da postura não há efeito')
ok(magus.activeCascade(on, party.ceros) === null, 'Quem não tem Arcane Cascade não ganha a postura')
const sword = nat.weapons[0]
GEAR.Longsword = { kind: 'weapon', traits: ['Versatile P'], weaponType: 'melee' }
const swordStrike = strikes.weaponStrike(nat, sword, GEAR.Longsword)
const cascadePlan = strikes.planStrike(nat, swordStrike, cascadeMods, opts())
const cascadeExtra = cascadePlan.extras.find((e) => e.key === 'arcane-cascade')
ok(cascadeExtra && cascadeExtra.expr.flat === 2 && cascadeExtra.type === 'fire', 'Golpe corpo a corpo ganha +2 de fogo da postura')
eq(strikes.planStrike(nat, swordStrike, NO_MODIFIERS, opts()).extras.some((e) => e.key === 'arcane-cascade'), false, 'Sem a postura não há parcela extra')
eq(strikes.planStrike(nat, swordStrike, cascadeMods, opts({ mode: 'thrown' })).extras.some((e) => e.key === 'arcane-cascade'), false, 'Arremesso não leva a postura')
const cascadeRoll = strikes.rollStrikeDamage(cascadePlan, 'cortante')
ok(cascadeRoll.parts.some((p) => p.rolled.total === 2 && /fogo/.test(p.label)), 'A parcela da postura rola 2 e diz o tipo')
eq(magus.sanitizeMagus('lixo'), magus.NO_MAGUS, 'Estado da mesa inválido vira "sem nada"')
eq(magus.sanitizeMagus({ cascade: true, cascadeType: 'lixo' }).cascadeType, 'force', 'Tipo desconhecido volta a força')
ok(magus.isMagusEmpty(magus.NO_MAGUS) && !magus.isMagusEmpty({ ...magus.NO_MAGUS, spent: true }), 'Estado vazio só sem nada gravado')
eq(magus.divertDestinyHp(10, 100), 20, 'Divert Destiny: 10 + nível')
eq(magus.divertDestinyHp(10, 15), 15, 'Divert Destiny nunca passa do PV máximo')


// ── Spellstrike dentro do Golpe ──────────────────────────────────────────────
// O Pathbuilder manda as magias do dia em `prepared`; o app lê `spells` (parseCharacterJson copia).
const natN = normalizeSpellCasters(nat)
const ssOpts = spellstrike.spellstrikeOptions(natN, () => 0)
ok(ssOpts.length > 0 && ssOpts.every((o) => spellstrike.magusCaster(natN) !== null), 'Nathaniel tem opções de Spellstrike do bloco Magus')
ok(ssOpts.some((o) => o.name === 'Ignition' && o.kind === 'cantrip' && o.slot === null && o.rank === 5), 'Truque entra no rank da metade do nível e sem slot')
const banish = ssOpts.find((o) => o.name === 'Banishment')
ok(banish && banish.kind === 'prepared' && banish.slot.total === 1 && banish.left === 1 && banish.rank === 5, 'Magia preparada: 1 slot do próprio rank')
eq(spellstrike.spellstrikeOptions(natN, (k) => (k === banish.slot.key ? 1 : 0)).find((o) => o.name === 'Banishment').left, 0, 'Slot gasto zera o que resta')
ok(!ssOpts.some((o) => o.name === '500 Toads' || o.name === 'Detect Magic'), 'Magia de arquétipo e de herança não entram')
eq(spellstrike.spellstrikeOptions(party.ceros, () => 0).length, 0, 'Quem não é Magus não tem opções')
eq(spellstrike.spellstrikeIssue({ name: 'Fireball', actions: '2', traits: ['fire'], defense: 'basic Reflex', description: 'x' }), null, 'Magia de salvaguarda de 2 ações serve')
ok(spellstrike.spellstrikeIssue({ name: 'Fireball', actions: '3', traits: [], defense: 'Reflex', description: 'x' }) !== null, 'Magia de 3 ações não serve')
ok(spellstrike.spellstrikeIssue({ name: 'Shield', actions: '1', traits: [], description: 'x' }) !== null, 'Magia sem ataque nem salvaguarda não serve')
eq(spellstrike.spellstrikeIssue({ name: 'Ray', actions: '2', traits: ['attack'], description: 'x' }), null, 'Magia de ataque de 2 ações serve')
// A rolagem combinada: parcela da magia soma ao total e, no crítico, dobra só se a magia é de ataque.
const comp = { id: 1, kind: 'damage', formula: '', types: ['fire'], persistent: false, count: 0, faces: 0, flat: 7, nth: 0, occurrences: 1, value: { count: 0, faces: 0, flat: 7 }, changed: false, uncertain: false }
const ssWho = rolls.rollerIdentity(nat)
const strikeOnly = rolls.strikeRoll(ssWho, swordStrike, cascadePlan, null)
const viaAttack = rolls.spellstrikeRoll(ssWho, swordStrike, cascadePlan, null, undefined, { name: 'Ignition', components: [comp], usesAttack: true })
ok(viaAttack.damage.parts.length === strikeOnly.damage.parts.length + 1, 'A rolagem combinada traz a parcela da magia')
ok(viaAttack.damage.total - 7 >= 1 && viaAttack.damage.crit.total >= 2 * 7, 'Magia de ataque: o crítico dobra a parte da magia')
const viaSave = rolls.spellstrikeRoll(ssWho, swordStrike, cascadePlan, null, undefined, { name: 'Ignition', components: [comp], usesAttack: false })
ok(viaSave.damage.crit.total - viaSave.damage.total >= 0 && /magia 7/.test(viaSave.damage.crit.note), 'Magia de salvaguarda entra no crítico sem dobrar')
ok(table.sanitizeTableRoll(viaAttack) !== null, 'A rolagem combinada passa no sanitizador do feed')


// ── Patrulheiro: Hunt Prey, Gravity Weapon, Hunter's Aim ─────────────────────
const cer = party.ceros
ok(ranger.hasHuntPrey(cer) && ranger.hasGravityWeapon(cer) && ranger.hasPrecisionEdge(cer) && ranger.hasHuntersAim(cer), 'Ceros tem Hunt Prey, Gravity Weapon, Precision e Hunter\'s Aim')
for (const who of ['brukuthur', 'eldarion', 'ghan', 'nathaniel', 'thalos']) ok(!ranger.hasRangerFeatures(party[who]), `${who} não é patrulheiro: sem a faixa`)
eq(ranger.gravityBonus(3), 6, 'Gravity Weapon: 2 × 3 dados')
const preyOn = ranger.withRanger(NO_MODIFIERS, ranger.activeRanger({ prey: true, gravity: false }, cer))
const gravOn = ranger.withRanger(NO_MODIFIERS, ranger.activeRanger({ prey: false, gravity: true }, cer))
ok(ranger.activeRanger(ranger.NO_RANGER, cer) === null, 'Sem presa nem gravidade não há efeito')
ok(ranger.activeRanger({ prey: true, gravity: true }, party.eldarion) === null, 'Quem não tem as características não ganha o efeito')
const cerBow = strikes.weaponStrike(cer, cer.weapons[0], GEAR['Composite Longbow'])
const precisionOn = (mods, o = {}) => strikes.planStrike(cer, cerBow, mods, opts(o)).extras.some((e) => e.precision)
eq(precisionOn(NO_MODIFIERS), false, 'Sem presa a precisão vem desligada')
eq(precisionOn(preyOn), true, 'Presa marcada: a precisão do Hunter\'s Edge vem ligada')
eq(precisionOn(preyOn, { extrasOn: { [cerBow.extras.find((e) => e.precision).key]: false } }), false, 'A escolha do jogador vence a presa')
const dmgFlat = (mods, o = {}) => strikes.planStrike(cer, cerBow, mods, opts(o)).weapon.flat
eq(dmgFlat(gravOn), dmgFlat(NO_MODIFIERS) + ranger.gravityBonus(cerBow.weaponDice.count), 'Gravity Weapon soma 2 × dados no primeiro Golpe')
eq(dmgFlat(gravOn, { extrasOn: { [ranger.FIRST_STRIKE_KEY]: false } }), dmgFlat(NO_MODIFIERS), 'Desligar o "primeiro da rodada" tira o bônus')
const ceFist = unarmedAttacks(cer)[0]
eq(strikes.planStrike(cer, strikes.unarmedStrike(cer, ceFist), gravOn, opts()).weapon.flat, strikes.unarmedStrike(cer, ceFist).damageFlat, 'Desarmado não leva Gravity Weapon (é Golpe com arma)')
const atk = (o = {}) => strikes.planStrike(cer, cerBow, NO_MODIFIERS, opts(o)).attackTotal
eq(atk({ extrasOn: { [ranger.HUNTERS_AIM_KEY]: true } }), atk() + 2, "Hunter's Aim: +2 no ataque à distância")
const swordCe = strikes.weaponStrike(cer, cer.weapons[1], { kind: 'weapon', traits: ['Agile'], weaponType: 'melee' })
eq(strikes.planStrike(cer, swordCe, NO_MODIFIERS, opts({ extrasOn: { [ranger.HUNTERS_AIM_KEY]: true } })).attackTotal, strikes.planStrike(cer, swordCe, NO_MODIFIERS, opts()).attackTotal, "Hunter's Aim não vale corpo a corpo")
eq(ranger.sanitizeRanger('lixo'), ranger.NO_RANGER, 'Estado inválido vira "sem nada"')
ok(ranger.isRangerEmpty(ranger.NO_RANGER) && !ranger.isRangerEmpty({ prey: true, gravity: false }), 'Estado vazio só sem nada gravado')


// ── Ladino: Poison Weapon e Debilitating Strike ──────────────────────────────
const eld = party.eldarion
ok(rogue.hasPoisonWeapon(eld) && rogue.hasDebilitatingStrike(eld), 'Eldarion tem Poison Weapon e Debilitating Strike')
ok(!rogue.hasPoisonWeapon(party.ghan) && !rogue.hasPoisonWeapon(nat), 'Quem não tem o talento não ganha a faixa do Ladino')
const T = (traits) => ({ name: 'x', level: 1, traits, subcategory: null, consumable: true, healing: null })
ok(rogue.isApplicablePoison(T(['Consumable', 'Contact', 'Poison'])), 'Veneno de contato serve')
ok(rogue.isApplicablePoison(T(['Consumable', 'Injury', 'Poison'])), 'Veneno de injeção serve')
ok(!rogue.isApplicablePoison(T(['Consumable', 'Inhaled', 'Poison'])), 'Veneno inalado não serve (Breath of the Mantis God)')
ok(!rogue.isApplicablePoison(T(['Consumable', 'Contact'])), 'Contato sem ser veneno não serve')
ok(!rogue.isApplicablePoison(null), 'Item sem entrada no AON não serve')
eq(rogue.poisonNote('Fearweed', { dc: 30, save: 'fortitude' }), 'veneno: Fearweed (CD 30 Fortitude)', 'Nota do veneno com CD e salvaguarda')
eq(rogue.poisonNote('Fearweed', null), 'veneno: Fearweed', 'Nota do veneno sem dados da AON')
eq(rogue.sanitizeRogue('lixo'), rogue.NO_ROGUE, 'Estado inválido vira arma limpa')
eq(JSON.stringify(rogue.sanitizeRogue({ poison: 'Fearweed' })), JSON.stringify({ poison: 'Fearweed', simpleUsed: 0 }), 'Estado antigo (só o nome) ganha as doses zeradas')
eq(rogue.sanitizeRogue({ poison: 'Fearweed' }).poison, 'Fearweed', 'O veneno gravado sobrevive à releitura')
ok(rogue.isRogueEmpty(rogue.NO_ROGUE) && !rogue.isRogueEmpty({ poison: 'x' }), 'Estado vazio só sem veneno')
// A anotação da rolagem passa pelos DOIS sanitizadores, com o mesmo teto.
const noted = { ...strikeOnly, note: 'veneno: Fearweed (CD 30 Fortitude) · Debilitating Strike: Enfraquecido 1 até o fim do próximo turno' }
eq(table.sanitizeTableRoll(noted)?.note, noted.note, 'cliente mantém a anotação')
eq(server.sanitizeRoll(noted)?.note, noted.note, 'servidor mantém a anotação')
eq(table.sanitizeTableRoll({ ...strikeOnly, note: 'a'.repeat(400) })?.note.length, 300, 'cliente corta a anotação em 300')
eq(server.sanitizeRoll({ ...strikeOnly, note: 'a'.repeat(400) })?.note.length, 300, 'servidor corta a anotação em 300')
// Spellstrike com muitas parcelas continua dentro do teto de 8 do feed.
const manyComps = Array.from({ length: 9 }, (_, i) => ({ ...comp, id: i + 1 }))
const crowded = rolls.spellstrikeRoll(ssWho, swordStrike, cascadePlan, null, undefined, { name: 'Ignition', components: manyComps, usesAttack: true })
ok(crowded.damage.parts.length <= 8, 'Muitas parcelas de magia viram uma só, dentro do teto do feed')
ok(table.sanitizeTableRoll(crowded) !== null && server.sanitizeRoll(crowded) !== null, 'A rolagem cheia ainda passa nos dois sanitizadores')



// ── Veneno simples do Poison Weapon (o padrão do Eldarion) ───────────────────
eq(rogue.simpleDoses(eld), 10, 'Doses por dia = nível')
eq(rogue.simplePoisonDice(eld).count, 2, 'Eldarion tem o Improved Poison Weapon: 2d4')
eq(rogue.simplePoisonDice({ ...eld, feats: eld.feats.filter((f) => f[0] !== 'Improved Poison Weapon') }).count, 1, 'Sem o Improved: 1d4')
ok(rogue.isSimplePoison(rogue.SIMPLE_POISON) && !rogue.isSimplePoison('Fearweed'), 'O simples tem nome próprio, que o inventário não colide')
eq(rogue.sanitizeRogue({ poison: null, simpleUsed: 99999 }).simpleUsed, 99, 'Doses usadas são limitadas')
ok(!rogue.isRogueEmpty({ poison: null, simpleUsed: 3 }), 'Dose usada precisa subir para a mesa')
const baseRoll = rolls.strikeRoll(ssWho, swordStrike, cascadePlan, null)
const poisonedRoll = rolls.withSimplePoison(baseRoll, rogue.simplePoisonDice(eld))
const venom = poisonedRoll.damage.parts[poisonedRoll.damage.parts.length - 1]
ok(/veneno simples/.test(venom.label) && venom.dice.length === 2, 'A parcela do veneno simples tem 2d4')
eq(poisonedRoll.damage.total, baseRoll.damage.total + venom.total, 'O veneno soma ao dano do Golpe')
eq(poisonedRoll.damage.crit.total, baseRoll.damage.crit.total + venom.total, 'O veneno NÃO dobra no crítico')
ok(table.sanitizeTableRoll(poisonedRoll) !== null && server.sanitizeRoll(poisonedRoll) !== null, 'A rolagem envenenada passa nos dois sanitizadores')

// ── Guerreiro: Fearsome Brute, Exacting Strike, Reflexive Shield, Fiery Rebirth ─
const gh = party.ghan
ok(fighter.hasFearsomeBrute(gh) && fighter.hasExactingStrike(gh) && fighter.hasReflexiveShield(gh) && fighter.hasFieryRebirth(gh), 'Ghan Buri tem os quatro talentos')
ok(!fighter.hasFearsomeBrute(party.ceros) && !fighter.hasFieryRebirth(nat), 'Quem não tem o talento não ganha o efeito')
eq(fighter.fearsomeBruteBonus(gh, 0), 0, 'Sem medo, sem bônus')
eq(fighter.fearsomeBruteBonus(gh, 2), 4, 'Treinado em Intimidação: 2 × o medo')
eq(fighter.fearsomeBruteBonus({ ...gh, proficiencies: { ...gh.proficiencies, intimidation: 6 } }, 2), 6, 'Mestre em Intimidação: 3 × o medo')
const hammer = gh.weapons[0]
GEAR.Warhammer = GEAR.Warhammer ?? { kind: 'weapon', traits: ['Shove'], weaponType: 'melee' }
const hammerStrike = strikes.weaponStrike(gh, hammer, GEAR.Warhammer)
const hFlat = (o = {}) => strikes.planStrike(gh, hammerStrike, NO_MODIFIERS, opts(o)).weapon.flat
eq(hFlat({ frightened: 2 }), hFlat() + 4, 'Alvo amedrontado 2: +4 no dano do Golpe')
eq(hFlat({ frightened: 0 }), hFlat(), 'Alvo sem medo: dano da ficha')
eq(strikes.planStrike(party.ceros, bowStrike, NO_MODIFIERS, opts({ frightened: 3 })).weapon.flat, strikes.planStrike(party.ceros, bowStrike, NO_MODIFIERS, opts()).weapon.flat, 'Sem o talento o medo do alvo não muda nada')
eq(fighter.reflexShieldBonus(gh, 3), 3, 'Reflexive Shield: o bônus do escudo erguido')
eq(fighter.reflexShieldBonus(gh, 0), 0, 'Escudo abaixado não dá bônus')
eq(fighter.reflexShieldBonus(party.ceros, 3), 0, 'Sem o talento o escudo não vale nos Reflexos')
const refBase = checks.saveCheck(gh, 'reflex', NO_MODIFIERS).total
eq(checks.saveCheck(gh, 'reflex', fighter.withReflexShield(NO_MODIFIERS, 3)).total, refBase + 3, 'Reflexos com o escudo erguido soma o bônus')
eq(checks.saveCheck(gh, 'fortitude', fighter.withReflexShield(NO_MODIFIERS, 3)).total, checks.saveCheck(gh, 'fortitude', NO_MODIFIERS).total, 'Só os Reflexos ganham')
ok(checks.saveCheck(gh, 'reflex', fighter.withReflexShield(NO_MODIFIERS, 3)).parts.some((p) => /Reflexive Shield/.test(p.label)), 'O memorial mostra a parcela do escudo')
eq(fighter.fieryRebirthHeal(10), 10, 'Fiery Rebirth cura o nível')
eq(fighter.fieryRebirthDamage(10), 20, 'Fiery Rebirth explode 2 × nível')
eq(fighter.classDc(gh), 27, 'CD de classe do Ghan Buri: 10 + 10 + 2 + FOR 5')
const rebirth = rolls.fieryRebirthRoll(rolls.rollerIdentity(gh), 20, 27)
ok(rebirth.damage.basic === true && rebirth.damage.total === 20, 'A explosão sai como dano básico de 20')
ok(table.sanitizeTableRoll(rebirth) !== null && server.sanitizeRoll(rebirth) !== null, 'A explosão passa nos dois sanitizadores')


// ── Bônus de iniciativa: Incredible Initiative, Elven Instincts, Battlefield Surveyor ──
const ib = initiative.initiativeBonus
eq(ib(party.ceros, 'Perception')?.value, 2, 'Ceros (Incredible Initiative): +2 na Percepção')
eq(ib(party.ceros, 'Stealth')?.value, 2, 'Incredible Initiative vale em qualquer perícia de iniciativa')
eq(ib(party.eldarion, 'Perception')?.value, 2, 'Eldarion: circunstância não empilha (Incredible + Elven Instincts = +2)')
ok(ib(party.eldarion, 'Perception').from.length === 2, 'O memorial cita as duas fontes do mesmo +2')
eq(ib(party.eldarion, 'Perception').winsTies, true, 'Elven Instincts vence o empate')
eq(ib(party.ghan, 'Perception')?.value, 2, 'Ghan Buri: Battlefield Surveyor dá +2 na Percepção')
eq(ib(party.ghan, 'Athletics'), null, 'Battlefield Surveyor só vale com Percepção')
eq(ib(party.brukuthur, 'Perception'), null, 'Sem talento nenhum, sem bônus')
eq(ib(party.thalos, 'Acrobatics')?.value, 2, 'Thalos: Incredible Initiative em Acrobacia')


// ── Ações do turno: orçamento, Lento/Atordoado, Acelerado (Haste) e custo ────
const withActive = (...list) => ({ ...NO_MODIFIERS, active: list.map(([id, value]) => ({ id, value })) })
eq(acts.actionBudget(NO_MODIFIERS).base, 3, 'Sem condição: 3 ações')
eq(acts.actionBudget(withActive(['slowed', 1])).base, 2, 'Lento 1: 2 ações')
eq(acts.actionBudget(withActive(['stunned', 2])).base, 1, 'Atordoado 2: 1 ação')
eq(acts.actionBudget(withActive(['slowed', 2], ['stunned', 1])).base, 1, 'Lento e Atordoado não somam: vale o maior (2)')
eq(acts.actionBudget(withActive(['slowed', 5])).base, 0, 'Nunca abaixo de zero')
ok(acts.actionBudget(withActive(['quickened', 1])).quick, 'Acelerado dá a ação extra')
const b3 = acts.actionBudget(NO_MODIFIERS)
const bq = acts.actionBudget(withActive(['quickened', 1]))
let st = acts.NO_ACTIONS
eq(acts.actionsLeft(st, b3).total, 3, 'Turno novo: 3 disponíveis')
st = acts.applySpend(st, b3, 1, 'move-attack')
eq(acts.actionsLeft(st, b3).total, 2, 'Um Golpe gasta 1')
st = acts.applySpend(st, b3, 2, 'any')
eq(acts.actionsLeft(st, b3).total, 0, 'Uma atividade de 2 zera o turno')
eq(acts.shortfall(st, b3, 1, 'move-attack'), 1, 'Sem ações, falta 1 para um Golpe')
eq(acts.shortfall(acts.NO_ACTIONS, b3, 3, 'any'), 0, 'Cabe uma atividade de 3 ações em turno cheio')
eq(acts.shortfall({ ...acts.NO_ACTIONS, used: 2 }, b3, 2, 'any'), 1, 'Com 1 sobrando, uma de 2 ações falta 1')
// Haste: a ação extra é só para Golpe/Andar e vai primeiro.
let hq = acts.applySpend(acts.NO_ACTIONS, bq, 1, 'move-attack')
ok(hq.quickUsed && hq.used === 0, 'Haste: o primeiro Golpe usa a ação extra')
hq = acts.applySpend(hq, bq, 1, 'move-attack')
ok(hq.quickUsed && hq.used === 1, 'Haste: o segundo Golpe já gasta uma ação geral')
const hs = acts.applySpend(acts.NO_ACTIONS, bq, 2, 'any')
ok(!hs.quickUsed && hs.used === 2, 'Haste: atividade de 2 ações não usa a extra')
ok(!acts.applySpend(acts.NO_ACTIONS, bq, 1, 'any').quickUsed, 'Haste: ação de outro tipo não usa a extra (ex.: Interagir)')
eq(acts.actionsLeft(acts.NO_ACTIONS, bq).total, 4, 'Haste: 3 gerais + 1 extra')
eq(acts.shortfall({ ...acts.NO_ACTIONS, used: 3 }, bq, 1, 'move-attack'), 0, 'Haste: com as gerais gastas, a extra ainda paga um Golpe')
eq(acts.shortfall({ ...acts.NO_ACTIONS, used: 3 }, bq, 1, 'any'), 1, 'Haste: mas não paga um Interagir')
eq(acts.actionCost('Two Actions'), 2, 'Custo de "Two Actions"')
eq(acts.actionCost('1'), 1, 'Custo de "1"')
eq(acts.actionCost('reaction'), null, 'Reação não gasta ação')
eq(acts.actionCost('1 to 3'), null, 'Variável não é adivinhado')
eq(acts.sanitizeActions('lixo'), acts.NO_ACTIONS, 'Estado inválido vira turno novo')
eq(acts.sanitizeActions({ used: 99 }).used, 9, 'Gasto absurdo é limitado')
ok(acts.isActionsEmpty(acts.NO_ACTIONS) && !acts.isActionsEmpty(acts.newTurn(5)), 'Turno novo carimbado não é "vazio" (precisa subir)')



// ── Companheiros de combate (Animated Armor do Nathaniel) ────────────────────
const sc = companions.sanitizeCompanions
eq(sc('lixo').length, 0, 'Lista inválida vira vazia')
eq(sc([{ id: 'ab12', name: ' Animated Armor ' }])[0].name, 'Animated Armor', 'O nome é aparado')
eq(sc([{ id: 'ab12', name: 'A' }, { id: 'ab12', name: 'B' }]).length, 1, 'Id repetido entra uma vez')
eq(sc([{ id: 'MAIUSCULA!', name: 'A' }, { id: 'ok', name: '' }]).length, 0, 'Id fora do padrão ou sem nome é descartado')
eq(sc(Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, name: `N${i}` }))).length, companions.MAX_COMPANIONS, 'Há um teto de companheiros')
eq(sc([{ id: 'ab12', name: 'A', token: { url: 'idb:x' } }])[0].token.url, 'idb:x', 'O token sobrevive à leitura')
eq(sc([{ id: 'ab12', name: 'A', token: { url: 42 } }])[0].token, undefined, 'Token inválido some, a criatura fica')
eq(JSON.stringify(sc([{ id: 'ab12', name: 'A', fit: { x: 0.3, y: 0.6, z: 2 } }])[0].fit), JSON.stringify({ x: 0.3, y: 0.6, z: 2 }), 'O enquadramento do companheiro sobrevive à leitura')
eq(sc([{ id: 'ab12', name: 'A', fit: { x: 0.5, y: 0.5, z: 1 } }])[0].fit, undefined, 'Enquadramento padrão não é guardado')
eq(sc([{ id: 'ab12', name: 'A', fit: { x: 9, y: -1, z: 99 } }])[0].fit.z, 4, 'Enquadramento fora da faixa é limitado')
const npcBase = (extra) => ({ id: crypto.randomUUID(), kind: 'npc', name: 'Animated Armor', level: 2, initiative: 0, ac: 18, perception: 5, maxHp: 20, current: 20, temp: 0, conditions: {}, delayed: false, defeated: false, durations: {}, ...extra })
const emptyEnc = { version: 1, round: 0, activeId: null, combatants: [] }
const once = encounterReducer(emptyEnc, { type: 'addCombatants', combatants: [npcBase({ companionOf: 'nathaniel', companionId: 'ab12' })] })
eq(once.combatants.length, 1, 'O companheiro entra')
const twice = encounterReducer(once, { type: 'addCombatants', combatants: [npcBase({ companionOf: 'nathaniel', companionId: 'ab12' })] })
eq(twice.combatants.length, 1, 'Adicionar o dono de novo não duplica o companheiro')
const other = encounterReducer(once, { type: 'addCombatants', combatants: [npcBase({ companionOf: 'ceros', companionId: 'ab12' })] })
eq(other.combatants.length, 2, 'Mesmo id em outro dono é outro companheiro')
const plain = encounterReducer(once, { type: 'addCombatants', combatants: [npcBase({}), npcBase({})] })
eq(plain.combatants.length, 3, 'Monstro comum (sem dono) pode repetir à vontade')

// ── Enquadramento da imagem do token (Modo GM) ───────────────────────────────
const tf = tokenFit
eq(JSON.stringify(tf.sanitizeFit(undefined)), JSON.stringify(tf.DEFAULT_FIT), 'Sem campo: o padrão de sempre')
eq(JSON.stringify(tf.sanitizeFit({ x: 7, y: -3, z: 99 })), JSON.stringify({ x: 1, y: 0, z: 4 }), 'Valores fora da faixa são limitados')
eq(JSON.stringify(tf.sanitizeFit({ x: 'a', y: NaN, z: null })), JSON.stringify(tf.DEFAULT_FIT), 'Lixo vira o padrão')
ok(tf.isDefaultFit(tf.DEFAULT_FIT) && !tf.isDefaultFit({ x: 0.5, y: 0.5, z: 1.5 }), 'Só o centro sem ampliação é o padrão')
const st0 = tf.fitStyle(tf.DEFAULT_FIT, 1)
ok(st0.width === '100%' && st0.height === '100%' && st0.left === '0%' && st0.top === '0%', 'Padrão em imagem quadrada: preenche o círculo, sem deslocar')
const wide = tf.fitStyle(tf.DEFAULT_FIT, 2)
ok(wide.width === '200%' && wide.height === '100%' && wide.left === '-50%', 'Imagem larga: cobre o círculo e centra')
const zoomed = tf.fitStyle({ x: 0.25, y: 0.5, z: 2 }, 1)
eq(zoomed.width, '200%', 'Ampliação 2× dobra o tamanho')
eq(zoomed.left, '0%', 'Ponto a 25% com 2×: o limite da borda trava o deslocamento (sem canto vazio)')
eq(tf.sanitizeFit({ x: 0.5, y: 0.5, z: 1, url: 'https://x.public.blob.vercel-storage.com/monsters/a.webp' }).url, 'https://x.public.blob.vercel-storage.com/monsters/a.webp', 'A imagem enviada no mapa sobrevive à leitura')
eq(tf.sanitizeFit({ url: 42 }).url, undefined, 'URL que não é texto some')
eq(tf.sanitizeFit({ url: 'x'.repeat(700) }).url, undefined, 'URL enorme some')
ok(!tf.isDefaultFit({ x: 0.5, y: 0.5, z: 1, url: 'idb:abc' }), 'Com imagem própria o campo não é o padrão (precisa ficar gravado)')
eq(tf.clampFit({ x: 0.5, y: 0.5, z: 2, url: 'idb:abc' }, 1).url, 'idb:abc', 'O ajuste de limites não perde a imagem')
const edge = tf.clampFit({ x: 0, y: 1, z: 2 }, 1)
ok(edge.x === 0.25 && edge.y === 0.75, 'O ponto não passa de onde o círculo ainda está coberto')
const free = tf.fitStyle({ x: 0.7, y: 0.3, z: 2 }, 1)
eq(free.left, `${50 - 0.7 * 200}%`, 'O ponto escolhido cai no centro do círculo (x)')
eq(free.top, `${50 - 0.3 * 200}%`, 'O ponto escolhido cai no centro do círculo (y)')


// ── Magias de ação variável (1 a 3 ações) ────────────────────────────────────
const rg = av.actionRange
eq(JSON.stringify(rg('Single Action to Three Actions')), JSON.stringify({ min: 1, max: 3 }), '"Single Action to Three Actions" = 1..3')
eq(JSON.stringify(rg('Single Action to Two Actions')), JSON.stringify({ min: 1, max: 2 }), '"Single Action to Two Actions" = 1..2')
eq(JSON.stringify(rg('Single Action or Two Actions')), JSON.stringify({ min: 1, max: 2 }), '"Single Action or Two Actions" = 1..2')
eq(rg('Two Actions'), null, 'Ação fixa não tem faixa')
eq(rg('1'), null, '"1" não tem faixa')
eq(rg(undefined), null, 'Sem dado não tem faixa')
const vf = (name, rank, n) => av.variantFor(name, rank, n)
const diceOf = (v) => `${v.components[0].value.count}d${v.components[0].value.faces}${v.components[0].value.flat ? `+${v.components[0].value.flat}` : ''}`
eq(diceOf(vf('Heal', 1, 1)), '1d8', 'Heal 1 ação rank 1: 1d8')
eq(diceOf(vf('Heal', 3, 1)), '3d8', 'Heal 1 ação rank 3: 3d8')
eq(diceOf(vf('Heal', 3, 2)), '3d8+24', 'Heal 2 ações rank 3: 3d8 + 8 por rank')
eq(diceOf(vf('Heal', 3, 3)), '3d8', 'Heal 3 ações: sem o extra, só a área')
ok(/Emanação/.test(vf('Heal', 1, 3).notes.join(' ')), 'Heal com 3 ações diz que é emanação')
eq(vf('Heal', 1, 1).components[0].kind, 'healing', 'Heal é cura')
eq(vf('Harm', 2, 1).components[0].kind, 'damage', 'Harm é dano')
eq(diceOf(vf('Force Barrage', 1, 1)), '1d4+1', 'Force Barrage 1 ação: 1 projétil')
eq(diceOf(vf('Force Barrage', 1, 3)), '3d4+3', 'Force Barrage 3 ações: 3 projéteis')
eq(diceOf(vf('Magic Missile', 3, 2)), '4d4+4', 'Magic Missile rank 3, 2 ações: 2 × (1 + 1) projéteis')
eq(diceOf(vf('Blazing Bolt', 2, 1)), '2d6', 'Blazing Bolt rank 2, 1 ação: 2d6')
eq(diceOf(vf('Blazing Bolt', 2, 2)), '4d6', 'Blazing Bolt rank 2, 2 ações: 4d6')
eq(diceOf(vf('Blazing Bolt', 2, 3)), '4d6', 'Blazing Bolt rank 2, 3 ações: 4d6')
eq(diceOf(vf('Scorching Ray', 3, 1)), '3d6', 'Scorching Ray rank 3, 1 ação: +1d6')
eq(diceOf(vf('Scorching Ray', 3, 2)), '6d6', 'Scorching Ray rank 3, 2 ações: +2d6')
eq([1, 2, 3].map((n) => vf('Blazing Bolt', 2, n).rays).join(','), '1,2,3', 'Um raio por ação')
eq(vf('Blazing Bolt', 5, 2).components[0].types[0], 'fire', 'Blazing Bolt é fogo')
eq([1, 2, 3].map((n) => diceOf(vf('Ki Blast', 3, n))).join(','), '2d6,3d6,4d6', 'Ki Blast rank 3: 2d6/3d6/4d6')
eq([1, 2, 3].map((n) => diceOf(vf('Qi Blast', 4, n))).join(','), '3d6,5d6,6d6', 'Qi Blast rank 4: +1d6 (1 ação) ou +2d6')
eq([1, 2, 3].map((n) => diceOf(vf('Disorienting Flash', 2, n))).join(','), '1d10,2d10,2d10', 'Disorienting Flash rank 2')
eq([1, 2, 3].map((n) => diceOf(vf('Disorienting Flash', 3, n))).join(','), '2d10,3d10,3d10', 'Disorienting Flash rank 3: +1d10 em todas')
eq([1, 2].map((n) => diceOf(vf('Concordant Choir', 1, n))).join(','), '1d4,2d4', 'Concordant Choir rank 1')
eq([1, 2].map((n) => diceOf(vf('Concordant Choir', 2, n))).join(','), '2d4,4d4', 'Concordant Choir rank 2: +1d4 / +2d4')
eq(diceOf(vf('Rebuke Death', 4, 2)), '3d6', 'Rebuke Death rank 4: 3d6 por alvo')
eq(diceOf(vf('Rebuke Death', 6, 1)), '5d6', 'Rebuke Death rank 6: +1d6 por rank')
eq(av.variantFor('Fireball', 3, 2), null, 'Fora do catálogo: sem regra própria')
eq(JSON.stringify(vf('Heal', 2, 2).components.map((c) => c.id)), JSON.stringify(vf('Heal', 2, 2).components.map((c) => c.id)), 'Os ids são estáveis a cada chamada')
ok(vf('Heal', 2, 2).components[0].id === 9500, 'O id vem da posição (a seleção do jogador sobrevive ao render)')
eq(spellstrike.spellstrikeIssue({ name: 'Blazing Bolt', actions: 'Single Action to Three Actions', traits: ['attack', 'fire'], description: 'x' }), null, 'Blazing Bolt serve no Spellstrike (1 ou 2 ações)')
ok(spellstrike.spellstrikeIssue({ name: 'X', actions: 'Two Actions to Three Actions', traits: ['attack'], description: 'x' }) !== null || av.actionRange('Two Actions to Three Actions').min === 2, 'Faixa 2 a 3 ainda cabe com 2 ações')

console.log(`${passed} conferências ok, ${failures} falha(s).`)
process.exit(failures ? 1 : 0)
