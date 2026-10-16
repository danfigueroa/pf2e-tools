import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { NO_ENERGY, allowedModes, isEnergyEmpty, sanitizeEnergy, type EnergyMode, type EnergyStored } from '../energy'

/** Conservation of Energy compartilhada com a mesa (campo `energy`). */
export function useEnergy(syncKey: string) {
    const [stored, setStored] = useSharedState<EnergyStored>(syncKey, {
        empty: () => NO_ENERGY,
        sanitize: sanitizeEnergy,
        isEmpty: isEnergyEmpty,
    })
    const allowed = useMemo(() => allowedModes(stored), [stored])
    const record = useCallback((mode: EnergyMode) => setStored(() => ({ last: mode })), [setStored])
    /** Refocus: volta ao neutro. */
    const reset = useCallback(() => setStored(() => NO_ENERGY), [setStored])
    return useMemo(() => ({ stored, allowed, record, reset }), [stored, allowed, record, reset])
}

export type EnergyApi = ReturnType<typeof useEnergy>
