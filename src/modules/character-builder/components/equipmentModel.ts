import { locale, tr } from '../../../i18n'
import type { RuleEntry } from '../rules/types'
import type { InventoryEntry } from '../types'
import type { ResolvedItem } from '../engine/equipment'

// Modelo da aba Equipamento (mochila, bancada, gravar runa e catálogo): classificação, onde o item está, se a runa cabe
// e as categorias do catálogo. Puro, sem React, para o fast refresh aceitar os componentes.

export type ItemKind = 'weapon' | 'armor' | 'shield' | 'worn' | 'consumable' | 'staff' | 'rune' | 'material' | 'relic' | 'gear' | 'custom'

const CONSUMABLE_RE = /consumable|alchemical|potion|scroll|talisman|oil|ammunition|snare|bomb|elixir/i

/** O tipo do item para ícone, grupo e o que a bancada mostra. */
export function itemKind(entry: RuleEntry | null, base: RuleEntry | null, inv?: InventoryEntry): ItemKind {
    const it = base?.item ?? entry?.item
    if (!entry && !it?.weapon && !it?.armor && !it?.shield) return inv?.item.startsWith('custom:') ? 'custom' : 'gear'
    if (it?.weapon) return 'weapon'
    if (it?.armor) return 'armor'
    if (it?.shield) return 'shield'
    if (!entry) return 'custom'
    // Item específico sem os números (a base vem por `baseItem`): a categoria da AON ainda diz o tipo.
    if (/^weapons?$/i.test(entry.item?.category ?? '')) return 'weapon'
    if (/^armor$/i.test(entry.item?.category ?? '')) return 'armor'
    if (/^shields?$/i.test(entry.item?.category ?? '')) return 'shield'
    const c = `${entry.item?.category ?? ''} ${entry.item?.subcategory ?? ''}`
    if (/^runes?/i.test(entry.item?.category ?? '')) return 'rune'
    if (/^materials?/i.test(entry.item?.category ?? '')) return 'material'
    if (/^relic/i.test(entry.item?.category ?? '')) return 'relic'
    if (/staff|staves|wand/i.test(c)) return 'staff'
    if (CONSUMABLE_RE.test(c) || (entry.traits ?? []).some((t) => /^consumable$/i.test(t))) return 'consumable'
    if (/^worn/i.test(entry.item?.category ?? '') || /^worn/i.test(entry.item?.usage ?? '')) return 'worn'
    return 'gear'
}

/** Arma e armadura levam potência e propriedade; escudo, só reforço. */
export const isRunic = (kind: ItemKind) => kind === 'weapon' || kind === 'armor' || kind === 'shield'
export const isInvestable = (entry: RuleEntry | null) => (entry?.traits ?? []).some((t) => /^invested$/i.test(t))
/** O que pode ficar "em uso": em mãos (arma, escudo) ou vestido (armadura, vestível). */
export const canUse = (kind: ItemKind, entry: RuleEntry | null) =>
    kind === 'weapon' || kind === 'armor' || kind === 'shield' || kind === 'worn' || /^worn|^held/i.test(entry?.item?.usage ?? '')

/** Em uso? Arma e escudo usam `equipped` (o escudo antigo vinha com `worn`); armadura e vestível, `worn`. */
export function inUse(kind: ItemKind, inv: InventoryEntry): boolean {
    if (kind === 'weapon') return !!inv.equipped
    if (kind === 'shield') return !!(inv.equipped || inv.worn)
    return !!inv.worn
}

/** O que muda para pôr ou tirar de uso. */
export function patchForUse(kind: ItemKind, on: boolean): Partial<InventoryEntry> {
    if (kind === 'weapon') return { equipped: on }
    if (kind === 'shield') return { equipped: on, worn: on ? undefined : false }
    return { worn: on }
}

export const USE_LABEL = (kind: ItemKind) => kind === 'weapon' || kind === 'shield'
    ? { on: tr('Em mãos', 'In hand'), off: tr('Guardado', 'Stowed') }
    : kind === 'armor'
        ? { on: tr('Vestida', 'Worn'), off: tr('Guardada', 'Stowed') }
        : { on: tr('Vestido', 'Worn'), off: tr('Guardado', 'Stowed') }

