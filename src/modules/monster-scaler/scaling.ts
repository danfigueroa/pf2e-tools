// Motor de escala: ficha da AON + nível-alvo → ficha no nível novo.
//
// A REGRA QUE EXPLICA O ARQUIVO INTEIRO: preserva-se a DIFERENÇA em relação ao
// benchmark, nunca o benchmark cru.
//
// Criaturas publicadas são feitas à mão e não batem com a tabela. O Bugbear
// Tormentor é "CA Alta" com CA 20, enquanto a tabela diz 19 no nível 3; a
// Percepção dele é +8 num degrau "Baixo" que a tabela põe em +6. Trocar o
// número pelo da tabela no nível-alvo apagaria essa personalidade e, pior,
// reescalar um monstro para o PRÓPRIO nível devolveria uma ficha diferente da
// original — a ferramenta perderia a confiança do GM logo no primeiro teste.
//
// Guardando a diferença, `valor + (tabela[alvo] - tabela[origem])` devolve o
// original exato quando os níveis são iguais, e desloca a ficha inteira mantendo
// o desenho do monstro quando não são.
//
// PV foge à regra e usa RAZÃO em vez de diferença: PV cresce quase
// geometricamente (9 no nível -1, ~500 no 24), e uma diferença fixa de +15 PV
// que é muito no nível 1 é irrelevante no 20.

import {
    AC_TABLE,
    ATTRIBUTE_TABLE,
    HP_TABLE,
    MAX_LEVEL,
    MIN_LEVEL,
    PERCEPTION_TABLE,
    RESISTANCE_TABLE,
    SAVE_TABLE,
    SKILL_TABLE,
    SPELL_TABLE,
    STRIKE_ATTACK_TABLE,
    STRIKE_DAMAGE_TABLE,
    type Band,
    type ByLevel,
    type DamageBenchmark,
    type ScaleColumn,
} from './data/creatureTables'
import type {
    AttributeKey,
    MonsterDetail,
    ScaledMonster,
    ScaledRow,
    ScaledStrike,
    ScaleOverrides,
} from './types'

export const clampLevel = (level: number): number =>
    Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)))

/** Colunas que uma tabela oferece, na ordem do livro. */
const ORDER: ScaleColumn[] = ['extreme', 'high', 'moderate', 'low', 'terrible']

function columnsOf(table: ByLevel<unknown>, level: number): ScaleColumn[] {
    const row = table[level] ?? {}
    return ORDER.filter((c) => row[c] !== undefined)
}

const mid = (band: Band): number => (band.max + band.min) / 2

/**
 * Degrau mais próximo de um valor. Só para perícias, que são a única
 * estatística sem `*_scale` no índice da AON.
 */
type Benchmark = number | Band | DamageBenchmark

/** O número comparável de uma célula, seja ela valor, faixa ou fórmula de dano. */
function benchmarkValue(entry: Benchmark): number | null {
    if (typeof entry === 'number') return entry
    if ('average' in entry) return entry.average
    return mid(entry)
}

function inferColumn(
    table: ByLevel<Benchmark>,
    level: number,
    value: number,
): ScaleColumn | null {
    const row = table[level]
    if (!row) return null
    let best: ScaleColumn | null = null
    let bestDistance = Infinity
    for (const column of ORDER) {
        const entry = row[column]
        if (entry === undefined) continue
        const target = benchmarkValue(entry)
        if (target === null) continue
        const distance = Math.abs(value - target)
        if (distance < bestDistance) {
            bestDistance = distance
            best = column
        }
    }
    return best
}

/**
 * Desloca preservando a diferença.
 *
 * A ORIGEM usa sempre o degrau que a AON deu à ficha (`base`); só o DESTINO usa
 * o degrau escolhido (`target`). Usar o escolhido nos dois lados faz o ajuste
 * fino não fazer nada: as colunas da tabela sobem quase em paralelo, então a
 * diferença `tabela[alvo][X] - tabela[origem][X]` é praticamente a mesma para
 * todo X, e trocar "Alto" por "Extremo" devolvia o mesmo número.
 *
 * Separando os dois, o desvio do monstro em relação ao PRÓPRIO degrau é o que
 * se preserva, e mudar o degrau move o número para o patamar novo. Com
 * `base === target` a conta é a de antes, então a identidade continua valendo.
 *
 * Sem entrada na tabela (degrau que não existe naquele nível), devolve o valor
 * original em vez de chutar.
 */
