// Golpe: o número do ataque e o dano, com a conta à mostra — para a rolagem.
//
// O ponto de partida é o que o Pathbuilder já somou (`weapon.attack`, dados com
// striking, `damageBonus` com FOR e especialização). Por cima entram as coisas
// que a ficha NÃO sabe e que mudam o número na mesa, cada uma pela regra:
//
// - **Atributo do ataque.** À distância é DES; corpo a corpo é FOR, e com
//   acuidade vale o melhor DEPOIS das condições (Desajeitado pode fazer a FOR
//   valer mais). É o que decide se Desajeitado ou Enfraquecido pesa — antes a
//   ficha só mostrava "FOR −2 · DES −1 a mais" como aviso.
// - **MAP**: −5/−10, ou −4/−8 com ágil.
// - **Enfraquecido no dano** só quando a arma soma FOR ao dano: corpo a corpo,
//   arremesso e propulsiva. Arco curto não perde nada.
// - **Piso 1** no dano: "if the combined penalties … would reduce the damage
//   to 0 or below, you still deal 1 damage" (Player Core).
// - **Crítico**: dobra o que foi rolado (dados, fixo e extras, precisão
//   incluída). Deadly soma 1/2/3 dados POR FORA do dobro (até striking /
//   greater / major); fatal troca o dado da arma pelo do fatal e soma +1 dado
//   fatal por fora. Efeitos de runa (Flaming, Shock…) e a especialização
//   crítica do grupo entram por fora também (`critEffects.ts`).
//
// Os traços vêm do AON (`services/gear.ts`). Sem eles a arma rola como corpo a
// corpo sem ágil — e a página avisa. Ninguém inventa número em silêncio.

import type { BuildInfo, Weapon } from '../../pathbuilder/types'
import { strikingDice, stepUpDie } from '../../pathbuilder/weapon'
import type { WeaponGear } from '../../services/gear'
import { translateDamageType } from '../transformation-statblock/i18n'
import { exprText, parseDiceExpr, rollGroups, type DiceExpr, type DiceGroup, type RolledExpr } from '../../dice/roll'
import { abilityMod, ABILITY_LABELS, mythicProficiencyDelta, weaponProficiencyRank } from './helpers'
import { conditionParts, type CheckPart } from './checks'
import type { ConditionModifiers } from './conditions'
import { meleeBonusParts } from './rage'
import { fearsomeBruteBonus, hasFearsomeBrute } from './fighter'
import { FIRST_STRIKE_KEY, HUNTERS_AIM_KEY, gravityBonus, hasHuntersAim } from './ranger'
import { hasStrategicStrike, stratagemOn, stratagemQualifies, strategicStrikeDice } from './investigator'
import type { UnarmedAttack } from './unarmed'
import type { MagicWeaponRules } from './magicWeapons'
import { runeCritEffects, specCritEffect, specSourceFor, type CritEffect, type SpecSource } from './critEffects'

export interface WeaponTraits {
    agile: boolean
    finesse: boolean
    ranged: boolean
    thrown: boolean
    propulsive: boolean
    /** Faces do dado deadly ("Deadly d10" → 10). */
    deadly: number | null
    /** Faces do dado fatal ("Fatal d12" → 12). */
    fatal: number | null
    /** Os traços vieram do AON (ou da tabela de desarmados). */
    known: boolean
}

export const UNKNOWN_TRAITS: WeaponTraits = {
    agile: false, finesse: false, ranged: false, thrown: false, propulsive: false,
    deadly: null, fatal: null, known: false,
}

