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
const dice = await import('../src/dice/roll.ts')
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

console.log(`${passed} conferências ok, ${failures} falha(s).`)
process.exit(failures ? 1 : 0)
