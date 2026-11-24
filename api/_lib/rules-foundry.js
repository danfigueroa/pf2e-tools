// Mecânica do sistema PF2e do Foundry (release fixada em docs/character-builder/FONTES-DE-DADOS.md §2).
// Funções puras sobre os JSONs já lidos: quem baixa e lê o pacote é o script, numa pasta isolada, sem executar nada dele.

/** Rule elements que o motor aplica na criação (MOTOR-DE-REGRAS §10). */
const SUPPORTED = new Set(['ChoiceSet', 'GrantItem', 'MartialProficiency', 'BaseSpeed', 'Sense', 'Resistance', 'Weakness',
    'Immunity', 'Strike', 'CriticalSpecialization'])
/** Situacionais: a Ficha trata em combate; ficam como informação, fora do compilado e sem aviso. */
const SITUATIONAL = new Set(['AdjustStrike', 'AdjustDegreeOfSuccess', 'RollOption', 'Note', 'DamageDice'])
/** Só aparência no tabuleiro do Foundry: sem efeito na ficha, então nem informação nem aviso. */
const COSMETIC = new Set(['TokenLight', 'TokenEffectIcon', 'TokenImage', 'TokenName'])
/** ActiveEffectLike "fixo" que o motor entende: proficiência, idiomas, sentidos e velocidade. */
const FIXED_PATHS = /^system\.(skills\.(\{[^}]+\}|[^.]+)\.rank|proficiencies\.|build\.languages\.|perception\.(rank|senses)|saves\.[a-z]+\.rank|attributes\.(classDC\.rank|speed\.|senses|ancestryhp|classhp))/
const FLAT_SELECTORS = /^(hp|hp-per-level|speed|land-speed|[a-z]+-speed|perception|fortitude|reflex|will|saving-throw|skill-check|[a-z]+-lore|acrobatics|arcana|athletics|crafting|deception|diplomacy|intimidation|medicine|nature|occultism|performance|religion|society|stealth|survival|thievery)$/
const ITEM_TYPES = new Set(['weapon', 'armor', 'shield', 'equipment', 'consumable', 'treasure', 'backpack', 'ammo', 'kit'])

const text = (value) => typeof value === 'string' ? value.trim() : ''
const hasPredicate = (rule) => Array.isArray(rule.predicate) ? rule.predicate.length > 0 : Boolean(rule.predicate)
const selectors = (rule) => (Array.isArray(rule.selector) ? rule.selector : [rule.selector]).filter((part) => typeof part === 'string')
const levels = (value) => Array.isArray(value?.value) ? value.value.filter(Number.isInteger) : []

/** Classifica um rule element em `rules`, situacional ou `unsupported` (com o caminho, para o relatório priorizar). */
function classifyRule(rule) {
    const key = text(rule?.key)
    if (!key || COSMETIC.has(key)) return null
    if (SITUATIONAL.has(key)) return { kind: 'rules', rule: { ...rule, situational: true } }
    if (key === 'ActiveEffectLike') {
        if (!FIXED_PATHS.test(text(rule.path))) return { kind: 'unsupported', label: `${key}:${text(rule.path).split('.').slice(0, 3).join('.')}` }
        return { kind: 'rules', rule: hasPredicate(rule) ? { ...rule, situational: true } : rule }
    }
    if (key === 'FlatModifier') {
        if (hasPredicate(rule)) return { kind: 'rules', rule: { ...rule, situational: true } }
        const type = text(rule.type) || 'untyped'
        const ok = ['item', 'untyped'].includes(type) && selectors(rule).length > 0 && selectors(rule).every((part) => FLAT_SELECTORS.test(part))
        return ok ? { kind: 'rules', rule } : { kind: 'unsupported', label: `${key}:${selectors(rule).join('|') || '?'}` }
    }
    if (SUPPORTED.has(key)) return { kind: 'rules', rule }
    return { kind: 'unsupported', label: key }
}

/** Categoria da AON (rules-normalize.js) de um documento do Foundry; null quando a AON não tem a categoria importada. */
export function foundryCategory(doc) {
    const type = text(doc?.type)
    const category = text(doc?.system?.category)
    const traits = doc?.system?.traits?.value ?? []
    if (ITEM_TYPES.has(type)) return 'item'
    if (type === 'feat') {
        if (category === 'classfeature') return 'class-feature'
        if (category === 'calling') return 'mythic-calling'
        if (category === 'ancestryfeature') return null
        return 'feat'
    }
    if (type === 'spell') return Array.isArray(traits) && traits.includes('ritual') ? 'ritual' : 'spell'
    if (type === 'action') return doc?.pack === 'familiar-abilities' ? 'familiar-ability' : 'action'
    return ['ancestry', 'heritage', 'background', 'class', 'deity'].includes(type) ? type : null
}

