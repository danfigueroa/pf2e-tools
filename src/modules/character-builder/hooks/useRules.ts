// O catálogo que o motor precisa na F3 (ancestralidades, heranças, backgrounds, classes, idiomas) e as regras de criação
// da mesa. Só listas de `core/` do Storage/IndexedDB: nenhuma chamada à AON.
import { useEffect, useMemo, useState } from 'react'
import { fetchMesaRules } from '../../../services/builds'
import { ancestries, backgrounds, classes, heritages, languages, openRules } from '../rules'
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
}

export interface UseRules {
    core: CoreRules | null
    index: RulesIndex | null
    mesaRules: MesaRules | null
    error: boolean
}

export function useRules(): UseRules {
    const [core, setCore] = useState<CoreRules | null>(null)
    const [mesaRules, setMesaRules] = useState<MesaRules | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
        let alive = true
        openRules()
            .then(async (version) => {
                const [a, h, b, c, l] = await Promise.all([ancestries(), heritages(), backgrounds(), classes(), languages()])
                if (alive) setCore({ version, ancestries: a, heritages: h, backgrounds: b, classes: c, languages: l })
            })
            .catch(() => alive && setError(true))
        void fetchMesaRules().then((out) => {
            if (alive && out.ok) setMesaRules(sanitizeMesaRules(out.value))
        })
        return () => { alive = false }
    }, [])

    const index = useMemo<RulesIndex | null>(() => {
        if (!core) return null
        const byId = new Map<string, RuleEntry>()
        for (const list of [core.ancestries, core.heritages, core.backgrounds, core.classes, core.languages]) {
            for (const entry of list) byId.set(entry.id, entry)
        }
        return { get: (id) => (id ? byId.get(id) : undefined), languages: core.languages }
    }, [core])

    return { core, index, mesaRules, error }
}
