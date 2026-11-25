// Pacotes de leitura do catálogo (MODELO-DE-DADOS §4, BASE-DE-REGRAS §5): o banco é a fonte, e o cliente lê estes
// JSONs do Storage, por versão, sem função nem consulta ao banco. Funções puras: quem lê o banco e grava é o chamador.
import { createHash } from 'node:crypto'
import { catalogRuleId } from './rules-normalize.js'

/** Categorias que o Criador oferece como escolha de classe (subclasse, kit, tática…), lidas com `core/class-features`. */
const CLASS_OPTIONS = new Set(['class-feature', 'apparition', 'arcane-school', 'arcane-thesis', 'bloodline', 'cause',
    'class-kit', 'conscious-mind', 'doctrine', 'draconic-exemplar', 'druidic-order', 'eidolon', 'element', 'epithet',
    'fey-patronage', 'grim-fascination', 'hunters-edge', 'hybrid-study', 'ikon', 'implement', 'innovation', 'instinct',
    'lesson', 'methodology', 'muse', 'mystery', 'mythic-calling', 'patron', 'practice', 'racket', 'research-field',
    'runesmith-rune', 'style', 'subconscious-mind', 'tactic', 'way'])
const GLOSSARY = new Set(['trait', 'condition', 'skill', 'skill-general-action', 'weapon-group', 'armor-group', 'item-bonus'])
const ITEM_LISTS = {
    Weapons: 'weapons', Armor: 'armor', Shields: 'shields', Runes: 'runes', Materials: 'materials',
    Consumables: 'consumables', 'Alchemical Items': 'consumables', Snares: 'consumables',
    'Worn Items': 'worn', Tattoos: 'worn', Grafts: 'worn', Shrouds: 'worn', 'Apex Items': 'worn',
    'Held Items': 'held', Grimoires: 'held', Banners: 'held', 'Assistive Items': 'held', Spellhearts: 'held',
    Staves: 'staves-wands', Wands: 'staves-wands',
}
const TRADITIONS = ['arcane', 'divine', 'occult', 'primal']
const ACTIONS = { 'Single Action': '1', 'Two Actions': '2', 'Three Actions': '3', Reaction: 'reaction', 'Free Action': 'free' }

const slug = (value) => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const lower = (values) => (values ?? []).map((value) => String(value).toLowerCase())
const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, part]) => part !== undefined && part !== null
    && !(Array.isArray(part) && !part.length)))
const sourceRef = (sourceId) => `source:${sourceId}`

function page(raw) {
    const match = /\bpg\.\s*(\d+)/.exec(raw ?? '')
    return match ? Number(match[1]) : undefined
}

function itemView(entry) {
    const { data } = entry
    const derived = data.derived ?? {}
    const base = compact({
        category: entry.category === 'equipment' ? data.item_category : { weapon: 'Weapons', armor: 'Armor', shield: 'Shields' }[entry.category],
        subcategory: data.item_subcategory,
        price: Number.isFinite(data.price) ? { gp: data.price / 100 } : undefined,
        bulk: data.bulk_raw === 'L' ? 'L' : Number.isFinite(data.bulk) ? data.bulk : undefined,
        hands: data.hands,
        usage: data.usage,
        parent: data.item_parent_id ? catalogRuleId('equipment', data.item_parent_id) : undefined,
        baseItem: data.base_item,
    })
    if (entry.category === 'weapon') base.weapon = compact({ ...derived.weapon, traitsRaw: data.trait_raw })
    if (entry.category === 'armor') {
        base.armor = compact({ ac: data.ac, dexCap: data.dex_cap, strength: data.strength, checkPenalty: data.check_penalty,
            speedPenalty: data.speed_penalty, category: data.armor_category, group: data.armor_group })
    }
    if (entry.category === 'shield') base.shield = compact({ ac: data.ac, hardness: data.hardness, hp: data.hp, bt: data.broken_threshold })
    return base
}

