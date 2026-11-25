// Perícias e idiomas (MOTOR-DE-REGRAS §4). Regras conferidas na AON, Remaster:
// - Player Core pg. 225 (Chapter 4: Skills): no 1º nível, as do background, as fixas da classe e N à escolha; ficar
//   treinado de novo na mesma perícia vira um treino livre em outra.
// - Player Core pg. 84 (Backgrounds): idem para background × classe; cada background treina em duas, uma é Lore.
// - Player Core pg. 92 (Skill Increases): treinar uma nova ou subir uma treinada; mestre a partir do 7º, lendário do 15º.
// - Player Core pg. 29 (Leveling Up): aumento que sobe a INT dá uma perícia treinada e um idioma a mais.
// - Player Core pg. 89 (Languages): os da ancestralidade, mais tantos quanto a INT positiva.
// O número de perícias à escolha da classe (`trainedSkills.additional`) é dado do catálogo, somado à INT (texto de cada
// classe: "equal to N plus your Intelligence modifier").
import { BLOODRAGER, CLASS_ARCHETYPES, WAR_MAGE } from './classArchetypes'
import { tr } from '../../../i18n'
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import { SKILL_KEYS, type Pending, type Rank, type SkillKey, type SkillResult, type Warning } from './types'

const SKILL_SET = new Set<string>(SKILL_KEYS)
export const SKILL_INCREASE_CAP: { level: number; rank: Rank }[] = [{ level: 15, rank: 4 }, { level: 7, rank: 3 }, { level: 1, rank: 2 }]

