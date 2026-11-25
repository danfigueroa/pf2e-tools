// Talentos (MOTOR-DE-REGRAS §9–11): o que cada slot recebeu, as validações (avisos, nunca trava) e os efeitos que o
// motor sabe aplicar. Rule elements no formato do Foundry; o subconjunto suportado aqui:
// - FlatModifier sem predicado em PV, PV por nível, deslocamento, Percepção, salvaguardas e perícias (Toughness, Fleet…);
// - ActiveEffectLike "upgrade" de rank em perícia, salvaguarda, Percepção e proficiências (com a escolha do ChoiceSet);
// - ChoiceSet: lista fixa, perícias (`config: skills`) ou talento filtrado (nível, categoria, traço) → slot filho;
// - GrantItem de talento → talento concedido (com os efeitos dele).
// O resto já vem do catálogo em `unsupported` e vira aviso "efeito não calculado".
// Dedicação: "can't select a different dedication feat until you complete your dedication by taking two other feats from
// your current archetype" (Player Core pg. 215).
import { BLOODRAGER, CLASS_ARCHETYPES } from './classArchetypes'
import { tr } from '../../../i18n'
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import { evaluatePrereqs, type PrereqContext, type PrereqPart } from './prereqs'
import { fitsSlot, type FeatKind, type FeatSlot } from './slots'
import { SKILL_KEYS, type Rank, type RulesIndex, type SkillKey, type Warning } from './types'

export interface ChildSlot {
    key: string
    parent: string
    label: string
    level: number
    kind: 'value' | 'skill' | 'feat'
    options?: { value: string; label: string }[]
    /** Talento: filtro lido do ChoiceSet. */
    filter?: { maxLevel?: number; category?: string; traits: string[] }
    chosen?: string
}

export interface TakenFeat {
    slot: string
    level: number
    entry: RuleEntry
    kind: FeatKind | 'granted' | 'child'
    prereq: { result: 'ok' | 'fail' | 'unknown'; parts: PrereqPart[] }
}

export interface Modifiers {
    hp: number
    hpPerLevel: number
    speed: number
    stat: Partial<Record<'perception' | 'fortitude' | 'reflex' | 'will', number>>
    skill: Partial<Record<SkillKey, number>>
    /** Upgrades de rank: alvo → rank (o maior vence). */
    ranks: Record<string, Rank>
    /** Sentidos (`Sense`), deslocamentos extras (`BaseSpeed`) e defesas fixas (`Resistance`/`Weakness`/`Immunity`). */
    senses: string[]
    speeds: Record<string, number>
    resistances: string[]
    weaknesses: string[]
    immunities: string[]
    sources: { label: string; target: string; value: number }[]
}

const STAT_SELECTORS = new Set(['perception', 'fortitude', 'reflex', 'will'])
const UUID_NAME = /^Compendium\.pf2e\.[\w-]+\.Item\.(.+)$/

/** Valor numérico de um rule element: número ou "@actor.level". O resto não é calculado. */
function numeric(value: unknown, level: number): number | null {
    if (typeof value === 'number') return value
    if (value === '@actor.level') return level
    return null
}

/** Caminho do ActiveEffectLike → alvo do motor (`skill:athletics`, `fortitude`, `attack:martial`…). */
function rankTarget(path: string): string | null {
    let m = /^system\.skills\.([a-z-]+)\.rank$/.exec(path)
    if (m) return (SKILL_KEYS as string[]).includes(m[1]) ? `skill:${m[1]}` : `lore:${m[1].replace(/-lore$/, '')}`
    m = /^system\.saves\.(fortitude|reflex|will)\.rank$/.exec(path)
    if (m) return m[1]
    if (path === 'system.perception.rank' || path === 'system.attributes.perception.rank') return 'perception'
    m = /^system\.proficiencies\.(attacks|defenses)\.([a-z-]+)\.rank$/.exec(path)
    if (m) return `${m[1] === 'attacks' ? 'attack' : 'defense'}:${m[2]}`
    m = /^system\.proficiencies\.classDCs?\.[a-z-]+\.rank$/.exec(path)
    if (m) return 'classDC'
    return null
}

