// Monta a rolagem que vai para a mesa a partir da conta já feita — teste
// (`checks.ts`), Golpe (`strikes.ts`) ou magia (`heightening.ts`).
//
// Puro de propósito: a página só decide QUANDO rolar, e o `check-rolls.mjs`
// confere estas funções com os mesmos números da ficha. A regra que vale para
// todas: o memorial (`check.parts`) soma EXATAMENTE o modificador rolado — a
// mesa confere a conta parcela por parcela.

import type { BuildInfo, SpellCaster } from '../character-sheet/types'
import { CAMPAIGN_PRESETS } from './campaignPresets'
import { charSlug } from './charId'
import { abilityMod, ABILITY_LABELS, isMythicMagicCaster, MYTHIC_PROFICIENCY_BONUS, mythicProficiencyDelta, proficiencyLabel, type AbilityKey } from './helpers'
import { conditionParts, type CheckPart } from './checks'
import type { ConditionModifiers } from './conditions'
import { rollDie, rollGroups, type RolledExpr } from '../../dice/roll'
import { newRollId, type RolledPart, type TableRoll } from '../../dice/tableRoll'
import { rollStrikeDamage, type Strike, type StrikePlan } from './strikes'
import { componentLabel, type ScaledComponent } from './heightening'
import { DEGREE_LABEL, treatWoundsOutcome, type Degree, type TreatVariant, type TreatWoundsOption } from './treatWounds'

/** Quem rola: o nome curto da mesa, o slug e a cor dos dados. */
export interface RollerIdentity {
    by: string
    slug: string
    color: string
}

/** Cores de dado legíveis no cartão escuro — sem o preto e o branco do mapa. */
const DIE_COLORS = ['#E0531F', '#3FA9F5', '#6BBF3A', '#9B59D0', '#F2D04B', '#FF6FB5', '#7DF9FF', '#C8A951']

export function rollerIdentity(build: BuildInfo): RollerIdentity {
    const slug = charSlug(build)
    const preset = CAMPAIGN_PRESETS.find((p) => p.sheetName === build.name)
    // "Brukuthur, The Barbarian Android" → "Brukuthur": o nome da mesa, não o do Pathbuilder.
    const by = preset?.name ?? build.name.split(',')[0].trim()
    let hash = 0
    for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
    return { by, slug, color: DIE_COLORS[hash % DIE_COLORS.length] }
}

const sum = (parts: CheckPart[]) => parts.reduce((s, p) => s + p.value, 0)

/** A parcela que troca a proficiência pela mítica (o delta, não +10 por cima). */
export const mythicPart = (delta: number): CheckPart => ({ label: '✦ proficiência mítica', value: delta, kind: 'mythic' })

const toPart = (label: string, r: RolledExpr, persistent = false): RolledPart => ({
    label,
    dice: r.dice,
    flat: r.flat,
    total: r.total,
    ...(persistent ? { persistent: true } : {}),
})

function d20Check(parts: CheckPart[], mythic: boolean): NonNullable<TableRoll['check']> {
    const d20 = rollDie(20)
    const mod = sum(parts)
    return { d20, mod, total: d20 + mod, mythic, parts: parts.map(({ label, value }) => ({ label, value })) }
}

const base = (who: RollerIdentity, title: string, sub?: string): TableRoll => ({
    id: newRollId(),
    at: Date.now(),
    by: who.by,
    slug: who.slug,
    color: who.color,
    title,
    ...(sub ? { sub } : {}),
})

/**
 * Teste de d20: salvaguarda, Percepção, perícia, ataque de magia. `parts` é o
 * memorial já com o ajuste; `mythicDelta` (quando rolado no mítico) entra como
 * mais uma parcela.
 */
export function checkRoll(
    who: RollerIdentity,
    title: string,
    parts: CheckPart[],
    mythicDelta: number | null,
    sub?: string,
    initiative = false,
): TableRoll {
    const all = mythicDelta != null ? [...parts, mythicPart(mythicDelta)] : parts
    return { ...base(who, title, sub), check: d20Check(all, mythicDelta != null), ...(initiative ? { initiative: true as const } : {}) }
}

