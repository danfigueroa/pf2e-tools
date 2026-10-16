import { useEffect, useState } from 'react'
import { searchAfflictions } from '../../../services/afflictions'
import type { AfflictionDef } from '../../initiative-tracker/afflictions'

/** A CD e a salvaguarda do veneno, lidas da AON pelo nome (`null` enquanto busca ou sem entrada). */
export function usePoisonDef(name: string | null): AfflictionDef | null {
    const [found, setFound] = useState<{ name: string; def: AfflictionDef | null } | null>(null)
    useEffect(() => {
        if (!name) return
        let cancelled = false
        searchAfflictions(name, 5).then((list) => {
            if (cancelled) return
            const exact = list.find((d) => d.name.toLowerCase() === name.toLowerCase()) ?? list[0] ?? null
            setFound({ name, def: exact })
        })
        return () => { cancelled = true }
    }, [name])
    return name && found?.name === name ? found.def : null
}