const choiceKey = (slot: string, flag: string) => `${slot}/choice:${flag}`

function parseFilter(filter: unknown[]): ChildSlot['filter'] {
    const out: NonNullable<ChildSlot['filter']> = { traits: [] }
    for (const part of filter) {
        if (typeof part !== 'string') continue
        let m = /^item:level:(\d+)$/.exec(part)
        if (m) out.maxLevel = Number(m[1])
        m = /^item:category:([a-z]+)$/.exec(part)
        if (m) out.category = m[1]
        m = /^item:trait:([a-z-]+)$/.exec(part)
        if (m) out.traits.push(m[1])
    }
    return out
}

export interface FeatsOutcome {
    taken: TakenFeat[]
    children: ChildSlot[]
    mods: Modifiers
    /** Nomes (minúsculas) do que o personagem tem: talentos, concedidos e características até o nível atual. */
    has: Set<string>
}

export function compileFeats(state: BuildState, slots: FeatSlot[], rules: RulesIndex, ctx: {
    level: number
    className?: string
    ancestryTraits: string[]
    /** Talentos concedidos por fora (o do background, características de classe), com nível. */
    awarded: { entry: RuleEntry; level: number; source: string }[]
    has: Set<string>
    prereqContext: () => PrereqContext
}, warnings: Warning[]): FeatsOutcome {
    const mods: Modifiers = { hp: 0, hpPerLevel: 0, speed: 0, stat: {}, skill: {}, ranks: {}, sources: [], senses: [], speeds: {}, resistances: [], weaknesses: [], immunities: [] }
    const taken: TakenFeat[] = []
    const children: ChildSlot[] = []
    const has = ctx.has
    const level = ctx.level

    const upgrade = (target: string, value: number) => {
        const rank = Math.max(0, Math.min(4, value)) as Rank
        if ((mods.ranks[target] ?? 0) < rank) mods.ranks[target] = rank
    }

    /** Aplica os rule elements de uma entrada (o slot dá a chave dos filhos). */
    const apply = (entry: RuleEntry, slot: string, slotLevel: number, depth: number) => {
        const selections: Record<string, string> = {}
        for (const rule of entry.rules ?? []) {
            if (rule.situational) continue
            if (rule.key === 'ChoiceSet' && typeof rule.flag === 'string') {
                const key = choiceKey(slot, rule.flag)
                const raw = state.choices[key]
                const chosen = raw && ('value' in raw ? raw.value : 'id' in raw ? raw.id : undefined)
                const child: ChildSlot = { key, parent: slot, label: `${entry.name}: ${tr('escolha', 'choice')}`, level: slotLevel, kind: 'value', chosen }
                if (Array.isArray(rule.choices)) {
                    child.options = (rule.choices as { value?: unknown; label?: unknown }[])
                        .filter((c) => typeof c.value === 'string')
                        .map((c) => ({ value: c.value as string, label: typeof c.label === 'string' ? c.label : (c.value as string) }))
                } else if (rule.choices && typeof rule.choices === 'object') {
                    const spec = rule.choices as { config?: string; filter?: unknown[] }
                    if (spec.config === 'skills') {
                        child.kind = 'skill'
                        child.options = SKILL_KEYS.map((s) => ({ value: s, label: s }))
                    } else if (Array.isArray(spec.filter)) {
                        child.kind = 'feat'
                        child.filter = parseFilter(spec.filter)
                    } else continue
                } else continue
                children.push(child)
                if (chosen) selections[rule.flag] = chosen
                if (chosen && child.kind === 'feat' && depth < 2) {
                    const feat = rules.get(chosen)
                    if (feat) take(feat, key, slotLevel, 'child', depth + 1)
                }
                continue
            }
            if (rule.key === 'GrantItem' && typeof rule.uuid === 'string' && depth < 2) {
                // O Foundry concede automaticamente a dedicação de Bloodrager pelo instinto.
                // Na mesa ela consome o talento de classe do nível 2 (War of Immortals pg. 60).
                if (entry.id === CLASS_ARCHETYPES[BLOODRAGER].subclass && rule.flag === 'bloodragerDedication') continue
                const name = UUID_NAME.exec(rule.uuid)?.[1]
                const granted = name ? rules.byName(name, 'feat') : undefined
                if (granted && !has.has(granted.name.toLowerCase())) take(granted, `${slot}/grant:${granted.aon.id}`, slotLevel, 'granted', depth + 1)
                continue
            }
            if (rule.predicate) continue
            if (rule.key === 'Sense' && typeof rule.selector === 'string') {
                const name = rule.selector.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                const range = numeric(rule.range, level)
                const label = range ? `${name} ${range} ft` : name
                if (!mods.senses.some((x) => x.toLowerCase().startsWith(name.toLowerCase()))) mods.senses.push(label)
                continue
            }
            if (rule.key === 'BaseSpeed' && typeof rule.selector === 'string') {
                const value = numeric(rule.value, level)
                if (value !== null) mods.speeds[rule.selector] = Math.max(mods.speeds[rule.selector] ?? 0, value)
                continue
            }
            if ((rule.key === 'Resistance' || rule.key === 'Weakness' || rule.key === 'Immunity') && typeof rule.type === 'string') {
                const value = rule.key === 'Immunity' ? 0 : numeric(rule.value, level)
                if (value === null) continue
                const list = rule.key === 'Resistance' ? mods.resistances : rule.key === 'Weakness' ? mods.weaknesses : mods.immunities
                list.push(rule.key === 'Immunity' ? rule.type : `${rule.type} ${value}`)
                continue
            }
            if (rule.key === 'FlatModifier' && typeof rule.selector === 'string') {
                const value = numeric(rule.value, level)
                const type = typeof rule.type === 'string' ? rule.type : 'untyped'
                if (value === null || !['untyped', 'item'].includes(type)) continue
                const sel = rule.selector
                if (sel === 'hp') mods.hp += value
                else if (sel === 'hp-per-level') mods.hpPerLevel += value
                else if (sel === 'land-speed' || sel === 'speed') mods.speed += value
                else if (STAT_SELECTORS.has(sel)) mods.stat[sel as 'perception'] = (mods.stat[sel as 'perception'] ?? 0) + value
                else if ((SKILL_KEYS as string[]).includes(sel)) mods.skill[sel as SkillKey] = (mods.skill[sel as SkillKey] ?? 0) + value
                else continue
                mods.sources.push({ label: entry.name, target: sel, value })
                continue
            }
            if (rule.key === 'ActiveEffectLike' && rule.mode === 'upgrade' && typeof rule.path === 'string') {
                // A escolha do ChoiceSet entra no caminho: "system.skills.{…fighterSkill}.rank" ou o caminho inteiro (Canny Acumen).
                const path = rule.path.replace(/\{item\|flags\.system\.rulesSelections\.([\w-]+)\}/g, (_, flag: string) => selections[flag] ?? '?')
                const target = path.includes('?') ? null : rankTarget(path)
                const value = numeric(rule.value, level)
                if (target && value !== null) upgrade(target, value)
            }
        }
    }

    const take = (entry: RuleEntry, slot: string, slotLevel: number, kind: TakenFeat['kind'], depth: number) => {
        const prereq = evaluatePrereqs(entry.prerequisites?.text, ctx.prereqContext())
        taken.push({ slot, level: slotLevel, entry, kind, prereq })
        has.add(entry.name.toLowerCase())
        apply(entry, slot, slotLevel, depth)
    }

    for (const award of ctx.awarded) if (award.level <= level) take(award.entry, `awarded:${award.entry.aon.id}`, award.level, 'granted', 0)

    const seen = new Map<string, string>()
    let openDedication: { name: string; archetype: string; count: number } | null = null
    for (const slot of slots) {
        if (slot.level > level) continue
        const raw = state.choices[slot.key]
        if (!raw || !('id' in raw)) continue
        const entry = rules.get(raw.id)
        if (!entry) {
            warnings.push({ code: 'ENTRY_NOT_FOUND', level: 'error', ref: slot.key, message: tr(`${slot.label} ${slot.level}: talento fora do catálogo atual (${raw.id}).`, `${slot.label} ${slot.level}: feat not in the current catalog (${raw.id}).`) })
            continue
        }
        const cap = slot.maxLevel ?? slot.level
        if ((entry.level ?? 0) > cap) {
            warnings.push({ code: 'LEVEL_TOO_LOW', level: 'warn', ref: slot.key, message: tr(`${entry.name} é de nível ${entry.level}, acima do limite do slot (${cap}).`, `${entry.name} is level ${entry.level}, above the slot limit (${cap}).`) })
        }
        if (!fitsSlot(entry, slot.kind, { className: ctx.className, ancestryTraits: ctx.ancestryTraits })) {
            warnings.push({ code: 'WRONG_SLOT', level: 'warn', ref: slot.key, message: tr(`${entry.name} não é ${slot.label.toLowerCase()}.`, `${entry.name} is not a ${slot.label.toLowerCase()}.`) })
        }
        const before = seen.get(entry.id)
        if (before && !/\b(special|more than once|multiple times)\b/i.test(entry.summary ?? '')) {
            warnings.push({ code: 'DUPLICATE_FEAT', level: 'info', ref: slot.key, message: tr(`${entry.name} já foi escolhido (${before}); confira se pode repetir.`, `${entry.name} was already chosen (${before}); check that it can repeat.`) })
        }
        seen.set(entry.id, `${slot.label} ${slot.level}`)
        // Dedicação: outra só depois de mais dois talentos do arquétipo atual.
        const traits = (entry.traits ?? []).map((t) => t.toLowerCase())
        const archetype = entry.feat?.archetype?.[0]
        if (traits.includes('dedication')) {
            if (openDedication && openDedication.count < 2) {
                warnings.push({ code: 'DEDICATION_LOCK', level: 'warn', ref: slot.key, message: tr(`${entry.name}: antes de outra dedicação, faltam ${2 - openDedication.count} talento(s) de ${openDedication.name} (Player Core pg. 215).`, `${entry.name}: before another dedication, ${2 - openDedication.count} more ${openDedication.name} feat(s) are needed (Player Core pg. 215).`) })
            }
            openDedication = { name: entry.name, archetype: archetype ?? entry.name.replace(/ Dedication$/i, ''), count: 0 }
        } else if (openDedication && archetype && archetype.toLowerCase() === openDedication.archetype.toLowerCase()) {
            openDedication.count++
        }
        take(entry, slot.key, slot.level, slot.kind, 0)
    }

    for (const feat of taken) {
        for (const part of feat.prereq.parts) {
            if (part.result === 'fail') warnings.push({ code: 'PREREQ_FAIL', level: 'warn', ref: feat.slot, message: tr(`${feat.entry.name}: ${part.reason ?? part.text}.`, `${feat.entry.name}: ${part.reason ?? part.text}.`) })
            else if (part.result === 'unknown') warnings.push({ code: 'PREREQ_UNKNOWN', level: 'info', ref: feat.slot, message: tr(`${feat.entry.name}: confira o pré-requisito "${part.text}".`, `${feat.entry.name}: check the prerequisite "${part.text}".`) })
        }
        for (const effect of feat.entry.unsupported ?? []) {
            warnings.push({ code: 'UNSUPPORTED_EFFECT', level: 'info', ref: feat.slot, message: tr(`Efeito não calculado: ${feat.entry.name} (${effect}).`, `Effect not calculated: ${feat.entry.name} (${effect}).`) })
        }
    }
    return { taken, children, mods, has }
}
