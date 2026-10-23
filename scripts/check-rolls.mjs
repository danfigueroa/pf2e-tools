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
const hasSpellstrikeFn = magusHas => magusHas && magus.hasSpellstrike(magusHas)
const ranger = await import('../src/modules/character-viewer/ranger.ts')
const rogue = await import('../src/modules/character-viewer/rogue.ts')
const fighter = await import('../src/modules/character-viewer/fighter.ts')
const investigator = await import('../src/modules/character-viewer/investigator.ts')
const treatWoundsMod = await import('../src/modules/character-viewer/treatWounds.ts')
const healActs = await import('../src/modules/character-viewer/healActivities.ts')
const itemActs = await import('../src/modules/character-viewer/itemActivities.ts')
const skillActs = await import('../src/modules/character-viewer/skillActions.ts')
const homebrew = await import('../src/modules/character-viewer/homebrewGear.ts')
const innate = await import('../src/modules/character-viewer/innateSpells.ts')
const monk = await import('../src/modules/character-viewer/monk.ts')
const unarmedMod = await import('../src/modules/character-viewer/unarmed.ts')
const critFx = await import('../src/modules/character-viewer/critEffects.ts')
const initiative = await import('../src/modules/character-viewer/initiative.ts')
const acts = await import('../src/modules/character-viewer/actions.ts')
const tokenFit = await import('../src/modules/battle-map/tokenFit.ts')
const av = await import('../src/modules/character-viewer/actionVariants.ts')
const companions = await import('../src/modules/character-viewer/companions.ts')
const gifts = await import('../src/modules/character-viewer/gifts.ts')
const relics = await import('../src/modules/character-viewer/relics.ts')
const tableStore = await import('../api/_lib/table-store.js')
const { encounterReducer } = await import('../src/modules/initiative-tracker/encounterReducer.ts')
const { normalizeSpellCasters, normalizeBuild, fixWeaponExports, parseCharacterJson } = await import('../src/pathbuilder/types.ts')
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
    ok(amps.psiAmpFor('Daze') === null, 'cantrip sem amp catalogado')
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
const ssOpts = spellstrike.spellstrikeOptions(natN, () => 0, 3)
ok(ssOpts.length > 0 && spellstrike.magusCaster(natN) !== null, 'Nathaniel tem opções de Spellstrike')
ok(ssOpts.some((o) => o.name === 'Ignition' && o.kind === 'cantrip' && o.slot === null && o.rank === 5 && o.caster === 'Magus'), 'Truque entra no rank da metade do nível e sem slot')
const banish = ssOpts.find((o) => o.name === 'Banishment')
ok(banish && banish.kind === 'prepared' && banish.slot.total === 1 && banish.left === 1 && banish.rank === 5, 'Magia preparada: 1 slot do próprio rank')
eq(spellstrike.spellstrikeOptions(natN, (k) => (k === banish.slot.key ? 1 : 0)).find((o) => o.name === 'Banishment').left, 0, 'Slot gasto zera o que resta')
// O Spellstrike aceita magia de QUALQUER bloco: arquétipo, inata e Mythic Magic.
const bolt1 = ssOpts.find((o) => o.name === 'Blazing Bolt')
ok(bolt1 && bolt1.kind === 'mythic' && bolt1.slot === null && bolt1.rank === 5 && bolt1.caster === 'Mythic Magic', 'Blazing Bolt (Mythic Magic) entra, em rank 5')
eq(bolt1.left, 3, 'Mythic Magic: o que resta são os Pontos Míticos')
eq(spellstrike.spellstrikeOptions(natN, () => 0, 0).find((o) => o.name === 'Blazing Bolt').left, 0, 'Sem Ponto Mítico a opção fica indisponível')
ok(ssOpts.some((o) => o.name === 'Live Wire' && o.caster === 'Archetype Wizard'), 'Magia do arquétipo de Mago entra')
ok(ssOpts.some((o) => o.name === 'Cave Fangs' && o.kind === 'prepared'), 'Magia preparada do arquétipo gasta o próprio slot')
ok(new Set(ssOpts.map((o) => o.id)).size === ssOpts.length, 'Os ids das opções são únicos')
ok(!spellstrike.spellstrikeOptions(party.ceros, () => 0).some((o) => o.caster === 'Magus'), 'Quem não tem o bloco Magus não ganha magia dele')
ok(!hasSpellstrikeFn(party.ceros), 'Sem a característica Spellstrike a seção nem aparece (a trava é a ficha)')
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

// ── Passar item entre jogadores ──────────────────────────────────────────────
{
    const row = (name, qty, equipment = true) => ({ label: name, name, qty, sheetQty: qty, tags: [], equipment })
    const potion = 'Healing Potion (Lesser)'
    // Thalos passa 2 de 3 poções ao Loki; o Loki recebe 2 do Thalos.
    const thalosGave = gifts.addGave({}, 'loki', potion, 2)
    const lokiIncoming = { thalos: { [potion]: 2 } }
    const thalosRows = gifts.withGifts([row(potion, 3), row('Rope', 1)], thalosGave, {})
    eq(thalosRows.find((r) => r.name === potion).qty, 1, 'gifts: quem passou fica com ficha − passado')
    eq(thalosRows.find((r) => r.name === potion).sheetQty, 3, 'gifts: a quantidade da ficha (chave do contador de uso) não muda')
    const lokiRows = gifts.withGifts([row('Rope', 1)], {}, lokiIncoming)
    const got = lokiRows.find((r) => r.name === potion)
    ok(got && got.qty === 2 && got.sheetQty === 0 && got.tags.includes('Recebido'), 'gifts: o que só foi recebido vira linha nova, marcada "Recebido"')
    eq(gifts.withGifts([row(potion, 3)], gifts.addGave({}, 'loki', potion, 3), {}).length, 0, 'gifts: passou tudo, a linha some')
    // Devolução: o Loki devolve 1; cada um escreve só na própria fatia.
    const lokiGave = gifts.addGave({}, 'thalos', potion, 1)
    eq(gifts.deltaOf(potion, lokiGave, lokiIncoming), 1, 'gifts: recebido 2 − devolvido 1 = 1')
    eq(gifts.heldFrom('thalos', potion, lokiGave, lokiIncoming), 1, 'gifts: líquido que o Loki ainda tem do Thalos')
    eq(gifts.deltaOf(potion, thalosGave, { loki: { [potion]: 1 } }), -1, 'gifts: o Thalos vê o que o Loki devolveu')
    eq(gifts.holdersOf(potion, lokiGave, lokiIncoming).map((h) => `${h.slug}:${h.n}`).join(), 'thalos:1', 'gifts: quem passou o item a mim, para devolver')
    eq(gifts.holdersOf(potion, gifts.addGave({}, 'thalos', potion, 2), lokiIncoming).length, 0, 'gifts: devolvido tudo, não sobra a quem devolver')
    // Desfazer (-n) apaga a entrada em vez de deixar 0.
    eq(Object.keys(gifts.addGave(thalosGave, 'loki', potion, -2)).length, 0, 'gifts: desfazer zera e remove a entrada')
    eq(gifts.addGave({}, 'loki', potion, -1).loki, undefined, 'gifts: desfazer sem nada passado não cria entrada negativa')
    // Só equipamento recebe a variação: arma e armadura nunca.
    eq(gifts.withGifts([row(potion, 3, false)], thalosGave, {})[0].qty, 3, 'gifts: arma/armadura não recebem variação')
    // Sanitize.
    eq(Object.keys(gifts.sanitizeGave('lixo')).length, 0, 'gifts: fatia inválida vira vazia')
    eq(Object.keys(gifts.sanitizeGave({ 'MAIUSCULA!': { a: 1 }, ok: { a: 0, b: -2, c: 'x' } })).length, 0, 'gifts: slug fora do padrão e quantidade ≤ 0 são descartados')
    eq(gifts.sanitizeGave({ ok: { a: 500 } }).ok.a, 99, 'gifts: quantidade é limitada')
    eq(Object.keys(gifts.sanitizeGave(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`c${i}`, { a: 1 }])))).length, gifts.MAX_GAVE_TARGETS, 'gifts: há um teto de destinatários')
    ok(!gifts.canGave(Object.fromEntries(Array.from({ length: gifts.MAX_GAVE_TARGETS }, (_, i) => [`c${i}`, { a: 1 }])), 'novo', 'a'), 'gifts: sem espaço para mais um destinatário')
    ok(gifts.canGave({ loki: { [potion]: 1 } }, 'loki', potion), 'gifts: quem já tem entrada sempre cabe')
    // Aviso de chegada.
    eq(gifts.arrivals({}, lokiIncoming).map((a) => `${a.from}:${a.name}:${a.n}`).join(), `thalos:${potion}:2`, 'gifts: o que chegou aparece no aviso')
    eq(gifts.arrivals(lokiIncoming, lokiIncoming).length, 0, 'gifts: nada novo, nada de aviso')
    eq(gifts.arrivals({ thalos: { [potion]: 3 } }, lokiIncoming).length, 0, 'gifts: devolução a menos não é aviso')
    // Servidor: o campo existe e a leitura do que me passaram funciona (fallback em memória).
    ok(tableStore.isValidField('gave'), 'gifts: o servidor aceita o campo gave')
    if (!tableStore.isStoreConfigured()) {
        const mesa = 'casa-do-gordo'
        await tableStore.writeField(mesa, 'thalos', 'gave', { loki: { [potion]: 2 }, ceros: { Rope: 1 } })
        await tableStore.writeField(mesa, 'ceros', 'gave', { loki: { [potion]: 1 } })
        await tableStore.writeField(mesa, 'loki', 'gave', { loki: { auto: 9 } })
        const inc = await tableStore.readIncoming(mesa, 'loki')
        eq(inc.thalos?.[potion], 2, 'gifts: readIncoming traz o que o Thalos me passou')
        eq(inc.ceros?.[potion], 1, 'gifts: readIncoming traz o que o Ceros me passou')
        eq(Object.keys(inc).length, 2, 'gifts: readIncoming ignora o que aponta para outros e para mim mesmo')
    }
}

