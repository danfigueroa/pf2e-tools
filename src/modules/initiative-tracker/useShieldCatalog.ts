import { useEffect, useMemo, useState } from 'react'
import { cachedShield, fetchShield } from '../../services/shields'
import type { AonShield } from '../character-viewer/shield'

/**
 * Os números da AON dos escudos dos personagens do encontro, por nome. Ficam
 * na página, como o estado da mesa em `useEncounterParty`: o diálogo de dano
 * em lote precisa da Dureza de todos os alvos antes de aplicar.
 */
export function useShieldCatalog(names: string[]): Record<string, AonShield | null> {
    const key = useMemo(() => [...new Set(names.filter(Boolean))].sort().join('|'), [names])
    const [catalog, setCatalog] = useState<Record<string, AonShield | null>>(() => {
        const out: Record<string, AonShield | null> = {}
        for (const name of key ? key.split('|') : []) {
            const hit = cachedShield(name)
            if (hit !== undefined) out[name] = hit
        }
        return out
    })

    useEffect(() => {
        if (!key) return
        let cancelled = false
        for (const name of key.split('|')) {
            fetchShield(name).then((value) => {
                if (!cancelled) setCatalog((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }))
            })
        }
        return () => { cancelled = true }
    }, [key])

    return catalog
}