/** Lê os traços como o AON os escreve: "Deadly d10", "Fatal 1d12", "Thrown 20 ft.". */
export function parseWeaponTraits(gear: Pick<WeaponGear, 'traits' | 'weaponType'> | null | undefined): WeaponTraits {
    if (!gear) return UNKNOWN_TRAITS
    const t = gear.traits.map((x) => x.toLowerCase().trim())
    const has = (name: string) => t.some((x) => x === name || x.startsWith(`${name} `))
    const dieOf = (name: string) => {
        for (const x of t) {
            const m = new RegExp(`^${name}\\s+\\d*d(\\d+)`).exec(x)
            if (m) return parseInt(m[1], 10)
        }
        return null
    }
    return {
        agile: has('agile'),
        finesse: has('finesse'),
        ranged: gear.weaponType === 'ranged',
        thrown: has('thrown'),
        propulsive: has('propulsive'),
        deadly: dieOf('deadly'),
        fatal: dieOf('fatal'),
        known: true,
    }
}

/** Uma parcela de dano extra da ficha: "1d6 Electricity", "1d8 precision". */
export interface ExtraDamage {
    key: string
    expr: DiceExpr
    /** Como veio, para o rótulo: "1d6 Electricity". */
    text: string
    /** Tipo canônico em inglês, minúsculo. */
    type: string
    precision: boolean
    persistent: boolean
    /** Começa ligado: tudo menos precisão — que é condicional (Ataque Furtivo,
     *  Hunter's Edge) —, a não ser que venha do perfil escolhido, que já É a
     *  situação dele ("atacando quem não te detecta"). */
    defaultOn: boolean
}

const EXTRA_RE = /^\s*(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?|\d+)\s+(.+?)\s*$/i

export function parseExtraDamage(list: string[] | undefined, fromProfile = false, offset = 0): ExtraDamage[] {
    const out: ExtraDamage[] = []
    for (const raw of list ?? []) {
        const m = EXTRA_RE.exec(String(raw))
        const expr = m ? parseDiceExpr(m[1].replace(/\s+/g, '')) : null
        if (!m || !expr) continue
        const words = m[2].toLowerCase().replace(/\bdamage\b/g, '').trim()
        const persistent = /\bpersistent\b/.test(words)
        const type = words.replace(/\bpersistent\b/, '').trim()
        const precision = type === 'precision'
        out.push({
            key: `${raw}#${offset + out.length}`,
            expr,
            text: String(raw).trim(),
            type,
            precision,
            persistent,
            defaultOn: fromProfile || !precision,
        })
    }
    return out
}

/** "1d6 elétrico", "1d8 precisão", "1d6 sangramento persistente". */
export function extraLabel(e: ExtraDamage): string {
    const type = translateDamageType(e.type)
    return [exprText(e.expr), type, e.persistent ? 'persistente' : ''].filter(Boolean).join(' ')
}

/** Tudo que a rolagem precisa de UMA arma (ou desarmado, ou perfil situacional). */
export interface Strike {
    /** Chave estável — guarda as escolhas de dano extra. */
    key: string
    name: string
    /** O total da ficha, sem condições. */
    attack: number
    /** Atributo que o `attack` da ficha já traz embutido. */
    baseAbility: 'str' | 'dex'
    /** Rank de proficiência que o `attack` traz; `null` = desconhecido (sem ✦). */
    profRank: number | null
    weaponDice: DiceGroup
    damageFlat: number
    /** "cortante", "contundente"… */
    damageType: string
    extras: ExtraDamage[]
    traits: WeaponTraits
    /** Efeitos de runa do crítico: valem sempre. */
    critEffects: CritEffect[]
    /** Especialização crítica do grupo e de onde a ficha a tira; `null` = a ficha não a tem. */
    spec: { effect: CritEffect; source: SpecSource } | null
}

const B_P_S: Record<string, string> = { B: 'contundente', P: 'perfurante', S: 'cortante' }

/**
 * Rank de proficiência que o ataque da ficha de fato usa. O Pathbuilder exporta
 * a CATEGORIA da arma, mas o guerreiro é Mestre no GRUPO (o Ghan Buri tem
 * "martial: Especialista" e ataca com Mestre) — e o ✦ trocaria a proficiência
 * errada. A conta de volta (ataque − nível − atributo − potência) acerta quando
 * o número fecha num rank de verdade; senão vale a categoria.
 */
