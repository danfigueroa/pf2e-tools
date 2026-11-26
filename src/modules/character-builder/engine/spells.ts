// Magias (MOTOR-DE-REGRAS §8). Regras e dados conferidos na AON:
// - Conjuração da classe (tradições, tipo, atributo) derivada do texto de cada classe (`class.casting`).
// - Magias por dia: tabela de cada classe gerada da AON por `fetch-rules-tables.mjs` (`core/tables` → `spellSlots`).
// - CD de magia = 10 + proficiência + atributo; ataque = proficiência + atributo (Player Core pg. 298, "Spell Attack Modifier
//   and Spell DC", com a proficiência de Player Core pg. 11).
// - Foco (Player Core pg. 298): pool = número de magias de foco que gastam ponto, até 3; truques de foco não contam.
//   Magias de foco e truques são elevados à metade do nível, arredondada para cima.
import { BLOODRAGER, CLASS_ARCHETYPES } from './classArchetypes'
import { FOCUS_GRANTS } from './focusGrants.gen'
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
    /** Como o conjurador conhece as magias que prepara ou lança (só a classe; arquétipo fica sem). */
    known?: KnownSpells
}

/**
 * Magias conhecidas, pela regra de cada classe (texto da AON):
 * - `list`: prepara de todas as comuns da lista da tradição (Cleric, Druid);
 * - `book`: prepara do que guardou num grimório, familiar ou dirge, que cresce duas magias por nível;
 * - `repertoire`: lança do repertório, uma magia por espaço da tabela em cada rank.
 */
export interface KnownSpells {
    kind: 'list' | 'book' | 'repertoire'
    /** Onde as magias ficam: "Grimório", "Familiar", "Dirge", "Repertório", "Lista divina". */
    name: string
    source: string
    /** Livro: truques e magias com rank que a regra dá até o nível atual (sem os extras da subclasse). */
    cantrips?: number
    spells?: number
    /** Repertório: quantas por rank (= espaços da tabela, sem bônus de item ou talento). */
    perRank?: number[]
    /** O que a regra soma por fora e o app não conta (currículo, linhagem, mente consciente). */
    note?: string
}

/** Livros: truques e magias de 1º rank no 1º nível; depois, duas magias por nível de qualquer rank com espaço. */
const BOOKS: Record<string, { name: string; source: string; cantrips: number; spells: number; note?: string }> = {
    // Player Core pg. 192, "Spellbook": 10 truques e cinco de 1º rank, mais duas do currículo da escola.
    wizard: { name: tr('Grimório', 'Spellbook'), source: 'Player Core pg. 192', cantrips: 10, spells: 5,
        note: tr('Mais as magias do currículo da escola (duas no 1º nível e uma a cada rank novo), fora desta conta.', 'Plus your school\'s curriculum spells (two at 1st level and one per new rank), outside this count.') },
    // Impossible Magic pg. 9, "Spellbook": oito truques e cinco de 1º rank.
    magus: { name: tr('Grimório', 'Spellbook'), source: 'Impossible Magic pg. 9', cantrips: 8, spells: 5 },
    // Player Core pg. 178, "Familiar": 10 truques, cinco de 1º rank e uma da lição inicial do patrono.
    witch: { name: tr('Familiar', 'Familiar'), source: 'Player Core pg. 178', cantrips: 10, spells: 5,
        note: tr('Mais a magia da lição inicial do patrono e as de talentos, fora desta conta.', 'Plus the spell from your patron\'s initial lesson and any from feats, outside this count.') },
    // Impossible Magic pg. 27, "Dirge": oito truques, Harm e quatro outras de 1º rank.
    necromancer: { name: tr('Dirge', 'Dirge'), source: 'Impossible Magic pg. 27', cantrips: 8, spells: 5,
        note: tr('As cinco de 1º rank incluem Harm, que a dirge sempre tem.', 'The five 1st-rank spells include harm, which the dirge always has.') },
}

