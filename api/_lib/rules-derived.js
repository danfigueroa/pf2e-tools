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

const RANK_WORDS = { expert: 2, master: 3, legendary: 4 }
/** Palavras do alvo da proficiência no texto da AON → alvo do motor. A ordem importa ("unarmored" antes de "unarmed"). */
const PROFICIENCY_TARGETS = [
    [/\bfortitude\b/, 'fortitude'], [/\breflex\b/, 'reflex'], [/\bwill\b/, 'will'], [/\bperception\b/, 'perception'],
    [/\bclass dc\b|\b(?!spell\b)[a-z]+ dc\b/, 'classDC'], [/\bspell (attack|dc)/, 'spell'],
    [/\bsimple\b/, 'simple'], [/\bmartial\b/, 'martial'], [/\badvanced\b/, 'advanced'], [/\bunarm(ored|ed) defense\b/, 'unarmored'],
    [/\bunarmed attacks?\b/, 'unarmed'], [/\blight\b/, 'light'], [/\bmedium\b/, 'medium'], [/\bheavy\b/, 'heavy'],
]
/** Depende de escolha ou de outro item (grupo de arma, a salvaguarda escolhida, armas de fogo, bombas): fica para o motor avisar. */
const NEEDS_CHOICE = /\b(that group|chosen|choose)\b/
/** Armas específicas listadas junto das categorias: saem do alvo (o motor avisa) sem levar as categorias junto. */
const SPECIFIC_WEAPONS = /\b(?:(?:simple|martial|advanced)(?:,? (?:and |or )?(?:simple|martial|advanced))* )?(?:firearms|crossbows)(?: and (?:firearms|crossbows))?|\balchemical bombs\b/g

/**
 * Proficiências que uma característica de classe sobe, lidas do texto da AON (Player Core e afins escrevem sempre "Your
 * proficiency rank(s) for X increase(s) to <rank>" ou "…increase(s) to <rank> for/with X"). Frase condicional ("If you have
 * … spells") ou que depende de escolha vai para `unsupported`; do companheiro (eidolon) é ignorada.
 */