export function weaponRank(build: BuildInfo, w: Pick<Weapon, 'prof' | 'attack' | 'pot'>, baseAbility: 'str' | 'dex'): number | null {
    const byCategory = weaponProficiencyRank(build, w.prof)
    const implied = w.attack - build.level - abilityMod(build.abilities[baseAbility]) - (w.pot || 0)
    if ([2, 4, 6, 8].includes(implied) && (byCategory == null || implied >= byCategory)) return implied
    return byCategory
}

/** O atributo que o Pathbuilder pôs no ataque: o melhor, se a arma deixa escolher. */
function pathbuilderAbility(build: BuildInfo, traits: WeaponTraits): 'str' | 'dex' {
    if (traits.ranged) return 'dex'
    const str = abilityMod(build.abilities.str)
    const dex = abilityMod(build.abilities.dex)
    if (traits.finesse) return dex > str ? 'dex' : 'str'
    return 'str'
}

/**
 * Arma da ficha → Golpe. `rules`/`profile` aplicam um perfil situacional de
 * `magicWeapons.ts` (Gloom Blade no escuro): potência e striking do perfil e o
 * dano extra dele.
 */
export function weaponStrike(
    build: BuildInfo,
    w: Weapon,
    gear: WeaponGear | null | undefined,
    rules?: MagicWeaponRules | null,
    profileIndex = 0,
): Strike {
    const traits = parseWeaponTraits(gear)
    const profile = profileIndex > 0 ? rules?.profiles[profileIndex - 1] : undefined
    const striking = profile?.striking ?? w.str
    const die = (w.increasedDice ? stepUpDie(w.die) : w.die).toLowerCase().replace(/^d?/, '')
    const baseAbility = pathbuilderAbility(build, traits)
    const effect = specCritEffect(gear?.group, w.pot || 0)
    const source = effect ? specSourceFor(build, { group: gear?.group, ...traits }) : null
    return {
        key: `w:${w.name}:${profileIndex}`,
        // O nome base ("Warhammer"), não o do Pathbuilder com as runas todas —
        // é o título do cartão na mesa, e as runas já aparecem no dano.
        name: w.name,
        attack: w.attack + (profile?.attackDelta ?? 0),
        baseAbility,
        profRank: weaponRank(build, w, baseAbility),
        weaponDice: { count: strikingDice(striking), faces: parseInt(die, 10) || 4 },
        damageFlat: w.damageBonus || 0,
        damageType: B_P_S[(w.damageType || '').toUpperCase()] ?? translateDamageType(w.damageType || ''),
        extras: [
            ...parseExtraDamage(w.extraDamage),
            ...parseExtraDamage(profile?.extraDamage, true, w.extraDamage?.length ?? 0),
        ],
        traits,
        critEffects: runeCritEffects(w.runes),
        spec: effect && source ? { effect, source } : null,
    }
}

/** Desarmado → Golpe. Os traços são da tabela de `unarmed.ts`, então são conhecidos. */
export function unarmedStrike(build: BuildInfo, u: UnarmedAttack): Strike {
    const expr = parseDiceExpr(u.damage) ?? { groups: [{ count: 1, faces: 4 }], flat: 0 }
    return {
        key: `u:${u.en}`,
        name: u.name,
        attack: u.attack,
        baseAbility: u.usesDex ? 'dex' : 'str',
        profRank: build.proficiencies.unarmed ?? 0,
        weaponDice: expr.groups[0] ?? { count: 1, faces: 4 },
        damageFlat: expr.flat,
        damageType: u.damageType,
        extras: parseExtraDamage(u.extraDamage),
        traits: { ...UNKNOWN_TRAITS, agile: u.agile, finesse: u.finesse, known: true },
        critEffects: [],
        spec: null,
    }
}

export type AttackMode = 'auto' | 'str' | 'dex' | 'thrown'