// ── Relíquias ────────────────────────────────────────────────────────────────
{
    // Catálogo de teste (o real entra quando o jogador informa a relíquia).
    const base = party.eldarion
    const w0 = base.weapons[0]
    const entry = (gifts, extra = {}) => ({
        id: 'teste', character: (b) => b.name === base.name, name: 'Relíquia de teste',
        on: { kind: 'weapon', weapon: w0.name.toUpperCase() }, gifts, ...extra,
    })
    const rune = (id, tier, r, extra = {}) => ({ id, name: id, tier, kind: 'rune', rune: r, ...extra })
    const power = (id, tier, activation, extra = {}) => ({ id, name: id, tier, kind: 'power', activation, ...extra })

    eq(relics.relicLevel(base), base.level, 'relíquia: o nível dela é o do dono')
    eq(relics.relicsOf(base, []).length, 0, 'relíquia: sem catálogo, nada aparece')
    eq(relics.relicsOf(party.ghan, [entry([])]).length, 0, 'relíquia: casa pelo nome do personagem')

    // Nível mínimo: Tabela 2–22 (1, 5, 9, 13, 17), ou o da própria dádiva.
    const g = (n) => power(`g${n}`, 'minor', undefined)
    eq(relics.giftMinLevel(g(0), 0), 1, 'relíquia: 1ª dádiva libera no 1º nível')
    eq(relics.giftMinLevel(g(1), 1), 5, 'relíquia: 2ª no 5º')
    eq(relics.giftMinLevel(g(4), 4), 17, 'relíquia: 5ª no 17º')
    eq(relics.giftMinLevel(g(9), 9), 17, 'relíquia: além da 5ª vale o último degrau')
    eq(relics.giftMinLevel(power('x', 'major', undefined, { minLevel: 7 }), 0), 7, 'relíquia: a dádiva pode declarar o próprio nível')
    ok(relics.giftUnlocked(g(1), 1, 5) && !relics.giftUnlocked(g(1), 1, 4), 'relíquia: libera exatamente no nível')

    // Ativação → economia de atividades.
    eq(relics.giftActivity(power('a', 'minor', undefined)), null, 'relíquia: sem ativação, sem botão')
    const two = relics.giftActivity(power('a', 'minor', { cost: 2, frequency: 'uma vez por dia', limited: true }))
    ok(two && two.time.kind === 'actions' && two.time.n === 2 && two.daily && !two.mythicPoint, 'relíquia: 2 ações, limitada')
    eq(relics.giftActivity(power('a', 'minor', { cost: 'reaction', trigger: 'x' })).time.kind, 'reaction', 'relíquia: reação')
    eq(relics.giftActivity(power('a', 'minor', { cost: 'free' })), null, 'relíquia: ação livre sem limite não ganha botão')
    ok(relics.giftActivity(power('a', 'minor', { cost: 'free', limited: true }))?.daily, 'relíquia: ação livre com limite ganha botão')
    eq(relics.giftUseKey({ id: 'r' }, { id: 'p' }), 'relic:r:p', 'relíquia: chave do "usada" é única por relíquia e dádiva')

    // Runas na arma: pelo maior, nunca somando.
    const cat = (gifts) => [entry(gifts)]
    const plain = { ...base, level: 20, weapons: [{ ...w0, pot: 1, str: null, runes: [], attack: 20 }] }
    const out = relics.withRelicRunes(plain, cat([rune('a', 'minor', { potency: 2, striking: 'striking', property: ['Flaming'] })])).weapons[0]
    ok(out.pot === 2 && out.attack === 21 && out.str === 'striking' && out.runes.join() === 'Flaming', 'relíquia: potência +1 sobe o ataque em 1, striking e propriedade entram')
    const same = relics.withRelicRunes({ ...plain, weapons: [{ ...plain.weapons[0], pot: 2, attack: 21, str: 'Greater Striking', runes: ['flaming'] }] },
        cat([rune('a', 'minor', { potency: 2, striking: 'striking', property: ['Flaming'] })]))
    ok(same.weapons[0].pot === 2 && same.weapons[0].attack === 21 && same.weapons[0].str === 'Greater Striking' && same.weapons[0].runes.length === 1, 'relíquia: runa que a ficha já tem (ou maior) não soma de novo')
    eq(relics.withRelicRunes({ ...plain, level: 4 }, cat([g(0), rune('b', 'minor', { potency: 3 })])).weapons[0].pot, 1, 'relíquia: runa na 2ª posição só vale a partir do 5º nível')
    eq(relics.withRelicRunes(plain, cat([g(0), rune('b', 'minor', { potency: 3 })])).weapons[0].pot, 3, 'relíquia: liberada no nível, a runa vale')
    eq(relics.withRelicRunes(plain, cat([rune('a', 'minor', { striking: 'greater striking' })])).weapons[0].str, 'greater striking', 'relíquia: greater striking')
    eq(relics.withRelicRunes({ ...plain, weapons: [{ ...plain.weapons[0], name: 'Outra', display: w0.name }] }, cat([rune('a', 'minor', { potency: 2 })])).weapons[0].pot, 2, 'relíquia: casa também pelo nome de exibição (display) do Pathbuilder')
    eq(relics.withRelicRunes({ ...plain, weapons: [{ ...plain.weapons[0], name: 'Outra', display: 'Outra' }] }, cat([rune('a', 'minor', { potency: 2 })])).weapons[0].pot, 1, 'relíquia: só a arma que a relíquia nomeia')
    ok(relics.withRelicRunes(plain, []) === plain, 'relíquia: sem relíquia a ficha é a mesma (identidade)')
    ok(relics.withRelicRunes(plain, cat([power('p', 'minor', undefined)])) === plain, 'relíquia: poder não mexe na arma')
}

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



// ── Vários raios numa rolagem só ─────────────────────────────────────────────
const bolt = av.variantFor('Blazing Bolt', 5, 3)
const atkParts = [{ label: 'Mítica', value: 20, kind: 'prof' }, { label: 'INT', value: 4, kind: 'ability' }]
const threeRays = rolls.raysRoll(ssWho, { name: 'Blazing Bolt', sub: 'rank 5', rays: Array.from({ length: bolt.rays }, () => ({ attackParts: atkParts, mythicDelta: null })), components: bolt.components })
eq(threeRays.rays.length, 3, 'Três ações: três raios na MESMA rolagem')
ok(!threeRays.check && !threeRays.damage, 'Os raios não deixam check/damage soltos no topo')
ok(threeRays.rays.every((ray) => ray.check.total === ray.check.d20 + 24 && ray.damage.parts[0].dice.length === 10), 'Cada raio tem o seu d20 e os seus 10d6')
ok(threeRays.rays.every((ray) => ray.damage.crit.total === 2 * ray.damage.total), 'O crítico dobra cada raio')
const rayTotalNow = threeRays.rays.reduce((n, r) => n + r.damage.total, 0)
eq(table.rayTotal(threeRays.rays), rayTotalNow, 'O total soma o dano de todos os raios')
eq(table.rayCritTotal(threeRays.rays), 2 * rayTotalNow, 'Todos críticos = o dobro do total')
ok(table.sanitizeTableRoll(threeRays) !== null, 'O cliente aceita a rolagem de raios')
ok(server.sanitizeRoll(threeRays) !== null, 'O servidor aceita a rolagem de raios (e cabe no teto de bytes)')
eq(JSON.stringify(server.sanitizeRoll(threeRays).rays), JSON.stringify(table.sanitizeTableRoll(threeRays).rays), 'Os dois sanitizadores deixam os raios iguais')
const cheat = JSON.parse(JSON.stringify(threeRays)); cheat.rays[1].check.total += 1
ok(table.sanitizeTableRoll(cheat) === null && server.sanitizeRoll(cheat) === null, 'Raio com a conta errada é recusado nos dois')
const emptyRays = { ...threeRays, rays: [] }
ok(table.sanitizeTableRoll(emptyRays) === null && server.sanitizeRoll(emptyRays) === null, 'Lista de raios vazia é recusada')
const manyRays = { ...threeRays, rays: Array.from({ length: 7 }, () => threeRays.rays[0]) }
ok(table.sanitizeTableRoll(manyRays) === null && server.sanitizeRoll(manyRays) === null, 'Mais de 6 raios é recusado')
ok(/3 raios/.test(table.rollSummaryText(threeRays)), 'O resumo para leitor de tela cita os raios')


// ── Correção do export do Pathbuilder: a Longsword do Nathaniel ──────────────
eq(nat.weapons[0].attack, 18, 'O JSON bruto do Nathaniel traz +18 (sem a potência)')
eq(normalizeBuild(nat).weapons[0].attack, 19, 'A ficha corrige para 10 + Perito 4 + FOR 4 + potência 1 = 19')
eq(normalizeBuild(normalizeBuild(nat)).weapons[0].attack, 19, 'Rodar de novo não soma o +1 outra vez')
eq(fixWeaponExports({ ...nat, weapons: [{ ...nat.weapons[0], attack: 19 }] }).weapons[0].attack, 19, 'Export já certo (19): a correção não age')
eq(fixWeaponExports({ ...nat, weapons: [{ ...nat.weapons[0], attack: 17 }] }).weapons[0].attack, 17, 'Só corrige quando falta EXATAMENTE 1')
eq(fixWeaponExports({ ...nat, weapons: [{ ...nat.weapons[0], display: 'Outra Espada' }] }).weapons[0].attack, 18, 'Só vale para a arma pelo nome')
eq(fixWeaponExports({ ...nat, name: 'Ghan Buri' }).weapons[0].attack, 18, 'Só vale para o personagem pelo nome')
for (const who of ['ceros', 'eldarion', 'ghan', 'brukuthur', 'thalos']) {
    eq(JSON.stringify(normalizeBuild(party[who]).weapons), JSON.stringify(normalizeSpellCasters(party[who]).weapons), `${who}: as armas ficam como o Pathbuilder mandou`)
}
const fixedSwing = strikes.weaponStrike(normalizeBuild(nat), normalizeBuild(nat).weapons[0], { kind: 'weapon', traits: ['Versatile P'], weaponType: 'melee' })
eq(strikes.planStrike(normalizeBuild(nat), fixedSwing, NO_MODIFIERS, opts()).attackTotal, 19, 'O Golpe do Nathaniel sai com +19')

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

// Magias de assinatura: o Pathbuilder não as exporta, o catálogo casa pelo nome do personagem.
{
    const { signatureSpellsFor } = await import('../src/modules/character-viewer/signatureSpells.ts')
    const psychic = party.thalos.spellCasters.find((c) => c.name === 'Psychic')
    const aero = party.thalos.spellCasters.find((c) => c.name === 'Aeromancer')
    eq(JSON.stringify(signatureSpellsFor(party.thalos, psychic)), JSON.stringify(['Breathe Fire', 'Blazing Bolt', 'Fireball', 'Ice Storm', 'Howling Blizzard']), 'Thalos: cinco magias de assinatura')
    eq(signatureSpellsFor(party.thalos, aero).length, 0, 'Bloco inato não tem assinatura')
    eq(signatureSpellsFor(party.ghan, party.ghan.spellCasters?.[0] ?? { name: 'x', spellcastingType: 'spontaneous' }).length, 0, 'Outro personagem não herda a lista')
    const known = new Set(psychic.spells.flatMap((l) => l.list))
    ok(signatureSpellsFor(party.thalos, psychic).every((n) => known.has(n)), 'Toda assinatura está no repertório do Thalos')
}