/** Prepara de toda a lista comum da tradição (Player Core pg. 108 e 122, "Spellcasting"). */
const WHOLE_LIST: Record<string, string> = { cleric: 'Player Core pg. 108', druid: 'Player Core pg. 122' }

/** O que o repertório soma por fora da tabela (texto de "Spell Repertoire" de cada classe). */
const REPERTOIRE_NOTE: Record<string, string> = {
    sorcerer: tr('Em cada rank novo, a primeira magia é a da linhagem (Player Core 2 pg. 144).', 'At each new rank, the first spell is your bloodline\'s (Player Core 2 pg. 144).'),
    psychic: tr('A mente consciente soma magias ao repertório, fora desta conta (Dark Archive pg. 9).', 'Your conscious mind adds spells to the repertoire, outside this count (Dark Archive pg. 9).'),
}

const TRADITION_LIST: Record<Tradition, string> = {
    arcane: tr('Lista arcana', 'Arcane list'), divine: tr('Lista divina', 'Divine list'), occult: tr('Lista oculta', 'Occult list'), primal: tr('Lista primal', 'Primal list'),
}

function knownSpells(cls: RuleEntry, type: 'prepared' | 'spontaneous', tradition: Tradition | null, perDay: number[], level: number, source?: string): KnownSpells | undefined {
    const slug = cls.name.toLowerCase()
    if (type === 'spontaneous') {
        return { kind: 'repertoire', name: tr('Repertório', 'Repertoire'), source: source ?? '', perRank: [...perDay], note: REPERTOIRE_NOTE[slug] }
    }
    const book = BOOKS[slug]
    if (book) return { kind: 'book', name: book.name, source: book.source, cantrips: book.cantrips, spells: book.spells + 2 * Math.max(0, level - 1), note: book.note }
    if (WHOLE_LIST[slug]) return { kind: 'list', name: tradition ? TRADITION_LIST[tradition] : tr('Lista da tradição', 'Tradition list'), source: WHOLE_LIST[slug] }
    return undefined
}

export interface FocusInfo {
    spells: RuleEntry[]
    cantrips: RuleEntry[]
    points: number
    /** Rank em que magias de foco e truques são lançados. */
    heightened: number
    /** As que vêm sozinhas (característica, subclasse, talento), com o nome de quem concede. */
    granted: { id: string; from: string }[]
    /** Concessões com escolha ("your choice of X or Y"): a aba Magias pergunta. */
    choices: FocusChoice[]
}

export interface FocusChoice {
    key: string
    from: string
    level: number
    options: string[]
    chosen?: string
}

/**
 * Talentos que sobem o degrau da magia da subclasse (texto da AON): "You gain the advanced bloodline spell associated
 * with your bloodline" (Advanced Bloodline, feat-6099), Greater Bloodline (feat-6108), Advanced Revelation (feat-6063),
 * Greater Revelation (feat-6076) e Advanced School Spell (feat-5036).
 */
const TIER_FEATS: Record<string, 'advanced' | 'greater'> = {
    'feat-6099': 'advanced', 'feat-6108': 'greater', 'feat-6063': 'advanced', 'feat-6076': 'greater', 'feat-5036': 'advanced',
}

/**
 * Magias de foco concedidas, pela tabela lida do texto da AON (`focusGrants.gen.ts`, de `fetch-focus-grants.mjs`): as
 * características de classe até o nível, a subclasse escolhida (inicial, e avançada/maior com o talento que a sobe) e os
 * talentos. Concessão com escolha vira pendência `focus-choice:<aon_id>`. Id fora das listas carregadas vai para
 * `missing`, que o carregador busca e recompila.
 */
