import { useCallback, useMemo, useRef } from 'react'
import type { Palette } from '@mui/material'
import { useSharedState } from './useSharedState'
import { readLegacy } from '../charId'

/** Prefixo da versão que só gravava local — lido uma vez, para migrar. */
const LEGACY_PREFIX = 'pf2e:viewer:hp:'

/**
 * O que fica guardado. `max` não entra: é derivado da ficha (e do corte de
 * Drenado), não é estado da mesa — guardá-lo só criava um valor que era
 * gravado e ignorado na releitura.
 */
export interface HpStored {
    current: number
    temp: number
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function sanitizeHp(raw: unknown): HpStored | null {
    if (!raw || typeof raw !== 'object') return null
    const saved = raw as Partial<HpStored>
    if (typeof saved.current !== 'number' || !Number.isFinite(saved.current)) return null
    return {
        current: Math.max(0, Math.floor(saved.current)),
        temp: Math.max(0, Math.floor(Number(saved.temp) || 0)),
    }
}

/**
 * PV atuais e temporários, compartilhados com a mesa inteira.
 *
 * `null` significa "ninguém mexeu ainda" e resolve para PV cheio no render —
 * é por isso que `maxHp` não participa da carga: mudar o máximo (marcar
 * Drenado, ou os stats do companheiro chegarem da AON) apenas reclampa o que
 * está na tela, sem reler nem sobrescrever o estado da mesa.
 */
export function useHpTracker(syncKey: string, maxHp: number, legacyKey?: string) {
    const [stored, setStored] = useSharedState<HpStored | null>(syncKey, {
        empty: () => null,
        sanitize: sanitizeHp,
        legacy: legacyKey ? () => sanitizeHp(readLegacy(LEGACY_PREFIX, legacyKey)) : undefined,
        isEmpty: (v) => v === null,
    })

    const state = useMemo(() => ({
        current: clamp(stored?.current ?? maxHp, 0, maxHp),
        temp: Math.max(0, stored?.temp ?? 0),
    }), [stored, maxHp])

    // Os callbacks precisam do valor já clampado sem depender dele na
    // identidade — senão toda mudança de PV recriaria os handlers.
    const stateRef = useRef(state)
    stateRef.current = state

    const applyDamage = useCallback((amount: number) => {
        const dmg = Math.max(0, Math.floor(amount))
        if (!dmg) return
        const s = stateRef.current
        const absorbed = Math.min(s.temp, dmg)
        const rest = dmg - absorbed
        setStored(() => ({ temp: s.temp - absorbed, current: Math.max(0, s.current - rest) }))
    }, [setStored])

    const applyHealing = useCallback((amount: number) => {
        const heal = Math.max(0, Math.floor(amount))
        if (!heal) return
        const s = stateRef.current
        setStored(() => ({ temp: s.temp, current: Math.min(maxHp, s.current + heal) }))
    }, [setStored, maxHp])

    const setTemp = useCallback((amount: number) => {
        const temp = Math.max(0, Math.floor(amount))
        setStored(() => ({ current: stateRef.current.current, temp }))
    }, [setStored])

    const resetFull = useCallback(() => {
        setStored(() => ({ current: maxHp, temp: 0 }))
    }, [setStored, maxHp])

    return { current: state.current, temp: state.temp, applyDamage, applyHealing, setTemp, resetFull }
}

/** Cor da barra conforme a fração de PV restante. */
export function hpBarColor(current: number, max: number, palette: Palette): string {
    if (current === 0) return palette.grey[500]
    const ratio = max > 0 ? current / max : 0
    if (ratio > 0.5) return palette.success.main
    if (ratio > 0.25) return palette.warning.main
    return palette.error.main
}