function classView(entry, mechanics) {
    const derived = entry.data.derived?.class ?? {}
    const progression = mechanics?.progression
    if (!progression) return derived
    return compact({
        ...derived,
        keyAttribute: derived.keyAttribute?.length ? derived.keyAttribute : progression.keyAttribute,
        featLevels: {
            ancestry: progression.ancestryFeatLevels,
            class: progression.classFeatLevels,
            general: progression.generalFeatLevels,
            skill: progression.skillFeatLevels,
        },
        skillIncreaseLevels: progression.skillIncreaseLevels,
        spellcasting: progression.spellcasting || undefined,
        features: progression.features.map((feature) => compact({
            level: feature.level,
            name: feature.name,
            id: feature.aon_id ? catalogRuleId('class-feature', feature.aon_id) : undefined,
        })),
    })
}

/** RuleEntry do pacote (MODELO-DE-DADOS §4): só campos mecânicos e de seleção, sem o markdown. */
export function ruleEntryView(entry, mechanics) {
    const { data } = entry
    const derived = data.derived ?? {}
    const unsupported = [...new Set([...(derived.unsupported ?? []), ...(mechanics?.unsupported ?? [])])]
    const view = compact({
        id: entry.id,
        name: entry.name,
        type: entry.category,
        level: entry.level ?? undefined,
        rarity: entry.rarity ?? undefined,
        traits: entry.traits,
        source: compact({ id: sourceRef(entry.source_id), page: page(data.primary_source_raw) }),
        aon: data.url ? { id: entry.aon_id, url: data.url } : { id: entry.aon_id },
        remaster: entry.remaster,
        replaces: entry.legacy_ids?.[0],
        legacyNames: entry.legacy_names,
        summary: data.summary,
        actions: ACTIONS[data.actions] ?? undefined,
        prerequisites: data.prerequisite ? { text: data.prerequisite } : undefined,
        rules: mechanics?.rules?.length ? mechanics.rules : undefined,
        unsupported,
    })
    if (entry.category === 'ancestry') view.ancestry = derived.ancestry
    // Ancestralidade da herança: a AON não traz; vem do Foundry (`extra.ancestry`). Sem ela = versátil.
    if (entry.category === 'heritage') view.heritage = compact({ ancestry: data.ancestry ?? mechanics?.extra?.ancestry ?? undefined })
    if (entry.category === 'background') view.background = derived.background
    if (entry.category === 'class') view.class = classView(entry, mechanics)
    if (CLASS_OPTIONS.has(entry.category) && data.class) view.classOption = { class: data.class }
    if (entry.category === 'class-feature' && derived.classFeature) view.classFeature = derived.classFeature
    if (entry.category === 'doctrine' && derived.doctrine) view.doctrine = derived.doctrine
    if (entry.category === 'feat') view.feat = compact({ archetype: data.archetype, skill: data.skill, casting: derived.feat?.casting })
    if (entry.category === 'spell' || entry.category === 'ritual') {
        view.spell = { ...(derived.spell ?? {}), ritual: entry.category === 'ritual' }
    }
    if (['armor', 'equipment', 'shield', 'weapon'].includes(entry.category)) view.item = itemView(entry)
    return view
}

