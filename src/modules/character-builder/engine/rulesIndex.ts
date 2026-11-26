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
        named: (name) => byName.get(name.toLowerCase()) ?? [],
        languages,
    }
}

/**
 * O talento de um `GrantItem` do Foundry: pelo `grantId` que o pacote resolveu na publicação e, sem ele (catálogo
 * antigo) ou fora das listas carregadas, pelo nome. O id que não achou vai para `missing`: editor e servidor buscam a
 * lista dele pelo `core/locations` e compilam de novo.
 */
export function grantedFeat(rule: { key: string; uuid?: unknown; grantId?: unknown }, rules: RulesIndex, missing?: Set<string>): RuleEntry | undefined {
    if (rule.key !== 'GrantItem' || typeof rule.uuid !== 'string') return undefined
    const id = typeof rule.grantId === 'string' ? rule.grantId : undefined
    const byId = id ? rules.get(id) : undefined
    if (byId) return byId
    // Só o compêndio de talentos: o Fighter concede a AÇÃO Reactive Strike (`actionspf2e`), e um talento homônimo de
    // outras classes entraria na ficha (a Pathbuilder lista a ação como característica, não como talento).
    const name = /^Compendium\.pf2e\.feats-srd\.Item\.(.+)$/.exec(rule.uuid)?.[1]
    const byName = name ? rules.byName(name, 'feat') : undefined
    if (!byName && id) missing?.add(id)
    return byName
}
