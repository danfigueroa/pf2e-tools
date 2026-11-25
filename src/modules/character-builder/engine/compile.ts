// `compileBuild`: escolhas (BuildState) → números, pendências e avisos (MOTOR-DE-REGRAS §1). F3 cobre o nível 1 "de
// corpo": origem, atributos, proficiências iniciais da classe, perícias, idiomas e os derivados. Regras na AON, Remaster:
// - Proficiência: destreinado +0; treinado/perito/mestre/lendário = nível + 2/4/6/8 (Player Core pg. 11).
// - PV: os da ancestralidade + (os da classe + CON) por nível (Player Core pg. 91, "Hit Points").
// - CA = 10 + DES + proficiência (sem armadura: defesa sem armadura) + item + outros (Player Core pg. 271).
// - Salvaguardas: Fortitude CON, Reflexos DES, Vontade SAB (Player Core pg. 26). Percepção: SAB (Player Core pg. 25).
// - CD de classe = 10 + proficiência + atributo-chave (Player Core pg. 27); as 29 classes Remaster da AON começam
//   "Trained in <classe> class DC".
// O que o motor ainda não calcula (características de classe acima do 1º nível, talentos, itens) vira aviso, nunca número.
import { tr } from '../../../i18n'
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import { attributeLabel, compileAttributes } from './attributes'
import { compileSkills } from './skills'
import { compileFeats } from './feats'
import type { PrereqContext } from './prereqs'
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
    if (rules) {
        // Lista de livros vazia = o GM ainda não restringiu (mesa nova): não avisa por livro.
        const allowed = (rules.sources.allow.length === 0 || rules.sources.allow.includes(entry.source.id)) && !(rules.sources.deny ?? []).includes(entry.source.id)
        const exception = rules.exceptions.some((e) => e.ids.includes(entry.id))
        if (!allowed && !exception) {
            warnings.push({ code: 'SOURCE_NOT_ALLOWED', level: 'warn', ref, message: tr(`${entry.name}: livro não liberado nesta mesa.`, `${entry.name}: book not allowed at this table.`) })
        }
        if (!entry.remaster && !rules.legacy && !exception) {
            warnings.push({ code: 'LEGACY_NOT_ALLOWED', level: 'warn', ref, message: tr(`${entry.name}: conteúdo pré-Remaster não liberado nesta mesa.`, `${entry.name}: pre-Remaster content not allowed at this table.`) })
        }
        const rarity = entry.rarity === 'uncommon' ? rules.rarity.uncommon : entry.rarity === 'rare' || entry.rarity === 'unique' ? rules.rarity.rare : 'allow'
        if (rarity !== 'allow' && !exception) {
            warnings.push({
                code: rarity === 'deny' ? 'RARITY_DENIED' : 'RARITY_ASK', level: 'warn', ref,
                message: rarity === 'deny'
                    ? tr(`${entry.name}: raridade não permitida nesta mesa.`, `${entry.name}: rarity not allowed at this table.`)
                    : tr(`${entry.name}: ${entry.rarity === 'uncommon' ? 'incomum' : 'raro'} — combine com o GM.`, `${entry.name}: ${entry.rarity} — check with the GM.`),
            })
        }
    }
    for (const effect of entry.unsupported ?? []) {
        warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref, message: tr(`Efeito não calculado: ${entry.name} (${effect}).`, `Effect not calculated: ${entry.name} (${effect}).`) })
    }
}