/** Golpe: o ataque e o dano saem juntos, com o crítico já montado. */
export function strikeRoll(
    who: RollerIdentity,
    strike: Strike,
    plan: StrikePlan,
    mythicDelta: number | null,
    sub?: string,
): TableRoll {
    const attackParts = mythicDelta != null ? [...plan.attackParts, mythicPart(mythicDelta)] : plan.attackParts
    const dmg = rollStrikeDamage(plan, strike.damageType)
    return {
        ...base(who, `Golpe — ${strike.name}`, sub),
        check: d20Check(attackParts, mythicDelta != null),
        damage: {
            parts: dmg.parts.map((p) => toPart(p.label, p.rolled, p.persistent)),
            total: dmg.total,
            crit: { total: dmg.crit.total, note: dmg.crit.note },
        },
    }
}

/**
 * A explosão do Fiery Rebirth: fogo em quem está adjacente, Reflexos básico
 * contra a CD de classe. Dano fixo (2 × nível), então não há dado a rolar.
 */
export function fieryRebirthRoll(who: RollerIdentity, damage: number, dc: number): TableRoll {
    const roll = base(who, 'Fiery Rebirth', `Reflexos básico · CD ${dc}`)
    roll.damage = {
        parts: [{ label: 'fogo (adjacentes)', dice: [], flat: damage, total: damage }],
        total: damage,
        basic: true,
    }
    return roll
}

/**
 * O veneno simples do Poison Weapon (1d4 de veneno, 2d4 com o Improved) entra no
 * Golpe como parcela à parte. NÃO dobra no crítico: o veneno é efeito da injeção,
 * não dano do Golpe — e sem salvaguarda. Vale se o Golpe acertar; a mesa decide.
 */
export function withSimplePoison(roll: TableRoll, dice: { count: number; faces: number }): TableRoll {
    if (!roll.damage) return roll
    const rolled = rollGroups([dice])
    const label = `veneno simples (${dice.count}d${dice.faces})`
    const dmg = roll.damage
    return {
        ...roll,
        damage: {
            ...dmg,
            parts: dmg.parts.length < 8 ? [...dmg.parts, toPart(label, rolled)] : dmg.parts,
            total: dmg.total + rolled.total,
            ...(dmg.crit
                ? { crit: { total: dmg.crit.total + rolled.total, note: `${dmg.crit.note} + veneno ${rolled.total} (não dobra)` } }
                : {}),
        },
    }
}

/** A magia que entra no Golpe do Spellstrike. */
export interface SpellstrikeInput {
    name: string
    /** Dano escolhido, já no rank em que a magia entra. */
    components: ScaledComponent[]
    /** Ataque de magia: usa o resultado do Golpe e dobra no crítico. Salvaguarda: não dobra. */
    usesAttack: boolean
}

/**
 * Spellstrike: o Golpe e a magia numa rolagem só. O ataque é o do Golpe; o dano
 * soma os dois (para resistências e fraquezas é um dano só). No crítico a magia
 * de ATAQUE dobra junto; a de salvaguarda fica como está, porque o alvo faz a
 * própria salvaguarda e o crítico do Golpe não a muda.
 */
export function spellstrikeRoll(
    who: RollerIdentity,
    strike: Strike,
    plan: StrikePlan,
    mythicDelta: number | null,
    sub: string | undefined,
    spell: SpellstrikeInput,
): TableRoll {
    const roll = strikeRoll(who, strike, plan, mythicDelta, sub)
    roll.title = `Spellstrike — ${strike.name} + ${spell.name}`
    const parts = spell.components.map((c) =>
        toPart(componentLabel(c), rollGroups(c.value.count ? [{ count: c.value.count, faces: c.value.faces }] : [], c.value.flat), c.persistent))
    const spellTotal = Math.max(0, parts.filter((p) => !p.persistent).reduce((n, p) => n + p.total, 0))
    const dmg = roll.damage!
    // O feed aceita até 8 parcelas de dano; passando disso a rolagem inteira seria
    // recusada. As da magia viram uma só (a soma de tudo que não é persistente).
    dmg.parts = dmg.parts.length + parts.length <= 8
        ? [...dmg.parts, ...parts]
        : [...dmg.parts, { label: `magia: ${spell.name}`, dice: [], flat: spellTotal, total: spellTotal }]
    dmg.total += spellTotal
    if (dmg.crit) {
        const extra = spell.usesAttack ? 2 * spellTotal : spellTotal
        dmg.crit = {
            total: dmg.crit.total + extra,
            note: `${dmg.crit.note} + magia ${spell.usesAttack ? `2 × ${spellTotal}` : spellTotal} = ${dmg.crit.total + extra}`,
        }
    }
    return roll
}