function shift(
    table: ByLevel<number>,
    from: number,
    to: number,
    base: ScaleColumn | null,
    target: ScaleColumn | null,
    value: number,
): number {
    if (!base || !target) return value
    const a = table[from]?.[base]
    const b = table[to]?.[target]
    if (a === undefined || b === undefined) return value
    return value + (b - a)
}

/** PV: razão entre os pontos médios das faixas, nunca menos de 1. */
function shiftHp(
    from: number,
    to: number,
    base: ScaleColumn | null,
    target: ScaleColumn | null,
    value: number,
): number {
    if (!base || !target) return value
    const a = HP_TABLE[from]?.[base]
    const b = HP_TABLE[to]?.[target]
    if (!a || !b || mid(a) === 0) return value
    return Math.max(1, Math.round(value * (mid(b) / mid(a))))
}

/** Perícias com faixa (a coluna Baixa do livro) valem pelo ponto médio. */
function shiftBand(
    table: ByLevel<Band>,
    from: number,
    to: number,
    base: ScaleColumn | null,
    target: ScaleColumn | null,
    value: number,
): number {
    if (!base || !target) return value
    const a = table[from]?.[base]
    const b = table[to]?.[target]
    if (!a || !b) return value
    return Math.round(value + (mid(b) - mid(a)))
}

/**
 * Média de uma fórmula de dados: `3d10+12` → 28,5.
 *
 * Existe porque NÃO DÁ para confiar em `strike_damage_average` do índice por
 * posição: a AON entrega esses arrays ORDENADOS, não na ordem dos golpes. O
 * Adult Horned Dragon tem jaws/claw/tail/horn com médias 28,5/25,5/23,5/19 e o
 * índice devolve [19,23,25,36] — casar por índice dava à mordida a média da
 * chifrada. Calcular da própria fórmula é exato e independe de ordem.
 */
function formulaAverage(formula: string | null): number | null {
    if (!formula) return null
    const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(formula)
    if (!m) {
        const flat = parseInt(formula, 10)
        return Number.isFinite(flat) ? flat : null
    }
    const count = parseInt(m[1], 10)
    const faces = parseInt(m[2], 10)
    const flat = parseInt(m[3] ?? '0', 10)
    return count * ((faces + 1) / 2) + flat
}

/**
 * Dano do golpe.
 *
 * Os DADOS vêm da tabela do nível-alvo (dado maior conforme o nível sobe, como
 * manda o livro) e o MODIFICADOR FIXO absorve a diferença do golpe original em
 * relação ao benchmark. Assim um golpe que batia acima da média continua acima
 * da média, e a média no mesmo nível continua sendo a média original.
 *
 * Golpe sem fórmula ("attach", "tongue grab") passa intacto: não há número.
 */
function shiftDamage(
    from: number,
    to: number,
    base: ScaleColumn | null,
    target: ScaleColumn | null,
    formula: string | null,
    average: number | null,
): string | null {
    if (!formula) return null
    if (!base || !target) return formula

    const a = STRIKE_DAMAGE_TABLE[from]?.[base]
    const b = STRIKE_DAMAGE_TABLE[to]?.[target]
    if (!a || !b || a.average === null || b.average === null) return formula
    if (from === to && base === target) return formula

    // Quanto este golpe bate acima (ou abaixo) do benchmark do nível original.
    const deviation = (average ?? a.average) - a.average

    const parsed = /^(\d+)d(\d+)([+-]\d+)?$/.exec(b.formula)
    if (!parsed) return b.formula

    const flat = parseInt(parsed[3] ?? '0', 10) + Math.round(deviation)
    const dice = `${parsed[1]}d${parsed[2]}`
    if (flat === 0) return dice
    return `${dice}${flat > 0 ? '+' : ''}${flat}`
}