export function focusGrants(state: BuildState, sources: { aon?: string; name: string; level: number; subclass?: boolean }[], level: number,
    rules: (id: string) => RuleEntry | undefined, pending: Pending[], used: Set<string>, missing: Set<string>) {
    const granted: { id: string; from: string }[] = []
    const choices: FocusChoice[] = []
    const taken = new Set(sources.map((s) => s.aon))
    const tiers = new Set(Object.entries(TIER_FEATS).filter(([id]) => taken.has(id)).map(([, tier]) => tier))
    const add = (id: string, from: string) => {
        if (!rules(id)) missing.add(id)
        if (!granted.some((g) => g.id === id)) granted.push({ id, from })
    }
    for (const { aon, name, level: at, subclass } of sources) {
        const g = aon ? FOCUS_GRANTS[aon] : undefined
        if (!g || at > level) continue
        const reached = (id: string) => (g.atLevel?.[id] ?? 0) <= level
        for (const id of g.initial ?? []) if (reached(id)) add(id, name)
        if (subclass) for (const tier of tiers) for (const id of g[tier] ?? []) add(id, name)
        if (g.choice?.length) {
            const key = `focus-choice:${aon}`
            used.add(key)
            const raw = state.choices[key]
            const chosen = raw && 'id' in raw && g.choice.includes(raw.id) ? raw.id : undefined
            for (const id of g.choice) if (!rules(id)) missing.add(id)
            choices.push({ key, from: name, level: at, options: g.choice, chosen })
            if (chosen) add(chosen, name)
            else pending.push({ key, label: tr(`Magia de foco: ${name}`, `Focus spell: ${name}`), level: at, missing: 1 })
        }
    }
    return { granted, choices }
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
    const known = knownSpells(cls, casting.type, tradition, perDay, ctx.level, row.source)
    const bonus = state.spellcasting.class?.bonusSlots ?? {}
    for (const [rank, extra] of Object.entries(bonus)) perDay[Number(rank)] = (perDay[Number(rank)] ?? 0) + extra
    const prof = ctx.spellRank > 0 ? ctx.level + 2 * ctx.spellRank : 0
    return [{
        key: 'class', name: cls.name, tradition, type: casting.type, attribute, rank: ctx.spellRank, perDay,
        dc: 10 + prof + ctx.mod[attribute], attack: prof + ctx.mod[attribute],
        spellbook: casting.type === 'prepared' && SPELLBOOK_CLASSES.has(cls.name.toLowerCase()), source: row.source, known,
    }]
}

/**
 * O que a elevação dá no rank conjurado (Player Core pg. 297, "Heightened Spells"): "Heightened (+N)" ganha a cada N
 * ranks acima do rank base; "Heightened (3rd)" só a partir daquele rank. O rank da magia sobe com o espaço de qualquer
 * jeito (conta para contra-atacar), então espaço sem ganho é permitido: vira aviso, não trava.
 */