// Tratar Ferimentos: CDs por proficiência, graus de sucesso e a cura de cada um.
{
    const tw = await import('../src/modules/character-viewer/treatWounds.ts')
    eq(tw.availableOptions(0).length, 0, 'Destreinado em Medicina não trata ferimentos')
    eq(tw.availableOptions(2).map((o) => o.dc).join(','), '15', 'Treinado: só CD 15')
    eq(tw.availableOptions(6).map((o) => o.dc).join(','), '15,20,30', 'Mestre: CD 15, 20 e 30')
    eq(tw.availableOptions(8).map((o) => `${o.dc}+${o.bonus}`).join(','), '15+0,20+10,30+30,40+50', 'Lendário: bônus 0/10/30/50')
    eq(tw.degreeOf(10, 20, 20), 'success', 'Igual à CD é sucesso')
    eq(tw.degreeOf(10, 30, 20), 'critSuccess', 'CD+10 é sucesso crítico')
    eq(tw.degreeOf(10, 19, 20), 'failure', 'Um abaixo da CD é falha')
    eq(tw.degreeOf(10, 10, 20), 'critFailure', 'CD−10 é falha crítica')
    eq(tw.degreeOf(20, 19, 20), 'success', 'd20 natural 20 sobe um grau')
    eq(tw.degreeOf(1, 20, 20), 'failure', 'd20 natural 1 desce um grau')
    const opt20 = tw.TREAT_WOUNDS_OPTIONS[1]
    const good = tw.treatWoundsOutcome({ total: 12 }, 10, opt20)
    ok(good.degree === 'success' && good.dice.count === 2 && good.flat === 10, 'Sucesso na CD 20: 2d8 + 10')
    const crit = tw.treatWoundsOutcome({ total: 12 }, 18, opt20)
    ok(crit.degree === 'critSuccess' && crit.dice.count === 4 && crit.flat === 10, 'Crítico: 4d8 + 10')
    const bad = tw.treatWoundsOutcome({ total: 0 }, 5, opt20)
    ok(bad.degree === 'critFailure' && !bad.dice.heals && bad.flat === 0, 'Falha crítica: 1d8 de dano, sem bônus')
    eq(tw.treatWoundsOutcome({ total: 12 }, 5, opt20).dice, null, 'Falha simples: nada')
    const who = { by: 'T', slug: 't', color: '#E0531F' }
    for (let i = 0; i < 200; i++) {
        const r = rolls.treatWoundsRoll(who, [{ label: 'Medicina', value: 12, kind: 'prof' }], opt20)
        if (!r.roll.free) continue
        const k = r.roll.free.dice.length
        if (r.delta > 0) ok(r.delta === r.roll.free.total && r.roll.free.flat === 10 && (k === 2 || k === 4), 'Cura rolada fecha com o delta')
        else ok(r.delta === -r.roll.free.total && k === 1 && r.roll.free.flat === 0, 'Dano da falha crítica fecha com o delta')
    }
        const o20 = tw.TREAT_WOUNDS_OPTIONS[1]
        const who2 = { by: 'T', slug: 't', color: '#E0531F' }
        eq(tw.healActionCost('battle'), 1, 'Battle Medicine custa 1 ação')
        eq(tw.healActionCost('treat'), 0, 'Tratar Ferimentos não gasta ação (10 minutos)')
        const bm = tw.treatWoundsOutcome({ total: 12 }, 10, o20, { mode: 'battle' })
        ok(bm.dice.heals && !bm.removesWounded, 'Battle Medicine cura mas NÃO tira Ferido')
        const tr = tw.treatWoundsOutcome({ total: 12 }, 10, o20, { mode: 'treat' })
        ok(tr.removesWounded, 'Tratar Ferimentos tira Ferido no sucesso')
        eq(tw.treatWoundsOutcome({ total: 0 }, 5, o20, { mode: 'treat' }).removesWounded, false, 'Falha crítica não tira Ferido')
        eq(tw.treatWoundsOutcome({ total: 12 }, 10, o20, { mode: 'treat', risky: true }).degree, 'critSuccess', 'Risky Surgery: sucesso vira crítico')
        eq(tw.treatWoundsOutcome({ total: 12 }, 10, o20, { mode: 'battle', risky: true }).degree, 'success', 'Risky Surgery não vale no Battle Medicine')
        eq(tw.treatWoundsOutcome({ total: 0 }, 12, o20, { mode: 'treat', risky: true }).degree, 'failure', 'Risky Surgery não salva falha')
        for (let i = 0; i < 200; i++) {
            const r = rolls.treatWoundsRoll(who2, [{ label: 'Medicina', value: 12, kind: 'prof' }], o20, null, { mode: 'treat', hour: true, risky: true })
            const f = r.roll.free
            if (f) ok(f.dice.reduce((n, d) => n + d.value, f.flat) === f.total, 'Parcela em dobro fecha (dados + fixo = total)')
            if (f && r.delta > 0) ok(r.delta === 2 * f.dice.reduce((n, d) => n + d.value, 0) + 20 && r.delta === f.total, 'Cura de 1 hora é o dobro de dados + bônus')
            ok(r.selfDamage >= 1 && r.selfDamage <= 8 && r.roll.damage.total === r.selfDamage, 'Risky Surgery rola 1d8 cortante')
            ok(r.roll.note.length <= 300, 'Nota cabe no feed')
        }
}

// Economia de uma conjuração: tempo de conjuração e o casamento entre rolar e marcar o slot.
{
    const sc = await import('../src/modules/character-viewer/spellCast.ts')
    const t = (x) => JSON.stringify(sc.castTimeOf(x))
    eq(t('Single Action'), '{"kind":"actions","n":1}', 'Single Action = 1 ação')
    eq(t('Two Actions'), '{"kind":"actions","n":2}', 'Two Actions = 2 ações')
    eq(t('Three Actions'), '{"kind":"actions","n":3}', 'Three Actions = 3 ações')
    eq(t('Reaction'), '{"kind":"reaction"}', 'Reaction gasta a reação')
    eq(t('Free Action'), '{"kind":"free"}', 'Ação livre não gasta')
    eq(t('Single Action to Three Actions'), '{"kind":"variable","min":1,"max":3}', 'Ação variável 1 a 3')
    eq(t('Two Actions or Three Actions'), '{"kind":"variable","min":2,"max":3}', 'Ação variável 2 ou 3')
    eq(t('10 minutes'), '{"kind":"long"}', '10 minutos não cabe no turno')
    eq(t('Two Actions to 2 rounds'), '{"kind":"long"}', 'Ação + rodadas é conjuração longa')
    eq(t(undefined), '{"kind":"unknown"}', 'Sem descrição: desconhecido')

    sc.resetCastLedger()
    const T = 1_000_000
    eq(sc.pairCast('Heal', 'roll', T), false, 'Rolar sem marcação paga')
    eq(sc.pairCast('heal', 'mark', T + 5000), true, 'Marcar o slot logo depois é a mesma conjuração (sem repetir)')
    eq(sc.pairCast('Heal', 'mark', T + 6000), false, 'Uma segunda marcação já é outra conjuração')
    eq(sc.pairCast('Heal', 'roll', T + 7000), true, 'Rolar depois de marcar é a mesma conjuração')
    // Duas conjurações rolando e marcando: paga duas, nunca quatro.
    sc.resetCastLedger()
    const paid = [sc.pairCast('Fireball', 'roll', T), sc.pairCast('Fireball', 'roll', T + 1), sc.pairCast('Fireball', 'mark', T + 2), sc.pairCast('Fireball', 'mark', T + 3)].filter((x) => !x).length
    eq(paid, 2, 'Duas conjurações = duas cobranças (rolar+marcar não duplica)')
    sc.resetCastLedger()
    sc.pairCast('Guidance', 'mark', T)
    eq(sc.pairCast('Guidance', 'roll', T + 91_000), false, 'Crédito velho expira e não engole a próxima conjuração')
    sc.resetCastLedger()
}

// Reações do Shield Block: com o Quick Shield Block a extra (só dele) vai primeiro.
{
    const none = acts.NO_ACTIONS
    eq(acts.blockReactionSource(none, true), 'shield', 'Quick Shield Block: a reação extra paga o primeiro bloqueio')
    const first = acts.spendBlockReaction(none, true)
    ok(first.stored.shieldReacted && !first.stored.reacted, 'O primeiro bloqueio não toca a reação normal')
    const second = acts.spendBlockReaction(first.stored, true)
    eq(second.source, 'normal', 'O segundo bloqueio sai da reação normal')
    ok(second.stored.reacted && second.stored.shieldReacted, 'Depois dos dois bloqueios, as duas estão gastas')
    eq(acts.spendBlockReaction(second.stored, true).source, 'none', 'Sem reação sobrando: avisa, não impede')
    eq(acts.blockReactionSource(none, false), 'normal', 'Sem o talento, o bloqueio gasta a reação normal')
    eq(acts.blockReactionSource({ ...none, reacted: true }, false), 'none', 'Sem o talento e já reagiu: nenhuma')
    eq(acts.blockReactionSource({ ...none, reacted: true }, true), 'shield', 'Reagiu em outra coisa: a extra ainda cobre o bloqueio')
    ok(!acts.newTurn(1).shieldReacted && !acts.newTurn(1).reacted, 'Turno novo devolve as duas reações')
    ok(acts.sanitizeActions({ used: 1, shieldReacted: true }).shieldReacted, 'A reação extra sobrevive à mesa')
    ok(!acts.isActionsEmpty({ ...none, shieldReacted: true }), 'Reação extra gasta não é estado vazio')
}

// Atividades de talentos: o custo vem da AON (pacotes de descrição), não de catálogo.
{
    const act = await import('../src/modules/character-viewer/activities.ts')
    const sc = await import('../src/modules/character-viewer/spellCast.ts')
    const bundle = (slug) => JSON.parse(readFileSync(new URL(`../public/descriptions/${slug}.json`, import.meta.url), 'utf8')).entries
    const bruk = bundle('brukuthur-the-barbarian-android')
    const info = (entries, name) => act.activityOf(name, entries.feat[name] ?? entries.special[name])
    const lbl = (i) => (i ? act.costLabel(i) : null)
    eq(lbl(info(bruk, 'Sudden Charge')), '2 ações', 'Sudden Charge: 2 ações')
    ok(info(bruk, 'Sudden Charge').includesStrike, 'Sudden Charge inclui um Golpe')
    eq(lbl(info(bruk, 'Terrifying Howl')), '1 ação', 'Terrifying Howl: 1 ação')
    ok(!info(bruk, 'Terrifying Howl').includesStrike, 'Terrifying Howl não inclui Golpe')
    eq(lbl(info(bruk, 'Quick Reversal')), '1 ação', 'Quick Reversal: 1 ação (inclui 2 Golpes)')
    ok(!info(bruk, 'Flip').includesStrike, 'Reação com Golpe não deixa Golpe pago (o Golpe da reação é outro caminho)')
    eq(info(bruk, 'Rage'), null, 'Rage tem caminho próprio (RageBar)')
    eq(info(bruk, 'Rewrite Fate'), null, 'Rewrite Fate é o ✦ dos diálogos')
    eq(info(bruk, 'Divert Destiny'), null, 'Divert Destiny tem caminho próprio')
    eq(info(bruk, 'Toughness'), null, 'Talento passivo não ganha botão')
    eq(info(bruk, 'Godspeed'), null, 'Godspeed tem a faixa mítica própria')
    eq(act.activityOf('Nimble Dodge', { actions: 'Reaction', traits: ['Rogue'], description: 'x' }).time.kind, 'reaction', 'Nimble Dodge gasta a reação')
    eq(act.activityOf('Kip Up', { actions: 'Free Action', traits: [], description: 'x' }), null, 'Ação livre sem ponto nem limite não ganha botão')
    ok(act.activityOf('Ex', { actions: 'Free Action', traits: [], description: 'x', frequency: 'uma vez por dia' }).daily, 'Ação livre diária ganha botão')
    ok(act.spendsMythicPoint({ traits: ['Mythic'], description: 'Gaste um Ponto Mítico; ...' }), 'Reconhece "Gaste um Ponto Mítico"')
    ok(act.spendsMythicPoint({ traits: ['Mythic'], description: 'Spend a Mythic Point to cast' }), 'Reconhece "Spend a Mythic Point"')
    ok(!act.spendsMythicPoint({ traits: ['Fighter'], description: 'Gaste um Ponto Mítico' }), 'Sem o traço Mythic não é talento mítico')
    // O Golpe que a atividade pagou: só o PRÓXIMO Golpe não cobra, e o crédito expira.
    sc.resetCastLedger()
    const T0 = 5_000_000
    eq(sc.takePrepaidStrike(T0), false, 'Sem atividade, o Golpe cobra')
    sc.prepayStrike(T0)
    ok(sc.hasPrepaidStrike(T0 + 1000), 'Há um Golpe pago')
    eq(sc.takePrepaidStrike(T0 + 1000), true, 'O primeiro Golpe depois da atividade não cobra')
    eq(sc.takePrepaidStrike(T0 + 2000), false, 'O segundo já cobra')
    sc.prepayStrike(T0)
    eq(sc.takePrepaidStrike(T0 + 120_000), false, 'O Golpe pago expira em 90 s')
    sc.resetCastLedger()
}

