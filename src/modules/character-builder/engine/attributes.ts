// Atributos (MOTOR-DE-REGRAS §2). Regras conferidas na AON, Remaster:
// - Player Core pg. 17 ("Character Creation" → Attribute Boosts): boost +1; em modificador +4 ou maior vira "parcial", e o
//   segundo parcial sobe +1. Boosts recebidos ao mesmo tempo vão para atributos diferentes. Flaw = −1. Nível 1: até +4.
//   Ordem: ancestralidade, background (dois boosts), classe (atributo-chave), quatro livres.
// - Player Core pg. 23 (Step 3): "Alternate Ancestry Boosts" troca os boosts e flaws da ancestralidade por dois livres;
//   "Voluntary Flaws", no máximo um flaw por atributo.
// - Player Core pg. 84 (Backgrounds) e o texto de cada background: um boost entre os dois listados e um livre.
// - Player Core pg. 92 (Attribute Boosts): no 5º nível e a cada 5 níveis, quatro boosts em atributos diferentes.
import { tr } from '../../../i18n'
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import { ATTRIBUTES, type AttributeKey, type AttributeResult, type Pending, type Warning } from './types'

export const LEVELLED_BOOST_LEVELS = [5, 10, 15, 20] as const

const ATTR_LABEL: Record<AttributeKey, string> = {
    str: tr('FOR', 'STR'), dex: tr('DES', 'DEX'), con: tr('CON', 'CON'), int: tr('INT', 'INT'), wis: tr('SAB', 'WIS'), cha: tr('CAR', 'CHA'),
}
export const attributeLabel = (key: AttributeKey) => ATTR_LABEL[key]

const boostsOf = (state: BuildState, key: string): AttributeKey[] => {
    const choice = state.choices[key]
    return choice && 'boosts' in choice ? choice.boosts : []
}

/** O que cada grupo de boosts pede, para a tela e para as pendências. */
export interface BoostGroup {
    key: string
    label: string
    level: number
    count: number
    /** Atributos aceitos (vazio = qualquer). Para o background, a lista restrita vale para UM dos dois boosts. */
    options: AttributeKey[]
    /** Background: um boost entre `options`, o outro livre. */
    oneOf?: boolean
    /** Fixos do grupo (os da ancestralidade), mostrados e aplicados sem escolha. */
    fixed: AttributeKey[]
    chosen: AttributeKey[]
}

export function boostGroups(state: BuildState, ancestry?: RuleEntry, background?: RuleEntry, cls?: RuleEntry): BoostGroup[] {
    const groups: BoostGroup[] = []
    if (ancestry) {
        const listed = ancestry.ancestry?.boosts ?? []
        const alternate = state.origin.alternateBoosts === true
        const fixed = alternate ? [] : listed.filter((b): b is AttributeKey => b !== 'free')
        const free = alternate ? 2 : listed.filter((b) => b === 'free').length
        groups.push({ key: 'boosts-ancestry', label: tr('Ancestralidade', 'Ancestry'), level: 1, count: free, options: [], fixed, chosen: boostsOf(state, 'boosts-ancestry') })
    }
    if (background) {
        const options = (background.background?.boosts ?? []).filter((b): b is AttributeKey => b !== 'free')
        groups.push({ key: 'boosts-background', label: tr('Background', 'Background'), level: 1, count: 2, options, oneOf: options.length > 0, fixed: [], chosen: boostsOf(state, 'boosts-background') })
    }
    if (cls) {
        const keys = cls.class?.keyAttribute ?? []
        const chosen = keys.length === 1 ? [keys[0]] : state.class.keyAttribute && keys.includes(state.class.keyAttribute) ? [state.class.keyAttribute] : []
        groups.push({ key: 'class-key', label: tr('Classe (atributo-chave)', 'Class (key attribute)'), level: 1, count: keys.length > 1 ? 1 : 0, options: keys, fixed: keys.length === 1 ? [keys[0]] : [], chosen: keys.length === 1 ? [] : chosen })
    }
    groups.push({ key: 'boosts-1', label: tr('Quatro boosts livres', 'Four free boosts'), level: 1, count: 4, options: [], fixed: [], chosen: boostsOf(state, 'boosts-1') })
    for (const level of LEVELLED_BOOST_LEVELS) {
        if (level > state.level) break
        groups.push({ key: `boosts-${level}`, label: tr(`Boosts do nível ${level}`, `Level ${level} boosts`), level, count: 4, options: [], fixed: [], chosen: boostsOf(state, `boosts-${level}`) })
    }
    return groups
}

export interface AttributeOutcome {
    result: AttributeResult
    groups: BoostGroup[]
    /** Quanto a INT subiu em cada nível de boost (Player Core pg. 29: cada aumento dá perícia e idioma). */
    intGains: Record<number, number>
    /** INT ao fim do 1º nível: base das perícias e idiomas iniciais. */
    intAt1: number
}