export function classFeatureProficiencies(markdown, unsupported) {
    const text = String(markdown ?? '').replace(/<[^>]+>/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ')
    const out = []
    for (const [sentence] of text.matchAll(/[^.]*\bproficiency ranks?\b[^.]*\bincreases? to (?:expert|master|legendary)\b[^.]*\./gi)) {
        // Cabeçalho colado na frase ("114 **Class** Monk --- Your…"): começa no "your proficiency".
        const lower = sentence.toLowerCase().trim().replace(/^(?!if\b).*?---\s*(?=(?:in addition, )?your\b)/, '')
        if (!/^(your|you|in addition, your|if you have)\b/.test(lower)) continue
        const conditional = /^if\b|\bif you have\b/.test(lower)
        // Cláusulas: "…for X increase to R, and your proficiency rank for Y increases to S" / "…to R with X and to S with Y".
        const clauses = lower.split(/,? and (?=your proficiency|to (?:expert|master|legendary))/)
        for (const clause of clauses) {
            // "Your … and your eidolon's … increase to R": vale o seu alvo, com o rank do fim da frase.
            const own = clause.replace(/^your and your eidolon[’']s\b/, 'your').replace(/\band your eidolon[’']s proficiency ranks? (for|in) [^,]*?(?=\bincreases? to\b)/, ' ')
            const rankMatch = /\bto (expert|master|legendary)\b/.exec(own)
            if (!rankMatch) continue
            const rankWord = rankMatch[1]
            // "…rank for X increases to R" (alvo antes) ou "…increases to R with/for X" (alvo depois, até a próxima vírgula de frase).
            const before = own.slice(0, rankMatch.index)
            const after = own.slice(rankMatch.index + rankMatch[0].length)
            const phrase = /\branks? (for|in|with)\b/.test(before) ? before : after.split(/,(?= (?:and|or) you\b)|;/)[0]
            if (NEEDS_CHOICE.test(phrase) || conditional) {
                unsupported.push(`proficiency: ${sentence.trim().slice(0, 140)}`)
                continue
            }
            const specific = phrase.match(SPECIFIC_WEAPONS) ?? []
            if (specific.length) unsupported.push(`proficiency: ${specific.join(', ')} → ${rankWord}`)
            const general = phrase.replace(SPECIFIC_WEAPONS, ' ')
            const targets = PROFICIENCY_TARGETS.filter(([re]) => re.test(general)).map(([, target]) => target)
            for (const skill of SKILLS) if (new RegExp(`\\b${skill}\\b`).test(general)) targets.push(`skill:${skill}`)
            for (const [, lore] of general.matchAll(/\b([a-z]+) lore\b/g)) targets.push(`lore:${lore}`)
            // "light, medium, and heavy armor" sem a palavra "armor" em cada um: as categorias só valem perto de "armor".
            const armorless = !/\barmor\b/.test(general)
            const kept = targets.filter((t) => !(armorless && ['light', 'medium', 'heavy'].includes(t)))
            if (!kept.length) {
                if (!specific.length) unsupported.push(`proficiency: ${sentence.trim().slice(0, 140)}`)
                continue
            }
            for (const target of kept) out.push({ target, rank: RANK_WORDS[rankWord] })
        }
    }
    // "You gain expert proficiency in X" (Weapon Tricks) e "You become an expert in X" (Expert Overdrive). Frases de
    // aumento de perícia ("you can use this increase…") e as que escalonam por nível ("At 3rd level, you become…") ficam de fora.
    for (const [sentence] of text.matchAll(/[^.]*\b(?:gain (?:expert|master|legendary) proficiency (?:in|with)|become (?:an expert|a master|legendary) in)\b[^.]*\./gi)) {
        const lower = sentence.toLowerCase().trim().replace(/^(?!if\b).*?---\s*(?=you\b)/, '')
        if (!/^you (gain|become)\b/.test(lower)) continue
        if (/\b(can use|either)\b/.test(lower)) continue
        if (/\bat \d+(st|nd|rd|th) level\b/.test(lower)) {
            unsupported.push(`proficiency: ${sentence.trim().slice(0, 140)}`)
            continue
        }
        const m = /\b(?:gain (expert|master|legendary) proficiency (?:in|with)|become (?:an |a )?(expert|master|legendary) in) (.+?)(?:;| when\b| and on\b| on a\b|\.|$)/.exec(lower)
        if (!m) continue
        const rankWord = m[1] ?? m[2]
        const phrase = m[3]
        if (NEEDS_CHOICE.test(phrase)) {
            unsupported.push(`proficiency: ${sentence.trim().slice(0, 140)}`)
            continue
        }
        const targets = PROFICIENCY_TARGETS.filter(([re]) => re.test(phrase)).map(([, target]) => target)
        for (const skill of SKILLS) if (new RegExp(`\\b${skill}\\b`).test(phrase)) targets.push(`skill:${skill}`)
        for (const target of targets.filter((t) => !(!/\barmor\b/.test(phrase) && ['light', 'medium', 'heavy'].includes(t)))) {
            out.push({ target, rank: RANK_WORDS[rankWord] })
        }
    }
    return out
}

/**
 * Conjuração da classe, lida da AON: tradições em `tradition_markdown` (mais de uma = depende da subclasse: linhagem,
 * patrono, eidolon); o tipo pela seção "Spellcasting" ("repertoire" = espontâneo, "prepare" = preparado; o Animist tem os
 * dois e fica `mixed`); o atributo pela frase "…spell DC use(s)/calculated using your X modifier" (sem ela, o atributo-chave).
 */
function classCasting(entry, unsupported) {
    const traditions = [...String(entry?.tradition_markdown ?? '').matchAll(/\[(arcane|divine|occult|primal)\]/gi)].map((m) => m[1].toLowerCase())
    if (!traditions.length) return undefined
    const text = String(entry?.markdown ?? '').replace(/<[^>]+>/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ')
    const start = text.search(/Spellcasting /)
    const section = start >= 0 ? text.slice(start, start + 4000).toLowerCase() : ''
    const spontaneous = /\brepertoire\b/.test(section)
    const prepared = /\bprepare/.test(section)
    const type = spontaneous && prepared && /\bapparition/.test(section) ? 'mixed' : spontaneous ? 'spontaneous' : prepared ? 'prepared' : undefined
    if (!type || type === 'mixed') unsupported.push(`casting: ${type ?? 'tipo não identificado'}`)
    const named = /spell dcs? (?:use|are calculated using) your (strength|dexterity|constitution|intelligence|wisdom|charisma) modifier/.exec(section)?.[1]
    const attribute = named ? ATTRIBUTES[named.charAt(0).toUpperCase() + named.slice(1)] : undefined
    return compact({ traditions, type, attribute })
}

/**
 * Boosts da ancestralidade. A AON escreve o Humano (e afins) como "Two free ability boosts" (Player Core pg. 62:
 * "Attribute Boosts: Two free ability boosts"); o resto vem como nomes de atributo e "Free". Texto desconhecido vai para
 * `unsupported`, nunca some.
 */
function ancestryBoosts(value, unsupported) {
    return list(value).flatMap((name) => {
        const key = lookup(ATTRIBUTES, name)
        if (key) return [key]
        if (/^two free (ability|attribute) boosts$/i.test(name.trim())) return ['free', 'free']
        unsupported.push(`attribute: ${name}`)
        return []
    })
}

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
            boosts: ancestryBoosts(data.attribute, unsupported),
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
            casting: classCasting(entry, unsupported),
        }))
    }
    case 'class-feature': {
        const proficiencies = classFeatureProficiencies(entry?.markdown, unsupported)
        return proficiencies.length || unsupported.length ? withNotes('classFeature', compact({ proficiencies })) : null
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