export function heightenGain(spell: RuleEntry, rank: number): { gains: boolean; next?: number } | null {
    const base = spell.spell?.rank ?? spell.level ?? 1
    const entries = spell.spell?.heighten ?? []
    if (spell.spell?.cantrip || rank <= base || !entries.length) return null
    const steps = entries.flatMap((h) => { const m = /^\+(\d+)$/.exec(h); return m ? [Number(m[1])] : [] })
    const fixed = entries.flatMap((h) => { const m = /^(\d+)(?:st|nd|rd|th)$/.exec(h); return m ? [Number(m[1])] : [] })
    const gains = steps.some((n) => rank - base >= n) || fixed.some((r) => r <= rank)
    const nexts = [...steps.map((n) => base + n * (Math.floor((rank - base) / n) + 1)), ...fixed.filter((r) => r > rank)].filter((r) => r <= 10)
    return { gains, next: nexts.length ? Math.min(...nexts) : undefined }
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
                // Rank 1 com Heightened (+2) num espaço de rank 2: vale (o rank sobe), mas ainda sem o ganho da elevação.
                const gain = heightenGain(spell, rank)
                if (gain && !gain.gains) {
                    warnings.push({ code: 'HEIGHTEN_NO_GAIN', level: 'info', ref: `spells:${caster.key}:${rank}`, message: tr(
                        `${spell.name} no rank ${rank} não ganha nada da elevação${gain.next ? ` (o próximo ganho é no rank ${gain.next})` : ''}; o rank da magia sobe mesmo assim (Player Core pg. 297).`,
                        `${spell.name} at rank ${rank} gets nothing from heightening${gain.next ? ` (the next benefit is at rank ${gain.next})` : ''}; the spell's rank still rises (Player Core pg. 297).`) })
                }
                if (caster.tradition && !(spell.spell?.traditions ?? []).some((t) => t.toLowerCase() === caster.tradition)) {
                    warnings.push({ code: 'SPELL_TRADITION', level: 'warn', ref: `spells:${caster.key}:${rank}`, message: tr(`${spell.name} não é da tradição ${caster.tradition}.`, `${spell.name} is not on the ${caster.tradition} list.`) })
                }
            }
        }
        if (caster.key === 'archetype:bloodrager') {
            const cantrips = lists['0'] ?? []
            if (cantrips.length < 2) pending.push({ key: 'spells:archetype:bloodrager:0', label: tr('Truques de Bloodrager', 'Bloodrager cantrips'), level: 2, missing: 2 - cantrips.length })
            if (cantrips.length > 2 || !cantrips.some((id) => spells(id)?.traits?.includes('Attack'))) {
                warnings.push({ code: 'BLOODRAGER_CANTRIPS', level: 'warn', ref: 'spells', message: tr(
                    'Escolha dois truques de Bloodrager e confira se pelo menos um exige uma rolagem de ataque de magia.',
                    'Choose two Bloodrager cantrips and check that at least one requires a spell attack roll.') })
            }
        } else if (caster.type === 'spontaneous' && caster.known?.perRank) {
            // Uma magia no repertório por espaço da tabela (Spell Repertoire de cada classe). A mais é aviso, não trava:
            // talentos e a subclasse também somam magias ao repertório.
            for (let rank = 0; rank <= 10; rank++) {
                const want = caster.known.perRank[rank] ?? 0
                const have = (lists[String(rank)] ?? []).length
                if (have > want) warnings.push({ code: 'REPERTOIRE_SIZE', level: 'info', ref: `spells:${caster.key}:${rank}`, message: tr(`${caster.name}: ${have} magias de rank ${rank} no repertório; a tabela dá ${want}. Confira se o resto vem de talento ou da subclasse.`, `${caster.name}: ${have} rank ${rank} spells in the repertoire; the table gives ${want}. Check that the rest come from a feat or the subclass.`) })
            }
        } else if (caster.type === 'spontaneous') {
            warnings.push({ code: 'REPERTOIRE_SIZE', level: 'info', ref: `spells:${caster.key}`, message: tr(`${caster.name}: o tamanho do repertório por rank ainda não é conferido (veja a tabela da classe).`, `${caster.name}: repertoire size per rank is not checked yet (see the class table).`) })
        }
        if (caster.known?.kind === 'book') {
            const book = choices.spellbook ?? []
            const cantrips = book.filter((id) => spells(id)?.spell?.cantrip).length
            const leveled = book.length - cantrips
            if (cantrips > (caster.known.cantrips ?? 0) || leveled > (caster.known.spells ?? 0)) {
                warnings.push({ code: 'SPELLBOOK_SIZE', level: 'info', ref: `spells:${caster.key}`, message: tr(
                    `${caster.known.name}: ${cantrips} truques e ${leveled} magias; a regra dá ${caster.known.cantrips} e ${caster.known.spells}. O resto precisa vir de Aprender Magia, talento ou subclasse.`,
                    `${caster.known.name}: ${cantrips} cantrips and ${leveled} spells; the rule gives ${caster.known.cantrips} and ${caster.known.spells}. The rest must come from Learn a Spell, a feat or the subclass.`) })
            }
        }
    }
}