export interface StrikeOptions {
    /** 0 = primeiro ataque, 1 = segundo, 2 = terceiro ou mais. */
    map: 0 | 1 | 2
    mode: AttackMode
    /** Liga/desliga por `ExtraDamage.key`; ausente = o padrão (precisão desligada). */
    extrasOn: Record<string, boolean>
    /** Ajuste livre, cru — entra no ataque. */
    attackAdjust: number
    /** Ajuste livre, cru — entra no dano. */
    damageAdjust: number
    /** Valor de amedrontado do alvo — só o Fearsome Brute usa. */
    frightened?: number
}

export const DEFAULT_STRIKE_OPTIONS: StrikeOptions = { map: 0, mode: 'auto', extrasOn: {}, attackAdjust: 0, damageAdjust: 0 }

/** A escolha do jogador sobre a especialização crítica, junto dos chips de dano extra. */
export const SPEC_KEY = 'crit-spec'

/** Vale neste golpe? A ficha decide; o chip só vence onde a situação é do jogador. */
export function specActive(s: Strike, mods: ConditionModifiers, on: Record<string, boolean>): boolean {
    if (!s.spec) return false
    switch (s.spec.source.kind) {
        case 'always': return true
        case 'raging': return !!mods.rage
        case 'prey': return on[SPEC_KEY] !== false
        case 'situational': return on[SPEC_KEY] === true
    }
}

/**
 * Presa marcada com Hunter's Edge: Precision: o dano de precisão da arma vem
 * ligado (a escolha do jogador, quando existe, vale sempre).
 */
export const extraEnabled = (e: ExtraDamage, on: Record<string, boolean>, mods?: ConditionModifiers) =>
    on[e.key] ?? (e.defaultOn || (e.precision && !!mods?.ranger?.precisionOnPrey))

export const mapPenalty = (agile: boolean, map: 0 | 1 | 2): number =>
    map === 0 ? 0 : (agile ? -4 : -5) * map

/**
 * O dano da postura Arcane Cascade como parcela extra: só corpo a corpo, sempre
 * ligada (a postura É a escolha) e dobrada no crítico como todo dano rolado.
 */
function cascadeExtras(mods: ConditionModifiers, ranged: boolean): ExtraDamage[] {
    const c = mods.cascade
    if (!c || ranged) return []
    return [{
        key: 'arcane-cascade',
        expr: { groups: [], flat: c.damage },
        text: `${c.damage} ${c.type}`,
        type: c.type,
        precision: false,
        persistent: false,
        defaultOn: true,
    }]
}

/** Strategic Strike: precisão sempre ligada (o estratagema É a escolha), dobrada no crítico. */
function strategicStrikeExtras(stratagem: { dice: number } | null): ExtraDamage[] {
    if (!stratagem) return []
    return [{
        key: 'strategic-strike',
        expr: { groups: [{ count: stratagem.dice, faces: 6 }], flat: 0 },
        text: `${stratagem.dice}d6 precision`,
        type: 'precision',
        precision: true,
        persistent: false,
        defaultOn: true,
    }]
}

/** A conta do Golpe antes de rolar: o que a prévia mostra e o que a rolagem usa. */
export interface StrikePlan {
    ability: 'str' | 'dex'
    attackParts: CheckPart[]
    attackTotal: number
    /** Somar para trocar a proficiência pela mítica; `null` = rank desconhecido. */
    mythicDelta: number | null
    /** Dados e fixo da arma (com Enfraquecido e ajuste). */
    weapon: DiceExpr
    damageParts: CheckPart[]
    extras: ExtraDamage[]
    /** Dados extras do crítico, rolados por fora do dobro. */
    deadly: DiceGroup | null
    fatal: number | null
    /** Runas e a especialização ligada; o que não está ligado fica de fora. */
    critEffects: CritEffect[]
    warnings: string[]
    /** Estratagema de ataque (Investigador): o Golpe soma INT e leva o Strategic Strike. */
    stratagem: { dice: number } | null
}

