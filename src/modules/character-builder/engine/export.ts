/* i18n-ignore-file */
// O retrato aplicado (CONTRATO-FICHA): o personagem compilado no formato `BuildInfo` que a Ficha, a Iniciativa, o Mapa
// e o servidor já leem, mais as extensões do Criador em `build.covil`. Nomes de conteúdo em inglês canônico (o mesmo
// que o Pathbuilder grava), para as descrições e os consertos da Ficha seguirem casando.
import type { BuildInfo, FeatArray, HomebrewFeatRef, Pet, Familiar, Weapon, Armor, SpellCaster } from '../../../pathbuilder/types'
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import { attributeScore } from './attributes'
import { ATTRIBUTES, SKILL_KEYS, type AttributeKey, type Compiled, type RulesIndex } from './types'
import { featKindLabel, type FeatSlot } from './slots'
import { GRADE_LABEL, REINFORCING_NAME } from './equipment'

const ATTR_LABEL: Record<AttributeKey, string> = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' }
const SIZE: Record<string, number> = { tiny: 0, small: 1, medium: 2, large: 3, huge: 4, gargantuan: 5 }
const STRIKING = ['', 'striking', 'greaterStriking', 'majorStriking']
const RESILIENT = ['', 'resilient', 'greaterResilient', 'majorResilient']
const DAMAGE_LETTER: Record<string, string> = { Bludgeoning: 'B', Piercing: 'P', Slashing: 'S' }

/**
 * O nome da arma como o Pathbuilder escreve em `display`: o apelido do jogador (é por ele que a Ficha acha a relíquia),
 * o nome do item específico ("Gloom Blade") ou o nome montado com as runas ("+2 Striking (Greater) Composite Longbow").
 */
function weaponDisplay(item: Compiled['equipment']['items'][number] | undefined, built: string): string {
    const custom = item?.inv.custom?.weapon?.name
    if (item?.inv.customName && (item.entry || (custom && custom !== item.inv.customName))) return item.inv.customName
    if (item?.entry?.item?.baseItem) return item.entry.name
    return built.replace(/\b(Greater|Major) Striking\b/, 'Striking ($1)')
}

export interface ExportContext {
    rules: RulesIndex
    buildId?: string
}

/** Rótulo do slot como o Pathbuilder grava ("Magus Feat 4", "Free Archetype 4"…). */
function slotLabel(slot: FeatSlot, className: string, ancestryName: string): string {
    switch (slot.kind) {
    case 'class': return slot.maxLevel ? slot.label : `${className} Feat ${slot.level}`
    case 'ancestry': return `${ancestryName} Feat ${slot.level}`
    case 'paragon': return `Ancestral Paragon Feat ${slot.level}`
    case 'general': return `General Feat ${slot.level}`
    case 'skill': return `Skill Feat ${slot.level}`
    case 'archetype': return `Free Archetype ${slot.level}`
    case 'mythic': return `Mythic Feat ${slot.level}`
    }
}

/** Tipo do talento como o Pathbuilder grava: a categoria do talento escolhido. */
function featType(entry: RuleEntry, slot: FeatSlot | undefined, className: string): string {
    const t = new Set((entry.traits ?? []).map((x) => x.toLowerCase()))
    if (t.has('mythic')) return 'Mythic Feat'
    if (t.has('archetype')) return 'Archetype Feat'
    if (t.has(className.toLowerCase())) return 'Class Feat'
    if (slot?.kind === 'ancestry' || slot?.kind === 'paragon') return 'Ancestry Feat'
    if (t.has('skill')) return 'Skill Feat'
    if (t.has('general')) return 'General Feat'
    return slot ? featKindLabel(slot.kind) : 'Feat'
}

const spellLists = (byRank: Record<string, string[]> | undefined, name: (id: string) => string) =>
    Object.entries(byRank ?? {}).map(([rank, ids]) => ({ spellLevel: Number(rank), list: ids.map(name) })).sort((a, b) => a.spellLevel - b.spellLevel)

