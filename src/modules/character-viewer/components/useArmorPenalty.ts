import { useMemo } from 'react'
import type { BuildInfo } from '../../character-sheet/types'
import { useGear } from '../../../services/gear'
import type { ArmorPenalty } from '../checks'

/**
 * Penalidade da armadura VESTIDA, com os números do AON. O Pathbuilder manda
 * a armadura só pelo nome (e o escudo na mesma lista, com `prof: 'shield'`).
 * `null` enquanto não chegou, ou quando o AON não tem a armadura — aí a perícia
 * sai sem penalidade, que é o caso de todo o grupo hoje.
 */
export function useArmorPenalty(build: BuildInfo): ArmorPenalty | null {
    const worn = (build.armor ?? []).find((a) => a.worn && (a.prof || '').toLowerCase() !== 'shield')
    const names = useMemo(() => (worn ? [worn.name] : []), [worn])
    const gear = useGear(names)
    const entry = worn ? gear[worn.name] : null
    if (!entry || entry.kind !== 'armor') return null
    return { checkPenalty: entry.checkPenalty, strength: entry.strength }
}