export type WhereTone = 'hand' | 'worn' | 'invested' | 'stowed'

/** O selo da linha: onde o item está (Em mãos, Vestida, ✦ Investido). Nada quando só está na mochila. */
export function whereLabel(kind: ItemKind, inv: InventoryEntry): { text: string; tone: WhereTone } | null {
    if (inv.invested) return { text: tr('✦ Investido', '✦ Invested'), tone: 'invested' }
    if (!inUse(kind, inv)) return null
    return kind === 'weapon' || kind === 'shield' ? { text: USE_LABEL(kind).on, tone: 'hand' } : { text: USE_LABEL(kind).on, tone: 'worn' }
}

export const KIND_GROUP: Record<ItemKind, number> = {
    weapon: 0, shield: 0, armor: 1, worn: 1, consumable: 2, staff: 3, relic: 3, rune: 3, material: 3, gear: 3, custom: 3,
}
export const GROUP_LABEL = [tr('Armas e escudos', 'Weapons and shields'), tr('Armaduras e vestíveis', 'Armor and worn items'),
    tr('Consumíveis', 'Consumables'), tr('Outros itens', 'Other items')]

export interface ItemGroup {
    key: string
    title: string
    items: ResolvedItem[]
    /** Soma do preço do grupo (comprado e ganho), só para referência. */
    value: number
}

/** "Por tipo": armas, armaduras, consumíveis e o resto. */
export function groupByKind(items: ResolvedItem[]): ItemGroup[] {
    const groups = GROUP_LABEL.map((title, i) => ({ key: `k${i}`, title, items: [] as ResolvedItem[], value: 0 }))
    for (const it of items) {
        const g = groups[KIND_GROUP[itemKind(it.entry, it.base, it.inv)]]
        g.items.push(it)
        g.value += it.price + it.runePrice
    }
    return groups.filter((g) => g.items.length)
}

/** "Onde está": em uso, cada contêiner e o que vai solto. */
export function groupByPlace(items: ResolvedItem[]): ItemGroup[] {
    const used: ResolvedItem[] = []
    const loose: ResolvedItem[] = []
    const byContainer = new Map<string, ResolvedItem[]>()
    const keys = new Set(items.map((i) => i.key))
    for (const it of items) {
        const kind = itemKind(it.entry, it.base, it.inv)
        if (inUse(kind, it.inv) || it.inv.invested) used.push(it)
        else if (it.inv.container && keys.has(it.inv.container)) byContainer.set(it.inv.container, [...(byContainer.get(it.inv.container) ?? []), it])
        else loose.push(it)
    }
    const value = (list: ResolvedItem[]) => list.reduce((s, i) => s + i.price + i.runePrice, 0)
    const out: ItemGroup[] = []
    if (used.length) out.push({ key: 'used', title: tr('Em uso', 'In use'), items: used, value: value(used) })
    for (const [key, list] of byContainer) {
        const name = items.find((i) => i.key === key)?.name ?? key
        out.push({ key, title: name, items: list, value: value(list) })
    }
    if (loose.length) out.push({ key: 'loose', title: tr('Carregado', 'Carried'), items: loose, value: value(loose) })
    return out
}

/** Contêiner = item de equipamento com "container" no nome da categoria ou o traço/uso de bolsa. */
export const isContainer = (entry: RuleEntry | null) =>
    !!entry && (/container/i.test(`${entry.item?.category ?? ''} ${entry.item?.subcategory ?? ''}`) ||
        /^(backpack|bag of holding|belt pouch|satchel|sack|chest|bandolier|spacious pouch)/i.test(entry.name))

/** Dinheiro em po com as frações (po, pp, pc), no idioma da conta. */
export function formatGp(gp: number): string {
    const neg = gp < 0
    const cp = Math.round(Math.abs(gp) * 100)
    const g = Math.floor(cp / 100)
    const s = Math.floor((cp % 100) / 10)
    const c = cp % 10
    const parts = [
        g ? tr(`${g.toLocaleString(locale)} po`, `${g.toLocaleString(locale)} gp`) : '',
        s ? tr(`${s} pp`, `${s} sp`) : '',
        c ? tr(`${c} pc`, `${c} cp`) : '',
    ].filter(Boolean)
    return `${neg ? '−' : ''}${parts.join(' ') || tr('0 po', '0 gp')}`
}