/** O retrato `{ success: true, build }` com as extensões `covil`. */
export function exportBuild(state: BuildState, compiled: Compiled, ctx: ExportContext): { success: true; build: BuildInfo & { covil: Record<string, unknown> } } {
    const { rules } = ctx
    const name = (id: string) => rules.get(id)?.name ?? id
    const ancestry = rules.get(state.origin.ancestry)
    const heritage = rules.get(state.origin.heritage)
    const background = rules.get(state.origin.background)
    const cls = rules.get(state.class.id)
    const className = cls?.name ?? ''
    const ancestryName = ancestry?.name ?? ''
    const { mod, partial, breakdown } = compiled.attributes
    const label = (list: AttributeKey[]) => list.map((a) => ATTR_LABEL[a])
    const level = compiled.level
    const pr = compiled.proficiency

    // Talentos: slots, concedidos e filhos.
    const slotByKey = new Map(compiled.featSlots.map((s) => [s.key, s]))
    const feats: FeatArray[] = []
    const homebrewFeats: Record<string, HomebrewFeatRef> = {}
    if (heritage) feats.push([heritage.name, null, 'Heritage', 1, 'Heritage Feat', 'standardChoice', null])
    for (const t of compiled.taken) {
        if (t.entry.type === 'feat' && t.entry.homebrew === 'feat') {
            homebrewFeats[feats.length] = { id: t.entry.id, name: t.entry.name, ...(t.kind === 'granted' ? {} : { slot: t.slot }) }
        }
        const slot = slotByKey.get(t.slot)
        if (t.kind === 'granted') {
            if (['ancestry', 'heritage', 'class-feature'].includes(t.entry.type) || t.entry.type !== 'feat') continue
            feats.push([t.entry.name, null, 'Awarded Feat', t.level])
            continue
        }
        if (t.kind === 'child') {
            const parentKey = t.slot.split('/')[0]
            const parent = slotByKey.get(parentKey)
            feats.push([t.entry.name, null, featType(t.entry, undefined, className), t.level, `${t.entry.name}`, 'childChoice', parent ? slotLabel(parent, className, ancestryName) : null])
            continue
        }
        const choice = state.choices[t.slot]
        const qualifier = choice && 'qualifier' in choice && choice.qualifier && !choice.qualifier.startsWith('archetype:')
            ? choice.qualifier.split(':')[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null
        const hasChild = compiled.taken.some((x) => x.kind === 'child' && x.slot.startsWith(`${t.slot}/`))
        feats.push([t.entry.name, qualifier, featType(t.entry, slot, className), t.level, slot ? slotLabel(slot, className, ancestryName) : '', hasChild ? 'parentChoice' : 'standardChoice', null])
    }

    // Características (specials): da classe até o nível, escolhas de classe, sentidos, herança.
    const specials = [
        ...compiled.classFeatures.filter((f) => f.level <= level).map((f) => {
            const save = compiled.saveChoices.find((s) => s.label === f.name && s.chosen)
            return save ? `${f.name} (${save.chosen!.charAt(0).toUpperCase()}${save.chosen!.slice(1)})` : f.name
        }),
        ...compiled.classChoices.filter((c) => c.chosen && c.level <= level).map((c) => name(c.chosen!)),
        ...compiled.senses,
        ...(heritage ? [heritage.name] : []),
    ]

    const proficiencies: Record<string, number> = {
        classDC: pr.classDC * 2, perception: pr.perception * 2, fortitude: pr.fortitude * 2, reflex: pr.reflex * 2, will: pr.will * 2,
        heavy: (pr.defenses.heavy ?? 0) * 2, medium: (pr.defenses.medium ?? 0) * 2, light: (pr.defenses.light ?? 0) * 2, unarmored: (pr.defenses.unarmored ?? 0) * 2,
        advanced: (pr.attacks.advanced ?? 0) * 2, martial: (pr.attacks.martial ?? 0) * 2, simple: (pr.attacks.simple ?? 0) * 2, unarmed: (pr.attacks.unarmed ?? 0) * 2,
        castingArcane: 0, castingDivine: 0, castingOccult: 0, castingPrimal: 0, piloting: 0, computers: 0,
    }
    // Duas fontes da mesma tradição (classe e arquétipo): vale o maior rank.
    for (const c of compiled.casters) if (c.tradition) {
        const k = `casting${c.tradition.charAt(0).toUpperCase()}${c.tradition.slice(1)}`
        proficiencies[k] = Math.max(proficiencies[k] ?? 0, c.rank * 2)
    }
    for (const s of SKILL_KEYS) proficiencies[s] = compiled.skills.rank[s] * 2
    // Conjuração inata ou de talento que o motor não calcula, trazida da Ficha por ajuste ("castingArcane").
    for (const a of state.manual.adjustments ?? []) {
        const t = a.effect.target ?? ''
        if (a.effect.kind === 'proficiency' && /^casting(arcane|divine|occult|primal)$/i.test(t)) {
            const k = `casting${t.slice(7, 8).toUpperCase()}${t.slice(8).toLowerCase()}`
            proficiencies[k] = Math.max(proficiencies[k] ?? 0, Math.max(0, Math.min(4, Number(a.effect.value) || 0)) * 2)
        }
    }

    // Equipamento.
    const eq = compiled.equipment
    const weapons: (Weapon & { grade: string })[] = eq.strikes.filter((s) => s.key !== 'fist').map((s) => {
        const item = eq.items.find((i) => i.key === s.key)
        return {
            name: item?.entry?.name ?? item?.base?.name ?? s.name, qty: item?.qty ?? 1, prof: s.category, die: s.die, pot: s.potency, str: STRIKING[s.striking] ?? '',
            // O nome que o jogador deu (o Pathbuilder põe em `display`) é o que a Ficha usa para achar a relíquia.
            mat: s.material ?? null, display: weaponDisplay(item, s.display), runes: s.runes,
            damageType: DAMAGE_LETTER[s.damageType] ?? s.damageType,
            attack: s.attack, damageBonus: s.damageBonus, extraDamage: s.extraDamage, increasedDice: false, isInventor: false, grade: '',
        }
    })
    const armor: (Armor & { grade: string })[] = eq.items.filter((i) => i.base?.item?.armor || i.base?.item?.shield).map((i) => ({
        name: i.entry?.name ?? i.name, qty: i.qty, prof: i.base?.item?.shield ? 'shield' : (i.base?.item?.armor?.category ?? 'unarmored').toLowerCase(),
        pot: i.inv.runes?.potency ?? 0, res: RESILIENT[i.inv.runes?.resilient ?? 0] ?? '',
        mat: i.inv.material ? (i.inv.material.grade ? `${name(i.inv.material.id)} (${GRADE_LABEL[i.inv.material.grade]})` : name(i.inv.material.id)) : null,
        display: i.inv.customName ?? '', worn: !!i.inv.worn,
        runes: [...(i.inv.runes?.reinforcing ? [`Reinforcing (${REINFORCING_NAME[i.inv.runes.reinforcing]})`] : []), ...(i.inv.runes?.property ?? []).map(name)], grade: '',
    }))
    const equipment: [string, number, string?][] = eq.items.filter((i) => !i.base?.item?.weapon && !i.base?.item?.armor && !i.base?.item?.shield)
        .map((i) => (i.inv.invested ? [i.name, i.qty, 'Invested'] : [i.name, i.qty]))
    const gp = Math.max(0, eq.money.remaining)
    const money = { pp: 0, gp: Math.floor(gp), sp: Math.floor((gp * 10) % 10), cp: Math.round((gp * 100) % 10) }

    // Magias.
    const spellCasters: SpellCaster[] = compiled.casters.map((c) => {
        const choices = state.spellcasting[c.key] ?? {}
        const byRank = (ids: string[]) => {
            const out: Record<string, string[]> = {}
            for (const id of ids) {
                const e = rules.get(id)
                const r = e?.spell?.cantrip ? 0 : e?.spell?.rank ?? e?.level ?? 1
                out[String(r)] = [...(out[String(r)] ?? []), id]
            }
            return out
        }
        const prepared = spellLists(choices.prepared, name)
        const spells = c.type === 'spontaneous' ? spellLists(choices.repertoire, name) : c.spellbook ? spellLists(byRank(choices.spellbook ?? []), name) : prepared
        return {
            name: c.name, magicTradition: c.tradition ?? '', spellcastingType: c.type, ability: c.attribute, proficiency: c.rank * 2,
            focusPoints: 0, innate: false, perDay: c.perDay, spells, prepared: c.spellbook ? prepared : [], blendedSpells: [],
        }
    })
    const focusTradition = compiled.casters[0]?.tradition ?? cls?.class?.casting?.traditions?.[0] ?? null
    const focusAttr = compiled.casters[0]?.attribute ?? compiled.keyAttribute ?? 'cha'
    const focus = focusTradition && (compiled.focus.spells.length || compiled.focus.cantrips.length)
        ? { [focusTradition]: { [focusAttr]: { abilityBonus: mod[focusAttr], proficiency: (compiled.casters[0]?.rank ?? pr.spell) * 2, itemBonus: 0,
            focusCantrips: compiled.focus.cantrips.map((s) => s.name), focusSpells: compiled.focus.spells.map((s) => s.name) } } }
        : undefined

    // Companheiros.
    const pets: Pet[] = state.companions.filter((c) => c.kind === 'animal').map((c) => {
        const chosen = Object.values(c.choices).flatMap((v) => ('id' in v ? [rules.get(v.id)] : [])).filter((e): e is RuleEntry => !!e)
        const advanced = chosen.filter((e) => e.type === 'animal-companion-advanced').map((e) => e.name)
        return {
            type: 'Animal Companion', name: c.name, animal: c.type ? name(c.type) : undefined,
            mature: advanced.length > 0, incredible: advanced.length > 1, incredibleType: advanced.slice(1).join(', ') || undefined,
            specializations: chosen.filter((e) => e.type === 'animal-companion-specialization').map((e) => e.name), equipment: [],
        }
    })
    const familiars: Familiar[] = state.companions.filter((c) => c.kind === 'familiar').map((c) => ({
        name: c.name, type: c.type ? name(c.type) : 'Familiar',
        abilities: Object.values(c.choices).flatMap((v) => ('id' in v ? [name(v.id)] : [])),
    }))

    const ac = compiled.stats.ac
    const partOf = (re: RegExp) => ac.parts.filter((p) => re.test(p.label)).reduce((s, p) => s + p.value, 0)
    const acItem = partOf(/^item$/i)
    const acAbility = ac.parts.find((p) => /^(DES|DEX)$/.test(p.label))?.value ?? mod.dex
    const acProf = ac.total - 10 - acItem - acAbility
    const resilient = eq.armor?.resilient ?? 0

    const build: BuildInfo & { covil: Record<string, unknown>; size: number; gender: string; age: string; pets?: Pet[]; familiars?: Familiar[]; formula: { type: string; known: string[] }[]; inventorMods: unknown[]; equipmentContainers: Record<string, unknown> } = {
        name: state.name, class: className, dualClass: null, level, xp: state.xp,
        ancestry: ancestryName, heritage: heritage?.name ?? '', background: background?.name ?? '',
        alignment: 'N', gender: state.details.gender ?? 'Not set', age: state.details.age ?? 'Not set',
        deity: state.origin.deity ? name(state.origin.deity) : 'Not set',
        size: SIZE[(compiled.size ?? 'medium').toLowerCase()] ?? 2, sizeName: compiled.size ?? 'Medium',
        keyability: compiled.keyAttribute ?? '',
        languages: compiled.languages.length ? compiled.languages : ['None selected'],
        abilities: {
            ...Object.fromEntries(ATTRIBUTES.map((a) => [a, attributeScore(mod[a], partial[a])])) as Record<AttributeKey, number>,
            breakdown: {
                ancestryFree: label(breakdown.ancestryFree), ancestryBoosts: label(breakdown.ancestryBoosts), ancestryFlaws: label(breakdown.ancestryFlaws),
                backgroundBoosts: label(breakdown.backgroundBoosts), classBoosts: label(breakdown.classBoosts),
                mapLevelledBoosts: Object.fromEntries(Object.entries(breakdown.mapLevelledBoosts).map(([k, v]) => [k, label(v)])),
            },
        } as BuildInfo['abilities'],
        attributes: {
            ancestryhp: ancestry?.ancestry?.hp ?? 0, classhp: cls?.class?.hp ?? 0,
            bonushp: compiled.stats.hp.parts.filter((p) => /^(Talentos|Feats)$/.test(p.label)).reduce((s, p) => s + p.value, 0),
            bonushpPerLevel: 0, speed: ancestry?.ancestry?.speed ?? 0, speedBonus: compiled.stats.speed.total - (ancestry?.ancestry?.speed ?? 0),
        },
        proficiencies: proficiencies as unknown as BuildInfo['proficiencies'],
        feats, specials, lores: compiled.skills.lores.map((l) => [l.name, l.rank * 2] as [string, number]),
        equipment, specificProficiencies: { trained: [], expert: [], master: [], legendary: [] },
        weapons, armor, money, spellCasters,
        focusPoints: compiled.focus.points, ...(focus ? { focus } : {}),
        mods: (() => {
            const m: Record<string, Record<string, number>> = {}
            const savePot = compiled.stats.fortitude.parts.find((p) => /resil|ABP/i.test(p.label))?.value ?? resilient
            if (savePot) for (const k of ['Fortitude', 'Reflex', 'Will']) m[k] = { 'Item Bonus': savePot }
            const percPot = compiled.stats.perception.parts.find((p) => /ABP/.test(p.label))?.value
            if (percPot) m.Perception = { 'Item Bonus': percPot }
            for (const [skill, bonus] of Object.entries(compiled.skillBonus)) if (bonus) m[skill.charAt(0).toUpperCase() + skill.slice(1)] = { 'Item Bonus': bonus }
            return m
        })(),
        acTotal: { acProfBonus: acProf, acAbilityBonus: acAbility, acItemBonus: acItem, acTotal: ac.total, shieldBonus: eq.shield ? eq.shield.ac : null },
        pets, familiars,
        rituals: (state.spellcasting.rituals?.spellbook ?? []).map(name),
        resistances: compiled.resistances,
        formula: state.formulas.length ? [{ type: 'other', known: state.formulas.map(name) }] : [],
        inventorMods: [], equipmentContainers: {},
        covil: {
            schema: 1, buildId: ctx.buildId, rulesVersion: state.rulesVersion,
            warnings: compiled.warnings.filter((w) => w.level !== 'info').slice(0, 40).map((w) => ({ code: w.code, message: w.message })),
            ...(Object.keys(homebrewFeats).length ? { homebrewFeats } : {}),
            ids: Object.fromEntries(Object.entries(state.choices).flatMap(([k, v]) => ('id' in v ? [[k, v.id]] : []))),
            // Slot de cada talento escolhido (nome → chave), para "Trocar talento" na Ficha.
            slots: Object.fromEntries(compiled.taken.filter((t) => t.kind !== 'granted').map((t) => [t.entry.name, t.slot])),
            variants: compiled.featSlots.some((s) => s.kind === 'archetype') ? ['freeArchetype'] : [],
            mythic: compiled.classChoices.find((c) => c.type === 'mythic-calling')?.chosen ? { calling: name(compiled.classChoices.find((c) => c.type === 'mythic-calling')!.chosen!) } : null,
            unarmed: eq.strikes.filter((s) => s.key === 'fist').map((s) => ({ name: s.name, die: s.die, attack: s.attack, damageBonus: s.damageBonus, damageType: s.damageType, traits: s.traits })),
        },
    }
    return { success: true, build }
}