/** Resistência e fraqueza acompanham a faixa do nível, por razão. */
function shiftDefense(
    from: number,
    to: number,
    values: Record<string, number>,
): Record<string, number> {
    const a = RESISTANCE_TABLE[from]
    const b = RESISTANCE_TABLE[to]
    const out: Record<string, number> = {}
    if (!a || !b || mid(a) === 0) return { ...values }
    const factor = mid(b) / mid(a)
    for (const [type, value] of Object.entries(values)) {
        out[type] = Math.max(1, Math.round(value * factor))
    }
    return out
}

const pick = (
    overrides: ScaleOverrides,
    key: string,
    fallback: ScaleColumn | null,
): ScaleColumn | null => overrides[key] ?? fallback

/**
 * Degrau de origem de uma estatística: o que a AON atribuiu ou, na falta dele,
 * o mais próximo do próprio valor.
 *
 * A dedução existe para as criaturas FORA da faixa das tabelas — a Tarrasque é
 * nível 25 e a AON devolve a string "undefined" no lugar do degrau. Sem
 * deduzir, escolher outro nível devolvia a ficha intacta, que é a pior resposta
 * possível: parece que a ferramenta não fez nada e não diz por quê. Deduzir a
 * partir do nível de origem já travado na faixa dá um resultado aproximado e
 * honesto, marcado como deduzido no painel.
 */
function baseColumn(
    declared: ScaleColumn | null,
    table: ByLevel<Benchmark>,
    level: number,
    value: number,
): { column: ScaleColumn | null; inferred: boolean } {
    if (declared) return { column: declared, inferred: false }
    return { column: inferColumn(table, level, value), inferred: true }
}

/**
 * O degrau de um golpe. A AON COLAPSA repetições em `attack_bonus_scale`: uma
 * criatura com três golpes moderados traz `["Moderate"]`, não três itens. Com
 * um item só, ele vale para todos; com a contagem certa, casa por índice; fora
 * disso, deduz do próprio valor.
 */
function strikeColumn(
    scales: (ScaleColumn | null)[],
    index: number,
    strikeCount: number,
    table: ByLevel<Benchmark>,
    level: number,
    value: number,
): ScaleColumn | null {
    if (scales.length === 1) return scales[0]
    if (scales.length === strikeCount) return scales[index]
    return inferColumn(table, level, value)
}