/** Volume escrito como a AON ("L", "—", "1,5"). */
export function formatBulk(bulk: number | 'L' | undefined): string {
    if (bulk === 'L') return 'L'
    if (!bulk) return '—'
    return bulk.toLocaleString(locale)
}

// ── Runas de propriedade: se cabe no item, pelo "Usage" da AON ("etched onto a piercing or slashing melee weapon").

export type Fit = { ok: true } | { ok: false; why: string } | { ok: 'unknown'; why: string }

const DAMAGE_WORD: Record<string, string> = { piercing: 'P', slashing: 'S', bludgeoning: 'B' }

/** A runa cabe neste item? O que o app não sabe conferir (metal) vira "o GM confere", nunca um não. */
export function runeFits(rune: RuleEntry, base: RuleEntry | null): Fit {
    const usage = (rune.item?.usage ?? '').toLowerCase()
    const it = base?.item
    if (!it) return { ok: 'unknown', why: tr('item fora do catálogo', 'item not in the catalog') }
    const sub = (rune.item?.subcategory ?? '').toLowerCase()
    if (sub.includes('weapon') && !it.weapon) return { ok: false, why: tr('só em arma', 'weapons only') }
    if (sub.includes('armor') && !it.armor) return { ok: false, why: tr('só em armadura', 'armor only') }
    if (it.weapon) {
        const traits = (it.weapon.traitsRaw ?? []).map((t) => t.toLowerCase())
        const ranged = !!it.weapon.range && !traits.some((t) => t.startsWith('thrown'))
        if (/melee weapon/.test(usage) && ranged) return { ok: false, why: tr('só em arma corpo a corpo', 'melee weapons only') }
        if (/thrown weapon/.test(usage) && !traits.some((t) => t.startsWith('thrown'))) return { ok: false, why: tr('só em arma de arremesso', 'thrown weapons only') }
        const dmg = (it.weapon.damageType ?? '').toLowerCase()
        const wanted = Object.keys(DAMAGE_WORD).filter((d) => usage.includes(d))
        if (wanted.length && !wanted.some((d) => dmg.startsWith(d) || dmg === DAMAGE_WORD[d].toLowerCase())) {
            return { ok: false, why: tr(`só em arma de dano ${wanted.join(' ou ')}`, `${wanted.join(' or ')} weapons only`) }
        }
        const trait = usage.match(/with the (\w+) trait/)?.[1]
        if (trait && !traits.some((t) => t.startsWith(trait))) return { ok: false, why: tr(`só em arma com o traço ${trait}`, `weapons with the ${trait} trait only`) }
        if (/isn't (holy|unholy)/.test(usage)) return { ok: 'unknown', why: tr('não pode estar numa arma do alinhamento oposto', "can't go on an opposed-sanctification weapon") }
    }
    if (it.armor) {
        const cat = (it.armor.category ?? '').toLowerCase()
        const allowed = ['light', 'medium', 'heavy'].filter((c) => new RegExp(`\\b${c}\\b`).test(usage))
        if (allowed.length && !allowed.includes(cat)) return { ok: false, why: tr(`só em armadura ${allowed.map(armorWord).join(' ou ')}`, `${allowed.join(' or ')} armor only`) }
        if (/metal armor/.test(usage)) return { ok: 'unknown', why: tr('só em armadura de metal (o GM confere)', 'metal armor only (GM checks)') }
    }
    return { ok: true }
}

const armorWord = (c: string) => ({ light: tr('leve', 'light'), medium: tr('média', 'medium'), heavy: tr('pesada', 'heavy') }[c] ?? c)

// ── Catálogo

export interface CatalogCategory {
    key: string
    label: string
    test: (e: RuleEntry) => boolean
}

const cat = (e: RuleEntry) => (e.item?.category ?? '').toLowerCase()
const subcat = (e: RuleEntry) => (e.item?.subcategory ?? '').toLowerCase()

export const CATALOG_CATEGORIES: CatalogCategory[] = [
    { key: 'all', label: tr('Tudo', 'All'), test: () => true },
    { key: 'weapons', label: tr('Armas', 'Weapons'), test: (e) => cat(e).startsWith('weapon') },
    { key: 'armor', label: tr('Armaduras', 'Armor'), test: (e) => cat(e).startsWith('armor') },
    { key: 'shields', label: tr('Escudos', 'Shields'), test: (e) => cat(e).startsWith('shield') },
    { key: 'consumables', label: tr('Consumíveis', 'Consumables'), test: (e) => /consumable|alchemical|snare/.test(cat(e)) },
    { key: 'worn', label: tr('Vestíveis', 'Worn items'), test: (e) => cat(e).startsWith('worn') || cat(e).startsWith('tattoo') },
    { key: 'held', label: tr('Empunhados', 'Held items'), test: (e) => cat(e).startsWith('held') },
    { key: 'staves', label: tr('Cajados e varinhas', 'Staves and wands'), test: (e) => /staff|staves|wand/.test(cat(e)) },
    { key: 'runes', label: tr('Runas', 'Runes'), test: (e) => cat(e).startsWith('rune') },
    { key: 'materials', label: tr('Materiais', 'Materials'), test: (e) => cat(e).startsWith('material') },
    { key: 'gear', label: tr('Equipamento', 'Gear'), test: (e) => /adventuring gear|^gear|tool|kit|clothing|container|services|animal|vehicle/.test(cat(e)) },
    { key: 'relics', label: tr('Relíquias', 'Relics'), test: (e) => cat(e).startsWith('relic') },
]

const CONSUMABLE_TYPES: CatalogCategory[] = [
    { key: 'potions', label: tr('Poções', 'Potions'), test: (e) => subcat(e).includes('potion') },
    { key: 'elixirs', label: tr('Elixires', 'Elixirs'), test: (e) => subcat(e).includes('elixir') },
    { key: 'bombs', label: tr('Bombas', 'Bombs'), test: (e) => subcat(e).includes('bomb') },
    { key: 'talismans', label: tr('Talismãs', 'Talismans'), test: (e) => subcat(e).includes('talisman') },
    { key: 'scrolls', label: tr('Pergaminhos', 'Scrolls'), test: (e) => subcat(e).includes('scroll') },
    { key: 'oils', label: tr('Óleos', 'Oils'), test: (e) => subcat(e).includes('oil') },
    { key: 'ammo', label: tr('Munição', 'Ammunition'), test: (e) => subcat(e).includes('ammunition') },
    { key: 'poisons', label: tr('Venenos', 'Poisons'), test: (e) => subcat(e).includes('poison') },
    { key: 'snares', label: tr('Armadilhas', 'Snares'), test: (e) => cat(e) === 'snares' },
]

// A AON lista Reinforcing em Shield Runes; a tabela de runas fundamentais inclui a de reforço (GM Core, p. 224).
const shieldRune = (e: RuleEntry) => subcat(e) === 'shield runes'
const RUNE_TYPES: CatalogCategory[] = [
    { key: 'fundamental', label: tr('Fundamentais', 'Fundamental'), test: (e) => subcat(e).startsWith('fundamental ') || shieldRune(e) },
    { key: 'property', label: tr('De propriedade', 'Property'), test: (e) => subcat(e).includes('property runes') },
    { key: 'shield', label: tr('De escudo', 'Shield'), test: shieldRune },
]

const SPELLCASTING_ITEM_TYPES: CatalogCategory[] = [
    { key: 'staff', label: tr('Cajados', 'Staves'), test: (e) => /staff|staves/.test(cat(e)) },
    { key: 'wand', label: tr('Varinhas', 'Wands'), test: (e) => cat(e).startsWith('wand') },
]

const ARMOR_TYPES: Record<string, string> = {
    light: tr('Leves', 'Light'), medium: tr('Médias', 'Medium'), heavy: tr('Pesadas', 'Heavy'), unarmored: tr('Sem armadura', 'Unarmored'),
}

const WEAPON_GROUPS: Record<string, string> = {
    axe: tr('Machados', 'Axes'), bomb: tr('Bombas', 'Bombs'), bow: tr('Arcos', 'Bows'), brawling: tr('Briga', 'Brawling'),
    club: tr('Clavas', 'Clubs'), crossbow: tr('Bestas', 'Crossbows'), dart: tr('Dardos', 'Darts'), firearm: tr('Armas de fogo', 'Firearms'),
    flail: tr('Manguais', 'Flails'), hammer: tr('Martelos', 'Hammers'), knife: tr('Facas', 'Knives'), pick: tr('Picaretas', 'Picks'),
    polearm: tr('Armas de haste', 'Polearms'), shield: tr('Escudos', 'Shields'), sling: tr('Fundas', 'Slings'),
    spear: tr('Lanças', 'Spears'), sword: tr('Espadas', 'Swords'),
}

export function catalogSubtypes(category: string, entries: RuleEntry[]): CatalogCategory[] {
    if (category === 'consumables') return CONSUMABLE_TYPES
    if (category === 'runes') return RUNE_TYPES
    if (category === 'staves') return SPELLCASTING_ITEM_TYPES
    if (category !== 'weapons' && category !== 'armor') return []

    const armor = category === 'armor'
    const typeOf = (entry: RuleEntry) => armor ? entry.item?.armor?.category : entry.item?.weapon?.group
    const byName = new Map<string, Set<string>>()
    for (const entry of entries) {
        const type = typeOf(entry)
        if (!type) continue
        const name = entry.name.toLowerCase()
        const values = byName.get(name) ?? new Set<string>()
        values.add(type)
        byName.set(name, values)
    }
    // Um item específico pode ter mais de uma base na AON. Use todas as categorias que os dados confirmam.
    const byType = new Map<string, { label: string; ids: Set<string> }>()
    const labels = armor ? ARMOR_TYPES : WEAPON_GROUPS
    for (const entry of entries) {
        const own = typeOf(entry)
        const types = own ? [own] : [entry.item?.baseItem ?? []].flat().flatMap((name) => [...(byName.get(name.toLowerCase()) ?? [])])
        for (const type of types.length ? types : ['']) {
            const key = type.toLowerCase() || 'unspecified'
            const label = labels[key] ?? (type || (armor ? tr('Sem categoria', 'No category') : tr('Sem grupo', 'No group')))
            const group = byType.get(key) ?? { label, ids: new Set<string>() }
            group.ids.add(entry.id)
            byType.set(key, group)
        }
    }
    const options = [...byType].map(([key, { label, ids }]) => ({ key, label, test: (e: RuleEntry) => ids.has(e.id) }))
    const order = Object.keys(ARMOR_TYPES)
    const rank = (key: string) => armor && order.includes(key) ? order.indexOf(key) : key === 'unspecified' ? order.length + 1 : order.length
    return options.sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label, locale))
}