// ✦ estrito: cada contexto só oferece o ponto se um talento da ficha permitir.
{
    const mu = await import('../src/modules/character-viewer/mythicUse.ts')
    const sk = await import('../src/modules/character-viewer/skillActions.ts')
    const opt = (who, ctx) => mu.mythicOptionFor(party[who], ctx)?.feat ?? null
    // Golpe: só com Mythic Strike (Ceros, Eldarion, Ghan).
    for (const who of ['ceros', 'eldarion', 'ghan']) eq(opt(who, 'strike'), 'Mythic Strike', `${who}: ✦ no Golpe pelo Mythic Strike`)
    for (const who of ['brukuthur', 'nathaniel', 'thalos']) eq(opt(who, 'strike'), null, `${who}: sem Mythic Strike, sem ✦ no Golpe`)
    // Ataque de magia nunca (Mythic Magic já é mítico).
    for (const who of Object.keys(party)) eq(opt(who, 'spell-attack'), null, `${who}: sem ✦ no ataque de magia`)
    // Perícia e salvaguarda: Rewrite Fate, todo mundo tem.
    for (const who of Object.keys(party)) eq(opt(who, 'check'), 'Rewrite Fate', `${who}: ✦ nos testes pelo Rewrite Fate`)
    // Iniciativa e Sense Motive: Ears (Brukuthur, Ghan, Nathaniel), os outros caem no Rewrite Fate.
    for (const who of ['brukuthur', 'ghan', 'nathaniel']) eq(opt(who, 'initiative'), 'Ears that Hear the Truth', `${who}: ✦ da Percepção de iniciativa é o Ears`)
    for (const who of ['ceros', 'eldarion', 'thalos']) eq(opt(who, 'initiative'), 'Rewrite Fate', `${who}: sem Ears, a iniciativa cai no Rewrite Fate`)
    eq(opt('eldarion', 'jump'), 'Feet that Stride the Sky', 'Eldarion: ✦ no salto pelo Feet')
    eq(opt('ceros', 'swim'), 'Arms that Cut the Waves', 'Ceros: ✦ na natação pelo Arms')
    eq(opt('ghan', 'jump'), 'Rewrite Fate', 'Ghan: salto sem Feet cai no Rewrite Fate')
    // Seletor de ação de perícia.
    const find = (en, id) => sk.skillActionsFor(en).find((a) => a.id === id)
    eq(find('Intimidation', 'demoralize')?.actions, 1, 'Demoralize: 1 ação')
    eq(find('Athletics', 'high-jump')?.actions, 2, 'High Jump: 2 ações')
    eq(find('Athletics', 'high-jump')?.mythic, 'jump', 'High Jump libera o ✦ do salto')
    eq(find('Thievery', 'lock')?.actions, 2, 'Pick a Lock: 2 ações')
    eq(sk.skillActionsFor('Warfare Lore').map((a) => a.id).join(), 'recall', 'Saber: Recall Knowledge')
    eq(sk.skillActionsFor('Fortitude').length, 0, 'Salvaguarda não é ação de perícia')
    // Unbelievably Believable (Loki, Arton 1515): ✦ em Mentir, Causar Impressão, Pedir e Coletar Informações.
    const loki = parseCharacterJson(JSON.parse(readFileSync(new URL('../public/characters/loki7.json', import.meta.url))))
    eq(mu.mythicOptionFor(loki, 'influence')?.feat, 'Unbelievably Believable', 'Loki: ✦ de influência pelo Unbelievably Believable')
    eq(mu.mythicOptionFor(loki, 'initiative')?.feat, 'Ears that Hear the Truth', 'Loki: ✦ da iniciativa pelo Ears')
    eq(opt('thalos', 'influence'), 'Rewrite Fate', 'Thalos: sem o talento, influência cai no Rewrite Fate')
    for (const [en, id] of [['Deception', 'lie'], ['Diplomacy', 'request'], ['Diplomacy', 'make-impression'], ['Diplomacy', 'gather-information']]) {
        eq(find(en, id)?.mythic, 'influence', `${id} libera o ✦ de influência`)
    }
    eq(find('Diplomacy', 'make-impression')?.actions, 0, 'Make an Impression não gasta ação (1 minuto)')
    eq(find('Diplomacy', 'request')?.actions, 1, 'Request continua custando 1 ação')
}

// Talentos míticos do turno: quem tem o quê, e o Godspeed (Acelerado + 3 m).
{
    const mf = await import('../src/modules/character-viewer/mythicFeats.ts')
    const names = (who) => mf.mythicFeatsOf(party[who]).map((f) => f.id).join(',')
    eq(names('thalos'), 'correct-the-story,arc-of-destruction,become-destiny,weve-met-before', 'Thalos: Correct, Arc, Become Destiny e We\'ve Met Before')
    eq(names('nathaniel'), 'godspeed', 'Nathaniel: só o Godspeed')
    eq(names('brukuthur'), 'godspeed,correct-the-story', 'Brukuthur: Godspeed e Correct the Story')
    eq(names('ghan'), 'correct-the-story', 'Ghan: Correct the Story')
    const base = computeConditionModifiers({}, 10)
    eq(mf.withGodspeed(base, true).total.speed - base.total.speed, 10, 'Godspeed soma 10 pés de status')
    eq(mf.withGodspeed(base, false), base, 'Godspeed desligado não mexe nos modificadores')
    const quick = computeConditionModifiers(mf.godspeedConditions(true), 10)
    ok(acts.actionBudget(quick).quick, 'Godspeed liga o Acelerado: a faixa de Ações ganha a ação extra')
    ok(!acts.actionBudget(base).quick, 'Sem Godspeed, sem ação extra')
    eq(JSON.stringify(mf.MYTHIC_FEATS.find((f) => f.id === 'correct-the-story').info.time), '{"kind":"reaction"}', 'Correct the Story gasta a reação')
}

// Regra compartilhada com a mesa: os DOIS sanitizadores aceitam e recusam o mesmo.
{
    const shares = await import('../src/services/tableShare.ts')
    const good = {
        id: 'abc-123', at: 1, by: 'Thalos', slug: 'thalos', color: '#336699', type: 'spell', name: 'Fireball', level: 5,
        caster: { name: 'Psychic', dc: 29, attack: 19, tradition: 'occult' },
    }
    const both = (s) => [shares.sanitizeTableShare(s), server.sanitizeShare(s)]
    for (const out of both(good)) {
        eq(out?.level, 5, 'compartilhamento: rank da magia')
        eq(out?.caster?.dc, 29, 'compartilhamento: CD de quem conjura')
    }
    for (const out of both({ ...good, type: 'item' })) {
        ok(out && out.level === undefined && out.caster === undefined, 'item não leva rank nem conjurador')
    }
    for (const out of both({ ...good, caster: { name: 'X', dc: 500, attack: 1 } })) {
        ok(out && out.caster === undefined, 'conjurador inválido sai, o compartilhamento fica')
    }
    for (const out of both({ ...good, level: 31 })) ok(out && out.level === undefined, 'rank fora da faixa sai')
    const badShares = [
        ['tipo desconhecido', { ...good, type: 'weapon' }],
        ['nome vazio', { ...good, name: '  ' }],
        ['nome com quebra de linha', { ...good, name: 'Fire\nball' }],
        ['nome com 121 caracteres', { ...good, name: 'x'.repeat(121) }],
        ['cor que não é hex', { ...good, color: 'red' }],
        ['id com maiúscula', { ...good, id: 'ABC' }],
    ]
    for (const [why, s] of badShares) {
        ok(shares.sanitizeTableShare(s) === null, `cliente recusa o compartilhamento: ${why}`)
        ok(server.sanitizeShare(s) === null, `servidor recusa o compartilhamento: ${why}`)
    }
}

// ── O tamanho que o Pathbuilder lista entre as características não vira habilidade ──
{
    const base = normalizeBuild({ name: 'T', level: 1, specials: ['Medium', 'Spellstrike', 'Large'], spellCasters: [], weapons: [] })
    eq(base.specials.join(','), 'Spellstrike', 'tamanho ("Medium", "Large") sai das habilidades — na AON, "Medium" é a classe do médium')
}

// ── Pool de foco pela regra do Remaster: uma magia de foco = um ponto, até 3; truque de foco não conta ──
{
    const pool = (file) => normalizeBuild(load(file)).focusPoints
    eq(pool('loki7'), 2, 'Loki: 2 Pontos de Foco (Force Fang e Dimensional Assault; o Pathbuilder exporta 3)')
    eq(pool('nathaniel10'), 3, 'Nathaniel: 3 Pontos de Foco (três magias de foco)')
    eq(pool('cerosqualhanthallas10'), 3, 'Ceros: 3 Pontos de Foco (quatro magias, teto 3)')
    eq(pool('thalos10'), 3, 'Thalos: o pool do Psíquico vem da classe e fica como exportado')
}