// ── Magia ────────────────────────────────────────────────────────────────────

/** O ataque de magia de um bloco de conjuração, com a conta e o ✦. */
export interface SpellAttackInfo {
    parts: CheckPart[]
    total: number
    /** Somar para rolar no mítico; `null` = já é mítico (Mythic Magic) ou sem rank. */
    mythicDelta: number | null
    /** O bloco já usa a proficiência mítica — e o ponto saiu ao conjurar. */
    alreadyMythic: boolean
}

export function casterAttack(build: BuildInfo, caster: SpellCaster, mods: ConditionModifiers): SpellAttackInfo {
    const ability = (caster.ability || '').toLowerCase() as AbilityKey
    const mythicMagic = isMythicMagicCaster(caster)
    const rank = caster.proficiency ?? 0
    const parts: CheckPart[] = [
        mythicMagic
            ? { label: 'Mítica', value: build.level + MYTHIC_PROFICIENCY_BONUS, kind: 'prof' }
            // Mesma conta de `spellcasterStats` (o "Atq" do cartão): bloco de
            // conjuração nunca é destreinado, e os dois números têm de bater.
            : { label: proficiencyLabel(rank), value: build.level + rank, kind: 'prof' },
        { label: ABILITY_LABELS[ability] ?? ability.toUpperCase(), value: abilityMod(build.abilities[ability] || 10), kind: 'ability' },
        ...conditionParts(mods, 'attackSpell'),
    ]
    return {
        parts,
        total: sum(parts),
        mythicDelta: mythicMagic ? null : mythicProficiencyDelta(build.level, rank),
        alreadyMythic: mythicMagic,
    }
}

/** Ataque das magias de foco, pelos números que o Pathbuilder dá no `build.focus`. */
export function focusAttack(
    build: BuildInfo,
    group: { proficiency?: number; abilityBonus?: number; itemBonus?: number },
    mods: ConditionModifiers,
): SpellAttackInfo | null {
    const { proficiency, abilityBonus, itemBonus } = group
    if (proficiency == null || abilityBonus == null) return null
    const parts: CheckPart[] = [
        { label: proficiencyLabel(proficiency), value: proficiency > 0 ? build.level + proficiency : 0, kind: 'prof' },
        { label: 'Atributo', value: abilityBonus, kind: 'ability' },
        ...(itemBonus ? [{ label: 'Item', value: itemBonus, kind: 'item' as const }] : []),
        ...conditionParts(mods, 'attackSpell'),
    ]
    return { parts, total: sum(parts), mythicDelta: mythicProficiencyDelta(build.level, proficiency), alreadyMythic: false }
}

export const mapLabel = (map: 0 | 1 | 2, agile = false) =>
    map === 0 ? '1º ataque' : `${map + 1}º ataque (${agile ? (map === 1 ? '−4' : '−8') : (map === 1 ? '−5' : '−10')})`

/**
 * Magia: o ataque (se tiver o traço ataque) e o dano dos componentes escolhidos,
 * no rank conjurado. Os componentes vêm do `scaleSpell` — o mesmo número que a
 * linha e o drawer mostram.
 */
export function spellRoll(
    who: RollerIdentity,
    input: {
        name: string
        sub?: string
        /** Memorial do ataque, já com MAP e ajuste; `null` = magia sem ataque. */
        attackParts: CheckPart[] | null
        mythicDelta: number | null
        components: ScaledComponent[]
        basic: boolean
    },
): TableRoll {
    const roll = base(who, input.name, input.sub)
    if (input.attackParts) {
        const parts = input.mythicDelta != null ? [...input.attackParts, mythicPart(input.mythicDelta)] : input.attackParts
        roll.check = d20Check(parts, input.mythicDelta != null)
    }
    if (input.components.length > 0) roll.damage = spellDamage(input.components, !!input.attackParts, input.basic)
    return roll
}