/** Foco: as magias de foco concedidas (pelo GrantItem de talentos e características) e o pool (Player Core pg. 298). */
export function compileFocus(granted: RuleEntry[], level: number): FocusInfo {
    const unique = [...new Map(granted.filter((s) => s.spell?.focus || (s.traits ?? []).includes('Focus')).map((s) => [s.id, s])).values()]
    const cantrips = unique.filter((s) => s.spell?.cantrip || (s.traits ?? []).includes('Cantrip'))
    const spells = unique.filter((s) => !cantrips.includes(s))
    return { spells, cantrips, points: Math.min(3, spells.length), heightened: Math.ceil(level / 2), granted: [], choices: [] }
}

/** Tabela de arquétipo (Player Core pg. 215): nível → rank do espaço, por patamar (Basic, Expert, Master). */
export interface ArchetypeSlotTable { basic?: Record<string, number>; expert?: Record<string, number>; master?: Record<string, number> }

/**
 * Conjuradores de arquétipo (Player Core pg. 215): a dedicação dá os truques, a tradição e o atributo (texto da AON,
 * `feat.casting`); Basic/Expert/Master <Classe> Spellcasting dão os espaços da tabela e perito/mestre.
 */
export function compileArchetypeCasters(state: BuildState, taken: { entry: RuleEntry; slot: string }[], ctx: {
    classArchetype?: string
    level: number
    mod: Record<AttributeKey, number>
    keyAttribute: AttributeKey | null
    table?: ArchetypeSlotTable
    classByName: (name: string) => RuleEntry | undefined
}, pending: Pending[], warnings: Warning[], used: Set<string>): Caster[] {
    const names = new Set(taken.map((t) => t.entry.name.toLowerCase()))
    const out: Caster[] = []
    const takenIds = new Set(taken.map((t) => t.entry.id))
    for (const { entry, slot } of taken) {
        // War of Immortals pp. 60–61: a escolha de tradição da dedicação também dá o treino da perícia.
        const bloodrager = ctx.classArchetype === BLOODRAGER && entry.id === CLASS_ARCHETYPES[BLOODRAGER].dedication
        const casting = bloodrager
            ? { className: 'Bloodrager', type: 'spontaneous' as const, attribute: 'cha' as const, cantrips: 2, tradition: undefined }
            : entry.feat?.casting
        if (!casting?.type || !casting.className) continue
        const cls = casting.className
        const slug = cls.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const key = `archetype:${slug}`
        let tradition = (casting.tradition as Tradition | undefined) ?? null
        if (bloodrager) {
            const skill = state.choices[`${slot}/choice:skill`]
            if (skill && 'value' in skill) tradition = skill.value === 'arcana' ? 'arcane' : skill.value === 'religion' ? 'divine' : null
        } else if (!tradition) {
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
        const tiers = ['basic', 'expert', 'master'] as const
        const bloodMagic = { basic: 'feat:feat-7241', expert: 'feat:feat-7245', master: 'feat:feat-7246' }
        const perDay = Array.from({ length: 11 }, () => 0)
        perDay[0] = casting.cantrips ?? 0
        let rank: Rank = 1
        for (const tier of tiers) {
            const hasTier = bloodrager ? takenIds.has(bloodMagic[tier]) : names.has(`${tier} ${cls.toLowerCase()} spellcasting`)
            if (!hasTier) continue
            if (tier === 'expert') rank = Math.max(rank, 2) as Rank
            if (tier === 'master') rank = Math.max(rank, 3) as Rank
            for (const [lvl, r] of Object.entries(ctx.table?.[tier] ?? {})) if (Number(lvl) <= ctx.level) perDay[r] = Math.max(perDay[r], 1)
        }
        if (bloodrager && takenIds.has(bloodMagic.master)) {
            for (let r = 1; r < perDay.length; r++) if (perDay[r]) perDay[r]++
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
