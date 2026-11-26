// O catálogo que o motor precisa (núcleo de `core/`, características de classe e as listas de talento que o personagem
// usa) e as regras de criação da mesa. Só listas de `core/` do Storage/IndexedDB: nenhuma chamada à AON.
import { useEffect, useMemo, useState } from 'react'
import { fetchHomebrew, fetchMesaRules } from '../../../services/builds'
import { ancestries, archetypes, backgrounds, classes, classOptions, heritages, languages, openRules, ruleTables } from '../rules'
import { featListPaths, locate, type FeatListNeeds } from '../engine/catalog'
import type { SpellSlotTable } from '../engine/spells'
import { loadRuleList } from '../rules/loader'
import { buildRulesIndex } from '../engine/rulesIndex'
import type { RuleEntry } from '../rules/types'
import type { RulesIndex } from '../engine/types'
import { sanitizeMesaRules } from '../mesaRules'
import type { MesaRules } from '../types'

export interface CoreRules {
    version: string
    ancestries: RuleEntry[]
    heritages: RuleEntry[]
    backgrounds: RuleEntry[]
    classes: RuleEntry[]
    languages: RuleEntry[]
    classFeatures: RuleEntry[]
    archetypes: RuleEntry[]
}

// As listas que o personagem usa: a mesma função do servidor (F10.1).
export { featListPaths, ITEM_LISTS, type FeatListNeeds } from '../engine/catalog'

export interface UseRules {
    core: CoreRules | null
    index: RulesIndex | null
    mesaRules: MesaRules | null
    error: boolean
}

export function useRules(needs?: FeatListNeeds): UseRules & { feats: RuleEntry[]; featLists: Readonly<Record<string, RuleEntry[]>>; tables: { spellSlots?: SpellSlotTable } | null; setMesaRules: (r: MesaRules) => void } {
    const [tables, setTables] = useState<{ spellSlots?: SpellSlotTable } | null>(null)
    const [core, setCore] = useState<CoreRules | null>(null)
    const [featLists, setFeatLists] = useState<Record<string, RuleEntry[]>>({})
    const [mesaRules, setMesaRules] = useState<MesaRules | null>(null)
    const [supplement, setSupplement] = useState<RuleEntry[]>([])
    const [homebrew, setHomebrew] = useState<RuleEntry[]>([])
    const [error, setError] = useState(false)

    useEffect(() => {
        let alive = true
        openRules()
            .then(async (version) => {
                const [a, h, b, c, l, cf, ar] = await Promise.all([ancestries(), heritages(), backgrounds(), classes(), languages(), classOptions(), archetypes().catch(() => [] as RuleEntry[])])
                if (alive) setCore({ version, ancestries: a, heritages: h, backgrounds: b, classes: c, languages: l, classFeatures: cf, archetypes: ar })
            })
            .catch(() => alive && setError(true))
        ruleTables().then((t) => alive && setTables(t as { spellSlots?: SpellSlotTable })).catch(() => {})
        // Conteúdo da mesa (9.1): entra no catálogo com o selo "Da mesa". Falhou = segue só o oficial.
        void fetchHomebrew().then((out) => { if (alive && out.ok) setHomebrew(out.value.map((r) => r.entry)) })
        void fetchMesaRules().then((out) => {
            if (alive && out.ok) setMesaRules(sanitizeMesaRules(out.value))
        })
        return () => { alive = false }
    }, [])

    // Listas de talento: baixa as que faltam (lista inexistente = vazia, ex.: classe sem talentos próprios).
    const paths = needs ? featListPaths(needs).join('|') : ''
    useEffect(() => {
        if (!paths) return
        let alive = true
        for (const path of paths.split('|')) {
            if (featLists[path]) continue
            loadRuleList<RuleEntry[]>(path).catch(() => [] as RuleEntry[])
                .then((list) => alive && setFeatLists((prev) => (prev[path] ? prev : { ...prev, [path]: list })))
        }
        return () => { alive = false }
    }, [paths, featLists])

    // Talentos, magias e itens da mesa vão junto das listas baixadas (os seletores filtram por tipo e traço).
    const feats = useMemo(() => [...Object.values(featLists).flat(), ...homebrew.filter((e) => e.type !== 'background' && e.type !== 'heritage')], [featLists, homebrew])
    const merged = useMemo<CoreRules | null>(() => {
        if (!core || homebrew.length === 0) return core
        const of = (type: string) => homebrew.filter((e) => e.type === type)
        return { ...core, backgrounds: [...core.backgrounds, ...of('background')], heritages: [...core.heritages, ...of('heritage')] }
    }, [core, homebrew])
    const index = useMemo<RulesIndex | null>(() => {
        if (!merged) return null
        return buildRulesIndex([merged.ancestries, merged.heritages, merged.backgrounds, merged.classes, merged.languages, merged.classFeatures, feats, merged.archetypes, supplement], merged.languages)
    }, [merged, feats, supplement])

    // Uma revisão pode ter mudado de lista (por exemplo, a tradição de uma magia). Ao reabrir,
    // busque a lista do destino salvo somente se a carga habitual não resolveu a referência.
    const missing = (needs?.references ?? []).filter((id) => !id.startsWith('custom:') && !id.startsWith('mesa:') && !index?.get(id)).join('|')
    const loaded = !!paths && paths.split('|').every((path) => featLists[path])
    useEffect(() => {
        if (!core || !loaded || !missing) return
        let alive = true
        const ids = new Set(missing.split('|'))
        // Mesma busca do servidor (F10.1): `core/locations`, e o `core/remaster` para o legado.
        const reader = { read: (path: string) => loadRuleList<unknown>(path, core.version).catch(() => null) }
        const read = (path: string) => loadRuleList<RuleEntry[]>(path, core.version).catch(() => [] as RuleEntry[])
        void locate(ids, reader, read).then((found) => {
            if (alive && found.length) setSupplement((prev) => [...new Map([...prev, ...found].map((e) => [e.id, e])).values()])
        }).catch(() => { if (alive) setError(true) })
        return () => { alive = false }
    }, [core, loaded, missing])

    return { core: merged, index, mesaRules, error, feats, featLists, tables, setMesaRules }
}
