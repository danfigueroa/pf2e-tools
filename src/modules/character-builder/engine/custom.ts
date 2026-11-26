/* i18n-ignore-file */
// Conteúdo caseiro do build (`custom:`): o que o catálogo não tem e a ficha da mesa traz — origem legada (Android,
// Fleshwarp), talento de livro não importado (Cognitive Crossover). Vira entrada sintética por cima do índice, para o
// slot contar como preenchido e o retrato levar o nome à Ficha. Efeito nenhum é calculado: só o que o export disse
// (PV, tamanho e deslocamento da ancestralidade) e os traços do slot, para caber nele. O livro conta como o da mesa: a
// ficha já está em jogo, e o aviso de livro não liberado não ajudaria ninguém.
import type { BuildState } from '../types'
import type { RuleEntry } from '../rules/types'
import type { RulesIndex } from './types'

const base = (id: string, name: string, type: string): RuleEntry => ({ id, name, type, source: { id: 'mesa' }, aon: { id }, remaster: true, traits: [] })

/** Traços que fazem o talento caber no slot pela chave (`ancestry-feat-5`, `skill-feat-4`…). */
function slotTraits(key: string, ancestryTraits: string[], className: string | undefined): { traits: string[]; level?: number } {
    const m = /^([a-z]+)-feat-(\d+)$/.exec(key)
    if (!m) return { traits: [] }
    const level = Number(m[2])
    const traits = {
        ancestry: ancestryTraits.slice(0, 1), paragon: ancestryTraits.slice(0, 1), class: className ? [className] : [],
        skill: ['General', 'Skill'], general: ['General'], archetype: ['Archetype'], mythic: ['Mythic'], flexibility: className ? [className] : [],
    }[m[1]] ?? []
    return { traits, level }
}

/** As entradas sintéticas do build (vazia sem conteúdo caseiro). */
export function customEntries(state: BuildState, rules: RulesIndex): RuleEntry[] {
    const out: RuleEntry[] = []
    const o = state.origin
    const c = o.custom
    if (c?.ancestry && o.ancestry?.startsWith('custom:')) {
        // Os aumentos de ancestralidade que o export deu viram livres (o livro não está aqui para dizer quais eram fixos).
        const chosen = state.choices['boosts-ancestry']
        const free = chosen && 'boosts' in chosen ? chosen.boosts.length : 2
        out.push({ ...base(o.ancestry, c.ancestry.name, 'ancestry'), traits: [c.ancestry.name],
            ancestry: { hp: c.ancestry.hp, size: c.ancestry.size, speed: c.ancestry.speed, boosts: Array.from({ length: free }, () => 'free' as const), flaws: [] } })
    }
    const ancestryName = c?.ancestry?.name ?? rules.get(o.ancestry)?.name
    if (c?.heritage && o.heritage?.startsWith('custom:')) out.push({ ...base(o.heritage, c.heritage.name, 'heritage'), heritage: { ancestry: ancestryName } })
    if (c?.background && o.background?.startsWith('custom:')) out.push({ ...base(o.background, c.background.name, 'background'), background: { boosts: [], skills: [] } })
    const ancestryTraits = ancestryName ? [ancestryName] : []
    const className = rules.get(state.class.id)?.name
    for (const [key, choice] of Object.entries(state.choices)) {
        if (!('id' in choice) || !choice.id.startsWith('custom:') || !choice.name) continue
        const { traits, level } = slotTraits(key, ancestryTraits, className)
        out.push({ ...base(choice.id, choice.name, 'feat'), level, traits, unsupported: ['efeitos do talento caseiro'] })
    }
    // Magias caseiras: o nome sai do id; o rank, da lista em que a magia está (repertório e preparadas são por rank).
    const seen = new Set(out.map((e) => e.id))
    const spell = (id: string, rank: number) => {
        if (!id.startsWith('custom:') || seen.has(id) || rules.get(id)) return
        seen.add(id)
        const name = id.slice(7).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        out.push({ ...base(id, name, 'spell'), level: rank, spell: { rank, cantrip: rank === 0, traditions: ['arcane', 'divine', 'occult', 'primal'] }, unsupported: ['magia caseira'] })
    }
    for (const caster of Object.values(state.spellcasting)) {
        for (const byRank of [caster.repertoire, caster.prepared]) for (const [r, ids] of Object.entries(byRank ?? {})) for (const id of ids) spell(id, Number(r) || 0)
        for (const id of [...(caster.spellbook ?? []), ...(caster.signature ?? [])]) spell(id, 1)
    }
    return out
}

/** O índice com as entradas caseiras do build por cima (o mesmo índice, se não há nenhuma). */
export function withCustom(rules: RulesIndex, state: BuildState): RulesIndex {
    const extra = customEntries(state, rules)
    if (!extra.length) return rules
    const byId = new Map(extra.map((e) => [e.id, e]))
    return {
        get: (id) => (id ? byId.get(id) ?? rules.get(id) : undefined),
        byName: (name, type) => rules.byName(name, type) ?? extra.find((e) => e.name.toLowerCase() === name.toLowerCase() && (!type || e.type === type)),
        named: (name) => { const a = rules.named(name); return a.length ? a : extra.filter((e) => e.name.toLowerCase() === name.toLowerCase()) },
        languages: rules.languages,
    }
}
