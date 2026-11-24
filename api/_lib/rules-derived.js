const ATTRIBUTES = {
    Strength: 'str', Dexterity: 'dex', Constitution: 'con',
    Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha', Free: 'free',
}
const RANKS = { untrained: 0, trained: 1, expert: 2, master: 3, legendary: 4 }
const SKILLS = new Set(['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine',
    'nature', 'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery'])
const WEAPON_CATEGORIES = new Set(['simple', 'martial', 'advanced', 'unarmed'])
const ARMOR_CATEGORIES = { light: ['light'], medium: ['medium'], heavy: ['heavy'], unarmored: ['unarmored'], all: ['light', 'medium', 'heavy'] }
const DAMAGE_LETTERS = { B: 'Bludgeoning', P: 'Piercing', S: 'Slashing' }

const list = (value) => (Array.isArray(value) ? value : [value]).filter((part) => typeof part === 'string')
const lookup = (table, key) => Object.hasOwn(table, key) ? table[key] : undefined
const rank = (value) => typeof value === 'string' ? lookup(RANKS, value.trim().toLowerCase()) : undefined
const attributes = (value) => list(value).map((name) => lookup(ATTRIBUTES, name)).filter(Boolean)
const number = (value) => Number.isFinite(value) ? value : undefined
const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, part]) =>
    part !== undefined && !(Array.isArray(part) && !part.length) && !(part && typeof part === 'object' && !Array.isArray(part) && !Object.keys(part).length)))

/** "A, B, and C" / "A and B" / "A or B" → ['A', 'B', 'C']. */
const splitList = (value) => value.split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/).map((part) => part.trim()).filter(Boolean)

/** Perícia ou Lore com o nome canônico; undefined quando não é uma perícia. */
function skillName(value) {
    const name = value.trim().replace(/\.$/, '')
    if (SKILLS.has(name.toLowerCase())) return name.toLowerCase()
    return /^[A-Z][\w' -]* Lore$/.test(name) ? name : undefined
}

function skillList(value) {
    const names = splitList(value).map(skillName)
    return names.length && names.every(Boolean) ? names : undefined
}

/** "Expert in simple and martial weapons" → { simple: 2, martial: 2 }; o resto vai para `unsupported`. */
function attackProficiencies(values, unsupported) {
    const result = {}
    for (const value of list(values)) {
        const match = /^(\w+) in (.+?) (?:weapons|attacks?)\.?$/i.exec(value.trim())
        const proficiency = match && rank(match[1])
        const categories = match && splitList(match[2].toLowerCase())
        if (proficiency === undefined || !categories?.length || !categories.every((part) => WEAPON_CATEGORIES.has(part))) {
            unsupported.push(value)
            continue
        }
        for (const category of categories) result[category] = proficiency
    }
    return result
}

/** "Trained in all armor" → light/medium/heavy; uma ressalva após a vírgula fica registrada em `unsupported`. */
function defenseProficiencies(values, unsupported) {
    const result = {}
    for (const value of list(values)) {
        const match = /^(\w+) in (.+?) (?:armor|defense)(?:,\s*(.+?))?\.?$/i.exec(value.trim())
        const proficiency = match && rank(match[1])
        const categories = match && splitList(match[2].toLowerCase())
        if (proficiency === undefined || !categories?.length || !categories.every((part) => lookup(ARMOR_CATEGORIES, part))) {
            unsupported.push(value)
            continue
        }
        for (const category of categories) for (const key of ARMOR_CATEGORIES[category]) result[key] = proficiency
        if (match[3]) unsupported.push(value)
    }
    return result
}

/** Perícias treinadas da classe: fixas, escolhas e adicionais; o que depende de subclasse vai para `unsupported`. */
function trainedSkills(values, unsupported) {
    const fixed = []
    const choices = []
    let additional
    for (const raw of list(values)) {
        const value = raw.trim().replace(/\.$/, '')
        const extra = /^Trained in a number of (additional )?skills equal to (\d+) plus your Intelligence modifier$/i.exec(value)
        if (extra) {
            additional = Number(extra[2])
            continue
        }
        const body = /^Trained in (.+)$/i.exec(value)?.[1]
        const choice = body && /^(?:your choice of|either) (.+)$/i.exec(body)
        const withChoice = body && /^(.+?) and either (.+)$/i.exec(body)
        if (choice && skillList(choice[1])) {
            choices.push(skillList(choice[1]))
        } else if (withChoice && skillList(withChoice[1]) && skillList(withChoice[2])) {
            fixed.push(...skillList(withChoice[1]))
            choices.push(skillList(withChoice[2]))
        } else if (body && skillList(body)) {
            fixed.push(...skillList(body))
        } else {
            unsupported.push(raw)
        }
    }
    return compact({ fixed, choices, additional })
}

function damageType(data) {
    const letter = /^\d+d\d+\s+([BPS])\b/.exec(data.damage ?? '')?.[1]
    if (letter) return DAMAGE_LETTERS[letter]
    const types = list(data.damage_type)
    return types.length === 1 ? types[0] : undefined
}

/**
 * Projeção dos campos estruturados da AON. Valor ausente fica sem derivação; texto que o parser não entende vai para
 * `unsupported`, para virar aviso no motor em vez de sumir.
 */
export function deriveRuleData(category, data, entry) {
    const unsupported = []
    const withNotes = (key, value) => ({ [key]: value, ...(unsupported.length ? { unsupported } : {}) })
    switch (category) {
    case 'ancestry':
        return withNotes('ancestry', compact({
            hp: number(data.hp),
            size: list(data.size)[0],
            speed: number(entry.speed?.land),
            boosts: attributes(data.attribute),
            flaws: attributes(data.attribute_flaw),
            languages: list(data.language),
            senses: list(data.vision),
        }))
    case 'background': {
        const skills = list(data.skill).map((value) => skillName(value) ?? (unsupported.push(value), undefined)).filter(Boolean)
        return withNotes('background', compact({
            boosts: attributes(data.attribute),
            skills,
            feats: list(data.feat),
        }))
    }
    case 'class': {
        const keys = list(data.attribute)
        const keyAttribute = attributes(keys).filter((key) => key !== 'free')
        if (keyAttribute.length !== keys.length) unsupported.push(`attribute: ${keys.join(', ')}`)
        return withNotes('class', compact({
            hp: number(data.hp),
            keyAttribute,
            perception: rank(data.perception_proficiency),
            saves: compact({
                fortitude: rank(data.fortitude_proficiency),
                reflex: rank(data.reflex_proficiency),
                will: rank(data.will_proficiency),
            }),
            attacks: attackProficiencies(data.attack_proficiency, unsupported),
            defenses: defenseProficiencies(data.defense_proficiency, unsupported),
            trainedSkills: trainedSkills(data.skill_proficiency, unsupported),
        }))
    }
    case 'weapon':
        return withNotes('weapon', compact({
            die: /^\d+d\d+\b/i.exec(data.damage ?? '')?.[0],
            damageType: damageType(data),
            group: data.weapon_group,
            category: data.weapon_category,
            range: data.range,
            reload: data.reload,
        }))
    case 'spell': {
        const tags = new Set([...list(entry.trait), ...list(data.spell_type)].map((value) => value.toLowerCase()))
        return withNotes('spell', compact({
            rank: Number.isInteger(entry.level) ? entry.level : undefined,
            traditions: list(data.tradition),
            cantrip: tags.has('cantrip'),
            focus: tags.has('focus') || tags.has('focus spell'),
            heighten: list(data.heighten),
        }))
    }
    default:
        return undefined
    }
}
