// Sanidade do motor de escala, contra criaturas de verdade da AON.
//
// Rode à mão: `node scripts/check-scaling.mjs [quantidade]`
//
// O teste que importa é a IDENTIDADE: reescalar uma criatura para o PRÓPRIO
// nível tem que devolver a ficha original, número por número. Se as tabelas
// foram transcritas errado, ou se o degrau foi casado com a coluna errada, é
// aqui que aparece — e falhar neste teste significa que qualquer outro nível
// também está errado, só que sem ninguém para conferir.
//
// O segundo teste é MONOTONIA: subir de nível não pode baixar estatística.
//
// Não há framework de teste no repositório, por isso é script avulso.

import { register } from 'node:module'

// Deixa importar o `scaling.ts` do app direto, sem cópia paralela do motor.
register('./ts-loader.mjs', import.meta.url)

const { resolveMonster } = await import('../api/_lib/monster-core.js')
const { scaleMonster } = await import('../src/modules/monster-scaler/scaling.ts')

const LIMIT = parseInt(process.argv[2], 10) || 150

async function sample(limit) {
  const res = await fetch('https://elasticsearch.aonprd.com/aon/_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: limit * 2,
      _source: ['name'],
      query: { bool: { filter: [
        { term: { category: 'creature' } },
        { range: { level: { gte: -1, lte: 24 } } },
      ] } },
      sort: [{ level: 'asc' }, { 'name.keyword': 'asc' }],
    }),
  })
  const hits = (await res.json()).hits.hits
  return [...new Set(hits.map((h) => h._source.name))].slice(0, limit)
}

const NUMERIC = [
  ['CA', (m) => m.ac],
  ['PV', (m) => m.hp],
  ['Percepção', (m) => m.perception],
  ['Fort', (m) => m.saves.fort],
  ['Ref', (m) => m.saves.ref],
  ['Von', (m) => m.saves.will],
]

const failures = []
const monotony = []
const roundTrip = []
const overrideFails = []
let checked = 0, strikesChecked = 0, dcsChecked = 0, damageChecked = 0, spellsChecked = 0

/**
 * A conjuração da ficha ORIGINAL como texto comparável.
 *
 * A contagem de slots sai dos dois lados: o AON só a escreve em ALGUNS ranks do
 * bloco espontâneo (o Rumin Purgo tem "(3 slots)" do 2º ao 6º e nada no 1º), e o
 * app a escreve em todos, derivada da mesma tabela e do desvio da própria ficha.
 * Acrescentar um número certo onde o índice foi omisso não é reescrever a ficha
 * — mas MUDAR um número que o índice declarou seria, e é isso que a checagem de
 * slots declarados logo abaixo garante.
 */
// O `()` vazio é artefato do índice (um link sem texto: "Longstrider ()") e o
// app o descarta ao ler a anotação. Descartar parêntese vazio não é reescrever
// magia nenhuma.
const stripSlots = (text) => text.replace(/\s*\(\d+ slots?\)/g, '').replace(/\s*\(\)/g, '')

function spellText(blocks) {
  return stripSlots(blocks
    .map((b) => `${b.label}|${b.groups.map((g) => `${g.rank}=${g.spells.join('/')}`).join(';')}`)
    .join(' || '))
}

/** Os slots que a ficha do AON declara, por bloco e rank: "0:3" → 4. */
function declaredSlots(blocks) {
  const out = new Map()
  blocks.forEach((b, i) => {
    for (const g of b.groups) {
      for (const spell of g.spells) {
        const m = /\((\d+) slots?\)\s*$/.exec(spell)
        if (m) out.set(`${i}:${g.rank}`, parseInt(m[1], 10))
      }
    }
  })
  return out
}

/**
 * O mesmo texto, a partir do resultado da escala. Os rótulos de grupo são
 * remontados no formato do AON ("Cantrips (4th)") justamente para a comparação
 * ser com o que o índice publicou, e não com uma forma interna.
 */
const ORD = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