/** Gravity Weapon vale em Golpe com arma (não desarmado) enquanto ativa. */
export const gravityApplies = (s: Strike, mods: ConditionModifiers): boolean =>
    !!mods.ranger?.gravity && s.key.startsWith('w:')

/** Hunter's Aim: só quem tem o talento, e só em Golpe à distância (ou arremessado). */
export const huntersAimApplies = (build: BuildInfo, s: Strike, opts: Pick<StrikeOptions, 'mode'>): boolean =>
    hasHuntersAim(build) && (s.traits.ranged || opts.mode === 'thrown')

export function planStrike(build: BuildInfo, s: Strike, mods: ConditionModifiers, opts: StrikeOptions): StrikePlan {
    const { traits } = s
    const warnings: string[] = []
    const modOf = (a: 'str' | 'dex') => abilityMod(build.abilities[a])
    const cond = (a: 'str' | 'dex') => mods.total[a === 'str' ? 'attackStr' : 'attackDex']

    // Qual atributo vale neste ataque.
    let ability: 'str' | 'dex' = s.baseAbility
    if (opts.mode === 'str' || opts.mode === 'dex') ability = opts.mode
    else if (opts.mode === 'thrown' || traits.ranged) ability = 'dex'
    else if (traits.finesse) {
        // Acuidade: o melhor DEPOIS das condições; empate fica com o da ficha.
        const score = (a: 'str' | 'dex') => modOf(a) - modOf(s.baseAbility) + cond(a)
        const other = s.baseAbility === 'str' ? 'dex' : 'str'
        if (score(other) > score(s.baseAbility)) ability = other
    }
    if (!traits.known) warnings.push('Traços da arma não encontrados no AON: rolando como corpo a corpo, sem ágil e sem deadly/fatal.')

    // Devise a Stratagem (ataque): com arma que pode somar INT, vale INT no lugar de FOR/DES.
    // Strategic Strike vem junto, mesmo que INT e DES empatem — a regra é "somar INT por causa do estratagema".
    const devising = stratagemOn(build, opts.extrasOn)
    const stratagemInt = devising && stratagemQualifies(traits)
    if (devising && !stratagemInt) {
        warnings.push(traits.known
            ? 'Devise a Stratagem: esta arma não é ágil nem de acuidade (e não é à distância), então não soma INT nem leva o Strategic Strike. O d20 do estratagema vale do mesmo jeito.'
            : 'Devise a Stratagem: sem os traços da arma não dá para saber se ela soma INT. Se somar, use o ajuste no ataque e acrescente o Strategic Strike à mão.')
    }

    const attackParts: CheckPart[] = [{ label: 'Ficha', value: s.attack, kind: 'base' }]
    if (stratagemInt) {
        attackParts.push({
            label: `${ABILITY_LABELS.int} em vez de ${ABILITY_LABELS[s.baseAbility]} (estratagema)`,
            value: abilityMod(build.abilities.int) - modOf(s.baseAbility),
            kind: 'ability',
        })
        attackParts.push(...conditionParts(mods, 'skillInt'))
    } else {
        if (ability !== s.baseAbility) {
            attackParts.push({
                label: `${ABILITY_LABELS[ability]} em vez de ${ABILITY_LABELS[s.baseAbility]}`,
                value: modOf(ability) - modOf(s.baseAbility),
                kind: 'ability',
            })
        }
        attackParts.push(...conditionParts(mods, ability === 'str' ? 'attackStr' : 'attackDex'))
    }
    const map = mapPenalty(traits.agile, opts.map)
    // Hunter's Aim: Golpe à distância contra a presa (2 ações), escolha do jogador.
    if (huntersAimApplies(build, s, opts) && opts.extrasOn[HUNTERS_AIM_KEY] === true) {
        attackParts.push({ label: "Hunter's Aim (circunstância)", value: 2, kind: 'other' })
    }
    if (map) attackParts.push({ label: `${opts.map + 1}º ataque${traits.agile ? ' (ágil)' : ''}`, value: map, kind: 'map' })
    if (opts.attackAdjust) attackParts.push({ label: 'Ajuste', value: opts.attackAdjust, kind: 'other' })
    const attackTotal = attackParts.reduce((sum, p) => sum + p.value, 0)

    // Dano da arma. Enfraquecido só pesa se a arma soma FOR ao dano.
    const strInDamage = !traits.ranged || traits.propulsive || opts.mode === 'thrown'
    const damageParts: CheckPart[] = [{ label: 'Ficha', value: s.damageFlat, kind: 'base' }]
    if (strInDamage && mods.total.damageStr) {
        damageParts.push(...conditionParts(mods, 'damageStr'))
    }
    // Bônus de efeito no corpo a corpo (Enlarge) e a Fúria. Arremesso é ataque à distância.
    if (!traits.ranged && opts.mode !== 'thrown') {
        for (const b of meleeBonusParts(mods, { agile: traits.agile, name: s.name })) {
            damageParts.push({ label: b.from, value: b.value, kind: 'other' })
        }
    }
    // Gravity Weapon: status = 2 × dados da arma, no primeiro Golpe com ARMA da rodada.
    if (gravityApplies(s, mods) && opts.extrasOn[FIRST_STRIKE_KEY] !== false) {
        damageParts.push({ label: 'Gravity Weapon (status, 2 × dados)', value: gravityBonus(s.weaponDice.count), kind: 'other' })
    }
    // Fearsome Brute: circunstância, 2 × (3 × se mestre em Intimidação) o medo do alvo.
    const brute = hasFearsomeBrute(build) ? fearsomeBruteBonus(build, opts.frightened ?? 0) : 0
    if (brute) damageParts.push({ label: `Fearsome Brute (amedrontado ${opts.frightened})`, value: brute, kind: 'other' })
    if (opts.damageAdjust) damageParts.push({ label: 'Ajuste', value: opts.damageAdjust, kind: 'other' })
    const flat = damageParts.reduce((sum, p) => sum + p.value, 0)

    const stratagem = stratagemInt && hasStrategicStrike(build) ? { dice: strategicStrikeDice(build.level) } : null

    // Deadly: 1 dado; 2 com greater striking (3 dados de arma), 3 com major (4).
    const deadly = traits.deadly
        ? { count: Math.max(1, s.weaponDice.count - 1), faces: traits.deadly }
        : null

    return {
        ability,
        attackParts,
        attackTotal,
        mythicDelta: s.profRank == null ? null : mythicProficiencyDelta(build.level, s.profRank),
        weapon: { groups: [s.weaponDice], flat },
        damageParts,
        extras: [
            ...s.extras.filter((e) => extraEnabled(e, opts.extrasOn, mods)),
            ...cascadeExtras(mods, traits.ranged || opts.mode === 'thrown'),
            ...strategicStrikeExtras(stratagem),
        ],
        deadly,
        fatal: traits.fatal,
        critEffects: [...s.critEffects, ...(specActive(s, mods, opts.extrasOn) ? [s.spec!.effect] : [])],
        warnings,
        stratagem,
    }
}

