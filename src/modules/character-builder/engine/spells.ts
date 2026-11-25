// Magias (MOTOR-DE-REGRAS §8). Regras e dados conferidos na AON:
// - Conjuração da classe (tradições, tipo, atributo) derivada do texto de cada classe (`class.casting`).
// - Magias por dia: tabela de cada classe gerada da AON por `fetch-rules-tables.mjs` (`core/tables` → `spellSlots`).
// - CD de magia = 10 + proficiência + atributo; ataque = proficiência + atributo (Player Core pg. 298, "Spell Attack Modifier
//   and Spell DC", com a proficiência de Player Core pg. 11).
// - Foco (Player Core pg. 298): pool = número de magias de foco que gastam ponto, até 3; truques de foco não contam.
//   Magias de foco e truques são elevados à metade do nível, arredondada para cima.
import { tr } from '../../../i18n'
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import type { AttributeKey, Pending, Rank, Warning } from './types'

export type Tradition = 'arcane' | 'divine' | 'occult' | 'primal'

export interface SpellSlotTable {
    classes: Record<string, { source?: string; maxRank?: number; perDay: Record<string, (number | number[])[]> }>
    archetype?: ArchetypeSlotTable
}

export interface Caster {
    key: string
    name: string
    tradition: Tradition | null
    type: 'prepared' | 'spontaneous'
    attribute: AttributeKey
    rank: Rank
    /** Magias por dia do rank 0 (truques) ao 10. */
    perDay: number[]
    dc: number
    attack: number
    /** Preparado de grimório (Wizard, Magus…): tem grimório além das preparadas. */
    spellbook: boolean
    source?: string
}

export interface FocusInfo {
    spells: RuleEntry[]
    cantrips: RuleEntry[]
    points: number
    /** Rank em que magias de foco e truques são lançados. */
    heightened: number
}

const TRADITIONS: Tradition[] = ['arcane', 'divine', 'occult', 'primal']

/** Classes cujo preparado sai de um grimório (o texto da classe fala em "spellbook"). Dado conferido no texto da AON. */
const SPELLBOOK_CLASSES = new Set(['wizard', 'magus'])

export function compileCasters(state: BuildState, cls: RuleEntry | undefined, ctx: {
    level: number
    keyAttribute: AttributeKey | null
    mod: Record<AttributeKey, number>
    spellRank: Rank
    table?: SpellSlotTable
}, pending: Pending[], warnings: Warning[], used: Set<string>): Caster[] {
    const casting = cls?.class?.casting
    if (!cls || !casting) return []
    const row = ctx.table?.classes[cls.name]
    if (casting.type === 'mixed' || !casting.type) {
        warnings.push({ code: 'UNSUPPORTED_CASTING', level: 'info', ref: 'spells', message: tr(`Conjuração de ${cls.name} ainda não calculada (preparado e repertório juntos).`, `${cls.name} spellcasting is not calculated yet (prepared and repertoire together).`) })
        return []
    }
    if (!row) {
        warnings.push({ code: 'UNSUPPORTED_CASTING', level: 'info', ref: 'spells', message: tr(`Sem tabela de magias por dia para ${cls.name}.`, `No spell slot table for ${cls.name}.`) })
        return []
    }
    // Mais de uma tradição: a da subclasse (linhagem, patrono, eidolon). O jogador escolhe; o motor não deduz.
    let tradition: Tradition | null = casting.traditions.length === 1 ? casting.traditions[0] as Tradition : null
    if (!tradition) {
        const key = 'spell-tradition'
        used.add(key)
        const raw = state.choices[key]
        const chosen = raw && 'value' in raw && (TRADITIONS as string[]).includes(raw.value) ? raw.value as Tradition : null
        if (chosen) tradition = chosen
        else pending.push({ key, label: tr('Tradição das magias (pela subclasse)', 'Spell tradition (from the subclass)'), level: 1, missing: 1 })
    }
    const attribute = casting.attribute ?? ctx.keyAttribute ?? 'int'
    // Sempre do rank 0 ao 10 (a tabela do Magus e do Summoner para no 9).
    const perDay = Array.from({ length: 11 }, (_, r) => {
        const n = row.perDay[String(ctx.level)]?.[r] ?? 0
        return Array.isArray(n) ? n[0] : n
    })
    const bonus = state.spellcasting.class?.bonusSlots ?? {}
    for (const [rank, extra] of Object.entries(bonus)) perDay[Number(rank)] = (perDay[Number(rank)] ?? 0) + extra
    const prof = ctx.spellRank > 0 ? ctx.level + 2 * ctx.spellRank : 0
    return [{
        key: 'class', name: cls.name, tradition, type: casting.type, attribute, rank: ctx.spellRank, perDay,
        dc: 10 + prof + ctx.mod[attribute], attack: prof + ctx.mod[attribute],
        spellbook: casting.type === 'prepared' && SPELLBOOK_CLASSES.has(cls.name.toLowerCase()), source: row.source,
    }]
}