/** Progressão 1–20 da classe: níveis de talento, aumentos e características por nível (nome; o casamento é depois). */
function classProgression(system) {
    const features = Object.values(system.items ?? {})
        .filter((item) => Number.isInteger(item?.level) && text(item?.name))
        .map((item) => ({ level: item.level, name: text(item.name) }))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    return {
        keyAttribute: Array.isArray(system.keyAbility?.value) ? system.keyAbility.value : [],
        hp: system.hp,
        perception: system.perception,
        saves: system.savingThrows,
        attacks: Object.fromEntries(Object.entries(system.attacks ?? {}).filter(([, rank]) => Number.isInteger(rank))),
        defenses: system.defenses,
        trainedSkills: { fixed: system.trainedSkills?.value ?? [], additional: system.trainedSkills?.additional ?? 0 },
        spellcasting: system.spellcasting ?? 0,
        ancestryFeatLevels: levels(system.ancestryFeatLevels),
        classFeatLevels: levels(system.classFeatLevels),
        generalFeatLevels: levels(system.generalFeatLevels),
        skillFeatLevels: levels(system.skillFeatLevels),
        skillIncreaseLevels: levels(system.skillIncreaseLevels),
        features,
    }
}

/** Mecânica de um documento do Foundry, ainda sem o ID da AON. */
export function foundryMechanics(doc) {
    const system = doc?.system ?? {}
    const rules = []
    const unsupported = new Set()
    for (const rule of Array.isArray(system.rules) ? system.rules : []) {
        const result = classifyRule(rule)
        if (result?.kind === 'rules') rules.push(result.rule)
        else if (result) unsupported.add(result.label)
    }
    return {
        name: text(doc?.name),
        category: foundryCategory(doc),
        level: Number.isInteger(system.level?.value) ? system.level.value : null,
        remaster: Boolean(system.publication?.remaster),
        traits: Array.isArray(system.traits?.value) ? system.traits.value.filter((part) => typeof part === 'string') : [],
        rules,
        unsupported: [...unsupported].sort(),
        progression: doc?.type === 'class' ? classProgression(system) : null,
    }
}