// ── Loki (Arton 1515): psi cantrips do arquétipo, Spellstrike com eles e Laughing Shadow ──
{
    const loki = load('loki7')
    const { collectFocusSpells } = await import('../src/modules/character-viewer/spellNames.ts')
    const magusMod = await import('../src/modules/character-viewer/magus.ts')
    // Quem amplifica: o Psíquico e quem tem o Psi Development (o Loki); a dedicação sozinha não dá o amp.
    ok(amps.canAmpPsiCantrips(loki), 'Loki amplifica (Psi Development)')
    ok(amps.canAmpPsiCantrips(party.thalos), 'Thalos amplifica (Psíquico)')
    ok(!amps.canAmpPsiCantrips(party.nathaniel), 'Nathaniel não amplifica')
    // Truque de foco é truque: conjurar não gasta ponto. Magia de foco gasta.
    const focus = Object.fromEntries(collectFocusSpells(loki).map((e) => [e.name, e.cantrip]))
    eq(focus['Imaginary Weapon'], true, 'Imaginary Weapon é truque de foco')
    eq(focus['Dimensional Assault'], false, 'Dimensional Assault é magia de foco')
    ok(collectFocusSpells(party.thalos).every((e) => e.cantrip), 'os psi cantrips do Thalos são todos truques')
    // Amps da The Tangible Dream, no rank 4 (nível 7).
    const f = (name, rank) => amps.psiAmpFor(name).damage(rank, true).map((a) => `${a.count}d${a.faces} ${a.type}`).join(' + ')
    eq(f('Imaginary Weapon', 4), '8d6 force', 'Imaginary Weapon amplificada no rank 4: 2d6 + 2d6 por rank acima')
    eq(f('Imaginary Weapon', 1), '2d6 force', 'Imaginary Weapon amplificada no rank 1')
    eq(amps.psiAmpFor('Shield (Archetype)')?.name, 'Shield', 'a marca (Archetype) do Pathbuilder some')
    ok(amps.psiAmpFor('Shield').notes(4).some((n) => n.includes('Dureza 15') && n.includes('Dureza 20') && n.includes('normal é 10')), 'Shield amplificado no rank 4: Dureza 10, 15 com duas camadas, 20 com três')
    // Spellstrike: os truques de foco entram, com a CD do grupo de foco (10 + nível 7 + treinado 2 + CAR 3 = 22).
    const opts = spellstrike.spellstrikeOptions(loki, () => 0)
    const iw = opts.find((o) => o.name === 'Imaginary Weapon')
    eq(iw?.kind, 'cantrip', 'Imaginary Weapon entra no Spellstrike como truque')
    eq(iw?.rank, 4, 'no rank 4')
    eq(iw?.focus?.dc, 22, 'com a CD do grupo de foco')
    eq(iw?.focus?.psychic, true, 'e marcado como psi cantrip (dá o amp)')
    ok(!opts.some((o) => o.name === 'Dimensional Assault'), 'magia de foco não entra pela lista de truques')
    ok(opts.some((o) => o.name === 'Needle Darts' && o.caster === 'Magus'), 'os truques do bloco do Magus seguem lá')
    ok(!spellstrike.spellstrikeOptions(party.nathaniel, () => 0).some((o) => o.focus), 'Nathaniel: nenhum truque de foco a mais')
    // Laughing Shadow: dano da postura 5 com Weapon Specialization, só em Arcane Cascade e com o chip.
    eq(magusMod.laughingShadowDamage(loki), 5, 'Laughing Shadow com Weapon Specialization: 5')
    const cascading = { ...NO_MODIFIERS, cascade: { damage: 2, type: 'force' } }
    eq(magusMod.withLaughingShadow(cascading, loki, true).cascade.damage, 5, 'alvo desprevenido e mão livre: postura vai a 5')
    eq(magusMod.withLaughingShadow(cascading, loki, false).cascade.damage, 2, 'sem o chip, os 2 de sempre')
    ok(magusMod.withLaughingShadow(NO_MODIFIERS, loki, true).cascade === undefined || !magusMod.withLaughingShadow(NO_MODIFIERS, loki, true).cascade, 'fora da postura, nada')
    eq(magusMod.withLaughingShadow(cascading, party.nathaniel, true).cascade.damage, 2, 'Nathaniel (Sparkling Targe) não tem o bônus')
    // Economia do Magus na conjuração: confluência recarrega o Spellstrike; a que inclui um Golpe o deixa pago.
    const sc = await import('../src/modules/character-viewer/spellCast.ts')
    const bundle = (slug) => JSON.parse(readFileSync(new URL(`../public/descriptions/${slug}.json`, import.meta.url))).entries.spell
    const lokiSpells = bundle('loki'), natSpells = bundle('nathaniel-o-magus')
    for (const n of ['Dimensional Assault', 'Force Fang']) ok(sc.isConfluxSpell(lokiSpells[n].traits), `${n} é confluência (recarrega o Spellstrike)`)
    for (const n of ['Shielding Strike', 'Runic Impression']) ok(sc.isConfluxSpell(natSpells[n].traits), `${n} é confluência`)
    ok(!sc.isConfluxSpell(natSpells['Hand of the Apprentice'].traits), 'Hand of the Apprentice (foco de Mago) não recarrega')
    ok(!sc.isConfluxSpell(lokiSpells['Imaginary Weapon'].traits), 'psi cantrip não é confluência')
    ok(sc.spellIncludesStrike('Dimensional Assault') && sc.spellIncludesStrike('Shielding Strike'), 'Dimensional Assault e Shielding Strike incluem o Golpe')
    ok(!sc.spellIncludesStrike('Force Fang'), 'Force Fang não inclui Golpe (o dano é automático)')
    ok(magusMod.isStudiousSpell(loki, 'Blur') && magusMod.isStudiousSpell(loki, 'Gecko Grip'), 'Loki: Blur e Gecko Grip são estudiosas')
    ok(magusMod.isStudiousSpell(party.nathaniel, 'Resist Energy'), 'Nathaniel: Resist Energy é estudiosa')
    ok(!magusMod.isStudiousSpell(loki, 'Haste'), 'Haste só vira estudiosa no nível 11')
}

// ── Diário da sessão: as contas por personagem e os destaques ─────────────────
{
    const diary = await import('../src/modules/session-diary/stats.ts')
    const { diaryDayOf } = await import('../src/services/diary.ts')
    const server = await import('../api/_lib/roll-store.js')
    const check = (d20, mod, mythic = false) => ({ d20, mod, total: d20 + mod, mythic, parts: [] })
    const dmg = (total) => ({ parts: [{ label: 'x', dice: [], flat: total, total }], total })
    const roll = (id, by, slug, extra) => ({ id, at: 1, by, slug, color: '#2F7D46', title: `T${id}`, ...extra })
    const rolls = [
        roll('a', 'Thalos Alba', 'thalos', { check: check(20, 12), damage: dmg(30) }),
        roll('b', 'Thalos Alba', 'thalos', { check: check(1, 12, true) }),
        // Blazing Bolt de 3 raios: três testes, um ✦ só, o dano somado.
        roll('c', 'Thalos Alba', 'thalos', { rays: [
            { check: check(20, 15, true), damage: dmg(10) },
            { check: check(5, 15, true), damage: dmg(12) },
            { check: check(20, 15, true), damage: dmg(8) },
        ] }),
        roll('d', 'Ghan Buri', 'ghan-buri', { check: check(14, 20), damage: dmg(45) }),
        roll('e', 'Mestre', undefined, { free: { label: '1d20', dice: [{ faces: 20, value: 1 }], flat: 0, total: 1 } }),
        roll('f', ' mestre ', undefined, { check: check(1, 0) }),
    ]
    const people = diary.personStats(rolls)
    const thalos = people.find((p) => p.key === 'thalos')
    eq(people.length, 3, 'diário: Thalos, Ghan Buri e o Mestre (o nome livre ignora caixa e espaços)')
    eq(thalos.rolls, 3, 'diário: 3 rolagens do Thalos')
    eq(thalos.checks, 5, 'diário: cada raio conta como um teste')
    eq(thalos.nat20, 3, 'diário: 20 naturais do Thalos (um no teste, dois nos raios)')
    eq(thalos.nat1, 1, 'diário: 1 natural do Thalos')
    eq(thalos.mythic, 2, 'diário: ✦ é um por rolagem, não por raio')
    eq(thalos.damage, 60, 'diário: dano rolado = 30 + raios 10+12+8')
    eq(thalos.biggestHit.total, 30, 'diário: o maior dano do Thalos é o golpe, não um raio')
    eq(diary.d20Average(thalos), 13.2, 'diário: média do d20 do Thalos (20+1+20+5+20)/5')
    eq(people.find((p) => p.name === 'Mestre').checks, 1, 'diário: a rolagem livre não é teste de d20')
    const best = diary.highlights(people)
    eq(best.mostNat20?.name, 'Thalos Alba', 'diário: mais 20 naturais')
    eq(best.mostNat1, null, 'diário: empate em 1 naturais (Thalos 1 × Mestre 1) não elege ninguém')
    eq(best.biggestHit?.total, 45, 'diário: maior dano é o do Ghan Buri')
    eq(best.bestCheck?.total, 35, 'diário: maior teste é o raio de 20+15')
    // O dia de jogo vai das 6h às 6h em Brasília — igual no cliente e no servidor (fallback em memória).
    const at = (iso) => Date.parse(iso)
    eq(diaryDayOf(at('2026-10-18T02:30:00-03:00')), '2026-10-17', 'diário: 2h30 da madrugada ainda é a sessão da noite anterior')
    eq(diaryDayOf(at('2026-10-18T06:30:00-03:00')), '2026-10-18', 'diário: 6h30 já é outro dia')
    ok(server.DAY_RE.test('2026-10-17') && !server.DAY_RE.test('17/10/2026'), 'diário: o servidor só aceita YYYY-MM-DD')
}

