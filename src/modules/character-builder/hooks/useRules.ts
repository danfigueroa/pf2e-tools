// O catálogo que o motor precisa (núcleo de `core/`, características de classe e as listas de talento que o personagem
// usa) e as regras de criação da mesa. Só listas de `core/` do Storage/IndexedDB: nenhuma chamada à AON.
import { useEffect, useMemo, useState } from 'react'
import { fetchMesaRules } from '../../../services/builds'
import { ancestries, backgrounds, classes, classOptions, heritages, languages, openRules, ruleListSlug } from '../rules'
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
}

/** O que o personagem usa e decide quais listas de talento baixar. */
export interface FeatListNeeds {
    className?: string
    ancestryName?: string
    /** Herança versátil (Aiuvarin, Nephilim…) tem talentos próprios. */
    versatileHeritage?: string
    mythic?: boolean
    /** Arquétipos dos talentos escolhidos (qualificador `archetype:<slug>`). */
    archetypes: string[]
}

/** Caminhos das listas de talento que o personagem pode usar. */
export function featListPaths(needs: FeatListNeeds): string[] {
    return [
        'feats/general', 'feats/skill',
        needs.mythic ? 'feats/mythic' : null,
        needs.className ? `feats/class/${ruleListSlug(needs.className)}` : null,
        needs.ancestryName ? `feats/ancestry/${ruleListSlug(needs.ancestryName)}` : null,
        needs.versatileHeritage ? `feats/ancestry/${ruleListSlug(needs.versatileHeritage)}` : null,
        ...needs.archetypes.map((a) => `feats/archetype/${ruleListSlug(a)}`),
    ].filter((p): p is string => Boolean(p))
}

export interface UseRules {
    core: CoreRules | null
    index: RulesIndex | null
    mesaRules: MesaRules | null
    error: boolean
}

export function useRules(needs?: FeatListNeeds): UseRules & { feats: RuleEntry[] } {
    const [core, setCore] = useState<CoreRules | null>(null)
    const [featLists, setFeatLists] = useState<Record<string, RuleEntry[]>>({})
    const [mesaRules, setMesaRules] = useState<MesaRules | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
        let alive = true
        openRules()
            .then(async (version) => {
                const [a, h, b, c, l, cf] = await Promise.all([ancestries(), heritages(), backgrounds(), classes(), languages(), classOptions()])
                if (alive) setCore({ version, ancestries: a, heritages: h, backgrounds: b, classes: c, languages: l, classFeatures: cf })
            })
            .catch(() => alive && setError(true))
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

    const feats = useMemo(() => Object.values(featLists).flat(), [featLists])
    const index = useMemo<RulesIndex | null>(() => {
        if (!core) return null
        return buildRulesIndex([core.ancestries, core.heritages, core.backgrounds, core.classes, core.languages, core.classFeatures, feats], core.languages)
    }, [core, feats])

    return { core, index, mesaRules, error, feats }
}
