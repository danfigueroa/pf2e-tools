/* i18n-ignore-file */
// Importação reversa (CONTRATO-FICHA §9): um export do Pathbuilder vira um BuildState editável, com relatório do que
// não casou. A ordem por nível de perícias nem sempre é recuperável: o importador distribui pelo nível mais baixo
// possível (respeitando os tetos do Player Core pg. 92) e marca no histórico.
import type { BuildInfo } from '../../../pathbuilder/types'
import type { BuildState, Choice, InventoryEntry } from '../types'
import type { RuleEntry } from '../rules/types'
import { compileBuild } from './compile'
import { skillRef } from './skills'
import { SKILL_KEYS, type AttributeKey, type CompileContext, type SkillKey } from './types'
import { BLOODRAGER, CLASS_ARCHETYPE, CLASS_ARCHETYPES, PALATINE_DETECTIVE, RUNELORD, WAR_MAGE } from './classArchetypes'
import { CLASS_CHOICE_TYPES } from './classChoices'

const ATTR: Record<string, AttributeKey> = { Str: 'str', Dex: 'dex', Con: 'con', Int: 'int', Wis: 'wis', Cha: 'cha' }
const STRIKING: Record<string, number> = { '': 0, striking: 1, greaterStriking: 2, majorStriking: 3 }
const RESILIENT: Record<string, number> = { '': 0, resilient: 1, greaterResilient: 2, majorResilient: 3 }

export interface ImportReport {
    /** Nomes do export que não estão no catálogo carregado (legado, caseiro, rótulo composto). */
    notFound: string[]
    /** O que foi deduzido sem certeza (ordem das perícias, tradição…). */
    guesses: string[]
}

const lower = (list: string[] | undefined) => (list ?? []).map((a) => ATTR[a]).filter(Boolean)

/** Rótulo de slot do Pathbuilder → chave do Criador. */
export function slotKeyFromLabel(label: string, className: string, level: number): string | null {
    let m = /^Free Archetype (\d+)$/.exec(label)
    if (m) return `archetype-feat-${m[1]}`
    m = /^Mythic Feat (\d+)$/.exec(label)
    if (m) return `mythic-feat-${m[1]}`
    m = /^(?:Skill Feat|Skill Lessons) (\d+)$/.exec(label)
    if (m) return `skill-feat-${m[1]}`
    m = /^General Feat (\d+)$/.exec(label)
    if (m) return `general-feat-${m[1]}`
    if (label === 'Combat Flexibility' || label === 'Improved Flexibility') return `flexibility-feat-${level}`
    m = new RegExp(`^${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Feat (\\d+)$`).exec(label)
    if (m) return `class-feat-${m[1]}`
    m = /^Ancestral Paragon Feat (\d+)$/.exec(label)
    if (m) return `paragon-feat-${m[1]}`
    m = /^(.+) Feat (\d+)$/.exec(label)
    if (m) return `ancestry-feat-${m[2]}`
    return null
}