/** Uma parcela do dano rolado, como aparece no memorial e na bandeja. */
export interface DamagePartRoll {
    label: string
    rolled: RolledExpr
    persistent: boolean
}

export interface DamageRoll {
    parts: DamagePartRoll[]
    /** Dano imediato (sem os persistentes), com piso 1. */
    total: number
    crit: { total: number; note: string; extra: DamagePartRoll[] }
}

const plusTotal = (parts: DamagePartRoll[]) => parts.reduce((s, p) => s + p.rolled.total, 0)

/**
 * Rola o dano de um Golpe e monta o crítico a partir do MESMO rolado. Fatal é a
 * única exceção: o dado da arma muda de tamanho, então os dados da arma do
 * crítico são rolados de novo no tamanho do fatal.
 */
export function rollStrikeDamage(plan: StrikePlan, damageType: string): DamageRoll {
    const weapon = rollGroups(plan.weapon.groups, plan.weapon.flat)
    const parts: DamagePartRoll[] = [{ label: damageType, rolled: weapon, persistent: false }]
    for (const e of plan.extras) {
        parts.push({ label: extraLabel(e), rolled: rollGroups(e.expr.groups, e.expr.flat), persistent: e.persistent })
    }
    const immediate = parts.filter((p) => !p.persistent)
    const total = Math.max(1, plusTotal(immediate))

    const extra: DamagePartRoll[] = []
    // O que soma ao dano imediato do alvo por fora do dobro.
    let outside = 0
    // Persistente do crítico e efeitos fora do alvo: aparecem na nota, não no total.
    const aside: string[] = []
    let critBase = total
    let note = `2 × ${total}`
    if (plan.fatal) {
        const fatalWeapon = rollGroups(plan.weapon.groups.map((g) => ({ ...g, faces: plan.fatal! })), plan.weapon.flat)
        extra.push({ label: `fatal: arma em d${plan.fatal}`, rolled: fatalWeapon, persistent: false })
        critBase = Math.max(1, fatalWeapon.total + plusTotal(immediate.slice(1)))
        note = `2 × ${critBase}`
        const plus = rollGroups([{ count: 1, faces: plan.fatal }])
        extra.push({ label: `fatal +1d${plan.fatal}`, rolled: plus, persistent: false })
        outside += plus.total
        note += ` + fatal 1d${plan.fatal} (${plus.total})`
    }
    if (plan.deadly) {
        const d = rollGroups([plan.deadly])
        extra.push({ label: `deadly ${plan.deadly.count}d${plan.deadly.faces}`, rolled: d, persistent: false })
        outside += d.total
        note += ` + deadly ${plan.deadly.count}d${plan.deadly.faces} (${d.total})`
    }

    const weaponDice = plan.weapon.groups.reduce((n, g) => n + g.count, 0)
    for (const c of plan.critEffects) {
        if (c.damage) {
            const d = c.damage
            const flat = d.expr.flat + (d.perDie ?? 0) * weaponDice
            const rolled = rollGroups(d.expr.groups, flat)
            const type = translateDamageType(d.type)
            const label = `${c.label}: ${rolled.dice.length ? exprText({ groups: d.expr.groups, flat }) : flat} ${type}${d.persistent ? ' persistente' : ''}`
            extra.push({ label, rolled, persistent: d.persistent })
            if (d.to === 'armor') aside.push(`${c.label}: ${rolled.total} ${type} na armadura/escudo do alvo`)
            else if (d.persistent) aside.push(`${c.label}: ${rolled.total} ${type} persistente`)
            else { outside += rolled.total; note += ` + ${c.label} ${rolled.total}` }
        }
        if (c.mirrors) {
            // Mesmo dano do extra do tipo, em outras criaturas: não soma ao alvo, não dobra.
            const at = plan.extras.findIndex((e) => !e.persistent && e.type === c.mirrors)
            const hit = at >= 0 ? parts[at + 1] : null
            aside.push(hit
                ? `${c.label}: ${hit.rolled.total} ${translateDamageType(c.mirrors)} em até 2 criaturas a 3 m do alvo`
                : `${c.label}: mesmo dano ${translateDamageType(c.mirrors)} em até 2 criaturas a 3 m do alvo`)
        }
        if (c.note) aside.push(`${c.label}: ${c.note}`)
    }

    const critTotal = 2 * critBase + outside
    const persistent = parts.filter((p) => p.persistent)
    if (persistent.length) note += ` · persistente dobrado: ${persistent.map((p) => 2 * p.rolled.total).join(' + ')}`
    note = `${note} = ${critTotal}`
    if (aside.length) note += ` · ${aside.join(' · ')}`
    return { parts, total, crit: { total: critTotal, note, extra } }
}
