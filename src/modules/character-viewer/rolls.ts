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
export function checkRoll(who: RollerIdentity, title: string, parts: CheckPart[], mythicDelta: number | null, sub?: string): TableRoll {
    const all = mythicDelta != null ? [...parts, mythicPart(mythicDelta)] : parts
    return { ...base(who, title, sub), check: d20Check(all, mythicDelta != null) }
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
    if (input.components.length > 0) {
        const parts = input.components.map((c) =>
            toPart(componentLabel(c), rollGroups(c.value.count ? [{ count: c.value.count, faces: c.value.faces }] : [], c.value.flat), c.persistent))
        const total = Math.max(0, parts.filter((p) => !p.persistent).reduce((s, p) => s + p.total, 0))
        roll.damage = { parts, total }
        if (input.attackParts) {
            const persistent = parts.filter((p) => p.persistent)
            const extra = persistent.length ? ` · persistente dobrado: ${persistent.map((p) => 2 * p.total).join(' + ')}` : ''
            roll.damage.crit = { total: 2 * total, note: `2 × ${total} = ${2 * total}${extra}` }
        }
        if (input.basic) roll.damage.basic = true
    }
    return roll
}