export function importPathbuilder(b: BuildInfo, ctx: CompileContext): { state: BuildState; report: ImportReport } {
    const { rules } = ctx
    const notFound: string[] = []
    const guesses: string[] = []
    const find = (name: string | undefined | null, type?: string): RuleEntry | undefined => {
        if (!name || name === 'Not set' || name === 'None selected') return undefined
        const e = rules.byName(name, type)
        if (!e) notFound.push(name)
        return e
    }

    const ancestry = find(b.ancestry, 'ancestry')
    const heritage = find(b.heritage, 'heritage')
    const background = find(b.background, 'background')
    const cls = find(b.class, 'class')
    const bd = b.abilities.breakdown
    const listedFlaws = ancestry?.ancestry?.flaws ?? []
    const alternate = !!bd && (bd.ancestryBoosts ?? []).length === 0 && (ancestry?.ancestry?.boosts ?? []).some((x) => x !== 'free')
    const choices: Record<string, Choice> = {}
    if (bd) {
        if (bd.ancestryFree?.length) choices['boosts-ancestry'] = { boosts: lower(bd.ancestryFree) }
        if (bd.backgroundBoosts?.length) choices['boosts-background'] = { boosts: lower(bd.backgroundBoosts) }
        for (const [lvl, list] of Object.entries(bd.mapLevelledBoosts ?? {})) choices[`boosts-${lvl}`] = { boosts: lower(list as string[]) }
    } else guesses.push('atributos sem memória dos boosts no export')

    const languages = (b.languages ?? []).filter((l) => l !== 'None selected' && !(ancestry?.ancestry?.languages ?? []).includes(l))
        .map((l) => rules.languages.find((x) => x.name === l || (x.legacyNames ?? []).includes(l))?.id).filter((x): x is string => !!x)

    // Talentos: o rótulo do slot diz a chave; filhos pelo ChoiceSet do pai.
    const parentByLabel = new Map<string, { key: string; entry: RuleEntry }>()
    for (const f of b.feats) {
        if (!Array.isArray(f)) continue
        const [name, qualifier, , level, label, kind] = f as [string, string | null, string, number, string?, string?]
        if (!label || kind === 'childChoice' || label.startsWith('BACKGROUND_')) continue
        if (label === 'Heritage Feat') {
            if (heritage) parentByLabel.set(label, { key: `awarded:${heritage.aon.id}`, entry: heritage })
            continue
        }
        const key = slotKeyFromLabel(label, b.class, Number(level))
        const entry = find(name, 'feat')
        if (!key || !entry) continue
        const q = qualifier ? `skill:${qualifier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined
        const archetype = entry.feat?.archetype?.[0]
        choices[key] = { id: entry.id, ...(q && /^skill:[a-z0-9-]+$/.test(q) ? { qualifier: q } : archetype ? { qualifier: `archetype:${archetype.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` } : {}) }
        parentByLabel.set(label, { key, entry })
    }
    for (const f of b.feats) {
        if (!Array.isArray(f) || f[5] !== 'childChoice') continue
        const parentLabel = String(f[6] ?? '')
        const parent = parentByLabel.get(parentLabel)
        const child = find(String(f[0]), 'feat')
        if (!parent || !child) continue
        const flag = (parent.entry.rules ?? []).find((r) => r.key === 'ChoiceSet' && r.choices && typeof r.choices === 'object' && !Array.isArray(r.choices))?.flag
        if (typeof flag === 'string') choices[`${parent.key}/choice:${flag}`] = { id: child.id }
        else guesses.push(`escolha filha sem lugar: ${f[0]} (de ${parentLabel})`)
    }

    // Subclasses e chamado mítico: o export lista o nome nas características, às vezes com o tipo junto
    // ("Thief Racket", "Giant Instinct", "Hunter's Edge: Precision", "Empiricism Methodology").
    const specialKeys = new Set((b.specials ?? []).map((sp) => sp.toLowerCase()
        .replace(/^hunter['’]s edge:\s*/, '')
        .replace(/\s+(racket|instinct|methodology|muse|bloodline|order|mystery|patron|school|style|way|research field|doctrine)$/, '')))
    const types = Object.entries(CLASS_CHOICE_TYPES).filter(([, spec]) => spec.className.toLowerCase() === b.class.toLowerCase()).map(([t]) => t)
    for (const type of [...types, 'mythic-calling']) {
        const option = (ctx.classOptions ?? []).filter((o) => o.type === type).find((o) => specialKeys.has(o.name.toLowerCase()) || (b.specials ?? []).includes(o.name))
        if (option) choices[`class-choice:${type}`] = { id: option.id }
    }

    const covil = (b as BuildInfo & { covil?: { ids?: Record<string, string> } }).covil
    const archetypeId = covil?.ids ? covil.ids[CLASS_ARCHETYPE] : Object.entries(CLASS_ARCHETYPES).find(([id, spec]) =>
        spec.className === cls?.name && (Object.values(choices).some((c) => 'id' in c && c.id === spec.dedication)
            || (id === BLOODRAGER && specialKeys.has('bloodrager')) || (id === WAR_MAGE && specialKeys.has('war magic'))
            || (id === PALATINE_DETECTIVE && specialKeys.has('esoterica')) || (id === RUNELORD && specialKeys.has('school of thassilonian rune magic'))))?.[0]
    if (archetypeId && cls && CLASS_ARCHETYPES[archetypeId]?.className === cls.name) {
        choices[CLASS_ARCHETYPE] = { id: archetypeId }
        const fixed = CLASS_ARCHETYPES[archetypeId].subclass
        const key = `class-choice:${fixed.split(':')[0]}`
        // O retrato mostra a subclasse efetiva; os ids guardam a escolha original do rascunho.
        if (covil?.ids?.[key]) choices[key] = { id: covil.ids[key] }
        else if (choices[key] && 'id' in choices[key] && choices[key].id === fixed) delete choices[key]
    }
    if (archetypeId === BLOODRAGER) {
        const caster = b.spellCasters?.find((c) => c.name === 'Archetype Bloodrager')
        const slot = Object.keys(choices).find((k) => {
            const c = choices[k]
            return 'id' in c && c.id === CLASS_ARCHETYPES[BLOODRAGER].dedication
        })
        if (slot && (caster?.magicTradition === 'arcane' || caster?.magicTradition === 'divine')) {
            choices[`${slot}/choice:skill`] = { value: caster.magicTradition === 'arcane' ? 'arcana' : 'religion' }
        }
    }

    // Path to Perfection: o nome da característica traz a escolha ("Path to Perfection (Will)").
    for (const sp of b.specials ?? []) {
        const m = /^(Path to Perfection|Second Path to Perfection|Third Path to Perfection) \((Fortitude|Reflex|Will)\)$/.exec(sp)
        const ref = m && cls?.class?.features?.find((x) => x.name === m[1])
        if (ref) choices[`class-choice:save-${ref.level}`] = { value: m![2].toLowerCase() }
    }

    // Grupo de arma (Fighter Weapon Mastery, Weapon Legend): a arma mestre/lendária do export diz o grupo.
    const groupFeatures = (cls?.class?.features ?? []).filter((x) => /^(fighter weapon mastery|weapon legend)$/i.test(x.name) && x.level <= b.level)
    for (const [i, ref] of groupFeatures.entries()) {
        const names = i === 0 ? [...(b.specificProficiencies?.master ?? []), ...(b.specificProficiencies?.legendary ?? [])] : (b.specificProficiencies?.legendary ?? [])
        const group = names.map((n) => rules.byName(n)?.item?.weapon?.group).find(Boolean)
        if (group) choices[`class-choice:weapon-group-${ref.level}`] = { value: group.toLowerCase() }
        else guesses.push(`${ref.name}: grupo de arma não identificado no export`)
    }

    const base: BuildState = {
        schema: 1, rulesVersion: '', name: b.name, level: b.level, xp: b.xp ?? 0,
        options: {}, origin: {
            ancestry: ancestry?.id, heritage: heritage?.id, background: background?.id, alternateBoosts: alternate || undefined,
            voluntaryFlaws: lower(bd?.ancestryFlaws).filter((f) => !listedFlaws.includes(f)), languages,
            deity: find(b.deity, 'deity')?.id,
        },
        class: { id: cls?.id, keyAttribute: lower(bd?.classBoosts)[0] ?? (b.keyability as AttributeKey) },
        choices, manual: {}, inventory: [], money: { ...b.money }, formulas: [], spellcasting: {}, companions: [],
        details: (() => {
            const x = b as BuildInfo & { gender?: string; age?: string | number }
            return { ...(x.gender && x.gender !== 'Not set' ? { gender: x.gender } : {}), ...(x.age && x.age !== 'Not set' ? { age: String(x.age) } : {}) }
        })(),
        history: [{ at: new Date().toISOString(), by: 'import', note: 'Importado do Pathbuilder', kind: 'override' }],
    }
    // Free Archetype só se o export tem talentos dele.
    if (!b.feats.some((f) => Array.isArray(f) && /^Free Archetype/.test(String(f[4] ?? '')))) base.options.variants = { freeArchetype: false }

    const want = Object.fromEntries(SKILL_KEYS.map((s) => [s, Math.round(((b.proficiencies as unknown as Record<string, number>)[s] ?? 0) / 2)])) as Record<SkillKey, number>

    // Escolhas filhas que o export não lista como filhas: o estilo da Swashbuckler Dedication vem nas características
    // ("Rascal"); a perícia de um ChoiceSet de valor, pela perícia que a ficha tem treinada. Antes das perícias, para o
    // treino que o talento dá não gastar um treino livre.
    const children = compileBuild(base, ctx).featChildren.filter((c) => !choices[c.key])
    const specialNames = new Set((b.specials ?? []).map((sp) => sp.toLowerCase()))
    for (const child of children) {
        const flag = child.key.split('/choice:')[1]?.toLowerCase() ?? ''
        if (child.kind === 'feat') {
            const option = (ctx.classOptions ?? []).find((o) => specialNames.has(o.name.toLowerCase()) && flag.includes(o.type.toLowerCase()))
            if (option) { choices[child.key] = { id: option.id }; continue }
            // Basic Flair & cia.: o export lista o talento como "Swashbuckler Feat" no nível do pai.
            const traits = (child.filter?.traits ?? []).filter((t) => !t.includes('{'))
            const row = traits.length ? b.feats.find((f) => Array.isArray(f) && Number(f[3]) === child.level
                && traits.some((t) => String(f[2] ?? '').toLowerCase() === `${t.toLowerCase()} feat`)) : undefined
            const entry = row ? rules.byName(String((row as unknown as unknown[])[0]), 'feat') : undefined
            if (entry) choices[child.key] = { id: entry.id }
        } else if (child.kind === 'value' && child.options?.length && child.options.every((o) => SKILL_KEYS.includes(o.value as SkillKey))) {
            const pick = child.options.find((o) => want[o.value as SkillKey] >= 1)
            if (pick) choices[child.key] = { value: pick.value }
        }
    }

    // Perícias: o que a origem e a classe dão é automático; o resto vira treino livre e aumentos, do nível mais baixo.
    const auto = compileBuild(base, ctx)
    const have = auto.skills.rank
    const classSlots = auto.skillSlots.filter((s) => s.key.startsWith('class-skill-'))
    for (const slot of classSlots) {
        const pick = slot.options.find((o) => o.startsWith('skill:') && want[o.slice(6) as SkillKey] >= 1)
        if (pick) choices[slot.key] = { skills: [pick] }
    }
    const trained = new Set(Object.entries(have).filter(([, r]) => r >= 1).map(([k]) => k))
    for (const slot of classSlots) for (const s of (choices[slot.key] as { skills?: string[] })?.skills ?? []) trained.add(s.slice(6))
    const toTrain = SKILL_KEYS.filter((s) => want[s] >= 1 && !trained.has(s)).map((s) => `skill:${s}`)
    const lores = (b.lores ?? []).map(([n, bonus]) => ({ ref: skillRef(`${n} Lore`), rank: Math.round(bonus / 2) }))
        .filter((l) => !auto.skills.lores.some((x) => x.key === l.ref))
    const freeSlots = auto.skillSlots.filter((s) => s.kind === 'train' && !s.key.startsWith('class-skill-'))
    const queue = [...toTrain, ...lores.filter((l) => l.rank >= 1).map((l) => l.ref)]
    // O slot só de Lore (o do background) pega o Lore primeiro; os outros, na ordem.
    for (const slot of freeSlots.filter((s) => s.loreOnly)) {
        const take = queue.filter((r) => r.startsWith('lore:')).slice(0, slot.count)
        for (const r of take) queue.splice(queue.indexOf(r), 1)
        if (take.length) choices[slot.key] = { skills: take }
    }
    for (const slot of freeSlots.filter((s) => !s.loreOnly)) {
        const take = queue.splice(0, slot.count)
        if (take.length) choices[slot.key] = { skills: take }
    }
    // Aumentos: cada passo acima de treinado, nos níveis de aumento em ordem, respeitando os tetos (7 mestre, 15 lendário).
    const increases = (cls?.class?.skillIncreaseLevels ?? []).filter((l) => l <= b.level)
    const steps: { ref: string; to: number }[] = []
    for (const s of SKILL_KEYS) for (let r = 2; r <= want[s]; r++) steps.push({ ref: `skill:${s}`, to: r })
    for (const l of lores) for (let r = 2; r <= l.rank; r++) steps.push({ ref: l.ref, to: r })
    // Trainings left over (sem slot livre) também gastam aumento.
    for (const ref of queue) steps.unshift({ ref, to: 1 })
    steps.sort((a, b2) => a.to - b2.to)
    const used = new Set<number>()
    for (const step of steps) {
        const minLevel = step.to === 4 ? 15 : step.to === 3 ? 7 : 1
        const lvl = increases.find((l) => l >= minLevel && !used.has(l))
        if (lvl === undefined) { guesses.push(`aumento sem lugar: ${step.ref} → ${step.to}`); continue }
        used.add(lvl)
        choices[`skill-increase-${lvl}`] = { skills: [step.ref] }
    }
    if (steps.length) guesses.push('ordem dos aumentos de perícia deduzida (do nível mais baixo)')

    // Inventário.
    let n = 0
    const key = () => `inv-imp${(n++).toString(36)}`
    const inventory: InventoryEntry[] = []
    for (const w of b.weapons ?? []) {
        const e = find(w.name)
        if (!e) continue
        inventory.push({ key: key(), item: e.id, qty: w.qty || 1, acquired: 'given', equipped: true,
            runes: { potency: w.pot || 0, striking: STRIKING[w.str ?? ''] ?? 0, property: (w.runes ?? []).map((r) => rules.byName(r)?.id).filter((x): x is string => !!x) } })
    }
    for (const a of b.armor ?? []) {
        const e = find(a.name)
        if (!e) continue
        inventory.push({ key: key(), item: e.id, qty: a.qty || 1, acquired: 'given', worn: !!a.worn,
            runes: { potency: a.pot || 0, resilient: RESILIENT[a.res ?? ''] ?? 0, property: (a.runes ?? []).map((r) => rules.byName(r)?.id).filter((x): x is string => !!x) } })
    }
    for (const [name, qty, ...rest] of b.equipment ?? []) {
        const e = find(name)
        if (!e) continue
        inventory.push({ key: key(), item: e.id, qty: qty || 1, acquired: 'given', invested: rest.includes('Invested') && (e.traits ?? []).includes('Invested') })
    }

    // Magias: conjurador da classe e foco.
    const spellcasting: BuildState['spellcasting'] = {}
    const spellId = (name: string) => find(name.replace(/ \(Amped\)$/, ''), 'spell')?.id
    const classCaster = (b.spellCasters ?? []).find((c) => c.name === b.class)
    if (classCaster) {
        const byRank = (lists: { spellLevel: number; list: string[] }[] | undefined) =>
            Object.fromEntries((lists ?? []).filter((l) => l.list.length).map((l) => [String(l.spellLevel), l.list.map(spellId).filter((x): x is string => !!x)]))
        if (classCaster.spellcastingType === 'spontaneous') spellcasting.class = { repertoire: byRank(classCaster.spells) }
        else {
            const prepared = byRank(classCaster.prepared?.length ? classCaster.prepared : classCaster.spells)
            const book = Object.values(byRank(classCaster.spells)).flat()
            spellcasting.class = { prepared, ...(book.length ? { spellbook: book } : {}) }
        }
        if (cls?.class?.casting && cls.class.casting.traditions.length > 1) choices['spell-tradition'] = { value: classCaster.magicTradition }
    }
    // Conjuradores de arquétipo ("Archetype Wizard"): mesma forma, chave `archetype:<classe>`.
    for (const caster of (b.spellCasters ?? []).filter((c) => /^Archetype /.test(c.name))) {
        const slug = caster.name.replace(/^Archetype /, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const byRank = (lists: { spellLevel: number; list: string[] }[] | undefined) =>
            Object.fromEntries((lists ?? []).filter((l) => l.list.length).map((l) => [String(l.spellLevel), l.list.map(spellId).filter((x): x is string => !!x)]))
        if (caster.spellcastingType === 'spontaneous') spellcasting[`archetype:${slug}`] = { repertoire: byRank(caster.spells) }
        else {
            const book = Object.values(byRank(caster.spells)).flat()
            spellcasting[`archetype:${slug}`] = { prepared: byRank(caster.prepared?.length ? caster.prepared : caster.spells), ...(book.length ? { spellbook: book } : {}) }
        }
    }
    const focusNames = Object.values(b.focus ?? {}).flatMap((byAttr) => Object.values(byAttr))
    const focusCantrips = focusNames.flatMap((f) => f.focusCantrips ?? []).map(spellId).filter((x): x is string => !!x)
    const focusSpells = focusNames.flatMap((f) => f.focusSpells ?? []).map(spellId).filter((x): x is string => !!x)
    if (focusCantrips.length || focusSpells.length) spellcasting.focus = { repertoire: { 0: focusCantrips, 1: focusSpells } }
    const rituals = (b.rituals ?? []).map((r) => find(r, 'spell')?.id ?? find(r)?.id).filter((x): x is string => !!x)
    if (rituals.length) spellcasting.rituals = { spellbook: rituals }

    // Companheiros.
    const companions: BuildState['companions'] = []
    for (const p of b.pets ?? []) {
        if (p.type !== 'Animal Companion') continue
        const type = p.animal ? rules.byName(p.animal)?.id : undefined
        companions.push({ key: `pet-imp${companions.length}`, kind: 'animal', name: p.name || p.animal || 'Companion', ...(type ? { type } : {}), choices: {} })
    }
    for (const f of b.familiars ?? []) {
        const abilities = (f.abilities ?? []).map((a) => rules.byName(a)?.id).filter((x): x is string => !!x)
        companions.push({ key: `pet-imp${companions.length}`, kind: 'familiar', name: f.name || 'Familiar', choices: Object.fromEntries(abilities.map((id, i) => [`ability-${i + 1}`, { id }])) })
    }

    return {
        state: { ...base, choices, inventory, spellcasting, companions },
        report: { notFound: [...new Set(notFound)].sort(), guesses },
    }
}