/**
 * O mesmo texto, a partir do resultado da escala. Os rótulos de grupo são
 * remontados no formato do AON ("Cantrips (4th)") justamente para a comparação
 * ser com o que o índice publicou, e não com uma forma interna.
 */
function sameSpellText(scaled) {
  return stripSlots(scaled.spellcasting
    .map((b) => `${b.label}|${b.groups.map((g) => {
      const rank = g.label ?? (g.kind === 'cantrip' ? `Cantrips (${ORD(g.rank)})`
        : g.kind === 'constant' ? `Constant (${ORD(g.rank)})` : ORD(g.rank))
      const spells = g.spells.map((s) => (s.note ? `${s.name} (${s.note})` : s.name))
      return `${rank}=${spells.join('/')}`
    }).join(';')}`)
    .join(' || '))
}

/**
 * As CDs escritas na prosa das habilidades, na ordem em que aparecem, com a
 * marca de teste plano ao lado — a CD do teste plano é fixa (Player Core) e
 * NÃO pode acompanhar o nível.
 */
function dcList(abilities) {
  const out = []
  for (const a of abilities) {
    for (const m of a.text.matchAll(/\bDC\s*(\d+)\b( flat check)?/g)) {
      out.push({ ability: a.name, dc: parseInt(m[1], 10), flat: Boolean(m[2]) })
    }
  }
  return out
}

/**
 * O dano escrito na prosa, com a média ao lado — é a média que precisa subir
 * junto com o nível, não a fórmula, que muda de dado.
 */
function damageList(abilities) {
  const out = []
  for (const a of abilities) {
    for (const m of a.text.matchAll(/(\d+)d(\d+)([+-]\d+)?(\s+(?:persistent\s+)?[a-z]+)?\s+damage/gi)) {
      const flat = m[3] ? parseInt(m[3], 10) : 0
      out.push({
        ability: a.name,
        formula: m[0].trim(),
        average: parseInt(m[1], 10) * ((parseInt(m[2], 10) + 1) / 2) + flat,
      })
    }
  }
  return out
}