// ── Investigador: Devise a Stratagem e Strategic Strike ─────────────────────
{
    const miranda = load('miranda7')
    const cane = miranda.weapons.find((w) => w.name === 'Sword Cane')
    const caneGear = { kind: 'weapon', traits: ['Agile', 'Concealable', 'Finesse'], weaponType: 'melee' }
    const caneStrike = strikes.weaponStrike(miranda, cane, caneGear)
    const stratagem = { [investigator.STRATAGEM_KEY]: true }
    const off = strikes.planStrike(miranda, caneStrike, NO_MODIFIERS, opts())
    const onPlan = strikes.planStrike(miranda, caneStrike, NO_MODIFIERS, opts({ extrasOn: stratagem }))
    eq([1, 4, 5, 8, 9, 13, 17, 20].map(investigator.strategicStrikeDice).join(','), '1,1,2,2,3,4,5,5', 'Strategic Strike: +1 dado nos níveis 5, 9, 13 e 17')
    ok(off.stratagem === null && !off.extras.some((e) => e.key === 'strategic-strike'), 'Sem o estratagema não há Strategic Strike')
    eq(onPlan.stratagem?.dice, 2, 'Miranda (nível 7) rola 2d6 de Strategic Strike')
    const strike = onPlan.extras.find((e) => e.key === 'strategic-strike')
    ok(strike && strike.precision && strike.expr.groups[0].count === 2 && strike.expr.groups[0].faces === 6, 'Strategic Strike é precisão 2d6')
    eq(onPlan.attackTotal, off.attackTotal, 'INT = DES na Miranda: o ataque do estratagema fecha com a ficha (15)')
    eq(off.attackTotal, cane.attack, 'Sword Cane: o ataque sem estratagema é o do Pathbuilder')
    const critRoll = strikes.rollStrikeDamage(onPlan, 'perfurante')
    const sneak = critRoll.parts.find((p) => /precis/i.test(p.label))
    ok(sneak && sneak.rolled.dice.length === 2, 'A precisão do estratagema rola 2 dados')
    // INT mais alta que a DES: o estratagema passa a valer INT.
    const smarter = { ...miranda, abilities: { ...miranda.abilities, int: 20 } }
    const smarterStrike = strikes.weaponStrike(smarter, cane, caneGear)
    eq(strikes.planStrike(smarter, smarterStrike, NO_MODIFIERS, opts({ extrasOn: stratagem })).attackTotal,
        strikes.planStrike(smarter, smarterStrike, NO_MODIFIERS, opts()).attackTotal + 1, 'INT 20 (+5) contra DES 18 (+4): +1 no estratagema')
    // Arma sem ágil nem acuidade: o d20 vale, mas sem INT nem Strategic Strike.
    const heavyStrike = strikes.weaponStrike(miranda, cane, { kind: 'weapon', traits: ['Shove'], weaponType: 'melee' })
    const heavy = strikes.planStrike(miranda, heavyStrike, NO_MODIFIERS, opts({ extrasOn: stratagem }))
    ok(heavy.stratagem === null && heavy.warnings.some((w) => /Devise a Stratagem/.test(w)), 'Arma pesada: sem INT, sem Strategic Strike e com aviso')
    // À distância qualquer arma serve; sem traços conhecidos não dá para afirmar.
    ok(investigator.stratagemQualifies({ known: true, ranged: true, agile: false, finesse: false }), 'Arma à distância soma INT')
    ok(!investigator.stratagemQualifies({ known: false, ranged: false, agile: false, finesse: false }), 'Sem traços da AON, não afirma')
    // Quem não é Investigador não ganha nada, mesmo com a chave ligada.
    const ghanPlan = strikes.planStrike(party.ghan, ghanStrike, NO_MODIFIERS, opts({ extrasOn: stratagem }))
    ok(ghanPlan.stratagem === null && ghanPlan.warnings.length === 0, 'Ghan Buri não tem Devise a Stratagem')
    eq(investigator.stratagemCost({}), 1, 'Devise a Stratagem custa 1 ação')
    eq(investigator.stratagemCost({ [investigator.LEAD_KEY]: true }), 0, 'Com investigação ativa sobre o alvo é ação livre')
    // Godless Healing: +5 PV na cura EM SI MESMA, e a soma fecha para o servidor.
    const medicine = checks.skillCheck(miranda, 'medicine', NO_MODIFIERS)
    const wholeOpt = { dc: 30, minRank: 6, bonus: 30, label: 'Mestre' }
    const heal = (godless) => {
        for (let i = 0; i < 40; i++) {
            const out = rolls.treatWoundsRoll(rolls.rollerIdentity(miranda), medicine.parts, wholeOpt, null, { mode: 'battle', godless })
            if (out.delta > 0) return out
        }
        return null
    }
    const plain = heal(false), godly = heal(true)
    ok(plain && godly && godly.roll.free.label.includes('Godless') && !plain.roll.free.label.includes('Godless'), 'Godless Healing aparece só quando vale')
    ok(godly && godly.roll.free.total === godly.roll.free.dice.reduce((n, d) => n + d.value, 0) + godly.roll.free.flat, 'Godless Healing: dados + fixo = total')
    ok(godly && godly.roll.free.flat >= 30 + 5, 'Godless Healing soma 5 ao fixo (30 + 5)')
    ok(godly && table.sanitizeTableRoll(godly.roll) !== null && server.sanitizeRoll(godly.roll) !== null, 'Godless Healing: cliente e servidor aceitam a rolagem')
    const stratRoll = rolls.strikeRoll(rolls.rollerIdentity(miranda), caneStrike, onPlan, null)
    ok(table.sanitizeTableRoll(stratRoll) !== null && server.sanitizeRoll(stratRoll) !== null, 'Golpe com Strategic Strike: cliente e servidor aceitam')
    ok(treatWoundsMod.hasGodlessHealing(miranda) && !treatWoundsMod.hasGodlessHealing(party.ghan), 'Só a Miranda tem Godless Healing')
    // Investigações: no máximo duas; cheia, a troca manda a abandonada para a lista do dia.
    const inv0 = investigator.NO_INVESTIGATOR
    const inv1 = investigator.openLead(inv0, 'Quem matou o sacerdote?', null, 'a')
    const inv2 = investigator.openLead(inv1, 'O quadro sumiu', null, 'b')
    eq(inv2.leads.length, 2, 'Duas investigações abertas')
    eq(investigator.openLead(inv2, 'Terceira', null, 'c').leads.length, 2, 'Cheia sem dizer qual abandonar: nada muda')
    const swapped = investigator.openLead(inv2, 'Terceira', 'a', 'c')
    ok(swapped.leads.map((l) => l.id).join() === 'b,c' && investigator.isDropped(swapped, 'QUEM matou o sacerdote?'), 'Trocar abandona a escolhida e a marca do dia')
    eq(investigator.sanitizeInvestigator({ leads: [{ id: 'x', name: ' A ' }, { name: 'B' }, { name: 'C' }], pursuedAt: 'lixo' }).leads.length, 2, 'O estado da mesa guarda no máximo duas')
    eq(investigator.sanitizeInvestigator('lixo'), investigator.NO_INVESTIGATOR, 'Estado inválido vira vazio')
    ok(investigator.isInvestigatorEmpty(investigator.NO_INVESTIGATOR) && !investigator.isInvestigatorEmpty(inv1), 'Vazio só sem nada')
    eq(investigator.cooldownLeft(1000, 1000 + investigator.COOLDOWN_MS - 5000), 5000, 'Relógio de 10 minutos: faltam 5 s')
    eq(investigator.cooldownLeft(1000, 1000 + investigator.COOLDOWN_MS + 1), 0, 'Passados os 10 minutos não falta nada')
    eq(investigator.clock(581_000), '9:41', 'Relógio mostra minutos e segundos')
    // O bônus: +1 da investigação, +1 do estratagema de perícia (que, com a investigação, sobe o bônus dela).
    const sumOf = (parts) => parts.reduce((n, p) => n + p.value, 0)
    eq(sumOf(investigator.investigationParts(true, false)), 1, 'Investigação ativa: +1')
    eq(sumOf(investigator.investigationParts(false, true)), 1, 'Estratagema de perícia sozinho: +1')
    eq(sumOf(investigator.investigationParts(true, true)), 2, 'Investigação + estratagema de perícia: +2')
    ok(investigator.investigationEligible('Perception', null) && investigator.investigationEligible('Occultism', 'int') && !investigator.investigationEligible('Athletics', 'str'), 'O +1 vale em Percepção e perícias de INT/SAB/CAR, não em Atletismo')
    ok(investigator.investigationEligible('Planar Lore', null), 'Saberes valem')
    ok(investigator.readinessApplies(miranda, true) && !investigator.readinessApplies(miranda, false) && !investigator.readinessApplies(party.ghan, true), "Detective's Readiness: só salvaguarda e só com o talento")
    // Assurance e Keen Recollection.
    eq(investigator.assuranceResult(miranda, 'Medicine', 6)?.total, 23, 'Assurance em Medicina (mestre, nível 7) = 10 + 13')
    eq(investigator.assuranceResult(miranda, 'Stealth', 2), null, 'Assurance só na perícia escolhida')
    eq(investigator.assuranceResult(miranda, 'Medicine', 0), null, 'Assurance exige treinado')
    eq(investigator.keenRecollectionBonus(miranda, 0), 7, 'Keen Recollection: destreinada soma o nível')
    eq(investigator.keenRecollectionBonus(miranda, 2), 0, 'Keen Recollection não mexe em treinada')
    eq(investigator.keenRecollectionBonus(party.ghan, 0), 0, 'Quem não tem o talento não ganha')
    const assured = rolls.assuranceRoll(rolls.rollerIdentity(miranda), 'Medicina', 13)
    ok(assured.check.d20 === 10 && assured.check.total === 23 && table.sanitizeTableRoll(assured) !== null && server.sanitizeRoll(assured) !== null, 'Assurance fecha d20 + modificador = total e passa nos dois validadores')
    const assuredHeal = rolls.treatWoundsRoll(rolls.rollerIdentity(miranda), medicine.parts, wholeOpt, null, { mode: 'battle', assurance: 13 })
    ok(assuredHeal.roll.check.total === 23 && /Assurance/.test(assuredHeal.roll.sub), 'Battle Medicine com Assurance usa o 23 fixo')
    // Curas que são ação: Searing Restoration e Healer's Touch.
    eq([2, 3, 4, 5, 7, 9].map(healActs.searingRestorationDice).join(','), '1,2,2,3,4,5', 'Searing Restoration: +1d10 no 3º nível e a cada 2 depois')
    const searing = healActs.featHeal(miranda, 'Searing Restoration')
    ok(searing && searing.formula === '4d10' && searing.unstable && !searing.daily, 'Miranda cura 4d10 com a Searing Restoration (Unstable)')
    eq(healActs.featHeal(party.ghan, 'Searing Restoration'), null, 'Quem não tem o talento não ganha a cura')
    eq(healActs.itemHeal("Healer's Gloves")?.formula, '2d6+7', "Healer's Touch: 2d6+7")
    eq(healActs.itemHeal("Healer's Gloves (Greater)")?.formula, '4d6+15', 'Greater: 4d6+15')
    ok(healActs.itemHeal("Healer's Gloves").daily && healActs.itemHeal('Longsword') === null, "Healer's Touch é 1×/dia e só nas luvas")
    eq(healActs.unstableDc(miranda), 15, 'Unstable: CD 15')
    eq(healActs.unstableDc({ ...miranda, proficiencies: { ...miranda.proficiencies, crafting: 8 } }), 13, 'Ofício lendário: CD 13')
    eq([15, 14, 6, 5, 1, 20].map((d) => healActs.unstableOutcome(d, 15)).join(), 'success,failure,failure,critFailure,critFailure,success', 'Teste simples: passa com 15; falha crítica com 5 ou menos')
    eq(healActs.unstableBurn(7), 3, 'Falha crítica: fogo igual à metade do nível')
    const healed = rolls.healRoll(rolls.rollerIdentity(miranda), 'Searing Restoration', 'Cura 4d10', dice.rollGroups([{ count: 4, faces: 10 }], 0))
    ok(table.sanitizeTableRoll(healed) !== null && server.sanitizeRoll(healed) !== null, 'A cura-ação passa nos dois validadores')
    // Itens: resistência do Arachnid Harness e a ativação diária; Tamper só para quem o tem.
    const normalized = normalizeBuild(miranda)
    ok(normalized.resistances.includes('poison 2'), 'Arachnid Harness vestido dá resistência 2 a veneno')
    eq(normalizeBuild(normalized).resistances.filter((r) => r === 'poison 2').length, 1, 'A resistência do item não duplica')
    eq((normalizeBuild(party.ghan).resistances ?? []).length, (party.ghan.resistances ?? []).length, 'Quem não usa o item não ganha resistência')
    ok(itemActs.itemActivityOf('Arachnid Harness')?.daily === true && itemActs.itemActivityOf('Steel Shield') === null, 'Arachnid Harness: 1 ação, 1×/dia')
    ok(skillActs.skillActionsFor('Crafting', miranda).some((a) => a.id === 'tamper') && !skillActs.skillActionsFor('Crafting', party.ghan).some((a) => a.id === 'tamper'), 'Tamper só aparece para quem tem o talento')
    ok(tableStore.isValidField('investigator'), 'O campo investigator é aceito pelo estado da mesa')
    // Miranda's Arm: a relíquia é o braço (Braço Sônico); Scrap Shot e Dragon Strike.
    const armRelics = relics.relicsOf(miranda)
    ok(armRelics.length === 1 && armRelics[0].on?.weapon === 'Braço Sônico', "Miranda's Arm mora no Braço Sônico")
    eq(relics.relicsOf(party.ghan).length, 0, 'Quem não é a Miranda não tem a relíquia')
    ok(relics.relicGift(miranda, 'scrap-shot') && relics.relicGift(miranda, 'dragon-strike'), 'As duas dádivas estão liberadas no nível 7')
    eq(relics.relicWeaponName(miranda), 'Braço Sônico', 'O braço é a arma da relíquia')
    eq([1, 2, 3, 6, 7, 11, 20].map(relics.scrapShotDice).join(), '1,1,1,3,3,5,10', 'Scrap Shot: 1d6 a cada 2 níveis, mínimo 1d6')
    const armBefore = miranda.weapons.find((w) => w.name === 'Braço Sônico')
    const armAfter = relics.withRelicRunes(miranda).weapons.find((w) => w.name === 'Braço Sônico')
    ok(armAfter.pot === armBefore.pot && armAfter.str === armBefore.str && armAfter.attack === armBefore.attack, 'As runas do braço ficam como o Pathbuilder exportou')
    // O braço tem acuidade (informado pelo jogador) e NÃO é ágil: MAP −5/−10, e o estratagema soma INT.
    const armGear = homebrew.homebrewGear(miranda, 'Braço Sônico')
    ok(armGear && armGear.traits.join() === 'Finesse' && armGear.weaponType === 'melee', 'O Braço Sônico tem acuidade, sem ágil')
    eq(homebrew.homebrewGear(party.ghan, 'Braço Sônico'), null, 'A arma caseira é só da Miranda')
    eq(homebrew.homebrewGear(miranda, 'Sword Cane'), null, 'Arma da AON não é caseira')
    const armStrike = strikes.weaponStrike(miranda, armBefore, armGear)
    ok(armStrike.traits.finesse && !armStrike.traits.agile && armStrike.traits.known, 'Os traços do braço chegam ao Golpe')
    eq(strikes.planStrike(miranda, armStrike, NO_MODIFIERS, opts({ map: 1 })).attackTotal, armBefore.attack - 5, 'Braço: segundo ataque −5 (não é ágil)')
    const armStratagem = strikes.planStrike(miranda, armStrike, NO_MODIFIERS, opts({ extrasOn: { [investigator.STRATAGEM_KEY]: true } }))
    ok(armStratagem.stratagem?.dice === 2 && armStratagem.warnings.length === 0, 'Estratagema no braço: INT e Strategic Strike 2d6, sem aviso')
    // Scrap Shot: 2 ações (AON, Rage of Elements pg. 148); Dragon Strike: 1 ação.
    eq(relics.relicGift(miranda, 'scrap-shot').activation.cost, 2, 'Scrap Shot custa 2 ações')
    eq(relics.relicGift(miranda, 'dragon-strike').activation.cost, 1, 'Dragon Strike custa 1 ação')
    // Arcane Sense: Detect Magic em 1º rank (3º com Arcanismo mestre, 4º com lendário), não o rank automático do truque.
    const senseCaster = miranda.spellCasters[0]
    eq(innate.fixedInnateRank(miranda, senseCaster), 1, 'Arcane Sense: Detect Magic de 1º rank com Arcanismo treinado')
    eq(innate.fixedInnateRank({ ...miranda, proficiencies: { ...miranda.proficiencies, arcana: 6 } }, senseCaster), 3, 'Arcanismo mestre: 3º rank')
    eq(innate.fixedInnateRank({ ...miranda, proficiencies: { ...miranda.proficiencies, arcana: 8 } }, senseCaster), 4, 'Arcanismo lendário: 4º rank')
    eq(innate.fixedInnateRank(party.thalos, party.thalos.spellCasters[0]), null, 'Outro conjurador segue o rank normal do truque')
    const dragonOn = { [strikes.DRAGON_STRIKE_KEY]: true }
    const armPlain = strikes.planStrike(miranda, armStrike, NO_MODIFIERS, opts())
    const armDragon = strikes.planStrike(miranda, armStrike, NO_MODIFIERS, opts({ extrasOn: dragonOn }))
    ok(armDragon.extras.some((e) => e.key === 'dragon-strike' && e.type === 'slashing') && !armPlain.extras.some((e) => e.key === 'dragon-strike'), 'Dragon Strike soma 1d6 cortante só com o chip')
    ok(strikes.dragonStrikeApplies(miranda, armStrike, { mode: 'auto' }), 'Dragon Strike vale no braço')
    ok(!strikes.dragonStrikeApplies(miranda, caneStrike, { mode: 'auto' }), 'A Sword Cane não é desarmada: Dragon Strike não vale')
    const fistStrike = strikes.unarmedStrike(miranda, unarmedAttacks(miranda)[0])
    ok(strikes.dragonStrikeApplies(miranda, fistStrike, { mode: 'auto' }), 'Dragon Strike vale no Punho')
    ok(!strikes.dragonStrikeApplies(party.ghan, strikes.unarmedStrike(party.ghan, unarmedAttacks(party.ghan)[0]), { mode: 'auto' }), 'Quem não tem a relíquia não ganha')
    ok(!strikes.dragonStrikeApplies(miranda, armStrike, { mode: 'thrown' }), 'Arremesso não é Golpe corpo a corpo desarmado')
    const scrap = rolls.scrapShotRoll(rolls.rollerIdentity(miranda), "Miranda's Arm — Scrap Shot", [{ label: 'Ataque de magia', value: 10, kind: 'base' }, { label: 'Alvo de metal', value: 1, kind: 'other' }], 3, undefined, 'nota')
    ok(scrap.damage.parts[0].dice.length === 3 && scrap.damage.crit.total === 2 * scrap.damage.total, 'Scrap Shot rola 3d6 e dobra no crítico')
    ok(table.sanitizeTableRoll(scrap) !== null && server.sanitizeRoll(scrap) !== null, 'Scrap Shot passa nos dois validadores')
    // Loki's Heart: custo e pré-requisito pela AON (Treasure Vault Remastered pg. 199-200).
    const loki = load('loki7')
    const lokiRelic = relics.relicsOf(loki)
    eq(lokiRelic.length, 1, 'O Loki tem a relíquia Loki\'s Heart')
    const sands = lokiRelic[0].gifts.find((g) => g.id === 'sands-of-the-hourglass')
    const whammy = lokiRelic[0].gifts.find((g) => g.id === 'whammy')
    ok(sands.activation.cost === 2 && sands.activation.limited && relics.giftUnlocked(sands, 0, 7), 'Sands of the Hourglass: 2 ações, 1×/hora, liberada no nível 7')
    ok(!relics.giftUnlocked(sands, 0, 4) && relics.giftUnlocked(sands, 0, 5), 'Sands exige relíquia de 5º nível ou mais (pré-requisito da AON)')
    ok(whammy.activation.cost === 'reaction' && whammy.activation.limited, 'Whammy: reação, 1×/dia')
    ok(relics.giftActivity(whammy).time.kind === 'reaction' && relics.giftActivity(sands).time.n === 2, 'O botão cobra a reação e as 2 ações')
    ok(lokiRelic[0].aspects.join() === 'Time,Luck', 'Aspectos Time e Luck')
    eq(relics.relicsOf(miranda).some((r) => r.id === 'loki-heart'), false, 'A relíquia do Loki não vai para a Miranda')
    // ── Hearts Folly (Monge 7) ──
    const hf = load('heartsfolly7')
    // Untrained Improvisation (Player Core pg. 264): o nível inteiro a partir do 7º; salvaguarda e Percepção não mudam.
    const arcanaHf = checks.skillCheck(hf, 'arcana', NO_MODIFIERS)
    eq(arcanaHf.total, 8, 'Arcanismo destreinado com Untrained Improvisation = nível 7 + INT +1')
    eq(arcanaHf.mythicDelta, 10, 'O ✦ desconta a improvisação (nível + 10 − nível)')
    eq(checks.skillCheck(hf, 'athletics', NO_MODIFIERS).total, 7 + 6 + 3, 'Atletismo mestre não muda')
    eq(checks.skillCheck(party.ghan, 'stealth', NO_MODIFIERS).total, abilityMod(party.ghan.abilities.dex), 'Sem o talento, destreinado segue só o atributo')
    const lvl = (n) => ({ ...hf, level: n })
    eq([1, 4, 5, 6, 7, 9].map((n) => checks.untrainedImprovisation(lvl(n))).join(), '0,2,4,5,7,9', 'Improvisação: nível −2, −1 a partir do 5º, inteiro a partir do 7º')
    // Punho do Monge: Powerful Fist (d6) e Weapon Specialization (+2 de perito).
    const hfFist = unarmedMod.unarmedAttacks(hf)[0]
    eq(hfFist.damage, '1d6+5', 'Punho do Monge: 1d6 (Powerful Fist) + FOR 3 + Weapon Specialization 2')
    eq(hfFist.attack, 15, 'Punho do Monge: 7 + perito 4 + DES 4')
    eq(unarmedMod.weaponSpecializationBonus(hf, 4), 2, 'Weapon Specialization: +2 de perito')
    eq(unarmedMod.weaponSpecializationBonus({ ...hf, specials: [...hf.specials, 'Greater Weapon Specialization'] }, 6), 6, 'Greater Weapon Specialization de mestre: +6')
    eq(unarmedMod.weaponSpecializationBonus(party.thalos, 2), 0, 'Treinado não ganha Weapon Specialization')
    const hfFistStrike = strikes.unarmedStrike(hf, hfFist)
    ok(hfFistStrike.unarmed && hfFistStrike.group === 'Brawling' && hfFistStrike.spec?.source.kind === 'always', 'Expert Strikes: o Punho do Monge ganha a especialização do grupo brawling')
    ok(!strikes.unarmedStrike(party.ghan, unarmedMod.unarmedAttacks(party.ghan)[0]).spec, 'Quem não é Monge perito não ganha a especialização do Punho')
    const hfSp = hf.weapons.find((w) => w.name.startsWith('Special Unarmed'))
    const hfSpStrike = strikes.weaponStrike(hf, hfSp, null)
    // O jogador mandou tratar o desarmado caseiro como o Punho: ágil, acuidade, grupo brawling.
    const spGear = homebrew.homebrewGear(hf, 'Special Unarmed (1d6)')
    ok(spGear && spGear.traits.includes('Agile') && spGear.traits.includes('Finesse') && spGear.group === 'Brawling', 'O desarmado caseiro tem os traços do Punho')
    const spKnown = strikes.weaponStrike(hf, hfSp, spGear)
    ok(spKnown.traits.agile && spKnown.traits.finesse && spKnown.traits.known, 'Os traços chegam ao Golpe')
    eq(strikes.planStrike(hf, spKnown, NO_MODIFIERS, opts({ map: 1 })).attackTotal, hfSp.attack - 4, 'Special Unarmed: segundo ataque −4 (ágil)')
    ok(spKnown.spec?.source.kind === 'always', 'Special Unarmed: especialização crítica do grupo brawling (Expert Strikes)')
    ok(monk.flurryCheck(hf, spKnown, false).ok, 'Flurry vale no Special Unarmed')
    eq(homebrew.homebrewGear(miranda, 'Special Unarmed (1d6)'), null, 'O desarmado caseiro é só da Hearts Folly')
    ok(hfSpStrike.unarmed && hfSpStrike.damageType === 'contundente, perfurante ou cortante', 'O desarmado caseiro é desarmado e traduz o tipo "B, P or S"')
    ok(critFx.runeCritEffects(['Decaying'])[0].damage.type === 'void' && critFx.runeCritEffects(['Decaying'])[0].damage.persistent, 'Decaying: vazio persistente no crítico')
    // Flurry of Blows, Ki Strike / Inner Upheaval, Stunning Blows, Perfect Strike e a postura.
    eq([1, 7, 8, 9, 15, 17].map(monk.kiStrikeDice).join(), '1,1,1,2,2,3', 'Ki Strike: +1d6 a cada +4 ranks acima do 1º (rank 5 no nível 9, rank 9 no 17)')
    ok(monk.hasKiStrike(hf) && monk.hasPerfectStrike(hf) && monk.hasStunningBlows(hf) && monk.hasFlurryOfBlows(hf) && monk.hasMonasticArcherStance(hf), 'A Hearts Folly tem o kit do Monge')
    ok(!monk.hasKiStrike(party.ghan) && !monk.hasFlurryOfBlows(party.ghan), 'Quem não é Monge não tem Flurry nem Ki Strike')
    ok(monk.flurryCheck(hf, hfFistStrike, false).ok, 'Flurry vale no Punho')
    const hfBow = hf.weapons.find((w) => w.name === 'Longbow')
    const hfBowStrike = strikes.weaponStrike(hf, hfBow, { kind: 'weapon', traits: ['Deadly d10', 'Propulsive', 'Volley 30 ft.'], weaponType: 'ranged', group: 'Bow' })
    ok(!monk.flurryCheck(hf, hfBowStrike, false).ok && monk.flurryCheck(hf, hfBowStrike, false).reason, 'Flurry com arco sem a postura: não vale e diz por quê')
    ok(monk.flurryCheck(hf, hfBowStrike, true).ok, 'Flurry com arco na Monastic Archer Stance')
    ok(monk.kiStrikeApplies(hf, hfFistStrike) && monk.kiStrikeApplies(hf, hfBowStrike) && !monk.kiStrikeApplies(party.ghan, ghanStrike), 'Ki Strike vale no desarmado e no arco (quem tem a postura); outro personagem não')
    ok(monk.perfectStrikeApplies(hf, hfFistStrike) && !monk.perfectStrikeApplies(hf, hfBowStrike), 'Perfect Strike só em ataque desarmado')
    const hfKi = strikes.planStrike(hf, hfFistStrike, NO_MODIFIERS, opts({ extrasOn: { [monk.KI_KEY]: true, [monk.kiTypeKey('void')]: true } }))
    const hfPlain = strikes.planStrike(hf, hfFistStrike, NO_MODIFIERS, opts())
    eq(hfKi.attackTotal, hfPlain.attackTotal + 1, 'Ki Strike: +1 de status no ataque')
    ok(hfKi.extras.some((e) => e.key === 'ki-strike' && e.type === 'void' && e.expr.groups[0].count === 1) && !hfPlain.extras.some((e) => e.key === 'ki-strike'), 'Ki Strike: +1d6 de vazio só com o chip')
    ok(!strikes.planStrike(party.ghan, ghanStrike, NO_MODIFIERS, opts({ extrasOn: { [monk.KI_KEY]: true } })).extras.some((e) => e.key === 'ki-strike'), 'Quem não tem Ki Strike não ganha o dano')
    const hfSecond = strikes.planStrike(hf, hfFistStrike, NO_MODIFIERS, opts({ map: 1 }))
    eq(hfSecond.attackTotal, hfPlain.attackTotal - 4, 'O 2º Golpe do Flurry leva o MAP ágil (−4)')
    const hfFlurry = rolls.flurryRoll(rolls.rollerIdentity(hf), hfFistStrike, [hfPlain, hfSecond], 'Flurry of Blows')
    ok(hfFlurry.rays.length === 2 && hfFlurry.rays.every((r) => r.damage.total >= 1), 'Flurry: dois Golpes numa rolagem só')
    ok(table.sanitizeTableRoll(hfFlurry) !== null && server.sanitizeRoll(hfFlurry) !== null, 'Flurry passa nos dois validadores')
    eq(fighter.classDc(hf), 22, 'CD de classe do Monge: 10 + 7 + treinado 2 + FOR 3')
    ok(/CD 22/.test(monk.stunningBlowsNote(22)), 'Stunning Blows cita a CD de classe')
    ok(monk.isStrikeFocusSpell('Inner Upheaval') && monk.isStrikeFocusSpell('Perfect Strike') && !monk.isStrikeFocusSpell('Unfolding Wind Rush'), 'Ki Strike, Inner Upheaval e Perfect Strike vivem no Golpe; Unfolding Wind Rush é conjuração')
    // Relíquias da Hearts Folly: Redenção Pelas Cinzas e Afinco do Artista (dádivas da AON).
    const hfRelics = relics.relicsOf(hf)
    eq(hfRelics.map((r) => r.id).join(), 'redencao-pelas-cinzas,afinco-do-artista', 'A Hearts Folly tem as duas relíquias')
    const hfWave = hfRelics[0].gifts[0], faith = hfRelics[0].gifts[1], emotion = hfRelics[1].gifts[0], bestow = hfRelics[1].gifts[1]
    ok(relics.giftUnlocked(hfWave, 0, 7) && relics.giftUnlocked(faith, 1, 7) && !relics.giftUnlocked(faith, 1, 4), 'Healing Wave no 1º nível e Word of Faith no 5º (tabela do GM Core)')
    eq(relics.relicHealActivity(hf, hfRelics[0], hfWave).formula, '7d4', 'Healing Wave: 1d4 por nível da relíquia (7)')
    eq(relics.relicHealActivity(hf, hfRelics[0], faith).formula, '7d8', 'Word of Faith: 1d8 por nível do item (7)')
    ok(relics.relicHealActivity(hf, hfRelics[0], faith).reducesFrightened && !relics.relicHealActivity(hf, hfRelics[0], hfWave).reducesFrightened, 'Só a Word of Faith reduz o Amedrontado')
    ok(hfWave.activation.cost === 2 && faith.activation.cost === 2 && emotion.activation.cost === 'reaction' && bestow.activation.cost === 2, 'Custos da AON: 2 ações, 2 ações, reação, 2 ações')
    ok(/rank 4/.test(emotion.facts(7)) && /nível 3/.test(bestow.facts(7)), 'Dominant Emotion: counteract rank 4; Bestow Life: objeto de nível 3')
    ok(relics.relicHealActivity(hf, hfRelics[1], emotion) === null, 'Dominant Emotion não é cura')
    ok(hfRelics.every((r) => r.aspects.length === 2), 'Cada relíquia tem dois aspectos')
    ok(investigator.hasKnownWeaknesses(miranda) && investigator.hasSharedStratagem(miranda), 'Miranda tem Known Weaknesses e Shared Stratagem')
}

