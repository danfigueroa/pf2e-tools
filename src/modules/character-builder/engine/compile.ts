// `compileBuild`: escolhas (BuildState) → números, pendências e avisos (MOTOR-DE-REGRAS §1). F3 cobre o nível 1 "de
// corpo": origem, atributos, proficiências iniciais da classe, perícias, idiomas e os derivados. Regras na AON, Remaster:
// - Proficiência: destreinado +0; treinado/perito/mestre/lendário = nível + 2/4/6/8 (Player Core pg. 11).
// - PV: os da ancestralidade + (os da classe + CON) por nível (Player Core pg. 91, "Hit Points").
// - CA = 10 + DES + proficiência (sem armadura: defesa sem armadura) + item + outros (Player Core pg. 271).
// - Salvaguardas: Fortitude CON, Reflexos DES, Vontade SAB (Player Core pg. 26). Percepção: SAB (Player Core pg. 25).
// - CD de classe = 10 + proficiência + atributo-chave (Player Core pg. 27); as 29 classes Remaster da AON começam
//   "Trained in <classe> class DC".
// O que o motor ainda não calcula (características de classe acima do 1º nível, talentos, itens) vira aviso, nunca número.
import { grantedFeat } from './rulesIndex'
import { tr } from '../../../i18n'
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import { attributeLabel, compileAttributes } from './attributes'
import { backgroundLoreChoice, compileSkills } from './skills'
import { compileFeats } from './feats'
import type { PrereqContext } from './prereqs'
import { checkSpellChoices, compileArchetypeCasters, compileCasters, compileFocus } from './spells'
import {
    ADVANCED_SCHOOL_SPELL, adjustedClass, archetypeOfSubclass, BLOODRAGER, CLASS_ARCHETYPE, CLASS_ARCHETYPES, PALATINE_DETECTIVE,
    QUICK_IDENTIFICATION, RUNELORD, selectedClassArchetype, WAR_MAGE,
} from './classArchetypes'
import { armorClass, compileEquipment, GROUP_FEATURES } from './equipment'
import { withCustom } from './custom'
import { allowsBook } from '../mesaRules'
import { abpAt, abpSkillBonus } from './abp'
import { featSlots, variantFlags } from './slots'
import { classChoiceSlots, SAVE_CHOICE_FEATURES, UNCOUNTED_CHOICE_TYPES } from './classChoices'
import type { CompileContext, Compiled, Pending, Rank, Stat, Warning } from './types'

/** As 29 classes Remaster da AON: "Trained in <classe> class DC" (conferido em 2026-11-25). */
const CLASS_DC_RANK: Rank = 1

const RANK_NAME: Record<Rank, string> = {
    0: tr('Destreinado', 'Untrained'), 1: tr('Treinado', 'Trained'), 2: tr('Perito', 'Expert'), 3: tr('Mestre', 'Master'), 4: tr('Lendário', 'Legendary'),
}
export const rankName = (rank: Rank) => RANK_NAME[rank]

/** Bônus de proficiência (Player Core pg. 11). */
export const proficiencyBonus = (rank: Rank, level: number) => (rank > 0 ? level + 2 * rank : 0)

const stat = (parts: { label: string; value: number }[], base = 0): Stat => ({
    total: base + parts.reduce((sum, p) => sum + p.value, 0),
    parts: base ? [{ label: tr('Base', 'Base'), value: base }, ...parts] : parts,
})

function sourceWarnings(entry: RuleEntry, ctx: CompileContext, ref: string, warnings: Warning[]) {
    const rules = ctx.mesaRules
    if (rules && entry.source.id !== 'mesa') {
        const allowed = allowsBook(entry, rules)
        const exception = rules.exceptions.some((e) => e.buildId === ctx.buildId && e.ids.includes(entry.id))
        if (entry.remaster && !allowed && !exception) {
            warnings.push({ code: 'SOURCE_NOT_ALLOWED', level: 'warn', ref, entryId: entry.id, message: tr(`${entry.name}: livro não liberado nesta mesa.`, `${entry.name}: book not allowed at this table.`) })
        }
        if (!entry.remaster && !allowed && !exception) {
            warnings.push({ code: 'LEGACY_NOT_ALLOWED', level: 'warn', ref, entryId: entry.id, message: tr(`${entry.name}: conteúdo pré-Remaster não liberado nesta mesa.`, `${entry.name}: pre-Remaster content not allowed at this table.`) })
        }
        const rarity = entry.rarity === 'uncommon' ? rules.rarity.uncommon : entry.rarity === 'rare' || entry.rarity === 'unique' ? rules.rarity.rare : 'allow'
        if (rarity !== 'allow' && !exception) {
            warnings.push({
                code: rarity === 'deny' ? 'RARITY_DENIED' : 'RARITY_ASK', level: 'warn', ref, entryId: entry.id,
                message: rarity === 'deny'
                    ? tr(`${entry.name}: raridade não permitida nesta mesa.`, `${entry.name}: rarity not allowed at this table.`)
                    : tr(`${entry.name}: ${entry.rarity === 'uncommon' ? 'incomum' : 'raro'} — combine com o GM.`, `${entry.name}: ${entry.rarity} — check with the GM.`),
            })
        }
    }
    for (const effect of entry.unsupported ?? []) {
        // O Lore à escolha do background vira o slot `lore-background` (compileSkills).
        if (entry.background && backgroundLoreChoice(entry) && (/^Lore\b/i.test(effect.trim()) || /\bLore for\b/i.test(effect))) continue
        // Da classe, o que o Criador já resolve por escolha: o atributo-chave "other" (vem da subclasse e é escolhido na
        // aba Classe) e os treinos da subclasse (racket, instinto…), lidos das regras dela em `compileSkills`.
        if (entry.class && (/^attribute:/i.test(effect) || /skills? determined by your/i.test(effect))) continue
        warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref, message: tr(`Efeito não calculado: ${entry.name} (${effect}).`, `Effect not calculated: ${entry.name} (${effect}).`) })
    }
}