for (const name of await sample(LIMIT)) {
  const monster = await resolveMonster(name)
  if (!monster) continue
  checked += 1

  // --- identidade: mesmo nível, mesma ficha ---
  const same = scaleMonster(monster, monster.level)
  for (const [label, get] of NUMERIC) {
    const before = label === 'CA' ? monster.ac.value
      : label === 'PV' ? monster.hp.value
      : label === 'Percepção' ? monster.perception.value
      : label === 'Fort' ? monster.saves.fort.value
      : label === 'Ref' ? monster.saves.ref.value
      : monster.saves.will.value
    const after = get(same)
    if (before !== after) {
      failures.push(`${name}(n${monster.level}) ${label}: ${before} -> ${after}`)
    }
  }
  for (const [skill, value] of Object.entries(monster.skills)) {
    if (same.skills[skill] !== value) {
      failures.push(`${name}(n${monster.level}) perícia ${skill}: ${value} -> ${same.skills[skill]}`)
    }
  }
  same.strikes.forEach((s, i) => {
    strikesChecked += 1
    if (s.bonus !== s.originalBonus) {
      failures.push(`${name}(n${monster.level}) golpe ${s.name}: +${s.originalBonus} -> +${s.bonus}`)
    }
    if (s.originalFormula && s.damageFormula !== s.originalFormula) {
      failures.push(`${name}(n${monster.level}) dano ${s.name}: ${s.originalFormula} -> ${s.damageFormula}`)
    }
    void i
  })

  // A conjuração entra na identidade inteira: mesmos blocos, mesmos ranks,
  // mesmas magias, mesma contagem de slots. É a checagem que pegou os truques
  // indo para o teto do NÍVEL em vez do topo do BLOCO (a Sacuishu é nível 9 e
  // conjura no 4º) e a Ryta perdendo o quarto slot de 1º rank, que é a opção
  // generosa do livro e estava escrita na própria ficha.
  {
    const before = spellText(monster.statblock?.spellcasting ?? [])
    const after = sameSpellText(same)
    if (before !== after) {
      failures.push(`${name}(n${monster.level}) conjuração mudou no próprio nível:\n      ${before}\n      ${after}`)
    }
    // Slot declarado no índice não pode mudar de valor no próprio nível.
    const declared = declaredSlots(monster.statblock?.spellcasting ?? [])
    same.spellcasting.forEach((block, i) => {
      for (const group of block.groups) {
        // Só grupo de rank: o truque tem o MESMO rank do topo do bloco e cairia
        // na mesma chave, sem slot nenhum para comparar.
        if (group.kind !== 'rank') continue
        const want = declared.get(`${i}:${ORD(group.rank)}`)
        if (want !== undefined && group.slots !== want) {
          failures.push(`${name}(n${monster.level}) ${block.label} ${group.rank}º: ${want} slots -> ${group.slots}`)
        }
      }
    })
    spellsChecked += same.spellcasting.length
  }

  // As CDs da prosa entram na identidade: reescalar para o próprio nível tem
  // que devolver o texto caractere por caractere.
  same.abilities.forEach((a) => {
    if (a.text !== a.originalText) {
      failures.push(`${name}(n${monster.level}) prosa de "${a.name}" mudou no próprio nível`)
    }
  })

  // --- monotonia: dois níveis acima não pode piorar nada ---
  if (monster.level <= 22) {
    const up = scaleMonster(monster, monster.level + 2)
    if (up.ac < same.ac) monotony.push(`${name}: CA ${same.ac} -> ${up.ac}`)
    if (up.hp < same.hp) monotony.push(`${name}: PV ${same.hp} -> ${up.hp}`)
    if (up.perception < same.perception) monotony.push(`${name}: Perc ${same.perception} -> ${up.perception}`)

    const beforeDmg = damageList(same.abilities)
    const afterDmg = damageList(up.abilities)
    if (beforeDmg.length !== afterDmg.length) {
      monotony.push(`${name}: ${beforeDmg.length} dano(s) na prosa viraram ${afterDmg.length}`)
    } else {
      beforeDmg.forEach((b, i) => {
        damageChecked += 1
        if (afterDmg[i].average < b.average) {
          monotony.push(`${name}: dano de "${b.ability}" ${b.formula} -> ${afterDmg[i].formula}`)
        }
      })
    }

    const before = dcList(same.abilities)
    const after = dcList(up.abilities)
    if (before.length !== after.length) {
      monotony.push(`${name}: ${before.length} CD(s) na prosa viraram ${after.length}`)
    } else {
      before.forEach((b, i) => {
        dcsChecked += 1
        const a = after[i]
        if (b.flat && a.dc !== b.dc) {
          monotony.push(`${name}: teste plano de "${b.ability}" mudou, CD ${b.dc} -> ${a.dc}`)
        } else if (!b.flat && a.dc < b.dc) {
          monotony.push(`${name}: CD de "${b.ability}" ${b.dc} -> ${a.dc}`)
        }
      })
    }
  }

  // --- o ajuste fino precisa ajustar ---
  // Trocar o degrau de uma estatística tem que mover o número. Preservar a
  // diferença usando o degrau ESCOLHIDO dos dois lados da conta fazia o
  // override não fazer nada — as colunas da tabela sobem quase em paralelo, e a
  // diferença se cancelava. Sem esta checagem o painel parecia funcionar.
  {
    const base = scaleMonster(monster, monster.level)
    const other = monster.ac.scale === 'extreme' ? 'low' : 'extreme'
    const forced = scaleMonster(monster, monster.level, { ac: other })
    if (forced.ac === base.ac) {
      overrideFails.push(`${name}(n${monster.level}) CA ${monster.ac.scale}->${other} não mudou (${base.ac})`)
    }
  }

  // --- ida e volta ---
  // A identidade sozinha não prova nada sobre o dano: `shiftDamage` devolve a
  // fórmula original de saída quando os níveis são iguais. Subir quatro níveis
  // e voltar exercita a conta de verdade e tem que fechar no ponto de partida.
  if (monster.level + 4 <= 24) {
    const trip = scaleMonster(scaledAsSource(monster, scaleMonster(monster, monster.level + 4)), monster.level)
    if (trip.ac !== monster.ac.value) {
      roundTrip.push(`${name}(n${monster.level}) CA ${monster.ac.value} -> ${trip.ac}`)
    }
    if (Math.abs(trip.hp - monster.hp.value) > Math.max(1, monster.hp.value * 0.02)) {
      roundTrip.push(`${name}(n${monster.level}) PV ${monster.hp.value} -> ${trip.hp}`)
    }
    if (trip.perception !== monster.perception.value) {
      roundTrip.push(`${name}(n${monster.level}) Perc ${monster.perception.value} -> ${trip.perception}`)
    }
    trip.strikes.forEach((st, i) => {
      const orig = monster.statblock?.strikes[i]
      if (orig && st.bonus !== orig.bonus) {
        roundTrip.push(`${name}(n${monster.level}) golpe ${st.name} +${orig.bonus} -> +${st.bonus}`)
      }
    })
    // A CD da prosa também precisa fechar: a identidade não a exercita, porque
    // no mesmo nível o texto sai sem passar por conta nenhuma.
    trip.abilities.forEach((a, i) => {
      const orig = monster.statblock?.abilities[i]
      if (orig && a.text !== orig.text) {
        roundTrip.push(`${name}(n${monster.level}) prosa de "${a.name}" não voltou ao original`)
      }
    })
  }
}