export function compileBuild(state: BuildState, ctx: CompileContext): Compiled {
    const { rules } = ctx
    const level = Math.min(20, Math.max(1, state.level))
    const pending: Pending[] = []
    const warnings: Warning[] = []
    const used = new Set<string>()

    // 1. Coleta.
    const ancestry = rules.get(state.origin.ancestry)
    const heritage = rules.get(state.origin.heritage)
    const background = rules.get(state.origin.background)
    const cls = rules.get(state.class.id)
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
        spell: 0,
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
        for (const note of (entry.unsupported ?? []).filter((u) => u.startsWith('proficiency:'))) {
            warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: 'class', message: tr(`Efeito não calculado: ${entry.name} (${note.slice(13)}).`, `Effect not calculated: ${entry.name} (${note.slice(13)}).`) })
        }
        for (const rule of entry.rules ?? []) {
            const name = rule.key === 'GrantItem' && typeof rule.uuid === 'string' ? /\.Item\.(.+)$/.exec(rule.uuid)?.[1] : undefined
            const feat = name ? rules.byName(name, 'feat') : undefined
            if (feat) awarded.push({ entry: feat, level: ref.level, source: entry.name })
        }
    }
    // Escolhas de classe (subclasse): a escolhida entra como concessão (com os efeitos e escolhas filhas dela).
    const classChoices: Compiled['classChoices'] = classChoiceSlots(cls, ctx.classOptions ?? []).map((slot) => {
        const raw = state.choices[slot.key]
        const chosen = raw && 'id' in raw ? raw.id : undefined
        if (slot.level <= level) {
            used.add(slot.key)
            if (!chosen) pending.push({ key: slot.key, label: slot.label, level: slot.level, missing: 1 })
            const entry = chosen ? rules.get(chosen) ?? slot.options.find((o) => o.id === chosen) : undefined
            if (entry) {
                awarded.push({ entry, level: slot.level, source: slot.label })
                has.add(entry.name.toLowerCase())
                if (slot.type === 'doctrine') {
                    warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: slot.key, message: tr(`Efeito não calculado: a progressão da doutrina ${entry.name} (salvaguardas e armas por nível).`, `Effect not calculated: the ${entry.name} doctrine progression (saves and weapons by level).`) })
                }
            }
        }
        return { ...slot, chosen }
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
    const skills = compileSkills(state, background, cls, attrs.intAt1, attrs.intGains, cls?.class?.skillIncreaseLevels ?? [], pending, warnings)
    for (const s of skills.slots) used.add(s.key)

    // Talentos por nível: slots da classe e das variantes, concessões e efeitos.
    const flags = variantFlags(state, ctx.mesaRules)
    const slots = featSlots(cls, flags)
    const ancestryTraits = [ancestry?.name, ...(heritage && !heritage.heritage?.ancestry ? [heritage.name] : [])].filter((t): t is string => !!t)
    const prereqContext = (): PrereqContext => ({
            level, className: cls?.name, ancestryName: ancestry?.name, heritageName: heritage?.name, has,
            skillRank: (s) => skills.result.rank[s], loreRank: (l) => skills.result.lores.find((x) => x.key === `lore:${l.replace(/\s+/g, '-')}`)?.rank ?? 0,
            stat: { perception: proficiency.perception, fortitude: proficiency.fortitude, reflex: proficiency.reflex, will: proficiency.will },
            attribute: mod, deity: state.origin.deity,
        })
    const feats = compileFeats(state, slots, rules, { level, className: cls?.name, ancestryTraits, awarded, has, prereqContext }, warnings)
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

    // 5. Derivados.
    const part = (label: string, value: number) => ({ label, value })
    const attrPart = (key: keyof typeof mod) => part(attributeLabel(key), mod[key])
    const hpParts = [
        ...(ancestry ? [part(tr('Ancestralidade', 'Ancestry'), ancestry.ancestry?.hp ?? 0)] : []),
        ...(cls ? [part(tr(`Classe × ${level}`, `Class × ${level}`), (c?.hp ?? 0) * level), part(tr(`CON × ${level}`, `CON × ${level}`), mod.con * level)] : []),
    ]
    const p = (rank: Rank) => part(rankName(rank), proficiencyBonus(rank, level))
    const featPart = (key: 'perception' | 'fortitude' | 'reflex' | 'will') => (feats.mods.stat[key] ? [part(tr('Talentos', 'Feats'), feats.mods.stat[key] ?? 0)] : [])
    const stats: Compiled['stats'] = {
        hp: stat([...hpParts, ...(feats.mods.hp ? [part(tr('Talentos', 'Feats'), feats.mods.hp)] : []),
            ...(feats.mods.hpPerLevel ? [part(tr(`Talentos × ${level}`, `Feats × ${level}`), feats.mods.hpPerLevel * level)] : [])]),
        ac: stat([attrPart('dex'), p(proficiency.defenses.unarmored ?? 0)], 10),
        fortitude: stat([p(proficiency.fortitude), attrPart('con'), ...featPart('fortitude')]),
        reflex: stat([p(proficiency.reflex), attrPart('dex'), ...featPart('reflex')]),
        will: stat([p(proficiency.will), attrPart('wis'), ...featPart('will')]),
        perception: stat([p(proficiency.perception), attrPart('wis'), ...featPart('perception')]),
        classDC: cls && keyAttribute ? stat([p(proficiency.classDC), attrPart(keyAttribute)], 10) : null,
        speed: stat([...(ancestry?.ancestry?.speed !== undefined ? [part(tr('Ancestralidade', 'Ancestry'), ancestry.ancestry.speed)] : []),
            ...(feats.mods.speed ? [part(tr('Talentos', 'Feats'), feats.mods.speed)] : [])]),
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
        languages: [...ancestryLanguages, ...chosenLanguages],
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
        skillBonus: feats.mods.skill,
    }
}
