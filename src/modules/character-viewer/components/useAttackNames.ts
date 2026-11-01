import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { MAX_NAME_LENGTH, NO_NAMES, isAttackNamesEmpty, sanitizeAttackNames, type AttackNamesStored } from '../attackNames'

/** Os apelidos das armas e ataques do personagem, compartilhados com a mesa (campo `names`). */
export function useAttackNames(syncKey: string) {
    const [stored, setStored] = useSharedState<AttackNamesStored>(syncKey, {
        empty: () => NO_NAMES,
        sanitize: sanitizeAttackNames,
        isEmpty: isAttackNamesEmpty,
    })

    /** Nome vazio tira o apelido (volta ao do Pathbuilder). */
    const setName = useCallback((key: string, name: string) => {
        const clean = name.trim().slice(0, MAX_NAME_LENGTH)
        setStored((s) => {
            if ((s[key] ?? '') === clean) return s
            const next = { ...s }
            if (clean) next[key] = clean
            else delete next[key]
            return next
        })
    }, [setStored])

    // Viaja até a aba de Combate, que é `memo`.
    return useMemo(() => ({ names: stored, setName }), [stored, setName])
}

export type AttackNamesApi = ReturnType<typeof useAttackNames>