export const isMagicalItem = (e: RuleEntry) => /\bmagic\b/.test(subcat(e)) ||
    (e.traits ?? []).some((t) => /^(magical|arcane|divine|occult|primal)$/i.test(t))

/**
 * O que o catálogo lista: itens com preço ou variantes. Some o grupo sem preço que tem variantes ("Healing Potion" sem
 * grau, ao lado de Minor, Lesser…), porque comprar o grupo não diz quanto custa.
 */
export function catalogItems(entries: RuleEntry[]): RuleEntry[] {
    const items = entries.filter((e) => e.item && !e.superseded)
    const parents = new Set(items.map((e) => e.item?.parent).filter(Boolean))
    return items.filter((e) => !parents.has(e.id))
}

/** Itens que se empilham na mesma linha (quantidade), em vez de virarem linhas novas. */
export const stacks = (kind: ItemKind) => kind === 'consumable' || kind === 'gear' || kind === 'material'

/** Fatos curtos do item para a ficha do catálogo e a bancada. */
export function itemFacts(e: RuleEntry): { k: string; v: string }[] {
    const it = e.item
    if (!it) return []
    const out: { k: string; v: string }[] = []
    if (it.price) out.push({ k: tr('Preço', 'Price'), v: formatGp(it.price.gp) })
    out.push({ k: tr('Volume', 'Bulk'), v: formatBulk(it.bulk) })
    if (it.hands) out.push({ k: tr('Mãos', 'Hands'), v: it.hands })
    if (it.usage) out.push({ k: tr('Uso', 'Usage'), v: it.usage })
    if (it.weapon) {
        out.push({ k: tr('Dano', 'Damage'), v: [it.weapon.die, it.weapon.damageType].filter(Boolean).join(' ') })
        if (it.weapon.category || it.weapon.group) out.push({ k: tr('Arma', 'Weapon'), v: [it.weapon.category, it.weapon.group].filter(Boolean).join(' · ') })
        if (it.weapon.range) out.push({ k: tr('Alcance', 'Range'), v: tr(`${it.weapon.range} pés`, `${it.weapon.range} feet`) })
    }
    if (it.armor) {
        out.push({ k: tr('CA', 'AC'), v: `+${it.armor.ac ?? 0}` })
        if (it.armor.dexCap !== undefined) out.push({ k: tr('DES máx.', 'Dex cap'), v: `+${it.armor.dexCap}` })
        if (it.armor.strength) out.push({ k: tr('Força', 'Strength'), v: `+${it.armor.strength}` })
        if (it.armor.category) out.push({ k: tr('Categoria', 'Category'), v: it.armor.category })
    }
    if (it.shield) {
        out.push({ k: tr('CA', 'AC'), v: `+${it.shield.ac ?? 0}` })
        if (it.shield.hardness !== undefined) out.push({ k: tr('Dureza', 'Hardness'), v: String(it.shield.hardness) })
        if (it.shield.hp !== undefined) out.push({ k: tr('PV', 'HP'), v: `${it.shield.hp}${it.shield.bt ? ` (${tr('LQ', 'BT')} ${it.shield.bt})` : ''}` })
    }
    return out
}

