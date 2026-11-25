/* i18n-ignore-file */
import type { BuildState, Choice, MesaRules } from './types'
import type { RuleEntry } from './rules/types'
import { allowsLegacyBook } from './mesaRules'

export interface RemasterTarget {
    id: string
    name: string
    source: RuleEntry['source']
    rarity?: string
    list?: string
}
export interface RemasterLink {
    id: string
    name: string
    list?: string
    targets: RemasterTarget[]
}

/** O pacote anterior guardava apenas o primeiro legacy_id do sucessor. Confira o tipo nativo antes de usá-lo. */
function previousId(entry: RuleEntry): string | undefined {
    if (!entry.remaster || !entry.replaces || !entry.aon.id || entry.source.id === 'mesa') return undefined
    const prefix = entry.aon.id.replace(/-\d+$/, '')
    if (entry.replaces.replace(/-\d+$/, '') !== prefix) return undefined
    return entry.id.split(':')[0] + ':' + entry.replaces
}

export function legacyLinks(entries: RuleEntry[]): RemasterLink[] {
    const byId = new Map(entries.map((e) => [e.id, e]))
    const links = new Map<string, RemasterLink>()
    for (const entry of byId.values()) {
        const id = previousId(entry)
        if (!id) continue
        const old = byId.get(id)
        if (old && (old.remaster || old.type !== entry.type)) continue
        const row = links.get(id) ?? { id, name: old?.name ?? entry.legacyNames?.[0] ?? id, targets: [] }
        row.targets.push(entry)
        links.set(id, row)
    }
    return [...links.values()]
}

export function pickerEditions(entries: RuleEntry[], rules: MesaRules | null, exceptions?: ReadonlySet<string>): RuleEntry[] {
    const replaced = new Set(legacyLinks(entries).map((row) => row.id))
    return entries.filter((e) => e.remaster || e.source.id === 'mesa' ||
        (!e.superseded && !replaced.has(e.id) && (exceptions?.has(e.id) || (rules && allowsLegacyBook(rules, e.source.id)))))
}

/** Percorra só campos de referência. Chaves de instância, qualificadores, texto livre e histórico são do jogador. */
function visitRuleIds(state: BuildState, visit: (id: string) => string | undefined) {
    function field<K extends string>(owner: Partial<Record<K, string>>, key: K) {
        const id = owner[key]
        if (!id) return
        const next = visit(id)
        if (next && next !== id) owner[key] = next
    }

    const choices = (values: Record<string, Choice>) => {
        for (const choice of Object.values(values)) if ('id' in choice) field(choice, 'id')
    }
    const list = (ids?: string[], repeats = false) => {
        if (!ids) return
        const mapped = ids.map((id) => visit(id) ?? id)
        if (mapped.some((id, i) => id !== ids[i])) ids.splice(0, ids.length, ...(repeats ? mapped : new Set(mapped)))
    }
    for (const key of ['ancestry', 'heritage', 'background', 'deity'] as const) {
        field(state.origin, key)
    }
    list(state.origin.languages)
    field(state.class, 'id')
    field(state.class, 'dual')
    choices(state.choices)
    for (const item of state.inventory) {
        field(item, 'item')
        if (item.material) field(item.material, 'id')
        list(item.runes?.property)
    }
    list(state.formulas)
    for (const caster of Object.values(state.spellcasting)) {
        list(caster.signature)
        list(caster.spellbook)
        for (const rank of Object.values(caster.repertoire ?? {})) list(rank)
        for (const rank of Object.values(caster.prepared ?? {})) list(rank, true)
    }
    for (const companion of state.companions) {
        field(companion, 'type')
        choices(companion.choices)
    }
}

export function convertRuleIds(state: BuildState, replacements: ReadonlyMap<string, string>): BuildState {
    const next = structuredClone(state)
    visitRuleIds(next, (id) => replacements.get(id))
    return next
}

export function chosenRuleIds(state: BuildState): Set<string> {
    const ids = new Set<string>()
    visitRuleIds(state, (id) => { ids.add(id); return undefined })
    return ids
}