export function scaleMonster(
    source: MonsterDetail,
    targetLevel: number,
    overrides: ScaleOverrides = {},
): ScaledMonster {
    const from = clampLevel(source.level)
    const to = clampLevel(targetLevel)
    const rows: ScaledRow[] = []
    const warnings: string[] = []

    const addRow = (
        key: string,
        label: string,
        table: ByLevel<unknown>,
        column: ScaleColumn | null,
        fromValue: number,
        toValue: number,
        kind: 'modifier' | 'flat',
        inferred = false,
    ) => {
        rows.push({
            key, label, column, inferred, kind,
            from: fromValue,
            to: toValue,
            columns: columnsOf(table, to),
        })
    }

    // --- defesas e sentidos ---
    const acBase = baseColumn(source.ac.scale, AC_TABLE, from, source.ac.value)
    const acColumn = pick(overrides, 'ac', acBase.column)
    const ac = shift(AC_TABLE, from, to, acBase.column, acColumn, source.ac.value)
    addRow('ac', 'CA', AC_TABLE, acColumn, source.ac.value, ac, 'flat', acBase.inferred)

    const hpBase = baseColumn(source.hp.scale, HP_TABLE, from, source.hp.value)
    const hpColumn = pick(overrides, 'hp', hpBase.column)
    const hp = shiftHp(from, to, hpBase.column, hpColumn, source.hp.value)
    addRow('hp', 'PV', HP_TABLE, hpColumn, source.hp.value, hp, 'flat', hpBase.inferred)

    const percBase = baseColumn(source.perception.scale, PERCEPTION_TABLE, from, source.perception.value)
    const percColumn = pick(overrides, 'perception', percBase.column)
    const perception = shift(PERCEPTION_TABLE, from, to, percBase.column, percColumn, source.perception.value)
    addRow('perception', 'Percepção', PERCEPTION_TABLE, percColumn, source.perception.value, perception, 'modifier', percBase.inferred)

    const saveLabels = { fort: 'Fortitude', ref: 'Reflexos', will: 'Vontade' } as const
    const saves = { fort: 0, ref: 0, will: 0 }
    for (const key of ['fort', 'ref', 'will'] as const) {
        const stat = source.saves[key]
        const base = baseColumn(stat.scale, SAVE_TABLE, from, stat.value)
        const column = pick(overrides, key, base.column)
        saves[key] = shift(SAVE_TABLE, from, to, base.column, column, stat.value)
        addRow(key, saveLabels[key], SAVE_TABLE, column, stat.value, saves[key], 'modifier', base.inferred)
    }

    // --- atributos ---
    const attrLabels: Record<AttributeKey, string> = {
        strength: 'For', dexterity: 'Des', constitution: 'Con',
        intelligence: 'Int', wisdom: 'Sab', charisma: 'Car',
    }
    const attributes = {} as Record<AttributeKey, number>
    for (const key of Object.keys(attrLabels) as AttributeKey[]) {
        const stat = source.attributes[key]
        const base = baseColumn(stat.scale, ATTRIBUTE_TABLE, from, stat.value)
        const column = pick(overrides, `attr:${key}`, base.column)
        attributes[key] = shift(ATTRIBUTE_TABLE, from, to, base.column, column, stat.value)
        addRow(`attr:${key}`, attrLabels[key], ATTRIBUTE_TABLE, column, stat.value, attributes[key], 'modifier', base.inferred)
    }

    // --- perícias: única estatística sem degrau no índice ---
    const skills: Record<string, number> = {}
    for (const [name, value] of Object.entries(source.skills)) {
        const guess = inferColumn(SKILL_TABLE, from, value)
        const column = pick(overrides, `skill:${name}`, guess)
        skills[name] = shiftBand(SKILL_TABLE, from, to, guess, column, value)
        addRow(
            `skill:${name}`,
            name.charAt(0).toUpperCase() + name.slice(1),
            SKILL_TABLE, column, value, skills[name], 'modifier',
            !overrides[`skill:${name}`],
        )
    }

    // --- golpes ---
    const parsedStrikes = source.statblock?.strikes ?? []
    const strikes: ScaledStrike[] = parsedStrikes.map((strike, index) => {
        const attackBase = strikeColumn(
            source.attackScales, index, parsedStrikes.length, STRIKE_ATTACK_TABLE, from, strike.bonus,
        )
        const attackColumn = pick(overrides, `attack:${index}`, attackBase)
        const bonus = shift(STRIKE_ATTACK_TABLE, from, to, attackBase, attackColumn, strike.bonus)
        addRow(`attack:${index}`, `${strike.name} (ataque)`, STRIKE_ATTACK_TABLE, attackColumn, strike.bonus, bonus, 'modifier')

        const average = formulaAverage(strike.damage?.formula ?? null)
        const damageBase = strikeColumn(
            source.damageScales, index, parsedStrikes.length, STRIKE_DAMAGE_TABLE, from, average ?? 0,
        )
        const damageColumn = pick(overrides, `damage:${index}`, damageBase)
        const damageFormula = shiftDamage(
            from, to, damageBase, damageColumn, strike.damage?.formula ?? null, average,
        )

        if (strike.damage?.riders) {
            warnings.push(`O dano extra de "${strike.name}" (${strike.damage.riders}) não foi reescalado.`)
        }

        return {
            ...strike,
            bonus,
            originalBonus: strike.bonus,
            originalFormula: strike.damage?.formula ?? null,
            damageFormula,
        }
    })

    // Linha de dano depois das de ataque, para o painel não intercalar as duas.
    parsedStrikes.forEach((strike, index) => {
        if (!strike.damage?.formula) return
        const scaled = strikes[index]
        const row = rows.find((r) => r.key === `attack:${index}`)
        const avgFrom = formulaAverage(scaled.originalFormula) ?? 0
        rows.push({
            key: `damage:${index}`,
            label: `${strike.name} (dano)`,
            from: Math.round(avgFrom),
            to: Math.round(formulaAverage(scaled.damageFormula) ?? avgFrom),
            column: pick(
                overrides,
                `damage:${index}`,
                strikeColumn(
                    source.damageScales, index, parsedStrikes.length, STRIKE_DAMAGE_TABLE, from, avgFrom,
                ) ?? row?.column ?? null,
            ),
            inferred: false,
            columns: columnsOf(STRIKE_DAMAGE_TABLE, to),
            kind: 'flat',
            formulaFrom: scaled.originalFormula,
            formulaTo: scaled.damageFormula,
        })
    })

    // --- conjuração: só DC e ataque são estruturados ---
    const spellcasting = (source.statblock?.spellcasting ?? []).map((block) => {
        const dcBase = source.spellDcScale
        const atkBase = source.spellAttackScale ?? source.spellDcScale
        const dcColumn = pick(overrides, 'spellDc', dcBase)
        const atkColumn = pick(overrides, 'spellAttack', atkBase)
        return {
            ...block,
            dc: block.dc === null ? null : shiftSpell(from, to, dcBase, dcColumn, block.dc, 'dc'),
            attack: block.attack === null ? null : shiftSpell(from, to, atkBase, atkColumn, block.attack, 'attack'),
        }
    })

    // --- avisos: tudo que a ferramenta deliberadamente não tocou ---

    // Criatura fora da faixa das tabelas (a Tarrasque é nível 25) não tem
    // degrau atribuído pela AON, e sem degrau `shift` devolve o valor original.
    // Sem este aviso o GM escolheria outro nível, veria a ficha intacta e não
    // saberia por quê — pior do que um erro visível.
    if (source.level < MIN_LEVEL || source.level > MAX_LEVEL) {
        warnings.push(
            `A ficha original é de nível ${source.level}, fora da faixa das tabelas do GM Core `
            + `(${MIN_LEVEL} a ${MAX_LEVEL}): os degraus foram deduzidos do nível ${clampLevel(source.level)} `
            + 'e o resultado é aproximado.',
        )
    }

    const unscaled = rows.filter((r) => r.column === null).map((r) => r.label)
    if (unscaled.length > 0) {
        warnings.push(
            `Sem degrau de referência na AON, então não foi reescalado: ${unscaled.join(', ')}.`,
        )
    }

    if ((source.statblock?.abilities.length ?? 0) > 0) {
        warnings.push(
            'Habilidades especiais não foram reescaladas — ajuste dados e CDs manualmente.',
        )
    }
    if (spellcasting.length > 0) {
        warnings.push(
            'A lista de magias não foi ajustada: a CD e o ataque mudaram, os ranks não.',
        )
    }
    if (source.defenseNotes.length > 0) {
        warnings.push(...source.defenseNotes.map((n) => `Defesa com ressalva, mantida como está: ${n}.`))
    }
    if (parsedStrikes.length === 0 && source.attackBonuses.length > 0) {
        warnings.push('Os golpes desta criatura não puderam ser lidos e não foram reescalados.')
    }

    return {
        source,
        level: to,
        ac, hp, perception, saves, attributes, skills, strikes, spellcasting,
        resistances: shiftDefense(from, to, source.resistances),
        weaknesses: shiftDefense(from, to, source.weaknesses),
        rows,
        warnings,
    }
}

/** CD e ataque de magia vivem na mesma tabela, em campos diferentes. */
function shiftSpell(
    from: number,
    to: number,
    base: ScaleColumn | null,
    target: ScaleColumn | null,
    value: number,
    field: 'dc' | 'attack',
): number {
    if (!base || !target) return value
    const a = SPELL_TABLE[from]?.[base]?.[field]
    const b = SPELL_TABLE[to]?.[target]?.[field]
    if (a === undefined || b === undefined) return value
    return value + (b - a)
}
