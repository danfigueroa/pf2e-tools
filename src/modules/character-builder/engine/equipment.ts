// Equipamento (MOTOR-DE-REGRAS §6, §7 e §12). Regras conferidas na AON, Remaster:
// - Volume: 5 + FOR sem penalidade; acima disso, sobrecarregado; nunca mais que 10 + FOR (Player Core pg. 269). L = 1/10.
//   Moedas: mil de qualquer tipo = 1 Volume, frações de mil arredondadas para baixo (Player Core pg. 269).
// - Investidos: no máximo 10 (GM Core pg. 219).
// - CA = 10 + DES (até o teto da armadura) + proficiência da categoria + bônus de item (armadura + potência) (Player Core
//   pg. 271). Força da armadura: com FOR igual ou maior, some a penalidade de teste e a de deslocamento cai 5 pés (pg. 271).
// - Escudo: não soma na CA até ser erguido (a Ficha soma); o export leva `shieldBonus` à parte.
// - Resiliente: bônus de item nas salvaguardas; potência de armadura: bônus de item na CA (GM Core pg. 226).
// - Potência de arma: bônus de item no ataque e uma runa de propriedade por ponto; striking soma dados (GM Core pg. 236).
// - Ataque corpo a corpo: FOR, ou DES com acuidade; à distância: DES. Dano corpo a corpo: + FOR; arremesso: + FOR;
//   propulsiva: + metade da FOR (a FOR inteira se negativa) (Player Core pg. 275).
// - Especialização: +2/+3/+4 (perito/mestre/lendário); a maior dobra para 4/6/8 (texto das características na AON).
// - Riqueza inicial: 15 po no nível 1 (Player Core pg. 10); acima, a tabela Character Wealth do GM Core é referência (D6).
import { tr } from '../../../i18n'
import type { BuildState, InventoryEntry } from '../types'
import type { RuleEntry } from '../rules/types'
import type { AttributeKey, Rank, RulesIndex, Stat, Warning } from './types'

export interface ResolvedItem {
    key: string
    entry: RuleEntry | null
    /** Entrada com os números (a base, quando o item é específico: Hero's Plate → Full Plate). */
    base: RuleEntry | null
    name: string
    qty: number
    bulk: number
    price: number
    inv: InventoryEntry
}

export interface Strike {
    key: string
    name: string
    display: string
    category: string
    group?: string
    die: string
    dice: number
    damageType: string
    attack: number
    damageBonus: number
    traits: string[]
    attackParts: { label: string; value: number }[]
    damageParts: { label: string; value: number }[]
    range?: number
    potency: number
    striking: number
    runes: string[]
    material?: string
}

export interface EquipmentResult {
    items: ResolvedItem[]
    bulk: { total: number; encumberedAt: number; max: number; coins: number }
    invested: number
    money: { start: number; spent: number; remaining: number }
    armor: { item: ResolvedItem; category: string; ac: number; dexCap: number; potency: number; resilient: number; checkPenalty: number; speedPenalty: number; strengthMet: boolean } | null
    shield: { item: ResolvedItem; ac: number; hardness?: number; hp?: number } | null
    strikes: Strike[]
}

const ATTR_LABEL: Record<AttributeKey, string> = { str: tr('FOR', 'STR'), dex: tr('DES', 'DEX'), con: 'CON', int: 'INT', wis: tr('SAB', 'WIS'), cha: tr('CAR', 'CHA') }
const COINS_GP = (m: BuildState['money']) => m.pp * 10 + m.gp + m.sp / 10 + m.cp / 100
export const STARTING_GOLD = 15

const bulkOf = (b: number | 'L' | undefined) => (b === 'L' ? 0.1 : typeof b === 'number' ? b : 0)
const TRAIT = (t: string) => t.toLowerCase().split(' ')[0]
const STRIKING_NAME = ['', 'Striking', 'Greater Striking', 'Major Striking']
const RESILIENT_NAME = ['', 'resilient', 'greater resilient', 'major resilient']