// ── Woyd (Clérigo 7, Arton 1515) ──
{
    const woyd = load('woyd7')
    const cl = await import('../src/modules/character-viewer/cleric.ts')
    const mu = await import('../src/modules/character-viewer/mythicUse.ts')
    const sk = await import('../src/modules/character-viewer/skillActions.ts')
    const opts = cl.variantOptionsFor(woyd)
    ok(opts.healingHands && opts.selectiveEnergy, 'Woyd tem Healing Hands e Selective Energy')
    ok(!cl.variantOptionsFor(party.ghan).healingHands, 'Quem não tem o talento não ganha o d10')
    const heal = (n, o) => av.variantFor('Heal', 4, n, o).components[0]
    eq(heal(1, opts).faces, 10, 'Healing Hands: Heal com d10')
    eq(heal(1, {}).faces, 8, 'Sem Healing Hands: d8')
    ok(heal(2, opts).count === 4 && heal(2, opts).flat === 32, 'Heal 4º com 2 ações: 4d10+32')
    ok(av.variantFor('Heal', 4, 3, opts).notes.some((n) => /Selective Energy/.test(n)), 'Selective Energy avisa na emanação')
    ok(!av.variantFor('Heal', 4, 2, opts).notes.some((n) => /Selective Energy/.test(n)), 'Selective Energy não vale fora da área')
    // Banishing Touch: 1d6 (1 ação) / 2d6 (2–3); +1d6 no 4º, +2d6 no 6º, +3d6 no 8º.
    const bt = (r, n) => av.variantFor('Banishing Touch', r, n).components[0]
    eq([bt(2, 1), bt(2, 2), bt(2, 3), bt(4, 1), bt(6, 2), bt(8, 3)].map((c) => c.count).join(), '1,2,2,2,4,5', 'Banishing Touch: dados por ações e rank')
    ok(bt(2, 1).faces === 6 && bt(2, 1).types[0] === 'bludgeoning', 'Banishing Touch: contundente em d6')
    ok(/6 m para o alto e 3 m/.test(av.variantFor('Banishing Touch', 2, 2).notes[0]), 'Banishing Touch: 2 ações lança 6 m para o alto e 3 m para trás')
    ok(rolls.isMythicAttackSpell('Banishing Touch') && !rolls.isMythicAttackSpell('Holy Light'), 'Só a Banishing Touch ataca com proficiência mítica')
    const atk = { parts: [{ label: 'Perito', value: 11, kind: 'prof' }, { label: 'SAB', value: 4, kind: 'ability' }], total: 15, mythicDelta: 6, alreadyMythic: false }
    const myth = rolls.mythicSpellAttack(woyd, atk)
    ok(myth.total === 21 && myth.mythicDelta === null, 'Banishing Touch do Woyd: +21 (nível 7 + 10 + SAB 4), sem ✦ por cima')
    // ✦: Prescience na iniciativa (vence o Ears), Sage's Calling no Recall Knowledge.
    eq(mu.mythicOptionFor(woyd, 'initiative')?.feat, 'Prescience', 'Woyd: ✦ da Percepção de iniciativa é o Prescience')
    ok(/\+1 de status na CA/.test(mu.mythicOptionFor(woyd, 'initiative')?.note ?? ''), 'Prescience anota o +1 na CA e nas salvaguardas')
    eq(mu.mythicOptionFor(woyd, 'initiative-skill')?.feat, 'Prescience', 'Woyd: Prescience vale na iniciativa por perícia')
    eq(mu.mythicOptionFor(party.ghan, 'initiative-skill')?.feat, 'Rewrite Fate', 'Sem Prescience, iniciativa por perícia cai no Rewrite Fate')
    eq(mu.mythicOptionFor(woyd, 'recall')?.feat, "Sage's Calling", "Woyd: ✦ do Recall Knowledge é o Sage's Calling")
    eq(mu.mythicOptionFor(party.ghan, 'recall')?.feat, 'Rewrite Fate', "Sem Sage's Calling, Recall Knowledge cai no Rewrite Fate")
    eq(sk.skillActionsFor('Religion').find((a) => a.id === 'recall')?.mythic, 'recall', 'Recall Knowledge libera o ✦ de Recall')
    // Sacred Ground: cura fixa = nível, sem ação; a rolagem fecha nos dois validadores.
    const sg = healActs.featHeal(woyd, 'Sacred Ground')
    ok(sg && sg.actions === 0 && sg.formula === '7' && sg.time === '1 minuto' && sg.daily, 'Sacred Ground: 7 PV, 1 minuto, marca usada')
    eq(healActs.featHeal(party.ghan, 'Sacred Ground'), null, 'Sacred Ground só com o talento')
    const sgRoll = rolls.healRoll(rolls.rollerIdentity(woyd), 'Sacred Ground', 'Cura 7', dice.rollGroups([], 7))
    ok(table.sanitizeTableRoll(sgRoll)?.free?.total === 7 && server.sanitizeRoll(sgRoll)?.free?.total === 7, 'Cura fixa sem dado: os dois validadores aceitam')
    // Relíquia: Brasão da Família (Soul/Emotion) — Absorb Injury (reação, 1×/dia) e Emotion Surge (1 ação, 1×/hora).
    const [brasao] = relics.relicsOf(woyd)
    eq(brasao?.id, 'brasao-da-familia', 'O Woyd tem o Brasão da Família')
    const [absorb, surge] = brasao.gifts
    ok(absorb.activation.cost === 'reaction' && absorb.activation.limited && surge.activation.cost === 1 && surge.activation.limited, 'Custos da AON: reação 1×/dia e 1 ação 1×/hora')
    ok(relics.giftUnlocked(absorb, 0, 7) && relics.giftUnlocked(surge, 1, 7), 'As duas dádivas liberadas no nível 7')
    eq(relics.giftActivity(absorb).time.kind, 'reaction', 'Absorb Injury gasta a reação')
}

