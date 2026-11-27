/* i18n-ignore-file */
// Importação reversa (CONTRATO-FICHA §9): um export do Pathbuilder vira um BuildState editável, com relatório do que
// não casou. A ordem por nível de perícias nem sempre é recuperável: o importador distribui pelo nível mais baixo
// possível (respeitando os tetos do Player Core pg. 92) e marca no histórico.
import { publishedRelics } from '../../../pathbuilder/playerRelic'
import type { BuildInfo } from '../../../pathbuilder/types'
import { tr } from '../../../i18n'
import type { BuildState, Choice, InventoryEntry } from '../types'
import type { RuleEntry } from '../rules/types'
import { compileBuild } from './compile'
import { skillRef } from './skills'
import { SKILL_KEYS, type AttributeKey, type CompileContext, type SkillKey } from './types'
import { BLOODRAGER, CLASS_ARCHETYPE, CLASS_ARCHETYPES, PALATINE_DETECTIVE, RUNELORD, WAR_MAGE } from './classArchetypes'
import { CLASS_CHOICE_TYPES } from './classChoices'
import { REINFORCING_NAME } from './equipment'

const ATTR: Record<string, AttributeKey> = { Str: 'str', Dex: 'dex', Con: 'con', Int: 'int', Wis: 'wis', Cha: 'cha' }
const STRIKING: Record<string, number> = { '': 0, striking: 1, greaterStriking: 2, majorStriking: 3 }
const RESILIENT: Record<string, number> = { '': 0, resilient: 1, greaterResilient: 2, majorResilient: 3 }

export interface ImportReport {
    /** Nomes do export que não estão no catálogo carregado (legado, caseiro, rótulo composto). */
    notFound: string[]
    /** O que foi deduzido sem certeza (ordem das perícias, tradição…). */
    guesses: string[]
}

const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']
/** Id caseiro pelo nome (`custom:cognitive-crossover`). */
const customId = (name: string) => `custom:${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'}`

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

