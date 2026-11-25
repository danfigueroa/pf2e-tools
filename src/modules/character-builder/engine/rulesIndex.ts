/* i18n-ignore-file */
// Índice do catálogo para o motor: por id e por nome (o GrantItem do Foundry e o talento do background vêm por nome).
import type { RuleEntry } from '../rules/types'
import type { RulesIndex } from './types'

export function buildRulesIndex(lists: RuleEntry[][], languages: RuleEntry[]): RulesIndex {
    const byId = new Map<string, RuleEntry>()
    const byName = new Map<string, RuleEntry[]>()
    for (const list of lists) {
        for (const entry of list) {
            if (byId.has(entry.id)) continue
            byId.set(entry.id, entry)
            for (const name of [entry.name, ...(entry.legacyNames ?? [])]) {
                const key = name.toLowerCase()
                byName.set(key, [...(byName.get(key) ?? []), entry])
            }
        }
    }
    return {
        get: (id) => (id ? byId.get(id) : undefined),
        byName: (name, type) => {
            const all = (byName.get(name.toLowerCase()) ?? []).filter((e) => !type || e.type === type)
            return all.find((e) => e.remaster) ?? all[0]
        },
        languages,
    }
}