/** Escolhas de magia por conjurador: avisos de contagem e de tradição/rank. */
export function checkSpellChoices(state: BuildState, casters: Caster[], spells: (id: string) => RuleEntry | undefined,
    pending: Pending[], warnings: Warning[], level = 1) {
    for (const caster of casters) {
        const choices = state.spellcasting[caster.key] ?? {}
        const lists = caster.type === 'spontaneous' ? choices.repertoire ?? {} : choices.prepared ?? {}
        for (let rank = 0; rank <= 10; rank++) {
            const slots = caster.perDay[rank] ?? 0
            const chosen = lists[String(rank)] ?? []
            // Preparado: uma magia por espaço. Espontâneo: o tamanho do repertório varia por classe e não está na tabela.
            if (caster.type === 'prepared' && slots > chosen.length) {
                pending.push({ key: `spells:${caster.key}:${rank}`, label: tr(`${caster.name}: magias de rank ${rank}`, `${caster.name}: rank ${rank} spells`), level, missing: slots - chosen.length })
            }
            for (const id of chosen) {
                const spell = spells(id)
                if (!spell) continue
                const sr = spell.spell?.rank ?? spell.level ?? 0
                const cantrip = spell.spell?.cantrip ?? false
                if ((rank === 0) !== cantrip || (rank > 0 && sr > rank)) {
                    warnings.push({ code: 'SPELL_RANK', level: 'warn', ref: `spells:${caster.key}:${rank}`, message: tr(`${spell.name} não cabe no rank ${rank}.`, `${spell.name} does not fit rank ${rank}.`) })
                }
                // A AON grava as tradições com inicial maiúscula ("Arcane").
                if (caster.tradition && !(spell.spell?.traditions ?? []).some((t) => t.toLowerCase() === caster.tradition)) {
                    warnings.push({ code: 'SPELL_TRADITION', level: 'warn', ref: `spells:${caster.key}:${rank}`, message: tr(`${spell.name} não é da tradição ${caster.tradition}.`, `${spell.name} is not on the ${caster.tradition} list.`) })
                }
            }
        }
        if (caster.type === 'spontaneous') {
            warnings.push({ code: 'REPERTOIRE_SIZE', level: 'info', ref: `spells:${caster.key}`, message: tr(`${caster.name}: o tamanho do repertório por rank ainda não é conferido (veja a tabela da classe).`, `${caster.name}: repertoire size per rank is not checked yet (see the class table).`) })
        }
    }
}

/** Foco: as magias de foco concedidas (pelo GrantItem de talentos e características) e o pool (Player Core pg. 298). */
export function compileFocus(granted: RuleEntry[], level: number): FocusInfo {
    const unique = [...new Map(granted.filter((s) => s.spell?.focus || (s.traits ?? []).includes('Focus')).map((s) => [s.id, s])).values()]
    const cantrips = unique.filter((s) => s.spell?.cantrip || (s.traits ?? []).includes('Cantrip'))
    const spells = unique.filter((s) => !cantrips.includes(s))
    return { spells, cantrips, points: Math.min(3, spells.length), heightened: Math.ceil(level / 2) }
}