/** Grupo escolhido nas características de grupo de arma (Player Core pg. 136). */
export const GROUP_FEATURES: { name: RegExp; ranks: { simple: Rank; martial: Rank; unarmed: Rank; advanced: Rank } }[] = [
    { name: /^fighter weapon mastery$/i, ranks: { simple: 3, martial: 3, unarmed: 3, advanced: 2 } },
    { name: /^weapon legend$/i, ranks: { simple: 4, martial: 4, unarmed: 4, advanced: 3 } },
]

export function resolveItems(state: BuildState, rules: RulesIndex, warnings: Warning[]): ResolvedItem[] {
    return state.inventory.map((inv) => {
        const entry = rules.get(inv.item) ?? null
        const baseName = entry?.item?.baseItem ? [entry.item.baseItem].flat()[0] : undefined
        const base = entry && (entry.item?.weapon || entry.item?.armor || entry.item?.shield) ? entry : baseName ? rules.byName(baseName) ?? null : null
        // Item caseiro (F8.12): só o nome; preço, volume e efeitos não entram nos números.
        if (!entry && inv.item.startsWith('custom:')) {
            warnings.push({ code: 'CUSTOM_ITEM', level: 'info', ref: 'equipment', message: tr(`${inv.customName ?? inv.item}: item caseiro — preço, volume e efeitos não entram nos números.`, `${inv.customName ?? inv.item}: homebrew item — price, bulk and effects are not in the numbers.`) })
        } else if (!entry) warnings.push({ code: 'ENTRY_NOT_FOUND', level: 'warn', ref: 'equipment', message: tr(`Item fora do catálogo atual: ${inv.customName ?? inv.item}.`, `Item not in the current catalog: ${inv.customName ?? inv.item}.`) })
        if (entry && baseName && entry.item?.subcategory?.startsWith('Specific')) {
            warnings.push({ code: 'SPECIFIC_ITEM', level: 'info', ref: 'equipment', message: tr(`${entry.name}: item específico — confira as runas e efeitos próprios dele.`, `${entry.name}: specific item — check its own runes and effects.`) })
        }
        return {
            key: inv.key, entry, base, name: inv.customName ?? entry?.name ?? inv.item, qty: inv.qty,
            bulk: bulkOf(entry?.item?.bulk) * inv.qty, price: (entry?.item?.price?.gp ?? 0) * inv.qty, inv,
        }
    })
}