/** Listas (caminho sem `.json`) em que a entrada entra. Talento pode estar em mais de uma (classe e arquétipo). */
export function ruleLists(entry, names) {
    const { category, data } = entry
    const traits = lower(entry.traits)
    if (category === 'ancestry') return ['core/ancestries']
    if (category === 'heritage') return ['core/heritages']
    if (category === 'background') return ['core/backgrounds']
    if (category === 'class') return ['core/classes']
    if (CLASS_OPTIONS.has(category)) return ['core/class-features']
    if (['deity', 'domain', 'deity-category'].includes(category)) return ['core/deities']
    if (category === 'language') return ['core/languages']
    if (category === 'archetype') return ['core/archetypes']
    if (category === 'action') return ['core/actions']
    if (GLOSSARY.has(category)) return ['core/glossary']
    if (category === 'relic' || category === 'set-relic') return ['items/relics']
    if (['animal-companion', 'animal-companion-advanced', 'animal-companion-specialization', 'animal-companion-unique'].includes(category)) {
        return ['companions/animal']
    }
    if (category === 'familiar-ability' || category === 'familiar-specific') return ['companions/familiar']
    if (category === 'ritual') return ['spells/rituals']
    if (category === 'spell') {
        const spell = data.derived?.spell ?? {}
        if (spell.focus) return ['spells/focus']
        const lists = lower(spell.traditions).filter((tradition) => TRADITIONS.includes(tradition)).map((tradition) => `spells/${tradition}`)
        return lists.length ? lists : ['spells/other']
    }
    if (category === 'feat') {
        const lists = new Set()
        for (const trait of traits) {
            if (names.classes.has(trait)) lists.add(`feats/class/${slug(trait)}`)
            if (names.ancestries.has(trait)) lists.add(`feats/ancestry/${slug(trait)}`)
        }
        for (const archetype of data.archetype ?? []) lists.add(`feats/archetype/${slug(archetype)}`)
        if (traits.includes('mythic')) lists.add('feats/mythic')
        if (traits.includes('skill')) lists.add('feats/skill')
        else if (traits.includes('general')) lists.add('feats/general')
        return lists.size ? [...lists] : ['feats/other']
    }
    if (category === 'weapon') return ['items/weapons']
    if (category === 'armor') return ['items/armor']
    if (category === 'shield') return ['items/shields']
    if (category === 'equipment') return [`items/${ITEM_LISTS[data.item_category] ?? 'gear'}`]
    return [`other/${category}`]
}

/** Vínculos entre entradas publicadas. Uma característica pode apontar para a classe inteira como legacy_id. */
function remasterLinks(entries, names) {
    const byAon = new Map(entries.map((entry) => [entry.aon_id, entry]))
    const byOld = new Map()
    function link(old, target) {
        if (!old || !target || old.remaster || !target.remaster || old.category !== target.category) return
        if (!byOld.has(old.id)) byOld.set(old.id, new Set())
        byOld.get(old.id).add(target)
    }
    for (const entry of entries) {
        for (const id of entry.data.remaster_ids ?? (entry.replaced_by ? [entry.replaced_by] : [])) link(entry, byAon.get(id))
        for (const id of entry.legacy_ids ?? []) link(byAon.get(id), entry)
    }
    return entries.filter((entry) => byOld.has(entry.id)).map((entry) => ({
        id: entry.id, name: entry.name, list: ruleLists(entry, names)[0],
        targets: [...byOld.get(entry.id)].sort((a, b) => a.id.localeCompare(b.id)).map((target) => ({
            id: target.id, name: target.name, list: ruleLists(target, names)[0],
            source: { id: sourceRef(target.source_id) }, rarity: target.rarity ?? undefined,
        })),
    }))
}

const hashOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

/**
 * Monta os arquivos de uma versão do catálogo. `entries` = linhas de `rules_entries` sem markdown, `mechanics` =
 * `aon_id` → linha de `rules_mechanics`, `sources` = `rules_sources` importados, `tables` = tabelas curadas
 * (`spell-slots.json`, `wealth.json`, `exports.json`). Devolve `{ files: { caminho: texto }, manifest }`.
 */