// ── Uso de poder sem dado (dádiva de relíquia) ──
{
  const base = { id: 'abc-1', color: '#336699', by: 'Miranda', title: 'Dragon Strike' }
  const used = { ...base, use: { text: 'Usou · 1 ação' } }
  ok(table.sanitizeTableRoll(used)?.use?.text === 'Usou · 1 ação', 'cliente aceita o uso de poder')
  ok(server.sanitizeRoll(used)?.use?.text === 'Usou · 1 ação', 'servidor aceita o uso de poder')
  const withDesc = { ...base, use: { text: 'Usou', desc: 'x'.repeat(900) } }
  ok(table.sanitizeTableRoll(withDesc)?.use?.desc.length === 700 && server.sanitizeRoll(withDesc)?.use?.desc.length === 700, 'a regra do poder é cortada em 700 nos dois')
  ok(table.sanitizeTableRoll({ ...base, use: { text: '  ' } }) === null, 'cliente recusa uso vazio')
  ok(server.sanitizeRoll({ ...base, use: { text: '' } }) === null, 'servidor recusa uso vazio')
  ok(table.sanitizeTableRoll(base) === null && server.sanitizeRoll(base) === null, 'sem nada para mostrar continua recusado')
}

console.log(`${passed} conferências ok, ${failures} falha(s).`)
process.exit(failures ? 1 : 0)