export function compileEquipment(state: BuildState, rules: RulesIndex, ctx: {
    level: number
    mod: Record<AttributeKey, number>
    attacks: Partial<Record<'simple' | 'martial' | 'advanced' | 'unarmed', Rank>>
    groupRanks: Record<string, Partial<Record<'simple' | 'martial' | 'advanced' | 'unarmed', Rank>>>
    specialization: 0 | 1 | 2
}, warnings: Warning[]): EquipmentResult {
    const items = resolveItems(state, rules, warnings)
    const str = ctx.mod.str

    // Volume e moedas.
    const coins = Math.floor((state.money.pp + state.money.gp + state.money.sp + state.money.cp) / 1000)
    const total = Math.floor(items.reduce((sum, i) => sum + i.bulk, 0) * 10) / 10 + coins
    const encumberedAt = 5 + str
    const max = 10 + str
    if (total > max) warnings.push({ code: 'OVER_BULK', level: 'warn', ref: 'equipment', message: tr(`Volume ${total} passa do máximo de ${max} (Player Core pg. 269).`, `Bulk ${total} is over the maximum of ${max} (Player Core pg. 269).`) })
    else if (total > encumberedAt) warnings.push({ code: 'ENCUMBERED', level: 'warn', ref: 'equipment', message: tr(`Volume ${total} acima de ${encumberedAt}: sobrecarregado (desajeitado 1, −10 pés).`, `Bulk ${total} over ${encumberedAt}: encumbered (clumsy 1, −10 feet).`) })

    const invested = items.filter((i) => i.inv.invested).length
    if (invested > 10) warnings.push({ code: 'INVESTED_LIMIT', level: 'warn', ref: 'equipment', message: tr(`${invested} itens investidos; o limite é 10 (GM Core pg. 219).`, `${invested} invested items; the limit is 10 (GM Core pg. 219).`) })

    const spent = items.filter((i) => i.inv.acquired === 'bought').reduce((sum, i) => sum + i.price, 0)
    const start = COINS_GP(state.money)
    const remaining = Math.round((start - spent) * 100) / 100
    if (remaining < 0) warnings.push({ code: 'NEGATIVE_MONEY', level: 'warn', ref: 'equipment', message: tr(`Compras passam do dinheiro em ${-remaining} po.`, `Purchases exceed the money by ${-remaining} gp.`) })

    // Armadura vestida (a primeira) e escudo.
    const wornArmor = items.find((i) => i.inv.worn && i.base?.item?.armor)
    let armor: EquipmentResult['armor'] = null
    if (wornArmor) {
        const a = wornArmor.base!.item!.armor!
        const strengthMet = (a.strength ?? 0) <= str
        const rawSpeed = typeof a.speedPenalty === 'number' ? a.speedPenalty : Number(String(a.speedPenalty ?? '0').replace(/[^-\d]/g, '')) || 0
        armor = {
            item: wornArmor, category: (a.category ?? 'unarmored').toLowerCase(), ac: a.ac ?? 0, dexCap: a.dexCap ?? 99,
            potency: wornArmor.inv.runes?.potency ?? 0, resilient: wornArmor.inv.runes?.resilient ?? 0,
            checkPenalty: strengthMet ? 0 : a.checkPenalty ?? 0,
            speedPenalty: strengthMet ? Math.min(0, rawSpeed + 5) : rawSpeed, strengthMet,
        }
        if (wornArmor.inv.runes?.property?.length && (wornArmor.inv.runes.property.length > armor.potency)) {
            warnings.push({ code: 'RUNE_SLOTS', level: 'warn', ref: 'equipment', message: tr(`${wornArmor.name}: mais runas de propriedade que a potência permite.`, `${wornArmor.name}: more property runes than the potency allows.`) })
        }
    }
    if (items.filter((i) => i.inv.worn && i.base?.item?.armor).length > 1) {
        warnings.push({ code: 'TWO_ARMORS', level: 'warn', ref: 'equipment', message: tr('Mais de uma armadura vestida; vale a primeira.', 'More than one armor worn; the first one counts.') })
    }
    const shieldItem = items.find((i) => (i.inv.worn || i.inv.equipped) && i.base?.item?.shield)
    const shield = shieldItem ? { item: shieldItem, ac: shieldItem.base!.item!.shield!.ac ?? 0, hardness: shieldItem.base!.item!.shield!.hardness, hp: shieldItem.base!.item!.shield!.hp } : null

    // Golpes: as armas do inventário e o punho (do catálogo).
    const strikes: Strike[] = []
    const specBonus = (rank: Rank) => (ctx.specialization === 0 || rank < 2 ? 0 : [0, 0, 2, 3, 4][rank] * ctx.specialization)
    const weaponStrike = (key: string, name: string, base: RuleEntry, inv?: InventoryEntry): Strike | null => {
        const w = base.item?.weapon
        if (!w) return null
        const traits = (w.traitsRaw ?? []).map((t) => t)
        const low = traits.map(TRAIT)
        const category = (w.category ?? 'simple').toLowerCase() as 'simple' | 'martial' | 'advanced' | 'unarmed'
        const group = w.group?.toLowerCase()
        const rank = Math.max(ctx.attacks[category] ?? 0, (group ? ctx.groupRanks[group]?.[category] : 0) ?? 0) as Rank
        const prof = rank > 0 ? ctx.level + 2 * rank : 0
        const ranged = !!w.range && !low.includes('thrown')
        const finesse = low.includes('finesse')
        const attr: AttributeKey = inv?.weapon?.attackAttribute ?? (ranged ? 'dex' : finesse && ctx.mod.dex > ctx.mod.str ? 'dex' : 'str')
        const potency = inv?.runes?.potency ?? 0
        const striking = inv?.runes?.striking ?? 0
        const strDamage = ranged ? (low.includes('propulsive') ? (str > 0 ? Math.floor(str / 2) : str) : 0) : str
        const spec = specBonus(rank)
        const attackParts = [{ label: tr('Proficiência', 'Proficiency'), value: prof }, { label: ATTR_LABEL[attr], value: ctx.mod[attr] }, ...(potency ? [{ label: tr('Potência', 'Potency'), value: potency }] : [])]
        const damageParts = [...(strDamage ? [{ label: tr('FOR', 'STR'), value: strDamage }] : []), ...(spec ? [{ label: tr('Especialização', 'Specialization'), value: spec }] : [])]
        let attack = attackParts.reduce((s, p) => s + p.value, 0)
        let damageBonus = damageParts.reduce((s, p) => s + p.value, 0)
        const o = inv?.weapon?.overrides
        if (o?.attack !== undefined || o?.damage !== undefined) {
            warnings.push({ code: 'WEAPON_OVERRIDE', level: 'info', ref: 'equipment', message: tr(`${name}: valor definido à mão.`, `${name}: value set by hand.`) })
            if (o.attack !== undefined) attack = o.attack
            if (o.damage !== undefined) damageBonus = o.damage
        }
        const runes = (inv?.runes?.property ?? []).map((id) => rules.get(id)?.name ?? id)
        if (runes.length > potency) warnings.push({ code: 'RUNE_SLOTS', level: 'warn', ref: 'equipment', message: tr(`${name}: mais runas de propriedade que a potência permite (GM Core pg. 236).`, `${name}: more property runes than the potency allows (GM Core pg. 236).`) })
        if (runes.length) warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: 'equipment', message: tr(`Efeito não calculado: dano extra das runas de ${name} (${runes.join(', ')}).`, `Effect not calculated: extra damage from ${name}'s runes (${runes.join(', ')}).`) })
        const material = inv?.material ? rules.get(inv.material.id)?.name : undefined
        const display = [potency ? `+${potency}` : '', STRIKING_NAME[striking] ?? '', ...runes, material ?? '', name].filter(Boolean).join(' ')
        return {
            key, name, display, category, group: w.group, die: (w.die ?? 'd4').replace(/^1/, ''), dice: 1 + striking,
            damageType: w.damageType ?? '', attack, damageBonus, traits, attackParts, damageParts, range: w.range,
            potency, striking, runes, material,
        }
    }
    for (const item of items) {
        if (!item.base?.item?.weapon) continue
        const strike = weaponStrike(item.key, item.name, item.base, item.inv)
        if (strike) strikes.push(strike)
    }
    const fist = rules.byName('Fist', 'weapon') ?? rules.byName('Fist')
    if (fist?.item?.weapon) {
        const strike = weaponStrike('fist', fist.name, fist)
        if (strike) strikes.unshift(strike)
    }

    return { items, bulk: { total, encumberedAt, max, coins }, invested, money: { start, spent, remaining }, armor, shield, strikes }
}

/** Partes da CA com a armadura (ou sem ela), para o resumo. */
export function armorClass(eq: EquipmentResult, ctx: { dex: number; level: number; defenses: Partial<Record<string, Rank>>; label: (r: Rank) => string }): Stat {
    const cat = eq.armor?.category ?? 'unarmored'
    const rank = (ctx.defenses[cat] ?? 0) as Rank
    const prof = rank > 0 ? ctx.level + 2 * rank : 0
    const dex = eq.armor ? Math.min(ctx.dex, eq.armor.dexCap) : ctx.dex
    const parts = [{ label: tr('Base', 'Base'), value: 10 }, { label: tr('DES', 'DEX'), value: dex }, { label: ctx.label(rank), value: prof }]
    if (eq.armor && eq.armor.ac + eq.armor.potency) parts.push({ label: tr('Item', 'Item'), value: eq.armor.ac + eq.armor.potency })
    return { total: parts.reduce((s, p) => s + p.value, 0), parts }
}

export const resilientName = (n: number) => RESILIENT_NAME[n] ?? ''
export const strikingName = (n: number) => STRIKING_NAME[n] ?? ''