export function buildRulePackages({ version, entries, mechanics, sources, tables }) {
    const live = entries.filter((entry) => !entry.removed_at)
    const names = {
        classes: new Set(live.filter((entry) => entry.category === 'class').map((entry) => entry.name.toLowerCase())),
        // Herança versátil (sem ancestralidade) tem talentos próprios com o traço dela (Nephilim, Aiuvarin…).
        ancestries: new Set(live.filter((entry) => entry.category === 'ancestry' || (entry.category === 'heritage' && !(entry.data.ancestry ?? mechanics.get(entry.aon_id)?.extra?.ancestry)))
            .map((entry) => entry.name.toLowerCase())),
    }
    const links = remasterLinks(live, names)
    const replaced = new Set(links.map((row) => row.id))
    const oldNames = new Map()
    for (const row of links) {
        for (const target of row.targets) {
            if (target.name === row.name) continue
            if (!oldNames.has(target.id)) oldNames.set(target.id, new Set())
            oldNames.get(target.id).add(row.name)
        }
    }
    // GrantItem do Foundry traz só o nome do talento: o pacote resolve o id (Remaster primeiro) para o motor buscar a
    // lista dele pelo `core/locations` quando ela não está carregada (Reactive Strike do Fighter, dedicações concedidas).
    const featByName = new Map()
    for (const entry of live) {
        if (entry.category !== 'feat') continue
        const key = entry.name.toLowerCase()
        const prev = featByName.get(key)
        if (!prev || (!prev.remaster && entry.remaster)) featByName.set(key, entry)
    }
    const withGrants = (rules) => rules?.map((rule) => {
        const name = rule?.key === 'GrantItem' && typeof rule.uuid === 'string' ? /^Compendium\.pf2e\.feats-srd\.Item\.(.+)$/.exec(rule.uuid)?.[1] : undefined
        const feat = name ? featByName.get(name.toLowerCase()) : undefined
        return feat ? { ...rule, grantId: feat.id } : rule
    })
    const lists = new Map()
    for (const entry of live) {
        const view = ruleEntryView(entry, mechanics.get(entry.aon_id))
        if (view.rules) view.rules = withGrants(view.rules)
        if (replaced.has(entry.id)) view.superseded = true
        // A busca pelo nome anterior deve encontrar o sucessor mesmo quando só o legado traz o vínculo.
        if (oldNames.has(entry.id)) view.previousNames = [...oldNames.get(entry.id)].sort()
        for (const list of ruleLists(entry, names)) {
            if (!lists.has(list)) lists.set(list, [])
            lists.get(list).push(view)
        }
    }
    lists.set('core/remaster', links)
    // Onde mora cada entrada fora do núcleo (id → primeira lista): o editor e o servidor buscam a lista de uma escolha
    // salva que a carga habitual não resolve (talento de outro arquétipo, magia de outra tradição, divindade).
    const locations = {}
    for (const entry of live) {
        const [list] = ruleLists(entry, names)
        if (list && (!list.startsWith('core/') || list === 'core/deities')) locations[entry.id] = list
    }
    lists.set('core/sources', sources.map((source) => compact({
        id: sourceRef(source.aon_id), name: source.name, productLine: source.product_line, releaseDate: source.release_date,
        remaster: source.remaster, errata: source.errata,
    })))
    const files = {}
    const manifestFiles = {}
    for (const [list, items] of [...lists].sort(([a], [b]) => a.localeCompare(b))) {
        const sorted = list === 'core/sources' ? items : [...items].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
        const text = JSON.stringify(sorted)
        files[`${list}.json`] = text
        manifestFiles[list] = { hash: hashOf(text), count: sorted.length, bytes: Buffer.byteLength(text) }
    }
    {
        const text = JSON.stringify(Object.fromEntries(Object.entries(locations).sort(([a], [b]) => a.localeCompare(b))))
        files['core/locations.json'] = text
        manifestFiles['core/locations'] = { hash: hashOf(text), count: Object.keys(locations).length, bytes: Buffer.byteLength(text) }
    }
    const tablesText = JSON.stringify(tables)
    files['core/tables.json'] = tablesText
    manifestFiles['core/tables'] = { hash: hashOf(tablesText), count: Object.keys(tables).length, bytes: Buffer.byteLength(tablesText) }
    const manifest = { version, generatedAt: new Date().toISOString(), files: manifestFiles, sources: sources.map((source) => sourceRef(source.aon_id)) }
    files['manifest.json'] = JSON.stringify(manifest)
    return { files, manifest }
}
