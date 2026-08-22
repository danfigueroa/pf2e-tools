import { useCallback, useEffect, useState } from 'react'
import type { Palette } from '@mui/material'
import type { BuildInfo } from '../../character-sheet/types'

const STORAGE_PREFIX = 'pf2e:viewer:hp:'

interface HpState {
    current: number
    temp: number
    max: number
}

/** Chave estável por personagem — BuildInfo não tem id único. */
export const charKeyFor = (build: BuildInfo): string =>
    [build.name, build.class, build.level, build.ancestry].join('|')

/** Chave de um companheiro/familiar, namespaced dentro da chave do dono. */
export const petKeyFor = (build: BuildInfo, kind: string, name: string, idx: number): string =>
    `${charKeyFor(build)}|${kind}:${name}#${idx}`

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function loadState(key: string, max: number): HpState {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key)
        if (raw) {
            const saved = JSON.parse(raw) as Partial<HpState>
            const temp = Math.max(0, Math.floor(saved.temp ?? 0))
            // Se o máximo mudou (ex.: subida de nível/re-upload), adota o novo e limita os atuais.
            const current = clamp(Math.floor(saved.current ?? max), 0, max)
            return { current, temp, max }
        }
    } catch { /* noop */ }
    return { current: max, temp: 0, max }
}

/** Estado de PV (atuais/temporários) com persistência em localStorage por chave. */
export function useHpTracker(key: string, maxHp: number) {
    const [state, setState] = useState<HpState>(() => loadState(key, maxHp))

    // Recarrega ao trocar de personagem ou quando o máximo derivado muda.
    useEffect(() => {
        setState(loadState(key, maxHp))
    }, [key, maxHp])

    // Persiste a cada alteração.
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state))
        } catch { /* noop */ }
    }, [key, state])

    const applyDamage = useCallback((amount: number) => {
        const dmg = Math.max(0, Math.floor(amount))
        if (!dmg) return
        setState((s) => {
            const absorbed = Math.min(s.temp, dmg)
            const rest = dmg - absorbed
            return { ...s, temp: s.temp - absorbed, current: Math.max(0, s.current - rest) }
        })
    }, [])

    const applyHealing = useCallback((amount: number) => {
        const heal = Math.max(0, Math.floor(amount))
        if (!heal) return
        setState((s) => ({ ...s, current: Math.min(s.max, s.current + heal) }))
    }, [])

    const setTemp = useCallback((amount: number) => {
        const temp = Math.max(0, Math.floor(amount))
        setState((s) => ({ ...s, temp }))
    }, [])

    const resetFull = useCallback(() => {
        setState((s) => ({ ...s, current: s.max, temp: 0 }))
    }, [])

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