export function compileBuild(state: BuildState, baseCtx: CompileContext): Compiled {
    // Conteúdo caseiro do build (origem e talentos `custom:`) por cima do catálogo.
    const ctx: CompileContext = { ...baseCtx, rules: withCustom(baseCtx.rules, state) }
    const { rules } = ctx
    const level = Math.min(20, Math.max(1, state.level))
    const pending: Pending[] = []
    const warnings: Warning[] = []
    const used = new Set<string>()
    const missingRefs = new Set<string>()

    // 1. Coleta.
    const ancestry = rules.get(state.origin.ancestry)
    const heritage = rules.get(state.origin.heritage)
    const background = rules.get(state.origin.background)
    const baseClass = rules.get(state.class.id)
    const choice = state.choices[CLASS_ARCHETYPE]
    const archetypeId = selectedClassArchetype(choice, baseClass)
    const spec = archetypeId ? CLASS_ARCHETYPES[archetypeId] : undefined
    const archetype = rules.get(archetypeId)
    const cls = adjustedClass(baseClass, archetypeId)
    if (archetypeId) {
        used.add(CLASS_ARCHETYPE)
        if (archetype) sourceWarnings(archetype, ctx, CLASS_ARCHETYPE, warnings)
    }
    const missing = (id: string | undefined, entry: RuleEntry | undefined, key: string, label: string) => {
        if (!id) pending.push({ key, label, level: 1, missing: 1 })
        else if (!entry) warnings.push({ code: 'ENTRY_NOT_FOUND', level: 'error', ref: key, message: tr(`${label}: não está no catálogo atual (${id}).`, `${label}: not in the current catalog (${id}).`) })
    }
    missing(state.origin.ancestry, ancestry, 'ancestry', tr('Ancestralidade', 'Ancestry'))
    missing(state.origin.heritage, heritage, 'heritage', tr('Herança', 'Heritage'))
    missing(state.origin.background, background, 'background', tr('Background', 'Background'))
    missing(state.class.id, cls, 'class', tr('Classe', 'Class'))
    for (const [entry, ref] of [[ancestry, 'ancestry'], [heritage, 'heritage'], [background, 'background'], [cls, 'class']] as const) {
        if (entry) sourceWarnings(entry, ctx, ref, warnings)
    }
    // Herança de outra ancestralidade (a versátil não tem ancestralidade e serve para todas).
    const heritageOf = heritage?.heritage?.ancestry
    if (heritage && ancestry && heritageOf && heritageOf.toLowerCase() !== ancestry.name.toLowerCase()) {
        warnings.push({ code: 'HERITAGE_MISMATCH', level: 'warn', ref: 'heritage', message: tr(`${heritage.name} é herança de ${heritageOf}, não de ${ancestry.name}.`, `${heritage.name} is a ${heritageOf} heritage, not ${ancestry.name}.`) })
    }

    if (ancestry && ancestry.ancestry?.hp === undefined) {
        warnings.push({ code: 'ANCESTRY_HP_UNKNOWN', level: 'warn', ref: 'ancestry', message: tr(`${ancestry.name}: o catálogo não traz os PV da ancestralidade; o total sai sem eles.`, `${ancestry.name}: the catalog has no ancestry HP; the total leaves them out.`) })
    }

    // 3. Atributos.
    const attrs = compileAttributes(state, ancestry, background, cls, pending, warnings)
    for (const g of attrs.groups) if (g.key !== 'class-key') used.add(g.key)
    const mod = attrs.result.mod
    const keyAttribute = attrs.groups.find((g) => g.key === 'class-key')?.fixed[0] ?? attrs.groups.find((g) => g.key === 'class-key')?.chosen[0] ?? null

    // 4. Proficiências iniciais da classe (características por nível entram na F4).
    const c = cls?.class
    const r = (v: number | undefined): Rank => (v ?? 0) as Rank
    const proficiency: Compiled['proficiency'] = {
        perception: r(c?.perception),
        fortitude: r(c?.saves?.fortitude),
        reflex: r(c?.saves?.reflex),
        will: r(c?.saves?.will),
        classDC: cls ? CLASS_DC_RANK : 0,
        spell: (c?.spellcasting ?? 0) as Rank,
        attacks: { ...(c?.attacks ?? {}) } as Compiled['proficiency']['attacks'],
        defenses: { ...(c?.defenses ?? {}) } as Compiled['proficiency']['defenses'],
    }
    // 4b. Características de classe até o nível atual: proficiências lidas da AON (rank maior vence) e o que concedem.
    const has = new Set<string>()
    const awarded: { entry: RuleEntry; level: number; source: string }[] = []
    const features: Compiled['classFeatures'] = []
    const extraRanks: Record<string, Rank> = {}
    const upgrade = (target: string, rank: Rank) => {
        if (target === 'perception' || target === 'fortitude' || target === 'reflex' || target === 'will' || target === 'classDC') {
            if (proficiency[target] < rank) proficiency[target] = rank
        } else if (['simple', 'martial', 'advanced', 'unarmed'].includes(target)) {
            const k = target as keyof Compiled['proficiency']['attacks']
            if ((proficiency.attacks[k] ?? 0) < rank) proficiency.attacks[k] = rank
        } else if (['light', 'medium', 'heavy', 'unarmored'].includes(target)) {
            const k = target as keyof Compiled['proficiency']['defenses']
            if ((proficiency.defenses[k] ?? 0) < rank) proficiency.defenses[k] = rank
        } else if (target === 'spell') {
            if (proficiency.spell < rank) proficiency.spell = rank
        } else extraRanks[target] = Math.max(extraRanks[target] ?? 0, rank) as Rank
    }
    for (const ref of c?.features ?? []) {
        const entry = ref.id ? rules.get(ref.id) : undefined
        features.push({ level: ref.level, name: ref.name, id: ref.id })
        if (ref.level > level) continue
        has.add(ref.name.toLowerCase())
        if (!entry) continue
        for (const p of entry.classFeature?.proficiencies ?? []) upgrade(p.target, p.rank)
        // Grupo de arma e salvaguarda escolhida viram escolha calculada abaixo: o aviso de "não calculado" não vale para elas.
        const handled = GROUP_FEATURES.some((g) => g.name.test(ref.name)) || SAVE_CHOICE_FEATURES.some((f) => f.name.test(ref.name))
        for (const note of handled ? [] : (entry.unsupported ?? []).filter((u) => u.startsWith('proficiency:'))) {
            warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: 'class', message: tr(`Efeito não calculado: ${entry.name} (${note.slice(13)}).`, `Effect not calculated: ${entry.name} (${note.slice(13)}).`) })
        }
        for (const rule of entry.rules ?? []) {
            const feat = grantedFeat(rule, rules, missingRefs)
            if (feat) awarded.push({ entry: feat, level: ref.level, source: entry.name })
        }
    }
    if (archetypeId === WAR_MAGE) {
        // Battlecry! pg. 68: familiaridade marcial acompanha a proficiência simples da classe.
        upgrade('martial', proficiency.attacks.simple ?? 0)
        if (level >= 11) for (const target of ['light', 'medium', 'unarmored']) upgrade(target, 2)
        const shieldBlock = rules.get('feat:feat-5212')
        if (shieldBlock) awarded.push({ entry: shieldBlock, level: 1, source: 'War Magic' })
        else warnings.push({ code: 'ENTRY_NOT_FOUND', level: 'warn', ref: CLASS_ARCHETYPE, message: tr('Shield Block ainda não foi carregado.', 'Shield Block has not loaded yet.') })
    }
    const grant = (id: string, at: number, source: string) => {
        const entry = rules.get(id)
        if (entry) awarded.push({ entry, level: at, source })
        else warnings.push({ code: 'ENTRY_NOT_FOUND', level: 'warn', ref: CLASS_ARCHETYPE, message: tr(`${source}: talento concedido fora das listas carregadas (${id}).`, `${source}: granted feat not in the loaded lists (${id}).`) })
    }
    // Rival Academies pg. 114: "You gain Advanced School Spell as a bonus feat at 8th level".
    if (archetypeId === RUNELORD) grant(ADVANCED_SCHOOL_SPELL, 8, 'Runelord')
    // Divine Mysteries pg. 288 (Esoterica): "you gain the Quick Identification skill feat".
    if (archetypeId === PALATINE_DETECTIVE) grant(QUICK_IDENTIFICATION, 1, 'Esoterica')
    // A subclasse entra como concessão, com efeitos e escolhas filhas.
    const classChoices: Compiled['classChoices'] = classChoiceSlots(cls, ctx.classOptions ?? []).map((slot) => {
        const raw = state.choices[slot.key]
        const fixed = spec?.subclass.startsWith(slot.type + ':') ? spec.subclass : undefined
        const saved = raw && 'id' in raw ? raw.id : undefined
        const chosen = fixed ?? saved
        if (fixed && saved && fixed !== saved) {
            warnings.push({ code: 'REPLACED_SUBCLASS', level: 'info', ref: CLASS_ARCHETYPE,
                message: tr('A subclasse anterior fica guardada enquanto o arquétipo de classe estiver ativo.', 'Your previous subclass is saved while the class archetype is active.') })
        }
        if (slot.level <= level) {
            used.add(slot.key)
            if (!chosen) pending.push({ key: slot.key, label: slot.label, level: slot.level, missing: 1 })
            const entry = chosen ? rules.get(chosen) ?? slot.options.find((o) => o.id === chosen) : undefined
            // A subclasse de um arquétipo de classe só vale com ele (instinto Bloodrager, Esoterica, escola Thassilonian).
            const owner = archetypeOfSubclass(chosen)
            if (owner && archetypeId !== owner) {
                const ownerName = rules.get(owner)?.name ?? owner
                warnings.push({ code: 'CLASS_ARCHETYPE_REQUIRED', level: 'warn', ref: CLASS_ARCHETYPE,
                    message: tr(`Escolha ${ownerName} na aba Classe para aplicar os ajustes desta escolha.`, `Choose ${ownerName} on the Class tab to apply this choice’s adjustments.`) })
            }
            if (entry) {
                awarded.push({ entry, level: slot.level, source: slot.label })
                has.add(entry.name.toLowerCase())
                if (slot.type === 'doctrine') {
                    // Degraus da doutrina até o nível atual (Player Core pg. 112); sem dados derivados, avisa.
                    if (entry.doctrine?.steps?.length) {
                        for (const stepDef of entry.doctrine.steps) if (stepDef.level <= level) for (const p of stepDef.proficiencies) upgrade(p.target, p.rank)
                    } else {
                        warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: slot.key, message: tr(`Efeito não calculado: a progressão da doutrina ${entry.name} (salvaguardas e armas por nível).`, `Effect not calculated: the ${entry.name} doctrine progression (saves and weapons by level).`) })
                    }
                }
            }
        }
        return { ...slot, chosen, fixed: !!fixed }
    })
    // Mítico (War of Immortals pg. 77): o chamado vem quando o personagem ganha o poder mítico; no 12º, o talento mítico
    // extra é obrigatoriamente o de destino.
    const mythicOn = variantFlags(state, ctx.mesaRules).mythic
    if (mythicOn) {
        const callingLevel = state.options.mythic?.startLevel ?? 1
        const options = (ctx.classOptions ?? []).filter((o) => o.type === 'mythic-calling')
        const key = 'class-choice:mythic-calling'
        const raw = state.choices[key]
        const chosen = raw && 'id' in raw ? raw.id : undefined
        if (options.length) classChoices.push({ key, type: 'mythic-calling', level: callingLevel, label: tr('Chamado mítico', 'Mythic calling'), options, chosen })
        if (options.length && callingLevel <= level) {
            used.add(key)
            if (!chosen) pending.push({ key, label: tr('Chamado mítico', 'Mythic calling'), level: callingLevel, missing: 1 })
            const entry = chosen ? options.find((o) => o.id === chosen) : undefined
            if (entry) {
                awarded.push({ entry, level: callingLevel, source: tr('Chamado mítico', 'Mythic calling') })
                has.add(entry.name.toLowerCase())
            }
        }
        if (level >= 12) {
            warnings.push({ code: 'MYTHIC_DESTINY', level: 'info', ref: 'mythic-feat-12', message: tr('Nível 12: o talento mítico precisa ser o de um destino mítico (War of Immortals pg. 77).', 'Level 12: the mythic feat must be a mythic destiny feat (War of Immortals pg. 77).') })
        }
    }
    for (const [type, owner] of Object.entries(UNCOUNTED_CHOICE_TYPES)) {
        if ((archetypeId === WAR_MAGE || archetypeId === RUNELORD) && type === 'arcane-thesis') continue
        if (cls && owner.toLowerCase() === cls.name.toLowerCase()) {
            warnings.push({ code: 'UNSUPPORTED_CHOICE', level: 'info', ref: 'class', message: tr(`Escolhas de ${type} ainda não entram no Criador: anote à parte.`, `${type} choices are not in the Builder yet: note them separately.`) })
        }
    }
    // Path to Perfection (Monk): salvaguarda escolhida por nível.
    const saveChoices: Compiled['saveChoices'] = []
    for (const ref of c?.features ?? []) {
        const spec = SAVE_CHOICE_FEATURES.find((f) => f.name.test(ref.name))
        if (!spec) continue
        const key = `class-choice:save-${ref.level}`
        const raw = state.choices[key]
        const chosen = raw && 'value' in raw ? raw.value : undefined
        saveChoices.push({ key, level: ref.level, label: ref.name, rank: spec.rank, chosen })
        if (ref.level > level) continue
        used.add(key)
        if (!chosen) pending.push({ key, label: ref.name, level: ref.level, missing: 1 })
        else if (chosen === 'fortitude' || chosen === 'reflex' || chosen === 'will') upgrade(chosen, spec.rank)
    }
    const picked = saveChoices.filter((s) => s.level <= level && s.chosen)
    if (picked.length >= 2 && picked[0].chosen === picked[1].chosen) {
        warnings.push({ code: 'SAVE_CHOICE_REPEAT', level: 'warn', ref: picked[1].key, message: tr(`${picked[1].label}: escolha uma salvaguarda diferente da primeira (Player Core 2 pg. 114).`, `${picked[1].label}: choose a different save than the first (Player Core 2 pg. 114).`) })
    }
    if (picked.length >= 3 && !picked.slice(0, 2).some((s) => s.chosen === picked[2].chosen)) {
        warnings.push({ code: 'SAVE_CHOICE_REPEAT', level: 'warn', ref: picked[2].key, message: tr(`${picked[2].label}: precisa ser uma das duas já escolhidas (Player Core 2 pg. 114).`, `${picked[2].label}: must be one of the two already chosen (Player Core 2 pg. 114).`) })
    }

    // Ancestralidade e herança passam pelo caminho dos talentos: efeitos (sentidos, deslocamentos) e escolhas filhas
    // (o talento geral do Versatile Human, a perícia do Skilled Human).
    for (const entry of [ancestry, heritage]) if (entry?.rules?.length) awarded.push({ entry, level: 1, source: entry.name })

    // Talento de perícia do background (Player Core pg. 84: "Each background … grants … a skill feat").
    for (const name of background?.background?.feats ?? []) {
        const feat = rules.byName(name, 'feat')
        if (feat) awarded.push({ entry: feat, level: 1, source: background!.name })
        else warnings.push({ code: 'ENTRY_NOT_FOUND', level: 'info', ref: 'background', message: tr(`Talento do background fora das listas carregadas: ${name}.`, `Background feat not in the loaded lists: ${name}.`) })
    }

    // Perícias e idiomas.
    const subclassTrained = classChoices.filter((c) => c.level === 1 && c.chosen).flatMap((c) => {
        const entry = rules.get(c.chosen) ?? c.options.find((o) => o.id === c.chosen)
        return (entry?.rules ?? []).flatMap((r) => {
            const path = typeof r.path === 'string' ? /^system\.skills\.([a-z]+)\.rank$/.exec(r.path) : null
            return r.key === 'ActiveEffectLike' && r.mode === 'upgrade' && r.value === 1 && path && !r.predicate && !r.situational
                ? [{ ref: `skill:${path[1]}`, source: entry!.name }] : []
        })
    })
    // Treinos fixos ou à escolha dos talentos escolhidos ("ActiveEffectLike upgrade system.skills.X.rank 1"), no nível do slot.
    const featTrained = Object.entries(state.choices).flatMap(([key, choice]) => {
        const m = /-feat-(\d+)$/.exec(key)
        if (!m || !('id' in choice)) return []
        const entry = rules.get(choice.id)
        return (entry?.rules ?? []).flatMap((r) => {
            if (r.key !== 'ActiveEffectLike' || r.mode !== 'upgrade' || r.value !== 1 || r.predicate || r.situational || typeof r.path !== 'string') return []
            const fixed = /^system\.skills\.([a-z]+)\.rank$/.exec(r.path)?.[1]
            const flag = /^system\.skills\.\{item\|flags\.system\.rulesSelections\.([A-Za-z]+)\}\.rank$/.exec(r.path)?.[1]
            const picked = flag ? state.choices[`${key}/choice:${flag}`] : undefined
            const skill = fixed ?? (picked && 'value' in picked ? picked.value : undefined)
            return skill ? [{ ref: `skill:${skill}`, level: Number(m[1]), source: entry!.name }] : []
        })
    })
    const skills = compileSkills(state, background, cls, attrs.intAt1, attrs.intGains, cls?.class?.skillIncreaseLevels ?? [], pending, warnings, archetypeId, subclassTrained, featTrained)
    for (const s of skills.slots) used.add(s.key)

    // Talentos por nível: slots da classe e das variantes, concessões e efeitos.
    const flags = variantFlags(state, ctx.mesaRules)
    const slots = featSlots(cls, flags)
    const dedicationSlot = slots.find((s) => s.key === 'class-feat-2')
    if (dedicationSlot && spec) {
        dedicationSlot.requiredFeat = spec.dedication
        const pick = state.choices[dedicationSlot.key]
        if (level >= 2 && pick && (!('id' in pick) || pick.id !== spec.dedication)) {
            warnings.push({ code: 'CLASS_DEDICATION', level: 'warn', ref: dedicationSlot.key,
                message: tr('O arquétipo exige sua dedicação no talento de classe do nível 2.', 'This archetype requires its dedication in the 2nd-level class feat slot.') })
        }
        dedicationSlot.label = rules.get(spec.dedication)?.name ?? tr('Dedicação do arquétipo de classe', 'Class archetype dedication')
    }
    // Slots de talento extras à mão ("Talento concedido"), com aviso.
    for (const [i, extra] of (state.manual.extraFeatSlots ?? []).entries()) {
        slots.push({ key: `extra-${extra.kind}-feat-${extra.level}-${i + 1}`, kind: extra.kind, level: extra.level, label: tr('Talento concedido (ajuste)', 'Granted feat (adjustment)') })
        if (extra.level <= level) warnings.push({ code: 'MANUAL_FEAT_SLOT', level: 'info', ref: 'manual', message: tr(`Slot de talento extra à mão no nível ${extra.level}.`, `Extra feat slot by hand at level ${extra.level}.`) }) // i18n-ok: código do aviso
    }
    const ancestryTraits = [ancestry?.name, ...(heritage && !heritage.heritage?.ancestry ? [heritage.name] : [])].filter((t): t is string => !!t)
    const prereqContext = (): PrereqContext => ({
            level, className: cls?.name, ancestryName: ancestry?.name, heritageName: heritage?.name, has,
            skillRank: (s) => skills.result.rank[s], loreRank: (l) => skills.result.lores.find((x) => x.key === `lore:${l.replace(/\s+/g, '-')}`)?.rank ?? 0,
            stat: { perception: proficiency.perception, fortitude: proficiency.fortitude, reflex: proficiency.reflex, will: proficiency.will },
            attribute: mod, deity: state.origin.deity,
        })
    const feats = compileFeats(state, slots, rules, { level, className: cls?.name, ancestryTraits, awarded, has, prereqContext, missing: missingRefs }, warnings)
    for (const t of feats.taken) {
        const required = Object.entries(CLASS_ARCHETYPES).find(([, a]) => a.dedication === t.entry.id)
        if (required && archetypeId !== required[0]) {
            warnings.push({ code: 'CLASS_ARCHETYPE_REQUIRED', level: 'warn', ref: CLASS_ARCHETYPE,
                message: tr(`${t.entry.name} exige o arquétipo correspondente desde o nível 1.`, `${t.entry.name} requires its class archetype from 1st level.`) })
        }
    }
    for (const slot of slots) {
        if (slot.level > level) continue
        used.add(slot.key)
        const choice = state.choices[slot.key]
        if (!choice) pending.push({ key: slot.key, label: slot.label, level: slot.level, missing: 1 })
    }
    for (const child of feats.children) {
        used.add(child.key)
        if (!child.chosen) pending.push({ key: child.key, label: child.label, level: child.level, missing: 1 })
    }
    if (archetypeId === RUNELORD) {
        warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: CLASS_ARCHETYPE, message: tr(
            'Runelord: o vínculo arcano é uma polearm ou spear, e a personal rune (cajado com as magias do pecado) não entra nas magias; anote à parte.',
            'Runelord: your arcane bond is a polearm or spear, and the personal rune (a staff with your sin spells) is not in the spell lists; note it separately.') })
    }
    if (archetypeId === PALATINE_DETECTIVE) {
        warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: CLASS_ARCHETYPE, message: tr(
            'Esoterica: os dois truques inatos (um divino, um oculto) e o treino em ataque e CD de magia (INT) ainda não entram nas magias; anote à parte.',
            'Esoterica: the two innate cantrips (one divine, one occult) and trained spell attack and DC (INT) are not in the spell lists yet; note them separately.') })
    }
    if (archetypeId === BLOODRAGER) {
        warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: CLASS_ARCHETYPE, message: tr(
            'Aplique na mesa os efeitos de fúria e de Harvest Blood que dependem do alvo.',
            'Apply the target-dependent rage and Harvest Blood effects at the table.') })
    }
    // Ranks concedidos por talentos e características (o maior vence).
    for (const [target, rank] of Object.entries({ ...extraRanks, ...feats.mods.ranks })) {
        const best = Math.max(rank, extraRanks[target] ?? 0, feats.mods.ranks[target] ?? 0) as Rank
        if (target.startsWith('skill:')) {
            const k = target.slice(6) as keyof typeof skills.result.rank
            if (k in skills.result.rank && skills.result.rank[k] < best) skills.result.rank[k] = best
        } else if (target.startsWith('lore:')) {
            const lore = skills.result.lores.find((l) => l.key === target)
            if (lore) lore.rank = Math.max(lore.rank, best) as Rank
            else skills.result.lores.push({ key: target, name: target.slice(5).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), rank: best })
        } else if (target.startsWith('attack:')) upgrade(target.slice(7), best)
        else if (target.startsWith('defense:')) upgrade(target.slice(8), best)
        else upgrade(target, best)
    }

    const ancestryLanguages = ancestry?.ancestry?.languages ?? []
    const extraLanguages: string[] = []
    // Rival Academies pg. 114: "You learn the Thassilonian language."
    if (archetypeId === RUNELORD) extraLanguages.push('Thassilonian')
    const chosenLanguages = (state.origin.languages ?? []).map((id) => rules.get(id)?.name ?? id)
    if (ancestry) {
        if (chosenLanguages.length < skills.languageSlots) {
            pending.push({ key: 'languages', label: tr('Idiomas', 'Languages'), level: 1, missing: skills.languageSlots - chosenLanguages.length })
        } else if (chosenLanguages.length > skills.languageSlots) {
            warnings.push({ code: 'LANGUAGE_TOO_MANY', level: 'warn', ref: 'languages', message: tr(`Idiomas a mais: a INT dá ${skills.languageSlots} (Player Core pg. 89).`, `Too many languages: INT grants ${skills.languageSlots} (Player Core pg. 89).`) })
        }
    }
    for (const id of state.origin.languages ?? []) {
        const entry = rules.get(id)
        if (entry) sourceWarnings(entry, ctx, 'languages', warnings)
    }

    // 6. Equipamento: grupo de arma escolhido (Fighter Weapon Mastery e Weapon Legend, Player Core pg. 136), especialização
    // pelas características alcançadas, armadura, escudo e golpes.
    const groupRanks: Record<string, Partial<Record<'simple' | 'martial' | 'advanced' | 'unarmed', Rank>>> = {}
    const groupChoices: Compiled['groupChoices'] = []
    for (const ref of c?.features ?? []) {
        const spec = GROUP_FEATURES.find((g) => g.name.test(ref.name))
        if (!spec) continue
        const key = `class-choice:weapon-group-${ref.level}`
        const raw = state.choices[key]
        const chosen = raw && 'value' in raw ? raw.value.toLowerCase() : undefined
        groupChoices.push({ key, level: ref.level, label: ref.name, chosen })
        if (ref.level > level) continue
        used.add(key)
        if (!chosen) pending.push({ key, label: ref.name, level: ref.level, missing: 1 })
        else {
            const cur = groupRanks[chosen] ?? {}
            for (const [cat, r] of Object.entries(spec.ranks) as [keyof typeof spec.ranks, Rank][]) cur[cat] = Math.max(cur[cat] ?? 0, r) as Rank
            groupRanks[chosen] = cur
        }
    }
    // Rival Academies pg. 114: polearms e spears marciais treinados, subindo junto com as armas simples.
    if (archetypeId === RUNELORD && (proficiency.attacks.simple ?? 0) > 0) {
        for (const group of ['polearm', 'spear']) {
            const cur = groupRanks[group] ?? {}
            cur.martial = Math.max(cur.martial ?? 0, proficiency.attacks.simple ?? 0) as Rank
            groupRanks[group] = cur
        }
    }
    const reached = (re: RegExp) => (c?.features ?? []).some((f) => f.level <= level && re.test(f.name))
    const specialization = reached(/^greater weapon specialization$/i) ? 2 : reached(/^weapon specialization$/i) ? 1 : 0
    // Automatic Bonus Progression (GM Core pg. 83): potência pelo nível no lugar das runas e itens (menos a armadura).
    const abp = flags.abp ? abpAt(level) : null
    // Proficiências de ajuste à mão entram antes do equipamento (a arma usa o rank); `weapon:<nome>` é a proficiência de
    // uma arma só, como a `specificProficiencies` do Pathbuilder (arma da divindade, por exemplo).
    const weaponRanks: Record<string, Rank> = {}
    for (const a of state.manual.adjustments ?? []) {
        const v = typeof a.effect.value === 'number' ? a.effect.value : Number(a.effect.value)
        const t = (a.effect.target ?? '').toLowerCase()
        if (a.effect.kind !== 'proficiency' || !t || !Number.isFinite(v)) continue
        const r = Math.max(0, Math.min(4, v)) as Rank
        if (t.startsWith('weapon:')) weaponRanks[t.slice(7)] = Math.max(weaponRanks[t.slice(7)] ?? 0, r) as Rank
        else upgrade(t, r)
    }
    // Características e subclasses que mudam o golpe (Sneak Attack, Thief, Hunter's Edge: Precision).
    const strikeFeatures = [
        ...(c?.features ?? []).filter((f) => f.level <= level).map((f) => f.name.toLowerCase()),
        ...classChoices.filter((x) => x.chosen && x.level <= level).map((x) => (rules.get(x.chosen)?.name ?? '').toLowerCase()),
    ]
    const equipment = compileEquipment(state, rules, { level, mod, attacks: proficiency.attacks, groupRanks, specialization, abp, features: strikeFeatures, weaponRanks }, warnings)
    if (abp && equipment.armor) {
        equipment.armor.potency = abp.defense
        equipment.armor.resilient = 0
    }
    const abpOrder = (() => { const c = state.choices['abp-skills']; return c && 'skills' in c ? c.skills : [] })()
    if (abp) {
        used.add('abp-skills')
        if (abp.skillSlots.length > abpOrder.length) pending.push({ key: 'abp-skills', label: tr('Potência de perícia (ABP)', 'Skill potency (ABP)'), level, missing: abp.skillSlots.length - abpOrder.length })
        if (abp.apex) warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: 'abp', message: tr('Efeito não calculado: attribute apex da ABP (nível 17).', 'Effect not calculated: ABP attribute apex (level 17).') })
        for (const [skill, bonus] of Object.entries(abpSkillBonus(abpOrder, abp.skillSlots))) feats.mods.skill[skill as keyof typeof feats.mods.skill] = Math.max(feats.mods.skill[skill as keyof typeof feats.mods.skill] ?? 0, bonus ?? 0)
    }

    // Livro, legado e raridade também para talentos escolhidos e itens do inventário (sem repetir os efeitos não
    // calculados, que os talentos já avisam).
    const checkTable = (entry: RuleEntry, ref: string) => {
        const before = warnings.length
        sourceWarnings(entry, ctx, ref, warnings)
        for (let i = warnings.length - 1; i >= before; i--) if (warnings[i].code === 'UNSUPPORTED_EFFECT') warnings.splice(i, 1)
    }
    for (const t of feats.taken) if (t.kind !== 'granted') checkTable(t.entry, t.slot)
    for (const item of equipment.items) if (item.entry) checkTable(item.entry, 'equipment')
    const checkIds = (ids: Iterable<string | undefined>, ref: string) => {
        for (const id of new Set(ids)) {
            const entry = rules.get(id)
            if (entry) checkTable(entry, ref)
        }
    }
    for (const slot of classChoices) if (!slot.fixed && slot.level <= level) checkIds([slot.chosen], slot.key)
    checkIds([...state.formulas, ...state.inventory.flatMap((i) => [i.material?.id, ...(i.runes?.property ?? [])]),
        ...state.companions.flatMap((c) => [c.type, ...Object.values(c.choices).flatMap((v) => 'id' in v ? [v.id] : [])])], 'equipment')
    checkIds(Object.values(state.spellcasting).flatMap((c) => [
        ...(c.spellbook ?? []), ...(c.signature ?? []), ...Object.values(c.repertoire ?? {}).flat(), ...Object.values(c.prepared ?? {}).flat(),
    ]), 'spells')

    // 7. Magias: o conjurador da classe e o foco (as magias de foco são escolha do jogador: o Foundry quase nunca as concede
    // por regra). Guardadas em `spellcasting.focus.repertoire` — "0" truques de foco, "1" magias de foco.
    const casters = compileCasters(state, cls, { level, keyAttribute, mod, spellRank: proficiency.spell, table: ctx.tables?.spellSlots }, pending, warnings, used)
    casters.push(...compileArchetypeCasters(state, feats.taken, {
        level, mod, keyAttribute, classArchetype: archetypeId, table: ctx.tables?.spellSlots?.archetype, classByName: (n) => rules.byName(n, 'class'),
    }, pending, warnings, used))
    checkSpellChoices(state, casters, (id) => rules.get(id), pending, warnings, level)
    const focusIds = Object.values(state.spellcasting.focus?.repertoire ?? {}).flat()
    const focus = compileFocus(focusIds.map((id) => rules.get(id)).filter((e): e is RuleEntry => !!e), level)

    // Ajustes permanentes à mão (com motivo): entram nos números, sempre com aviso.
    const adjust = { hp: 0, speed: 0, items: {} as Record<string, number> }
    for (const a of state.manual.adjustments ?? []) {
        const v = typeof a.effect.value === 'number' ? a.effect.value : Number(a.effect.value)
        const t = (a.effect.target ?? '').toLowerCase()
        if (a.effect.kind === 'hp' && Number.isFinite(v)) adjust.hp += v
        else if (a.effect.kind === 'speed' && Number.isFinite(v)) adjust.speed += v
        else if (a.effect.kind === 'resistance' && t) feats.mods.resistances.push(Number.isFinite(v) ? `${t} ${v}` : t)
        else if (a.effect.kind === 'sense' && t) feats.mods.senses.push(a.effect.target!)
        else if (a.effect.kind === 'language' && t) extraLanguages.push(a.effect.target!)
        else if (a.effect.kind === 'itemBonus' && t && Number.isFinite(v)) adjust.items[t] = Math.max(adjust.items[t] ?? 0, v)
        warnings.push({ code: 'MANUAL_ADJUSTMENT', level: 'info', ref: 'manual', message: tr(`Ajuste à mão: ${a.label} (${a.reason}).`, `Adjustment by hand: ${a.label} (${a.reason}).`) }) // i18n-ok: código do aviso
    }
    // Proficiência de perícia vinda de ajuste.
    for (const [target, rank] of Object.entries(extraRanks)) {
        if (!target.startsWith('skill:')) continue
        const k = target.slice(6) as keyof typeof skills.result.rank
        if (k in skills.result.rank && skills.result.rank[k] < rank) skills.result.rank[k] = rank
    }

    // 5. Derivados.
    const part = (label: string, value: number) => ({ label, value })
    const attrPart = (key: keyof typeof mod) => part(attributeLabel(key), mod[key])
    const hpParts = [
        ...(ancestry ? [part(tr('Ancestralidade', 'Ancestry'), ancestry.ancestry?.hp ?? 0)] : []),
        ...(cls ? [part(tr(`Classe × ${level}`, `Class × ${level}`), (c?.hp ?? 0) * level), part(tr(`CON × ${level}`, `CON × ${level}`), mod.con * level)] : []),
    ]
    const p = (rank: Rank) => part(rankName(rank), proficiencyBonus(rank, level))
    const resilient = abp ? abp.save : equipment.armor?.resilient ?? 0
    const featPart = (key: 'perception' | 'fortitude' | 'reflex' | 'will') => [
        ...(feats.mods.stat[key] ? [part(tr('Talentos', 'Feats'), feats.mods.stat[key] ?? 0)] : []),
        ...(resilient && key !== 'perception' ? [part(abp ? tr('Potência (ABP)', 'Potency (ABP)') : equipment.armor?.saveLabel ?? tr('Resiliente', 'Resilient'), resilient)] : []),
        ...(abp?.perception && key === 'perception' ? [part(tr('Potência (ABP)', 'Potency (ABP)'), abp.perception)] : []),
        ...(adjust.items[key] ? [part(tr('Item (ajuste)', 'Item (adjustment)'), adjust.items[key])] : []),
    ]
    const stats: Compiled['stats'] = {
        hp: stat([...hpParts, ...(adjust.hp ? [part(tr('Ajuste', 'Adjustment'), adjust.hp)] : []), ...(feats.mods.hp ? [part(tr('Talentos', 'Feats'), feats.mods.hp)] : []),
            ...(feats.mods.hpPerLevel ? [part(tr(`Talentos × ${level}`, `Feats × ${level}`), feats.mods.hpPerLevel * level)] : [])]),
        ac: (() => {
            const ac = armorClass(equipment, { dex: mod.dex, level, defenses: proficiency.defenses, label: rankName, unarmoredPotency: abp && !equipment.armor ? abp.defense : 0 })
            return adjust.items.ac ? { total: ac.total + adjust.items.ac, parts: [...ac.parts, part(tr('Item (ajuste)', 'Item (adjustment)'), adjust.items.ac)] } : ac
        })(),
        fortitude: stat([p(proficiency.fortitude), attrPart('con'), ...featPart('fortitude')]),
        reflex: stat([p(proficiency.reflex), attrPart('dex'), ...featPart('reflex')]),
        will: stat([p(proficiency.will), attrPart('wis'), ...featPart('will')]),
        perception: stat([p(proficiency.perception), attrPart('wis'), ...featPart('perception')]),
        classDC: cls && keyAttribute ? stat([p(proficiency.classDC), attrPart(keyAttribute)], 10) : null,
        speed: stat([...(ancestry?.ancestry?.speed !== undefined ? [part(tr('Ancestralidade', 'Ancestry'), ancestry.ancestry.speed)] : []),
            ...(feats.mods.speed ? [part(tr('Talentos', 'Feats'), feats.mods.speed)] : []),
            ...(equipment.armor?.speedPenalty ? [part(tr('Armadura', 'Armor'), equipment.armor.speedPenalty)] : []),
            ...(adjust.speed ? [part(tr('Ajuste', 'Adjustment'), adjust.speed)] : [])]),
    }

    // Sentidos: os da ancestralidade e os `Sense` de herança, talentos e concessões.
    const senses = [...(ancestry?.ancestry?.senses ?? [])]
    for (const sense of feats.mods.senses) if (!senses.some((x) => sense.toLowerCase().startsWith(x.toLowerCase()))) senses.push(sense)

    // Escolhas que nenhum slot usa: não some (o jogador não perde trabalho), vira aviso com "descartar".
    for (const key of Object.keys(state.choices)) {
        if (!used.has(key)) warnings.push({ code: 'ORPHAN_CHOICE', level: 'info', ref: key, message: tr(`Escolha sem lugar: ${key}.`, `Choice without a slot: ${key}.`) })
    }

    return {
        level,
        missingRefs: [...missingRefs].sort(),
        attributes: attrs.result,
        skills: skills.result,
        stats,
        proficiency,
        size: ancestry?.ancestry?.size ?? null,
        senses,
        speeds: feats.mods.speeds,
        resistances: feats.mods.resistances,
        weaknesses: feats.mods.weaknesses,
        immunities: feats.mods.immunities,
        languages: [...ancestryLanguages, ...chosenLanguages, ...extraLanguages],
        languageSlots: skills.languageSlots,
        keyAttribute,
        pending: pending.sort((a, b) => a.level - b.level),
        // A ancestralidade e a herança passam pelos dois caminhos (origem e concessões): um aviso igual sai uma vez só.
        warnings: warnings.filter((w, i) => warnings.findIndex((x) => x.code === w.code && x.message === w.message) === i),
        usedChoices: [...used],
        boostGroups: attrs.groups,
        skillSlots: skills.slots,
        automaticSkills: skills.automatic,
        featSlots: slots,
        featChildren: feats.children,
        taken: feats.taken,
        classFeatures: features,
        classChoices,
        saveChoices,
        prereq: prereqContext(),
        ancestryTraits,
        casters,
        focus,
        equipment,
        groupChoices,
        skillBonus: feats.mods.skill,
    }
}