export function importPathbuilder(b: BuildInfo, ctx: CompileContext, opts: { reconcile?: boolean } = {}): { state: BuildState; report: ImportReport } {
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
    // "Scholar (Arcana)": o background com a escolha entre parênteses.
    const background = find(b.background, 'background') ?? (/\(.+\)$/.test(b.background ?? '') ? rules.byName(b.background.replace(/\s*\(.+\)$/, ''), 'background') : undefined)
    // Origem fora do catálogo (livro legado não importado): entra caseira, com o que o export diz dela.
    const valid = (n: string | undefined | null): n is string => !!n && n !== 'Not set' && n !== 'None selected' && n !== 'None'
    const customOrigin: NonNullable<BuildState['origin']['custom']> = {}
    const attrs = (b.attributes ?? {}) as { ancestryhp?: number; speed?: number }
    if (!ancestry && valid(b.ancestry)) {
        const size = String((b as BuildInfo & { sizeName?: string }).sizeName ?? '').toLowerCase()
        customOrigin.ancestry = { name: b.ancestry, ...(attrs.ancestryhp !== undefined ? { hp: attrs.ancestryhp } : {}), ...(SIZES.includes(size) ? { size } : {}), ...(attrs.speed ? { speed: attrs.speed } : {}) }
    }
    if (!heritage && valid(b.heritage)) customOrigin.heritage = { name: b.heritage }
    if (!background && valid(b.background)) customOrigin.background = { name: b.background }
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
        if (!key) continue
        // Talento fora do catálogo (livro não importado): o slot fica com o talento caseiro, e o retrato leva o nome.
        if (!entry) { if (valid(name)) choices[key] = { id: customId(name), name: String(name).slice(0, 80) }; continue }
        const q = qualifier ? `skill:${qualifier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined
        const archetype = entry.feat?.archetype?.[0]
        choices[key] = { id: entry.id, ...(q && /^skill:[a-z0-9-]+$/.test(q) ? { qualifier: q } : archetype ? { qualifier: `archetype:${archetype.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` } : {}) }
        parentByLabel.set(label, { key, entry })
    }
    for (const f of b.feats) {
        if (!Array.isArray(f) || f[5] !== 'childChoice') continue
        const parentLabel = String(f[6] ?? '')
        const parent = parentByLabel.get(parentLabel)
        const child = rules.byName(String(f[0]), 'feat') ?? find(String(f[0]))
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
        schema: 2, rulesVersion: '', name: b.name, level: b.level, xp: b.xp ?? 0,
        options: { legacyRelics: b.covil?.legacyRelics ?? true }, origin: {
            ancestry: ancestry?.id ?? (customOrigin.ancestry ? customId(customOrigin.ancestry.name) : undefined),
            heritage: heritage?.id ?? (customOrigin.heritage ? customId(customOrigin.heritage.name) : undefined),
            background: background?.id ?? (customOrigin.background ? customId(customOrigin.background.name) : undefined),
            ...(Object.keys(customOrigin).length ? { custom: customOrigin } : {}),
            alternateBoosts: alternate || undefined,
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
    if (!b.feats.some((f) => Array.isArray(f) && /^Free Archetype/.test(String(f[4] ?? '')))) base.options.variants = { ...base.options.variants, freeArchetype: false }
    // Ancestral Paragon só se o export tem talento nele (a mesa pode ter ligado a variante depois da ficha).
    if (!b.feats.some((f) => Array.isArray(f) && f[5] !== 'childChoice' && /^Ancestral Paragon Feat \d+$/.test(String(f[4] ?? '')))) base.options.variants = { ...base.options.variants, ancestralParagon: false }

    const want = Object.fromEntries(SKILL_KEYS.map((s) => [s, Math.round(((b.proficiencies as unknown as Record<string, number>)[s] ?? 0) / 2)])) as Record<SkillKey, number>

    // Escolhas filhas que o export não lista como filhas: o estilo da Swashbuckler Dedication vem nas características
    // ("Rascal"); a perícia de um ChoiceSet de valor, pela perícia que a ficha tem treinada. Antes das perícias, para o
    // treino que o talento dá não gastar um treino livre.
    const children = compileBuild(base, ctx).featChildren.filter((c) => !choices[c.key])
    const specialNames = new Set((b.specials ?? []).map((sp) => sp.toLowerCase()))
    for (const k of specialKeys) specialNames.add(k.replace(/\s+innovation$/, ''))
    // O tamanho da ficha responde a escolha de tamanho (Adopted Ancestry: Automaton).
    const sizeName = String((b as BuildInfo & { sizeName?: string }).sizeName ?? '').toLowerCase()
    if (sizeName) specialNames.add(sizeName)
    // O qualificador do talento pai no export ("Assurance" + "Athletics", "Canny Acumen" + "Fortitude").
    const keyByLabel = new Map([...parentByLabel].map(([label, v]) => [v.key, label]))
    const qualifierOf = (slotKey: string) => {
        const label = keyByLabel.get(slotKey)
        const row = label ? b.feats.find((f) => Array.isArray(f) && f[4] === label) as unknown[] | undefined : undefined
        return row && typeof row[1] === 'string' ? row[1].toLowerCase() : null
    }
    const usedSpecials = new Set<string>()
    // Escolha dentro de escolha (o tamanho do Automaton do Adopted Ancestry) só aparece depois da de cima: até 3 passadas.
    for (let pass = 0; pass < 3; pass++) {
        const open = pass === 0 ? children : compileBuild(base, ctx).featChildren.filter((c) => !choices[c.key])
        if (!open.length) break
        for (const child of open) {
            // A última escolha da chave é a desta filha; o qualificador do export é do talento do slot (só a filha direta).
            const parts = child.key.split('/choice:')
            const flag = parts[parts.length - 1].toLowerCase()
            const q = parts.length === 2 ? qualifierOf(parts[0]) : null
            if (child.kind === 'feat') {
                const option = (ctx.classOptions ?? []).find((o) => specialNames.has(o.name.toLowerCase()) && flag.includes(o.type.toLowerCase().replace(/-/g, '')))
                if (option) { choices[child.key] = { id: option.id }; continue }
                // Adopted Ancestry e afins: o qualificador é o nome da ancestralidade.
                const named = q ? rules.byName(q, flag === 'ancestry' ? 'ancestry' : undefined) : undefined
                if (named && (flag !== 'ancestry' || named.type === 'ancestry')) { choices[child.key] = { id: named.id }; continue }
                // Basic Flair & cia.: o export lista o talento como "Swashbuckler Feat" no nível do pai.
                const traits = (child.filter?.traits ?? []).filter((t) => !t.includes('{'))
                const row = traits.length ? b.feats.find((f) => Array.isArray(f) && Number(f[3]) === child.level
                    && traits.some((t) => String(f[2] ?? '').toLowerCase() === `${t.toLowerCase()} feat`)) : undefined
                const entry = row ? rules.byName(String((row as unknown as unknown[])[0]), 'feat') : undefined
                if (entry) choices[child.key] = { id: entry.id }
            } else if (child.options?.length) {
                const opts = child.options
                const norm = (x: string) => x.toLowerCase()
                // 1. O qualificador do pai no export. 2. Uma característica do export com o nome da opção (Terrain "Forest",
                // as perícias do Natural Skill e do Skilled Human), sem repetir a que outra escolha já usou.
                const byQualifier = q ? opts.find((o) => norm(o.value) === q || norm(o.value).includes(`.${q}.`) || norm(o.label ?? '') === q) : undefined
                const bySpecial = byQualifier ? undefined : opts.find((o) => !usedSpecials.has(norm(o.value)) && (specialNames.has(norm(o.value)) || specialNames.has(norm(o.label ?? ''))))
                // O atributo de uma dedicação (Fighter Dedication: FOR ou DES) que o export não guarda: o maior da ficha.
                const attrScore = (a: string) => (b.abilities as unknown as Record<string, number>)[a] ?? 0
                const byAttribute = flag === 'attribute' && opts.every((o) => (Object.values(ATTR) as string[]).includes(o.value))
                    ? [...opts].sort((x, y) => attrScore(y.value) - attrScore(x.value))[0] : undefined
                const pick = byQualifier ?? bySpecial ?? byAttribute ?? (opts.every((o) => SKILL_KEYS.includes(o.value as SkillKey)) ? opts.find((o) => want[o.value as SkillKey] >= 1 && !usedSpecials.has(o.value)) : undefined)
                if (pick) {
                    usedSpecials.add(norm(pick.value))
                    choices[child.key] = { value: pick.value }
                    if (!byQualifier && !bySpecial) guesses.push(`escolha deduzida da ficha (${byAttribute ? 'atributo maior' : 'perícia treinada'}): ${child.key}`)
                }
            }
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

    // Inventário. O que o catálogo não tem entra como item caseiro com o nome (e, arma ou armadura, os números do export),
    // para a Ficha seguir achando a relíquia, o Braço Sônico e os itens da mesa pelo nome.
    let n = 0
    const key = () => `inv-imp${(n++).toString(36)}`
    const inventory: InventoryEntry[] = []
    // A runa de propriedade com preço ("Shock" também é o grupo sem preço, que o `byName` devolveria).
    const runeIds = (names: string[] | undefined) => (names ?? []).filter((r) => !/^reinforcing\b/i.test(r)).map((r) => {
        const all = rules.named(r).filter((x) => /^runes?$/i.test(x.item?.category ?? ''))
        return (all.find((x) => x.item?.price && x.remaster) ?? all.find((x) => x.item?.price) ?? rules.byName(r))?.id
    }).filter((x): x is string => !!x)
    const reinforcing = (names: string[] | undefined) => {
        const m = (names ?? []).map((r) => /^Reinforcing(?: Rune)? \((\w+)\)$/i.exec(r)?.[1]).find(Boolean)
        return m ? Math.max(0, REINFORCING_NAME.findIndex((x) => x.toLowerCase() === m.toLowerCase())) : 0
    }
    // "Cold Iron (Standard-Grade)" → o material do catálogo e o grau.
    const material = (mat: string | null | undefined): InventoryEntry['material'] => {
        const m = mat ? /^(.+?)(?: \((Low|Standard|High)-Grade\))?$/.exec(mat) : null
        if (!m) return undefined
        const e = rules.named(m[1]).find((x) => /^materials?$/i.test(x.item?.category ?? '') && !x.item?.parent)
        if (!e) { notFound.push(mat!); return undefined }
        return { id: e.id, ...(m[2] ? { grade: m[2].toLowerCase() as 'low' | 'standard' | 'high' } : {}) }
    }
    // O Pathbuilder põe o apelido do jogador em `display` ("Solar Bloodthirsty"); o nome montado traz o do item.
    // ("Studded Leather Armor" sai como "+1 Armor Resilient Studded Leather": o "Armor" do fim não conta).
    const nickname = (display: string | undefined, name: string) => {
        const d = (display ?? '').toLowerCase()
        const n = name.toLowerCase()
        return display && !d.includes(n) && !d.includes(n.replace(/\s+armor$/, '')) ? display : undefined
    }
    const LETTER: Record<string, string> = { B: 'Bludgeoning', P: 'Piercing', S: 'Slashing' }
    const dexMod = Math.floor(((b.abilities as unknown as Record<string, number>).dex - 10) / 2)
    const sheetWeapon = new Map<string, BuildInfo['weapons'][number]>()
    for (const w of b.weapons ?? []) {
        const e = rules.byName(w.name)
        const k = key()
        sheetWeapon.set(k, w)
        const runes = { potency: w.pot || 0, striking: STRIKING[w.str ?? ''] ?? 0, property: runeIds(w.runes) }
        if (e) {
            inventory.push({ key: k, item: e.id, qty: w.qty || 1, acquired: 'given', equipped: true, runes, material: material(w.mat), customName: nickname(w.display, w.name) })
            continue
        }
        notFound.push(w.name)
        const category = (['simple', 'martial', 'advanced', 'unarmed'] as const).find((c) => c === w.prof) ?? 'simple'
        inventory.push({ key: k, item: customId(w.name), qty: w.qty || 1, acquired: 'given', equipped: true, runes, material: material(w.mat), customName: nickname(w.display, w.name) ?? w.name,
            custom: { weapon: { name: w.name.slice(0, 80), die: /^d(4|6|8|10|12)$/.test(w.die) ? w.die : 'd4', damageType: (LETTER[w.damageType] ?? w.damageType ?? '').slice(0, 20), category } } })
    }
    for (const a of b.armor ?? []) {
        const e = rules.byName(a.name)
        const runes = { potency: a.pot || 0, resilient: RESILIENT[a.res ?? ''] ?? 0, reinforcing: reinforcing(a.runes), property: runeIds(a.runes) }
        if (e) {
            const invested = !!a.worn && (e.traits ?? []).includes('Invested')
            inventory.push({ key: key(), item: e.id, qty: a.qty || 1, acquired: 'given', worn: !!a.worn, ...(invested ? { invested } : {}), runes, material: material(a.mat), customName: nickname(a.display, a.name) })
            continue
        }
        notFound.push(a.name)
        // Armadura fora do catálogo: a CA base sai do bônus de item do export, menos a potência; o teto de DES, do que ele somou.
        const category = (['unarmored', 'light', 'medium', 'heavy'] as const).find((c) => c === a.prof)
        const ac = a.worn ? Math.max(0, (b.acTotal?.acItemBonus ?? 0) - (a.pot || 0)) : 0
        const cap = a.worn && (b.acTotal?.acAbilityBonus ?? dexMod) < dexMod ? b.acTotal!.acAbilityBonus : undefined
        inventory.push({ key: key(), item: customId(a.name), qty: a.qty || 1, acquired: 'given', worn: !!a.worn, runes, customName: a.name,
            ...(category ? { custom: { armor: { category, ac, ...(cap !== undefined ? { dexCap: cap } : {}) } } } : {}) })
    }
    for (const [name, qty, ...rest] of b.equipment ?? []) {
        const e = rules.byName(name)
        if (!e) {
            notFound.push(name)
            inventory.push({ key: key(), item: customId(name), qty: qty || 1, acquired: 'given', customName: name })
            continue
        }
        inventory.push({ key: key(), item: e.id, qty: qty || 1, acquired: 'given', invested: rest.includes('Invested') && (e.traits ?? []).includes('Invested') })
    }

    for (const row of publishedRelics(b)) {
        const offset = row.section === 'weapons' ? 0 : b.weapons.length + (row.section === 'equipment' ? b.armor.length : 0)
        const item = inventory[offset + row.index]
        if (!item) continue
        item.relic = { ...row.seed, id: row.key }
        item.customName = row.name
        if (item.runes) item.runes.property = row.etched
    }

    // Magias: conjurador da classe e foco.
    const spellcasting: BuildState['spellcasting'] = {}
    // Magia fora do catálogo (legada, de livro não importado): entra caseira pelo nome, para o retrato levá-la à Ficha.
    const spellId = (name: string) => find(name.replace(/ \(Amped\)$/, ''), 'spell')?.id ?? (valid(name) ? customId(name.replace(/ \(Amped\)$/, '')) : undefined)
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

    const draft: BuildState = { ...base, choices, inventory, spellcasting, companions }
    if (opts.reconcile !== false) reconcileWithSheet(draft, b, ctx, guesses)
    reconcileWeapons(draft, ctx, sheetWeapon, opts.reconcile !== false)

    return {
        state: draft,
        report: { notFound: [...new Set(notFound)].sort(), guesses },
    }
}

const SAVE_KEYS = ['perception', 'fortitude', 'reflex', 'will', 'classDC'] as const
/** Rótulos dos ajustes importados (os mesmos nomes da Ficha, `character-viewer/checks.ts`; o motor não importa a Ficha). */
const LABEL: Record<string, string> = {
    acrobatics: tr('Acrobacia', 'Acrobatics'), arcana: tr('Arcanismo', 'Arcana'), athletics: tr('Atletismo', 'Athletics'), crafting: tr('Ofício', 'Crafting'),
    deception: tr('Engano', 'Deception'), diplomacy: tr('Diplomacia', 'Diplomacy'), intimidation: tr('Intimidação', 'Intimidation'), medicine: tr('Medicina', 'Medicine'),
    nature: tr('Natureza', 'Nature'), occultism: tr('Ocultismo', 'Occultism'), performance: 'Performance', religion: tr('Religião', 'Religion'),
    society: tr('Sociedade', 'Society'), stealth: tr('Furtividade', 'Stealth'), survival: tr('Sobrevivência', 'Survival'), thievery: tr('Roubo', 'Thievery'),
    perception: tr('Percepção', 'Perception'), fortitude: tr('Fortitude', 'Fortitude'), reflex: tr('Reflexos', 'Reflex'), will: tr('Vontade', 'Will'), classDC: tr('CD de classe', 'Class DC'),
    simple: tr('Armas simples', 'Simple weapons'), martial: tr('Armas marciais', 'Martial weapons'), advanced: tr('Armas avançadas', 'Advanced weapons'), unarmed: tr('Ataques desarmados', 'Unarmed attacks'),
    unarmored: tr('Sem armadura', 'Unarmored'), light: tr('Armadura leve', 'Light armor'), medium: tr('Armadura média', 'Medium armor'), heavy: tr('Armadura pesada', 'Heavy armor'),
    castingArcane: tr('Conjuração arcana', 'Arcane spellcasting'), castingDivine: tr('Conjuração divina', 'Divine spellcasting'),
    castingOccult: tr('Conjuração oculta', 'Occult spellcasting'), castingPrimal: tr('Conjuração primal', 'Primal spellcasting'),
}
const label = (k: string) => tr(`${LABEL[k] ?? k} (da Ficha)`, `${LABEL[k] ?? k} (from the Sheet)`)
const CATEGORY_KEYS = ['simple', 'martial', 'advanced', 'unarmed', 'unarmored', 'light', 'medium', 'heavy'] as const

/**
 * A Ficha Virtual é a referência: o que o motor ainda não calcula (ancestralidade fora do catálogo, perícia dada por
 * talento, arma da divindade…) vira ajuste à mão com o motivo "Importado da Ficha", para o Criador mostrar os mesmos
 * números. Só sobe, nunca rebaixa: número menor no export que no motor fica para a pessoa conferir.
 */
function reconcileWithSheet(state: BuildState, b: BuildInfo, ctx: CompileContext, guesses: string[]) {
    const reason = tr('Importado da Ficha Virtual: o Criador ainda não calcula isto sozinho', 'Imported from the Virtual Sheet: the Builder does not calculate this on its own yet')
    const adjustments: NonNullable<BuildState['manual']['adjustments']> = []
    const add = (id: string, label: string, kind: 'proficiency' | 'itemBonus', target: string, value: number) =>
        adjustments.push({ id: `imp-${id}`.toLowerCase().replace(/[^a-z0-9:_-]+/g, '-').slice(0, 60), label, reason, effect: { kind, target, value } })

    // 0. Aumentos de origem que o export não guardou (breakdown vazio): os atributos mais altos da ficha, dentro do que o
    // grupo aceita. O número final vem do passo 1; isto só tira a pendência.
    const score = (a: AttributeKey) => (b.abilities as unknown as Record<string, number>)[a] ?? 10
    for (const g of compileBuild(state, ctx).boostGroups) {
        if (!['boosts-ancestry', 'boosts-background'].includes(g.key) || g.chosen.length >= g.count) continue
        const order = (Object.values(ATTR) as AttributeKey[]).filter((a) => !g.fixed.includes(a)).sort((x, y) => score(y) - score(x))
        const picks: AttributeKey[] = []
        if (g.oneOf && g.options.length) picks.push([...g.options].sort((x, y) => score(y) - score(x))[0])
        for (const a of order) if (picks.length < g.count && !picks.includes(a) && (g.oneOf || !g.options.length || g.options.includes(a))) picks.push(a)
        state.choices = { ...state.choices, [g.key]: { boosts: picks } }
        guesses.push(`aumentos deduzidos dos atributos da ficha: ${g.key}`)
    }

    // 1. Atributos (o modificador da ficha).
    let out = compileBuild(state, ctx)
    const override: Partial<Record<AttributeKey, number>> = {}
    for (const [short, a] of Object.entries(ATTR)) {
        const score = (b.abilities as unknown as Record<string, number>)[a]
        if (typeof score !== 'number') continue
        const want = Math.floor((score - 10) / 2)
        if (out.attributes.mod[a] !== want) override[a] = want
        void short
    }
    if (Object.keys(override).length) state.manual = { ...state.manual, attributeOverride: { ...state.manual.attributeOverride, ...override } }

    // 2. Proficiências que o export tem acima do motor.
    out = compileBuild(state, ctx)
    const prof = b.proficiencies as unknown as Record<string, number>
    for (const s of SKILL_KEYS) {
        const want = Math.round((prof[s] ?? 0) / 2)
        if (want > out.skills.rank[s]) add(`skill-${s}`, label(s), 'proficiency', `skill:${s}`, want)
    }
    for (const k of SAVE_KEYS) {
        const want = Math.round((prof[k] ?? 0) / 2)
        if (want > out.proficiency[k]) add(k, label(k), 'proficiency', k, want)
    }
    for (const k of CATEGORY_KEYS) {
        const want = Math.round((prof[k] ?? 0) / 2)
        const have = (k in out.proficiency.attacks ? out.proficiency.attacks[k as keyof typeof out.proficiency.attacks] : out.proficiency.defenses[k as keyof typeof out.proficiency.defenses]) ?? 0
        if (want > have) add(k, label(k), 'proficiency', k, want)
    }
    // Conjuração inata ou de talento (ancestralidade, Mythic Magic…): o retrato leva o rank da Ficha.
    const casters = new Map<string, number>()
    for (const c of out.casters) if (c.tradition) casters.set(c.tradition, Math.max(casters.get(c.tradition) ?? 0, c.rank))
    for (const t of ['arcane', 'divine', 'occult', 'primal']) {
        const k = `casting${t[0].toUpperCase()}${t.slice(1)}`
        const want = Math.round((prof[k] ?? 0) / 2)
        if (want > (casters.get(t) ?? 0)) add(k, label(k), 'proficiency', k, want)
    }
    // Proficiência numa arma só (a `specificProficiencies` do Pathbuilder: arma da divindade, Monastic Archer…).
    const specific = (b as BuildInfo & { specificProficiencies?: Record<string, string[]> }).specificProficiencies ?? {}
    for (const [rankName, rank] of [['trained', 1], ['expert', 2], ['master', 3], ['legendary', 4]] as const) {
        for (const name of specific[rankName] ?? []) {
            const st = out.equipment.strikes.find((x) => x.name.toLowerCase() === name.toLowerCase() || out.equipment.items.find((i) => i.key === x.key)?.base?.name.toLowerCase() === name.toLowerCase())
            const have = st ? Math.max(0, Math.round(((st.attackParts.find((p) => p.label === 'Proficiência' || p.label === 'Proficiency')?.value ?? 0) - out.level) / 2)) : 0
            if (!st || have < rank) add(`weapon-${name}`, tr(`${name} (da Ficha)`, `${name} (from the Sheet)`), 'proficiency', `weapon:${name.toLowerCase()}`, rank)
        }
    }
    if (adjustments.length) state.manual = { ...state.manual, adjustments: [...(state.manual.adjustments ?? []), ...adjustments] }

    // 3. CA: o que ainda falta vira bônus de item por ajuste (armadura ou item que o motor não lê).
    out = compileBuild(state, ctx)
    const acWant = b.acTotal?.acTotal
    if (typeof acWant === 'number' && acWant > out.stats.ac.total) {
        state.manual = { ...state.manual, adjustments: [...(state.manual.adjustments ?? []),
            { id: 'imp-ac', label: tr('CA (da Ficha)', 'AC (from the Sheet)'), reason, effect: { kind: 'itemBonus', target: 'ac', value: acWant - out.stats.ac.total } }] }
    }
}

/**
 * Armas: o atributo do ataque que bate com o export (arma caseira de acuidade, por exemplo) e o dano extra que o export
 * traz e o motor não calcula (fica guardado na arma, como no Pathbuilder). Com `exact`, o golpe que ainda difere fica
 * com o valor da Ficha, definido à mão (aviso), porque a Ficha é a referência.
 */
function reconcileWeapons(draft: BuildState, ctx: CompileContext, sheetWeapon: Map<string, BuildInfo['weapons'][number]>, exact: boolean) {
    const strikesOf = (st: BuildState) => compileBuild(st, ctx).equipment.strikes
    const strikes = strikesOf(draft)
    for (const inv of draft.inventory) {
        const w = sheetWeapon.get(inv.key)
        const st = strikes.find((x) => x.key === inv.key)
        if (!w || !st) continue
        if (st.attack !== w.attack) {
            for (const alt of ['dex', 'str'] as const) {
                const tried = strikesOf({ ...draft, inventory: draft.inventory.map((i) => (i.key === inv.key ? { ...i, weapon: { ...i.weapon, attackAttribute: alt } } : i)) })
                if (tried.find((x) => x.key === inv.key)?.attack === w.attack) { inv.weapon = { ...inv.weapon, attackAttribute: alt }; break }
            }
        }
        const extra = (w.extraDamage ?? []).filter((d) => !st.extraDamage.some((x) => x.toLowerCase() === d.toLowerCase()))
        if (extra.length) inv.weapon = { ...inv.weapon, extraDamage: extra.slice(0, 6).map((d) => d.slice(0, 40)) }
    }
    if (!exact) return
    const after = strikesOf(draft)
    for (const inv of draft.inventory) {
        const w = sheetWeapon.get(inv.key)
        const st = after.find((x) => x.key === inv.key)
        if (!w || !st) continue
        const overrides = { ...(st.attack !== w.attack ? { attack: w.attack } : {}), ...(st.damageBonus !== w.damageBonus ? { damage: w.damageBonus } : {}) }
        if (Object.keys(overrides).length) inv.weapon = { ...inv.weapon, overrides: { ...inv.weapon?.overrides, ...overrides } }
    }
}