let seq = 0
export const newInventoryKey = () => `inv-${Date.now().toString(36)}${(seq++).toString(36)}`

/** Id do item caseiro de texto livre (`custom:<slug>`). */
export const customItemId = (name: string) =>
    `custom:${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'}`

/** Traços dos ícones da aba (24×24). */
export const ICON_PATH = {
  coin: 'M12 4a8 8 0 110 16 8 8 0 010-16M12 8v8M9.5 10h4M9.5 14h4',
  bulk: 'M6 8h12l2 12H4zM9 8a3 3 0 016 0',
  invested: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5z',
  bag: 'M8 7V5a4 4 0 018 0v2M5 9a2 2 0 012-2h10a2 2 0 012 2v11H5z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 5a6 6 0 110 12 6 6 0 010-12M20 20l-4.5-4.5',
  chevron: 'M9 5l7 7-7 7',
  transfer: 'M4 8h13l-3-3M20 16H7l3 3',
  more: 'M12 6v.5M12 12v.5M12 18v.5',
  back: 'M15 5l-7 7 7 7',
  list: 'M4 6h16M4 12h16M4 18h16',
}

/** "+2 Striking Flaming Warhammer" para armas; "+1 Resilient Full Plate" para armaduras. */
export function itemDisplayName(item: ResolvedItem): string {
  const pre = item.runes.filter((r) => r.kind !== 'property').map((r) => (r.kind === 'potency' || r.kind === 'armorPotency' ? `+${r.tier}` : r.name.replace(/^Reinforcing Rune \((\w+)\)$/, '$1 Reinforcing').replace(/^(\w+) \((Greater|Major)\)$/, '$2 $1')))
  const prop = item.runes.filter((r) => r.kind === 'property').map((r) => r.name)
  return [...pre, ...prop, item.name].join(' ')
}

/** Nível do item com as runas: o maior entre a base e cada runa gravada (um +2 Striking é item de nível 10). */
export const itemLevel = (item: ResolvedItem): number | undefined => {
  const levels = [item.entry?.level, ...item.runes.map((r) => r.level)].filter((n): n is number => typeof n === 'number')
  return levels.length ? Math.max(...levels) : undefined
}

export const handsText = (hands: string) => (hands === '1' ? tr('1 mão', '1 hand') : tr(`${hands} mãos`, `${hands} hands`))
