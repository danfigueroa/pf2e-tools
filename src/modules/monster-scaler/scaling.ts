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
function inferColumn(
    table: ByLevel<number | Band>,
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
        const target = typeof entry === 'number' ? entry : mid(entry)
        const distance = Math.abs(value - target)
        if (distance < bestDistance) {
            bestDistance = distance
            best = column
        }
    }
    return best
}

/**
 * Desloca preservando a diferença. Sem entrada na tabela (degrau que não existe
 * naquele nível), devolve o valor original em vez de chutar.
 */
function shift(
    table: ByLevel<number>,
    from: number,
    to: number,
    column: ScaleColumn | null,
    value: number,
): number {
    if (!column) return value
    const a = table[from]?.[column]
    const b = table[to]?.[column]
    if (a === undefined || b === undefined) return value
    return value + (b - a)
}

/** PV: razão entre os pontos médios das faixas, nunca menos de 1. */
function shiftHp(from: number, to: number, column: ScaleColumn | null, value: number): number {
    if (!column) return value
    const a = HP_TABLE[from]?.[column]
    const b = HP_TABLE[to]?.[column]
    if (!a || !b || mid(a) === 0) return value
    return Math.max(1, Math.round(value * (mid(b) / mid(a))))
}

/** Perícias com faixa (a coluna Baixa do livro) valem pelo ponto médio. */
function shiftBand(
    table: ByLevel<Band>,
    from: number,
    to: number,
    column: ScaleColumn | null,
    value: number,
): number {
    if (!column) return value
    const a = table[from]?.[column]
    const b = table[to]?.[column]
    if (!a || !b) return value
    return Math.round(value + (mid(b) - mid(a)))
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
    column: ScaleColumn | null,
    formula: string | null,
    average: number | null,
): string | null {
    if (!formula) return null
    if (!column) return formula

    const a = STRIKE_DAMAGE_TABLE[from]?.[column]
    const b = STRIKE_DAMAGE_TABLE[to]?.[column]
    if (!a || !b || a.average === null || b.average === null) return formula
    if (from === to) return formula

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
 * O degrau de um golpe. A AON COLAPSA repetições em `attack_bonus_scale`: uma
 * criatura com três golpes moderados traz `["Moderate"]`, não três itens. Com
 * um item só, ele vale para todos; com a contagem certa, casa por índice; fora
 * disso, deduz do próprio valor.
 */
function strikeColumn(
    scales: (ScaleColumn | null)[],
    index: number,
    strikeCount: number,
    table: ByLevel<number | Band>,
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
    const acColumn = pick(overrides, 'ac', source.ac.scale)
    const ac = shift(AC_TABLE, from, to, acColumn, source.ac.value)
    addRow('ac', 'CA', AC_TABLE, acColumn, source.ac.value, ac, 'flat')

    const hpColumn = pick(overrides, 'hp', source.hp.scale)
    const hp = shiftHp(from, to, hpColumn, source.hp.value)
    addRow('hp', 'PV', HP_TABLE, hpColumn, source.hp.value, hp, 'flat')

    const percColumn = pick(overrides, 'perception', source.perception.scale)
    const perception = shift(PERCEPTION_TABLE, from, to, percColumn, source.perception.value)
    addRow('perception', 'Percepção', PERCEPTION_TABLE, percColumn, source.perception.value, perception, 'modifier')

    const saveLabels = { fort: 'Fortitude', ref: 'Reflexos', will: 'Vontade' } as const
    const saves = { fort: 0, ref: 0, will: 0 }
    for (const key of ['fort', 'ref', 'will'] as const) {
        const stat = source.saves[key]
        const column = pick(overrides, key, stat.scale)
        saves[key] = shift(SAVE_TABLE, from, to, column, stat.value)
        addRow(key, saveLabels[key], SAVE_TABLE, column, stat.value, saves[key], 'modifier')
    }

    // --- atributos ---
    const attrLabels: Record<AttributeKey, string> = {
        strength: 'For', dexterity: 'Des', constitution: 'Con',
        intelligence: 'Int', wisdom: 'Sab', charisma: 'Car',
    }
    const attributes = {} as Record<AttributeKey, number>
    for (const key of Object.keys(attrLabels) as AttributeKey[]) {
        const stat = source.attributes[key]
        const column = pick(overrides, `attr:${key}`, stat.scale)
        attributes[key] = shift(ATTRIBUTE_TABLE, from, to, column, stat.value)
        addRow(`attr:${key}`, attrLabels[key], ATTRIBUTE_TABLE, column, stat.value, attributes[key], 'modifier')
    }

    // --- perícias: única estatística sem degrau no índice ---
    const skills: Record<string, number> = {}
    for (const [name, value] of Object.entries(source.skills)) {
        const guess = inferColumn(SKILL_TABLE, from, value)
        const column = pick(overrides, `skill:${name}`, guess)
        skills[name] = shiftBand(SKILL_TABLE, from, to, column, value)
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
        const attackColumn = pick(
            overrides,
            `attack:${index}`,
            strikeColumn(source.attackScales, index, parsedStrikes.length, STRIKE_ATTACK_TABLE, from, strike.bonus),
        )
        const bonus = shift(STRIKE_ATTACK_TABLE, from, to, attackColumn, strike.bonus)
        addRow(`attack:${index}`, `${strike.name} (ataque)`, STRIKE_ATTACK_TABLE, attackColumn, strike.bonus, bonus, 'modifier')

        const average = source.damageAverages[index] ?? null
        const damageColumn = pick(
            overrides,
            `damage:${index}`,
            strikeColumn(source.damageScales, index, parsedStrikes.length, STRIKE_ATTACK_TABLE, from, average ?? 0),
        )
        const damageFormula = shiftDamage(from, to, damageColumn, strike.damage?.formula ?? null, average)

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
        rows.push({
            key: `damage:${index}`,
            label: `${strike.name} (dano)`,
            from: source.damageAverages[index] ?? 0,
            to: source.damageAverages[index] ?? 0,
            column: pick(overrides, `damage:${index}`, source.damageScales[0] ?? row?.column ?? null),
            inferred: false,
            columns: columnsOf(STRIKE_DAMAGE_TABLE, to),
            kind: 'flat',
            formulaFrom: scaled.originalFormula,
            formulaTo: scaled.damageFormula,
        })
    })

    // --- conjuração: só DC e ataque são estruturados ---
    const spellcasting = (source.statblock?.spellcasting ?? []).map((block) => {
        const dcColumn = pick(overrides, 'spellDc', source.spellDcScale)
        const atkColumn = pick(overrides, 'spellAttack', source.spellAttackScale ?? source.spellDcScale)
        return {
            ...block,
            dc: block.dc === null ? null : shiftSpell(from, to, dcColumn, block.dc, 'dc'),
            attack: block.attack === null ? null : shiftSpell(from, to, atkColumn, block.attack, 'attack'),
        }
    })

    // --- avisos: tudo que a ferramenta deliberadamente não tocou ---
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
    column: ScaleColumn | null,
    value: number,
    field: 'dc' | 'attack',
): number {
    if (!column) return value
    const a = SPELL_TABLE[from]?.[column]?.[field]
    const b = SPELL_TABLE[to]?.[column]?.[field]
    if (a === undefined || b === undefined) return value
    return value + (b - a)
}