/** Tabela de arquétipo (Player Core pg. 215): nível → rank do espaço, por patamar (Basic, Expert, Master). */
export interface ArchetypeSlotTable { basic?: Record<string, number>; expert?: Record<string, number>; master?: Record<string, number> }

/**
 * Conjuradores de arquétipo (Player Core pg. 215): a dedicação dá os truques, a tradição e o atributo (texto da AON,
 * `feat.casting`); Basic/Expert/Master <Classe> Spellcasting dão os espaços da tabela e perito/mestre.
 */
export function compileArchetypeCasters(state: BuildState, taken: { entry: RuleEntry }[], ctx: {
    level: number
    mod: Record<AttributeKey, number>
    keyAttribute: AttributeKey | null
    table?: ArchetypeSlotTable
    classByName: (name: string) => RuleEntry | undefined
}, pending: Pending[], warnings: Warning[], used: Set<string>): Caster[] {
    const names = new Set(taken.map((t) => t.entry.name.toLowerCase()))
    const out: Caster[] = []
    for (const { entry } of taken) {
        const casting = entry.feat?.casting
        if (!casting?.type || !casting.className) continue
        const cls = casting.className
        const slug = cls.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const key = `archetype:${slug}`
        let tradition = (casting.tradition as Tradition | undefined) ?? null
        if (!tradition) {
            const options = ctx.classByName(cls)?.class?.casting?.traditions ?? []
            if (options.length === 1) tradition = options[0] as Tradition
            else {
                const choiceKey = `spell-tradition-${slug}`
                used.add(choiceKey)
                const raw = state.choices[choiceKey]
                if (raw && 'value' in raw && (TRADITIONS as string[]).includes(raw.value)) tradition = raw.value as Tradition
                else pending.push({ key: choiceKey, label: tr(`Tradição do arquétipo ${cls}`, `${cls} archetype tradition`), level: 1, missing: 1 })
            }
        }
        const attribute = casting.attribute ?? ctx.keyAttribute ?? 'cha'
        if (!casting.attribute) warnings.push({ code: 'ARCHETYPE_ATTRIBUTE', level: 'info', ref: 'spells', message: tr(`${cls} (arquétipo): atributo de conjuração assumido como o atributo-chave; confira.`, `${cls} (archetype): spellcasting attribute assumed to be the key attribute; check it.`) })
        const tiers: [keyof ArchetypeSlotTable, string][] = [['basic', `basic ${cls} spellcasting`], ['expert', `expert ${cls} spellcasting`], ['master', `master ${cls} spellcasting`]]
        const perDay = Array.from({ length: 11 }, () => 0)
        perDay[0] = casting.cantrips ?? 0
        let rank: Rank = 1
        for (const [tier, featName] of tiers) {
            if (!names.has(featName.toLowerCase())) continue
            if (tier === 'expert') rank = Math.max(rank, 2) as Rank
            if (tier === 'master') rank = Math.max(rank, 3) as Rank
            for (const [lvl, r] of Object.entries(ctx.table?.[tier] ?? {})) if (Number(lvl) <= ctx.level) perDay[r] = Math.max(perDay[r], 1)
        }
        const prof = ctx.level + 2 * rank
        out.push({
            key, name: `Archetype ${cls}`, tradition, type: casting.type, attribute, rank, perDay,
            dc: 10 + prof + ctx.mod[attribute], attack: prof + ctx.mod[attribute],
            spellbook: casting.type === 'prepared' && SPELLBOOK_CLASSES.has(cls.toLowerCase()), source: 'Player Core pg. 215',
        })
    }
    return out
}
