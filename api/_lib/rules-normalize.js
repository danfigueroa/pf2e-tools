import { createHash } from 'node:crypto'
import { deriveRuleData } from './rules-derived.js'

export const RULE_CATEGORIES = [
    'action', 'ancestry', 'animal-companion', 'animal-companion-advanced', 'animal-companion-specialization',
    'animal-companion-unique', 'apparition', 'arcane-school', 'arcane-thesis', 'archetype', 'armor', 'armor-group',
    'background', 'bloodline', 'cause', 'class', 'class-feature', 'class-kit', 'condition', 'conscious-mind',
    'deity', 'deity-category', 'doctrine', 'domain', 'draconic-exemplar', 'druidic-order', 'eidolon', 'equipment',
    'familiar-ability', 'familiar-specific', 'feat', 'fey-patronage', 'grim-fascination', 'heritage', 'hunters-edge',
    'hybrid-study', 'ikon', 'implement', 'innovation', 'instinct', 'item-bonus', 'language', 'lesson', 'methodology',
    'muse', 'mystery', 'mythic-calling', 'patron', 'practice', 'racket', 'relic', 'research-field', 'ritual',
    'runesmith-rune', 'set-relic', 'shield', 'skill', 'skill-general-action', 'spell', 'style', 'subconscious-mind',
    'trait', 'way', 'weapon', 'weapon-group',
]

const REMASTER_DATE = '2023-11-15'
const ITEM_CATEGORIES = new Set(['armor', 'equipment', 'shield', 'weapon'])
const COMMON_FIELDS = ['actions', 'actions_number', 'prerequisite', 'primary_source_raw', 'release_date', 'source_raw', 'summary', 'type', 'url']
const ITEM_FIELDS = ['base_item', 'bulk', 'bulk_raw', 'item_category', 'item_parent_id', 'item_subcategory', 'price', 'price_raw', 'trait_raw', 'usage']
const CATEGORY_FIELDS = {
    ancestry: ['attribute', 'attribute_flaw', 'hp', 'language', 'size', 'speed', 'speed_raw', 'vision'],
    armor: ['ac', 'armor_category', 'armor_group', 'check_penalty', 'dex_cap', 'speed_penalty', 'strength'],
    background: ['attribute', 'feat', 'skill'],
    class: ['attack_proficiency', 'attribute', 'defense_proficiency', 'fortitude_proficiency', 'hp',
        'perception_proficiency', 'reflex_proficiency', 'skill_proficiency', 'tradition', 'will_proficiency'],
    'class-feature': ['class'],
    deity: ['attribute', 'domain', 'sanctification', 'skill', 'weapon'],
    feat: ['archetype', 'class', 'is_standard_ancestry_feat', 'skill'],
    heritage: ['ancestry'],
    ritual: ['area', 'duration', 'primary_check', 'range', 'secondary_casters', 'secondary_check', 'target'],
    shield: ['ac', 'broken_threshold', 'hardness', 'hp'],
    spell: ['area', 'defense', 'deity', 'duration', 'heighten', 'heighten_level', 'range', 'saving_throw', 'spell_type', 'target', 'tradition'],
    weapon: ['damage', 'damage_die', 'damage_type', 'hands', 'range', 'reload', 'weapon_category', 'weapon_group', 'weapon_type'],
}

const text = (value) => typeof value === 'string' ? value.trim() : ''
const strings = (value) => [...new Set((Array.isArray(value) ? value : [value]).map(text).filter(Boolean))]
const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) ? value.trim() : null
const slug = (value) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function identity(entry) {
    const aon_id = text(entry?.id)
    const name = text(entry?.name)
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(aon_id) || !name) throw new Error('AON: entrada sem ID ou nome válido')
    return { aon_id, name }
}

function remasterStatus(entry, releaseDate) {
    if (strings(entry.remaster_id).length) return false
    return strings(entry.legacy_id).length > 0 || Boolean(releaseDate && releaseDate >= REMASTER_DATE)
}

function pickData(entry, fields) {
    return Object.fromEntries(fields.flatMap((field) => {
        const value = entry[field]
        const scalar = (part) => ['string', 'number', 'boolean'].includes(typeof part)
        if (Array.isArray(value)) return [[field, value.filter(scalar)]]
        return scalar(value) ? [[field, value]] : []
    }))
}

/** O ID nativo diferencia homônimos e continua o mesmo quando o nome muda. */
export function catalogRuleId(category, aonId) {
    return `${ITEM_CATEGORIES.has(category) ? 'item' : category}:${aonId}`
}

export function normalizeRuleSource(entry) {
    if (entry?.category !== 'source') throw new Error('AON: categoria de livro inválida')
    const release_date = date(entry.release_date)
    const errata = /\bLatest Errata\b[^\n<]{0,80}?\d{4}-\d{2}-\d{2}\b/i.exec(text(entry.text))?.[0] ?? null
    return {
        ...identity(entry),
        product_line: strings(entry.primary_source_category ?? entry.source_category)[0] ?? null,
        release_date,
        errata,
        remaster: remasterStatus(entry, release_date),
    }
}

/** Normaliza uma entrada juntamente com a linha do livro devolvida por normalizeRuleSource. */
export function normalizeRuleEntry(entry, source) {
    const category = text(entry?.category)
    if (!RULE_CATEGORIES.includes(category)) throw new Error(`AON: categoria fora do catálogo (${category})`)
    if (!source?.aon_id || text(entry.primary_source) !== source.name) throw new Error('AON: livro da entrada divergente')

    const { aon_id, name } = identity(entry)
    const replacements = strings(entry.remaster_id)
    const fields = [...COMMON_FIELDS, ...(CATEGORY_FIELDS[category] ?? []), ...(ITEM_CATEGORIES.has(category) ? ITEM_FIELDS : [])]
    const normalized = pickData(entry, fields)
    const derived = deriveRuleData(category, normalized, entry)
    const data = {
        ...normalized,
        slug: slug(name),
        ...(replacements.length ? { remaster_ids: replacements } : {}),
        ...(derived ? { derived } : {}),
    }
    const row = {
        aon_id,
        id: catalogRuleId(category, aon_id),
        category,
        name,
        level: Number.isInteger(entry.level) ? entry.level : null,
        rarity: text(entry.rarity) || null,
        traits: strings(entry.trait),
        source_id: source.aon_id,
        remaster: remasterStatus(entry, date(entry.release_date) ?? source.release_date),
        legacy_ids: strings(entry.legacy_id),
        legacy_names: strings(entry.legacy_name),
        replaced_by: replacements.length === 1 ? replacements[0] : null,
        data,
        markdown: text(entry.markdown) || null,
    }
    return { ...row, hash: createHash('sha1').update(JSON.stringify(row)).digest('hex') }
}