/** O dano rolado dos componentes escolhidos; magia de ataque ganha o crítico (dobro). */
function spellDamage(components: ScaledComponent[], withCrit: boolean, basic: boolean): NonNullable<TableRoll['damage']> {
    const parts = components.map((c) =>
        toPart(componentLabel(c), rollGroups(c.value.count ? [{ count: c.value.count, faces: c.value.faces }] : [], c.value.flat), c.persistent))
    const total = Math.max(0, parts.filter((p) => !p.persistent).reduce((s, p) => s + p.total, 0))
    const damage: NonNullable<TableRoll['damage']> = { parts, total }
    // Persistente de magia fica fora do dobro: costuma ser de um grau só
    // (o 5d4 da Ignition só existe no crítico), e a prosa decide.
    if (withCrit) damage.crit = { total: 2 * total, note: `2 × ${total} = ${2 * total}` }
    if (basic) damage.basic = true
    return damage
}

/**
 * Magia que dispara VÁRIOS raios (Blazing Bolt): um ataque e um dano por raio, todos
 * numa rolagem só — o cartão da mesa mostra os raios e o total, em vez de um popup por raio.
 */
export function raysRoll(
    who: RollerIdentity,
    input: {
        name: string
        sub?: string
        /** Um item por raio: o memorial do ataque (igual para todos) e o ✦, se houver. */
        rays: Array<{ attackParts: CheckPart[]; mythicDelta: number | null }>
        components: ScaledComponent[]
    },
): TableRoll {
    const roll = base(who, input.name, input.sub)
    roll.rays = input.rays.map((ray) => {
        const parts = ray.mythicDelta != null ? [...ray.attackParts, mythicPart(ray.mythicDelta)] : ray.attackParts
        return {
            check: d20Check(parts, ray.mythicDelta != null),
            damage: spellDamage(input.components, true, false),
        }
    })
    return roll
}

/**
 * Tratar Ferimentos ou Battle Medicine: o teste de Medicina contra a CD escolhida
 * e, conforme o grau, a cura (`free`, 2d8 ou 4d8 + bônus da CD) ou 1d8 de dano na
 * falha crítica. `delta` é quanto o PV de quem foi tratado muda (negativo = dano);
 * `selfDamage` é o 1d8 cortante da Risky Surgery, que cai ANTES da cura.
 */
export function treatWoundsRoll(
    who: RollerIdentity,
    parts: CheckPart[],
    option: TreatWoundsOption,
    mythicDelta: number | null = null,
    variant: TreatVariant = { mode: 'treat' },
): { roll: TableRoll; degree: Degree; delta: number; selfDamage: number; removesWounded: boolean } {
    const battle = variant.mode === 'battle'
    const sub = [`Medicina · CD ${option.dc}`, variant.hour && !battle ? '1 hora' : null, variant.risky && !battle ? 'Risky Surgery' : null]
        .filter(Boolean).join(' · ')
    const roll = checkRoll(who, battle ? 'Battle Medicine' : 'Tratar Ferimentos', parts, mythicDelta, sub)
    const check = roll.check!
    const out = treatWoundsOutcome({ total: check.mod }, check.d20, option, variant)
    let delta = 0
    if (out.dice) {
        const rolled = rollGroups([{ count: out.dice.count, faces: 8 }], out.flat)
        if (out.doubled) {
            // A cura em dobro cabe numa parcela só: o fixo leva o que falta (dados + 2×bônus), e o total fecha.
            const sumDice = rolled.dice.reduce((n, d) => n + d.value, 0)
            rolled.flat = 2 * out.flat + sumDice
            rolled.total = 2 * sumDice + 2 * out.flat
        }
        roll.free = toPart(out.dice.heals ? (out.doubled ? 'Cura em dobro (1 h)' : 'Cura') : 'Dano', rolled)
        delta = out.dice.heals ? rolled.total : -rolled.total
    }
    let selfDamage = 0
    if (variant.risky && !battle) {
        const cut = rollGroups([{ count: 1, faces: 8 }], 0)
        selfDamage = cut.total
        roll.damage = { parts: [toPart('Risky Surgery (cortante)', cut)], total: cut.total }
    }
    roll.note = [
        DEGREE_LABEL[out.degree] + (delta === 0 ? ' — nenhuma cura' : ''),
        out.removesWounded ? 'tira Ferido' : null,
        battle ? 'Alvo imune ao seu Battle Medicine por 1 dia' : 'Alvo imune a Tratar Ferimentos por 1 hora',
    ].filter(Boolean).join('. ') + '.'
    return { roll, degree: out.degree, delta, selfDamage, removesWounded: out.removesWounded }
}