/** `Art Lore` → `lore:art`; `crafting` → `skill:crafting`. */
export function skillRef(name: string): string {
    const raw = name.trim()
    const lower = raw.toLowerCase()
    if (SKILL_SET.has(lower)) return `skill:${lower}`
    const lore = lower.replace(/\s*lore$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `lore:${lore || 'lore'}`
}

/** `lore:art` → "Art"; o nome que o jogador digitou fica em `loreNames`. */
export function loreName(ref: string, names: Record<string, string> = {}): string {
    const key = ref.replace(/^lore:/, '')
    return names[key] ?? key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const choiceSkills = (state: BuildState, key: string): string[] => {
    const choice = state.choices[key]
    return choice && 'skills' in choice ? choice.skills : []
}

export interface SkillSlot {
    key: string
    label: string
    level: number
    count: number
    /** Vazio = qualquer perícia (ou Lore). */
    options: string[]
    loreOnly?: boolean
    kind: 'train' | 'increase'
    chosen: string[]
}

export interface SkillOutcome {
    result: SkillResult
    slots: SkillSlot[]
    /** Treinos automáticos (background, fixas da classe), para a tela mostrar de onde vieram. */
    automatic: { ref: string; source: string }[]
    languageSlots: number
}

export function compileSkills(state: BuildState, background: RuleEntry | undefined, cls: RuleEntry | undefined, intMod1: number,
    intGains: Record<number, number>, skillIncreaseLevels: number[], pending: Pending[], warnings: Warning[], classArchetype?: string): SkillOutcome {
    const rank = Object.fromEntries(SKILL_KEYS.map((s) => [s, 0])) as Record<SkillKey, Rank>
    const lores = new Map<string, Rank>()
    const loreNames: Record<string, string> = {}
    const get = (ref: string): Rank => (ref.startsWith('skill:') ? rank[ref.slice(6) as SkillKey] ?? 0 : lores.get(ref) ?? 0)
    const set = (ref: string, value: Rank) => {
        if (ref.startsWith('skill:')) {
            const key = ref.slice(6)
            if (SKILL_SET.has(key)) rank[key as SkillKey] = value
        } else lores.set(ref, value)
    }

    // Automáticos: background e fixas da classe. Repetido = um treino livre a mais (Player Core pg. 225).
    const automatic: { ref: string; source: string }[] = []
    let overlaps = 0
    const train = (ref: string, source: string, auto: boolean) => {
        if (get(ref) >= 1) {
            overlaps += 1
            return
        }
        set(ref, 1)
        if (auto) automatic.push({ ref, source })
    }
    for (const name of background?.background?.skills ?? []) {
        const ref = skillRef(name)
        if (ref.startsWith('lore:')) loreNames[ref.slice(5)] = name.replace(/\s*Lore$/i, '')
        train(ref, background?.name ?? '', true)
    }
    for (const skill of cls?.class?.trainedSkills?.fixed ?? []) train(skillRef(skill), cls?.name ?? '', true)

    const slots: SkillSlot[] = []
    // Escolhas da classe entre opções ("Acrobatics or Athletics").
    ;(cls?.class?.trainedSkills?.choices ?? []).forEach((options, i) => {
        const key = `class-skill-${i + 1}`
        const chosen = choiceSkills(state, key).slice(0, 1)
        slots.push({ key, label: tr(`${cls?.name}: perícia à escolha`, `${cls?.name}: skill choice`), level: 1, count: 1, options: options.map(skillRef), kind: 'train', chosen })
        if (chosen[0] && !options.map(skillRef).includes(chosen[0])) {
            warnings.push({ code: 'SKILL_NOT_ALLOWED', level: 'warn', ref: key, message: tr('Perícia fora das opções da classe.', 'Skill outside the class options.') })
        }
        for (const ref of chosen) train(ref, cls?.name ?? '', false)
    })

    // Livres do 1º nível: as da classe + INT + repetidas (a INT negativa não tira treino: "number of additional skills
    // equal to N plus your Intelligence modifier" — com INT −1 sobra N − 1).
    if (cls) {
        const additional = (cls.class?.trainedSkills?.additional ?? 0) + intMod1
        const count = Math.max(0, additional) + overlaps
        const chosen = choiceSkills(state, 'skills-1')
        slots.push({ key: 'skills-1', label: tr('Perícias treinadas', 'Trained skills'), level: 1, count, options: [], kind: 'train', chosen })
        for (const ref of chosen.slice(0, count)) train(ref, '', false)
    }

    // A dedicação do 2º nível é posterior aos treinos iniciais e anterior aos aumentos dos níveis seguintes.
    const dedication = state.choices['class-feat-2']
    const hasDedication = classArchetype && state.level >= 2 && dedication && 'id' in dedication
        && dedication.id === CLASS_ARCHETYPES[classArchetype]?.dedication
    let warfareLore = false
    if (hasDedication) {
        const skill = state.choices['class-feat-2/choice:skill']
        let ref: string | undefined
        if (classArchetype === WAR_MAGE) ref = 'lore:warfare'
        if (classArchetype === BLOODRAGER && skill && 'value' in skill && ['arcana', 'religion'].includes(skill.value)) ref = skillRef(skill.value)
        if (ref) {
            warfareLore = classArchetype === WAR_MAGE
            const label = warfareLore ? 'War Mage Dedication' : 'Bloodrager Dedication'
            if (get(ref) === 0) train(ref, label, true)
            else {
                // Battlecry! pg. 68 concede outro Lore; War of Immortals pg. 60 concede uma perícia à escolha.
                const key = 'skills-dedication-2'
                const chosen = choiceSkills(state, key)
                const valid = chosen.filter((s) => (!warfareLore || s.startsWith('lore:')) && get(s) === 0)
                slots.push({ key, label, level: 2, count: 1, kind: 'train', options: [], loreOnly: warfareLore, chosen })
                if (valid[0]) train(valid[0], label, false)
                if (chosen.length && !valid.length) warnings.push({ code: 'SKILL_NOT_ALLOWED', level: 'warn', ref: key,
                    message: tr('Escolha um novo treino para a dedicação.', 'Choose a new trained skill for your dedication.') })
            }
        }
    }

    // INT que sobe nos níveis de boost: uma perícia por ponto (Player Core pg. 29).
    for (const [level, gain] of Object.entries(intGains)) {
        const key = `skills-int-${level}`
        const chosen = choiceSkills(state, key)
        slots.push({ key, label: tr(`Perícia pela INT (nível ${level})`, `Skill from INT (level ${level})`), level: Number(level), count: gain, options: [], kind: 'train', chosen })
        for (const ref of chosen.slice(0, gain)) train(ref, '', false)
    }

    // Aumentos de perícia nos níveis da classe (Player Core pg. 92).
    for (const level of skillIncreaseLevels) {
        if (level > state.level) break
        const key = `skill-increase-${level}`
        const chosen = choiceSkills(state, key).slice(0, 1)
        slots.push({ key, label: tr(`Aumento de perícia (nível ${level})`, `Skill increase (level ${level})`), level, count: 1, options: [], kind: 'increase', chosen })
        for (const ref of chosen) {
            const cap = SKILL_INCREASE_CAP.find((c) => level >= c.level)?.rank ?? 2
            const next = Math.min(4, get(ref) + 1) as Rank
            if (next > cap) {
                warnings.push({ code: 'SKILL_RANK_CAP', level: 'warn', ref: key, message: tr(`Nível ${level}: ${next === 3 ? 'mestre só a partir do 7' : 'lendário só a partir do 15'} (Player Core pg. 92).`, `Level ${level}: ${next === 3 ? 'master only from 7th' : 'legendary only from 15th'} (Player Core pg. 92).`) })
            }
            set(ref, next)
        }
    }

    // Additional Lore (Player Core pg. 252), concedido especificamente para Warfare Lore (Battlecry! pg. 68).
    if (warfareLore) {
        const rank = 1 + [3, 7, 15].filter((l) => state.level >= l).length
        set('lore:warfare', Math.max(rank, get('lore:warfare')) as Rank)
    }

    // Aumentos de perícia extras à mão, com aviso.
    for (const [lvl, count] of Object.entries(state.manual.extraSkillIncreases ?? {})) {
        const level = Number(lvl)
        if (level > state.level) continue
        for (let i = 1; i <= count; i++) {
            const key = `skill-increase-${level}-extra-${i}`
            const chosen = choiceSkills(state, key).slice(0, 1)
            slots.push({ key, label: tr(`Aumento extra (nível ${level}, ajuste)`, `Extra increase (level ${level}, adjustment)`), level, count: 1, options: [], kind: 'increase', chosen })
            for (const ref of chosen) set(ref, Math.min(4, get(ref) + 1) as Rank)
        }
        warnings.push({ code: 'MANUAL_SKILL', level: 'info', ref: 'manual', message: tr(`${count} aumento(s) de perícia extra(s) à mão no nível ${level}.`, `${count} extra skill increase(s) by hand at level ${level}.`) }) // i18n-ok: código do aviso
    }

    for (const slot of slots) {
        const missing = slot.count - Math.min(slot.count, slot.chosen.length)
        if (missing > 0) pending.push({ key: slot.key, label: slot.label, level: slot.level, missing })
        if (slot.chosen.length > slot.count) {
            warnings.push({ code: 'SKILL_TOO_MANY', level: 'warn', ref: slot.key, message: tr(`${slot.label}: escolhas a mais foram ignoradas.`, `${slot.label}: extra choices were ignored.`) })
        }
    }
    return {
        result: {
            rank,
            lores: [...lores].filter(([, r]) => r > 0).map(([key, r]) => ({ key, name: loreName(key, loreNames), rank: r })),
        },
        slots,
        automatic,
        languageSlots: Math.max(0, intMod1) + Object.values(intGains).reduce((a, b) => a + b, 0),
    }
}
