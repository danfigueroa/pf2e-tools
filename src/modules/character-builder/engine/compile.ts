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
        const allowed = rules.sources.allow.includes(entry.source.id) && !(rules.sources.deny ?? []).includes(entry.source.id)
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
        attacks: { ...(c?.attacks ?? {}) } as Compiled['proficiency']['attacks'],
        defenses: { ...(c?.defenses ?? {}) } as Compiled['proficiency']['defenses'],
    }
    if (cls && level > 1) {
        warnings.push({ code: 'PROGRESSION_PENDING', level: 'info', message: tr('Características de classe acima do 1º nível ainda não entram nos números (próxima etapa do Criador).', 'Class features above 1st level are not in the numbers yet (next stage of the Builder).') })
    }

    // Perícias e idiomas.
    const skills = compileSkills(state, background, cls, attrs.intAt1, attrs.intGains, cls?.class?.skillIncreaseLevels ?? [], pending, warnings)
    for (const s of skills.slots) used.add(s.key)

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
    const stats: Compiled['stats'] = {
        hp: stat(hpParts),
        ac: stat([attrPart('dex'), p(proficiency.defenses.unarmored ?? 0)], 10),
        fortitude: stat([p(proficiency.fortitude), attrPart('con')]),
        reflex: stat([p(proficiency.reflex), attrPart('dex')]),
        will: stat([p(proficiency.will), attrPart('wis')]),
        perception: stat([p(proficiency.perception), attrPart('wis')]),
        classDC: cls && keyAttribute ? stat([p(proficiency.classDC), attrPart(keyAttribute)], 10) : null,
        speed: stat(ancestry?.ancestry?.speed !== undefined ? [part(tr('Ancestralidade', 'Ancestry'), ancestry.ancestry.speed)] : []),
    }

    // Sentidos: da ancestralidade e os `Sense` da herança (rule element suportado).
    const senses = [...(ancestry?.ancestry?.senses ?? [])]
    for (const rule of heritage?.rules ?? []) {
        if (rule.key === 'Sense' && typeof rule.selector === 'string') {
            const name = rule.selector.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
            if (!senses.some((s) => s.toLowerCase() === name.toLowerCase())) senses.push(name)
        }
    }

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
        languages: [...ancestryLanguages, ...chosenLanguages],
        keyAttribute,
        pending: pending.sort((a, b) => a.level - b.level),
        warnings,
        usedChoices: [...used],
    }
}