export function compileAttributes(state: BuildState, ancestry: RuleEntry | undefined, background: RuleEntry | undefined, cls: RuleEntry | undefined,
    pending: Pending[], warnings: Warning[]): AttributeOutcome {
    const mod = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<AttributeKey, number>
    const partial = Object.fromEntries(ATTRIBUTES.map((a) => [a, false])) as Record<AttributeKey, boolean>
    const boost = (a: AttributeKey) => {
        if (mod[a] >= 4) {
            if (partial[a]) {
                mod[a] += 1
                partial[a] = false
            } else partial[a] = true
        } else mod[a] += 1
    }
    const groups = boostGroups(state, ancestry, background, cls)
    const intGains: Record<number, number> = {}
    let intAt1 = 0
    const breakdown: AttributeResult['breakdown'] = {
        ancestryFree: [], ancestryBoosts: [], ancestryFlaws: [], backgroundBoosts: [], classBoosts: [], mapLevelledBoosts: {},
    }

    // Flaws da ancestralidade (somem com os boosts alternativos) e voluntários: no máximo um por atributo.
    const flaws: AttributeKey[] = state.origin.alternateBoosts ? [] : (ancestry?.ancestry?.flaws ?? [])
    for (const flaw of [...flaws, ...(state.origin.voluntaryFlaws ?? [])]) mod[flaw] -= 1
    const voluntary = state.origin.voluntaryFlaws ?? []
    if (voluntary.some((f) => flaws.includes(f))) {
        warnings.push({ code: 'FLAW_TWICE', level: 'warn', ref: 'origin', message: tr('Mais de um flaw no mesmo atributo (Player Core pg. 23).', 'More than one flaw on the same attribute (Player Core pg. 23).') })
    }
    breakdown.ancestryFlaws = [...flaws, ...voluntary]

    for (const group of groups) {
        const picks = group.chosen.slice(0, group.count)
        const all = [...group.fixed, ...picks]
        if (new Set(all).size !== all.length) {
            warnings.push({ code: 'BOOST_DUPLICATE', level: 'warn', ref: group.key, message: tr(`${group.label}: boosts do mesmo grupo vão para atributos diferentes.`, `${group.label}: boosts in the same group go to different attributes.`) })
        }
        if (group.oneOf && picks.length === 2 && !picks.some((p) => group.options.includes(p))) {
            warnings.push({ code: 'BOOST_NOT_ALLOWED', level: 'warn', ref: group.key, message: tr(`Background: um dos boosts precisa ser ${group.options.map(attributeLabel).join(' ou ')}.`, `Background: one boost must be ${group.options.map(attributeLabel).join(' or ')}.`) })
        }
        if (!group.oneOf && group.options.length && picks.some((p) => !group.options.includes(p))) {
            warnings.push({ code: 'BOOST_NOT_ALLOWED', level: 'warn', ref: group.key, message: tr(`${group.label}: escolha fora das opções.`, `${group.label}: choice outside the options.`) })
        }
        if (group.chosen.length > group.count) {
            warnings.push({ code: 'BOOST_TOO_MANY', level: 'warn', ref: group.key, message: tr(`${group.label}: boosts a mais foram ignorados.`, `${group.label}: extra boosts were ignored.`) })
        }
        if (picks.length < group.count) pending.push({ key: group.key, label: group.label, level: group.level, missing: group.count - picks.length })
        const intBefore = mod.int
        for (const a of new Set(all)) boost(a)
        if (group.level > 1 && mod.int > intBefore) intGains[group.level] = (intGains[group.level] ?? 0) + (mod.int - intBefore)
        if (group.level === 1) intAt1 = mod.int

        if (group.key === 'boosts-ancestry') {
            breakdown.ancestryBoosts = group.fixed
            breakdown.ancestryFree = picks
        } else if (group.key === 'boosts-background') breakdown.backgroundBoosts = picks
        else if (group.key === 'class-key') breakdown.classBoosts = all
        else breakdown.mapLevelledBoosts[String(group.level)] = picks
    }

    if (Object.values(mod).some((v) => v > 4) && state.level === 1) {
        warnings.push({ code: 'ATTR_OVER_4', level: 'warn', message: tr('No nível 1, nenhum modificador passa de +4 (Player Core pg. 17).', 'At 1st level, no modifier goes above +4 (Player Core pg. 17).') })
    }
    // Override manual: troca o modificador final, sempre com aviso (MOTOR §2).
    for (const [a, value] of Object.entries(state.manual.attributeOverride ?? {}) as [AttributeKey, number][]) {
        mod[a] = value
        partial[a] = false
        warnings.push({ code: 'ATTR_OVERRIDE', level: 'info', ref: a, message: tr(`${attributeLabel(a)} definido à mão: ${value >= 0 ? '+' : ''}${value}.`, `${attributeLabel(a)} set by hand: ${value >= 0 ? '+' : ''}${value}.`) })
    }
    return { result: { mod, partial, breakdown }, groups, intGains, intAt1 }
}

/** "Pontuação" do export do Pathbuilder: 10 + 2 × modificador, +1 com boost parcial pendente. */
export const attributeScore = (mod: number, partial: boolean) => 10 + 2 * mod + (partial ? 1 : 0)