/** Chave de casamento: maiúsculas, acentos, apóstrofos e espaços não distinguem entradas. */
export const matchKey = (name) => text(name).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[’']/g, '').replace(/[^a-z0-9()]+/g, ' ').trim()

const idGroup = (category) => ['armor', 'equipment', 'shield', 'weapon'].includes(category) ? 'item' : category

/** Categorias que não casam pelo nome solto: um nome igual nelas é a palavra genérica, não a entrada. */
const LOOSE_SKIP = new Set(['trait', 'condition', 'skill', 'language', 'weapon-group', 'armor-group', 'item-bonus', 'deity-category'])

/** Índice das entradas importadas (linhas de normalizeRuleEntry) por categoria e nome, incluindo os nomes legados. */
export function buildAonIndex(entries) {
    const index = new Map()
    const add = (key, entry) => {
        if (!index.has(key)) index.set(key, [])
        if (!index.get(key).includes(entry)) index.get(key).push(entry)
    }
    for (const entry of entries) {
        add(`id|${entry.aon_id}`, entry)
        const group = idGroup(entry.category)
        for (const name of [entry.name, ...(entry.legacy_names ?? [])]) {
            add(`${group}|${matchKey(name)}`, entry)
            if (!LOOSE_SKIP.has(entry.category)) add(`*|${matchKey(name)}`, entry)
        }
    }
    return index
}

/** No casamento solto, a característica de classe procura subclasse (ordem, musa, raquete…) e não item ou arquétipo. */
const NOT_SUBCLASS = new Set(['feat', 'spell', 'ritual', 'equipment', 'weapon', 'armor', 'shield', 'archetype', 'action', 'class-feature', 'class'])
function looseCandidates(found, category) {
    if (category === 'class-feature') return found.filter((entry) => !NOT_SUBCLASS.has(entry.category))
    if (category === 'spell') return found.filter((entry) => entry.category === 'ritual')
    if (category === 'action') return found.filter((entry) => ['feat', 'skill-general-action', 'familiar-ability'].includes(entry.category))
    if (category === 'feat') return found.filter((entry) => ['action', 'class-feature'].includes(entry.category))
    return []
}

/** Casou a versão legada de algo que o Foundry já trata como Remaster: siga o `replaced_by` ("Weapon Mastery" do Ranger). */
function current(entry, mechanics, index) {
    if (entry.remaster || !mechanics.remaster || !entry.replaced_by) return entry
    return index.get(`id|${entry.replaced_by}`)?.[0] ?? entry
}

const owners = (entry) => [...(entry.traits ?? []), ...[entry.data?.class ?? []].flat()].map(matchKey)

function narrowed(candidates, mechanics, hints) {
    let kept = candidates
    const narrow = (test) => {
        const next = kept.filter(test)
        if (next.length) kept = next
    }
    if (kept.length > 1 && mechanics.level !== null) narrow((entry) => entry.level === mechanics.level)
    if (kept.length > 1 && hints.size) narrow((entry) => owners(entry).some((owner) => hints.has(owner)))
    if (kept.length > 1) narrow((entry) => entry.remaster === mechanics.remaster)
    // Família de graus: o documento-pai agrega; a mecânica é do grau, que tem `item_parent_id`.
    if (kept.length > 1) narrow((entry) => Boolean(entry.data?.item_parent_id))
    // Reimpressão no mesmo estado (Remaster ou não): vale a edição mais recente.
    if (kept.length > 1) {
        const newest = kept.map((entry) => entry.data?.release_date ?? '').sort().at(-1)
        narrow((entry) => (entry.data?.release_date ?? '') === newest)
    }
    return kept
}

/**
 * Casa a mecânica com a entrada da AON pelo nome exato normalizado (o fuzzy de `namesCompatible` serve para descrição,
 * não para regra). Ordem: nome na categoria; nome em qualquer categoria de jogador (o Foundry põe ritual em `spell` e
 * subclasse em `class-feature`); o mesmo sem o parêntese final, que vira variante ("Advanced Vials (Bomber)").
 * Homônimos se resolvem pelo nível, pela marca Remaster e pela classe; característica de classe que segue repetida é a
 * mesma regra em várias classes ("Evasion") e vale para todas.
 */
export function matchAon(mechanics, index, classHint = null) {
    if (!mechanics.category) return { status: 'no-category' }
    const hints = new Set([classHint, ...(mechanics.traits ?? [])].filter(Boolean).map(matchKey))
    const attempts = [{ name: mechanics.name, variant: null }]
    const paren = /^(.+?)\s*\(([^)]+)\)$/.exec(mechanics.name)
    if (paren) attempts.push({ name: paren[1], variant: paren[2] })
    const tagged = /^\([^)]+\)\s*(.+)$/.exec(mechanics.name)
    if (tagged) attempts.push({ name: tagged[1], variant: null })
    const prefixed = /^([^:]+):\s*(.+)$/.exec(mechanics.name)
    if (prefixed) attempts.push({ name: prefixed[2], variant: null, hint: prefixed[1] })
    let ambiguous = null
    for (const attempt of attempts) {
        const attemptHints = new Set([...hints, ...[attempt.variant, attempt.hint].filter(Boolean).map(matchKey)])
        for (const group of [mechanics.category, '*']) {
            let found = index.get(`${group}|${matchKey(attempt.name)}`) ?? []
            if (group === '*') found = looseCandidates(found, mechanics.category)
            if (!found.length) continue
            const kept = narrowed(found, mechanics, attemptHints)
            if (kept.length === 1) return { status: 'matched', entries: [current(kept[0], mechanics, index)], variant: attempt.variant }
            if (mechanics.category === 'class-feature' && kept.every((entry) => entry.category === 'class-feature')) {
                return { status: 'matched', entries: kept, variant: attempt.variant, shared: true }
            }
            ambiguous ??= kept.map((entry) => entry.aon_id)
        }
    }
    return ambiguous ? { status: 'ambiguous', candidates: ambiguous } : { status: 'unmatched' }
}

/**
 * Linhas de `rules_mechanics` (origin `foundry`) e o relatório da ingestão. Variantes do Foundry que a AON junta numa
 * entrada só entram na mesma linha, com `variant` em cada rule element. Na classe, cada característica da progressão
 * ganha o `aon_id` casado (ou null, que o motor mostra como aviso).
 */
