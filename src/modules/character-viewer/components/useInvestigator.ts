import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import {
    NO_INVESTIGATOR, isInvestigatorEmpty, openLead, sanitizeInvestigator,
    type InvestigatorStored,
} from '../investigator'

const newId = () => `l${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

/**
 * As investigações do Investigador (Pursue a Lead) e os relógios de 10 minutos, compartilhados com
 * a mesa (campo `investigator`). O bônus de +1 entra nos testes pelo diálogo de rolagem, que lê
 * este mesmo estado (a chave é por personagem, e as instâncias do hook se enxergam).
 */
export function useInvestigator(syncKey: string) {
    const [stored, setStored] = useSharedState<InvestigatorStored>(syncKey, {
        empty: () => NO_INVESTIGATOR,
        sanitize: sanitizeInvestigator,
        isEmpty: isInvestigatorEmpty,
    })

    /** Abre a investigação; com duas já abertas, `replaceId` diz qual delas é abandonada. */
    const open = useCallback((name: string, replaceId: string | null = null) => {
        setStored((s) => openLead(s, name, replaceId, newId()))
    }, [setStored])
    /** Resolvida ou deixada de lado de propósito: só sai da lista. */
    const close = useCallback((id: string) => {
        setStored((s) => ({ ...s, leads: s.leads.filter((l) => l.id !== id) }))
    }, [setStored])
    /** Abandonada: sai da lista e não volta até a próxima preparação diária. */
    const abandon = useCallback((id: string) => {
        setStored((s) => {
            const out = s.leads.find((l) => l.id === id)
            return out ? { ...s, leads: s.leads.filter((l) => l.id !== id), dropped: [...s.dropped, out.name.toLowerCase()] } : s
        })
    }, [setStored])
    const stamp = useCallback((key: 'pursuedAt' | 'clueAt' | 'inspectedAt', at: number | null) => {
        setStored((s) => ({ ...s, [key]: at }))
    }, [setStored])
    /** Preparação diária: as investigações abandonadas podem ser abertas de novo. */
    const newDay = useCallback(() => setStored((s) => ({ ...s, dropped: [] })), [setStored])

    return useMemo(() => ({ stored, open, close, abandon, stamp, newDay }), [stored, open, close, abandon, stamp, newDay])
}

export type InvestigatorApi = ReturnType<typeof useInvestigator>