/**
 * Empacota um resultado já escalado de volta no formato de entrada, para poder
 * escalá-lo outra vez. Só os campos que a conta usa.
 */
function scaledAsSource(original, scaled) {
  const withScale = (value, ref) => ({ value, scale: ref.scale })
  return {
    ...original,
    level: scaled.level,
    ac: withScale(scaled.ac, original.ac),
    hp: withScale(scaled.hp, original.hp),
    perception: withScale(scaled.perception, original.perception),
    saves: {
      fort: withScale(scaled.saves.fort, original.saves.fort),
      ref: withScale(scaled.saves.ref, original.saves.ref),
      will: withScale(scaled.saves.will, original.saves.will),
    },
    skills: scaled.skills,
    // A CD de conjuração precisa acompanhar o resto da ficha: ela é o degrau
    // DECLARADO das CDs da prosa (ver `scaleMonster`), e deixá-la no valor
    // original faria a volta cair na inferência por valor — que, num empate
    // entre dois degraus, erra por 1 e acusaria falha onde não há.
    spellDc: scaled.spellcasting.find((b) => b.dc !== null)?.dc
      ?? scaled.rows.find((r) => r.key === `dc:${original.spellDc}`)?.to
      ?? original.spellDc,
    damageAverages: original.damageAverages,
    statblock: original.statblock && {
      ...original.statblock,
      abilities: scaled.abilities,
      strikes: scaled.strikes.map((st) => ({
        ...st,
        damage: st.damage && { ...st.damage, formula: st.damageFormula },
      })),
    },
  }
}

console.log(
  `criaturas conferidas: ${checked} | golpes: ${strikesChecked}`
  + ` | CDs na prosa: ${dcsChecked} | danos na prosa: ${damageChecked}`
  + ` | blocos de conjuração: ${spellsChecked}`,
)
console.log(`\nIDENTIDADE (mesmo nível deve devolver a ficha original): ${failures.length} falha(s)`)
failures.slice(0, 25).forEach((f) => console.log('  ✗', f))
console.log(`\nMONOTONIA (subir nível não pode baixar número): ${monotony.length} falha(s)`)
monotony.slice(0, 15).forEach((f) => console.log('  ✗', f))

console.log(`\nIDA E VOLTA (+4 níveis e de volta deve fechar): ${roundTrip.length} falha(s)`)
roundTrip.slice(0, 20).forEach((f) => console.log('  ✗', f))

console.log(`\nAJUSTE FINO (trocar o degrau deve mover o número): ${overrideFails.length} falha(s)`)
overrideFails.slice(0, 15).forEach((f) => console.log('  ✗', f))

const total = failures.length + monotony.length + roundTrip.length + overrideFails.length
process.exit(total > 0 ? 1 : 0)