export function buildFoundryMechanics(docs, aonEntries) {
    const index = buildAonIndex(aonEntries)
    const rows = new Map()
    const report = { matched: 0, shared: 0, variants: 0, unmatched: [], ambiguous: [], duplicate: [], noCategory: 0, unsupported: {} }
    for (const doc of docs) {
        const mechanics = foundryMechanics(doc)
        const match = matchAon(mechanics, index)
        if (match.status === 'no-category') {
            report.noCategory++
            continue
        }
        if (match.status !== 'matched') {
            report[match.status].push({ name: mechanics.name, category: mechanics.category, candidates: match.candidates })
            continue
        }
        if (mechanics.progression) {
            for (const feature of mechanics.progression.features) {
                const found = matchAon({ name: feature.name, category: 'class-feature', level: null, remaster: true }, index, mechanics.name)
                feature.aon_id = found.status === 'matched' && found.entries.length === 1 ? found.entries[0].aon_id : null
            }
        }
        const rules = match.variant ? mechanics.rules.map((rule) => ({ ...rule, variant: match.variant })) : mechanics.rules
        for (const { aon_id } of match.entries) {
            const row = rows.get(aon_id)
            if (row && !match.variant) {
                report.duplicate.push({ name: mechanics.name, aon_id })
                continue
            }
            if (row) {
                row.rules.push(...rules)
                row.unsupported = [...new Set([...row.unsupported, ...mechanics.unsupported])].sort()
                report.variants++
                continue
            }
            rows.set(aon_id, {
                aon_id,
                origin: 'foundry',
                rules: [...rules],
                unsupported: mechanics.unsupported,
                prereq: null,
                progression: mechanics.progression,
                reviewed: false,
            })
        }
        for (const label of mechanics.unsupported) report.unsupported[label] = (report.unsupported[label] ?? 0) + 1
        report.matched++
        if (match.shared) report.shared++
    }
    report.unsupported = Object.fromEntries(Object.entries(report.unsupported).sort((a, b) => b[1] - a[1]))
    return { rows: [...rows.values()], report }
}

/** Linhas da tabela "Your Level | Class Features" do markdown da classe na AON: nível → itens em minúsculas. */
export function aonAdvancement(markdown) {
    const rows = new Map()
    for (const match of text(markdown).matchAll(/<tr><td>(\d{1,2})<\/td><td>([^<]*)<\/td><\/tr>/g)) {
        rows.set(Number(match[1]), match[2].split(',').map((part) => matchKey(part).replace(/\s+\d+d\d+$/, '')))
    }
    return rows
}

/**
 * Confere a progressão do Foundry com a tabela de avanço da AON: níveis de talento e de aumento de perícia, e cada
 * característica no nível certo. Devolve as divergências legíveis (vazio = bate).
 */
export function checkProgression(className, progression, markdown) {
    const table = aonAdvancement(markdown)
    if (table.size !== 20) return [`${className}: tabela de avanço da AON ilegível`]
    const problems = []
    const levelsWith = (pattern) => [...table].filter(([, items]) => items.some((item) => pattern.test(item))).map(([level]) => level)
    const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i])
    const slots = [
        ['classFeatLevels', new RegExp(`^${matchKey(className)} feat$`)],
        ['ancestryFeatLevels', /^ancestry feat$/],
        ['generalFeatLevels', /^general feat$/],
        // Talento de perícia extra: Skillful Lessons (Investigator) e Stylish Tricks (Swashbuckler), Player Core 2.
        ['skillFeatLevels', /^(skill feat|skillful lessons?|stylish tricks)$/],
        // A AON às vezes cola o item seguinte sem vírgula ("skill increase weapon mastery", Champion 13).
        ['skillIncreaseLevels', /^skill increase\b/],
    ]
    for (const [key, pattern] of slots) {
        const aon = levelsWith(pattern).filter((level) => !(key === 'ancestryFeatLevels' && level === 1))
        const ours = progression[key].filter((level) => !(key === 'ancestryFeatLevels' && level === 1))
        if (!same(aon, ours)) problems.push(`${className} ${key}: Foundry ${ours.join(',')} × AON ${aon.join(',')}`)
    }
    for (const feature of progression.features) {
        const items = table.get(feature.level) ?? []
        const key = matchKey(feature.name).replace(/^\([^)]*\)\s*/, '')
        if (!items.some((item) => item === key || item.startsWith(`${key} `) || key.startsWith(`${item} `))) {
            problems.push(`${className} ${feature.level}: "${feature.name}" fora da linha da AON`)
        }
    }
    return problems
}
