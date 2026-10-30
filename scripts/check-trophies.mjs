// Confere as regras puras dos Troféus do Covil (`api/_lib/trophies.js`): sequências de
// sessões seguidas, destaques da sessão (empate não elege), progresso limitado ao alvo e as
// platinas. Sem banco.
//
//   node scripts/check-trophies.mjs

import assert from 'node:assert/strict'
import {
    TROPHIES, catalogWire, deriveFacts, evaluateFacts, longestStreak, pointsOf, sessionHighlights,
} from '../api/_lib/trophies.js'

let failures = 0
const test = (name, fn) => {
    try { fn(); console.log(`ok   ${name}`) } catch (e) { failures += 1; console.log(`FAIL ${name}\n     ${e.message}`) }
}

const s = (mesa, startedAt, flags) => ({ mesa, startedAt, endedAt: startedAt + 1, ...flags })

test('ids únicos e com formato de banco', () => {
    const ids = TROPHIES.map((x) => x.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const id of ids) assert.match(id, /^[a-z0-9-]{1,40}$/)
})

test('sequência por mesa, na ordem das sessões', () => {
    const list = [s('a', 3, { noted: true }), s('a', 1, { noted: true }), s('a', 2, { noted: true }), s('b', 1, { noted: true })]
    assert.equal(longestStreak(list, (x) => x.noted), 3)
    const broken = [s('a', 1, { noted: true }), s('a', 2, { noted: false }), s('a', 3, { noted: true })]
    assert.equal(longestStreak(broken, (x) => x.noted), 1)
    // Duas mesas não emendam uma sequência.
    assert.equal(longestStreak([s('a', 1, { noted: true }), s('b', 2, { noted: true })], (x) => x.noted), 1)
})

test('do zero: sem fatos, nada desbloqueia', () => {
    const { earned } = evaluateFacts(deriveFacts({}))
    assert.equal(earned.size, 0)
})

test('progresso para no alvo', () => {
    const { progress, earned } = evaluateFacts(deriveFacts({ feats: { 'note-created': 70 } }))
    assert.equal(progress['dez-notas'], 10)
    assert.equal(progress['cinquenta-notas'], 50)
    assert.ok(earned.has('primeira-nota') && earned.has('cinquenta-notas'))
})

test('etiquetas: só NPC, item, local e evento contam', () => {
    const f = deriveFacts({ noteTags: ['npc', 'item', 'outro'] })
    assert.equal(f.noteTags, 2)
    const { earned } = evaluateFacts(deriveFacts({ noteTags: ['npc', 'item', 'local', 'evento'] }))
    assert.ok(earned.has('todas-etiquetas'))
})

test('background: limiar e depois do level-up', () => {
    assert.ok(!evaluateFacts(deriveFacts({ backgroundMax: 299 })).earned.has('background'))
    const { earned } = evaluateFacts(deriveFacts({ backgroundMax: 300, backgroundAfterLevelUp: 1 }))
    assert.ok(earned.has('background') && earned.has('background-atualizado') && !earned.has('background-longo'))
})

test('destaques: empate não elege, sem dono não conta, média exige 8 testes', () => {
    const rows = [
        { slug: 'a', owner: 'u1', damage: 50, topHit: 20, checks: 8, d20Sum: 120 },
        { slug: 'b', owner: 'u2', damage: 50, topHit: 30, checks: 7, d20Sum: 140 },
        { slug: 'c', owner: null, damage: 90, topHit: 90, checks: 20, d20Sum: 400 },
    ]
    const h = sessionHighlights(rows)
    assert.equal(h['session-top-damage'], null)
    assert.equal(h['session-top-hit'], 'u2')
    assert.equal(h['session-best-avg'], 'u1')
    assert.equal(sessionHighlights([])['session-top-damage'], null)
})

test('platina: todos os outros do papel', () => {
    const others = TROPHIES.filter((x) => x.role === 'gm' && x.tier !== 'platina').map((x) => x.id)
    const almost = new Set(others.slice(1))
    assert.ok(!evaluateFacts(deriveFacts({}), almost).earned.has('platina-gm'))
    const { earned, progress } = evaluateFacts(deriveFacts({}), new Set(others))
    assert.ok(earned.has('platina-gm'))
    assert.equal(progress['platina-gm'], others.length)
    assert.ok(!earned.has('platina-jogador'))
    const wire = catalogWire().find((x) => x.id === 'platina-gm')
    assert.equal(wire.goal, others.length)
})

test('sorte: médias da sessão e sequências', () => {
    const hot = evaluateFacts(deriveFacts({ bestSessionAvg: 14, worstSessionAvg: 0 })).earned
    assert.ok(hot.has('sortudo') && !hot.has('dado-gelado'), 'média 0 = nenhuma sessão com 10 testes, não "gelado"')
    assert.ok(evaluateFacts(deriveFacts({ worstSessionAvg: 6.5 })).earned.has('dado-gelado'))
    const runs = evaluateFacts(deriveFacts({ run20: 2, run1: 3, redemption: 1 })).earned
    assert.ok(runs.has('dois-20-seguidos') && !runs.has('tres-20-seguidos'))
    assert.ok(runs.has('dois-1-seguidos') && runs.has('tres-1-seguidos') && runs.has('redencao'))
})

test('combate e MVP', () => {
    const e = evaluateFacts(deriveFacts({ bestHit: 120, bestSessionDamage: 450, critStrikes: 1, maxRays: 3, sameSessionHighlights: 3 })).earned
    for (const id of ['dano-50', 'dano-100', 'sessao-300', 'critico', 'raios', 'mvp']) assert.ok(e.has(id), id)
    assert.ok(!e.has('sessao-600'))
})

test('secretos têm descrição (o cliente esconde até ganhar)', () => {
    for (const x of TROPHIES.filter((y) => y.hidden)) assert.ok(x.description.length > 10, x.id)
})

test('pontos por papel', () => {
    assert.deepEqual(pointsOf(['primeira-ficha', 'gm-15-sessoes', 'nao-existe']), { player: 15, gm: 90 })
})

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo.')
process.exit(failures ? 1 : 0)
