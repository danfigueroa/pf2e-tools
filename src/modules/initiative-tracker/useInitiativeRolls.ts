import { useEffect, useRef } from 'react'
import { useTableRolls } from '../../services/rolls'
import { pendingInitiativeUpdates, type InitiativeUpdate } from './initiativeRolls'
import type { Combatant } from './types'

const KEY = 'pf2e:initiative:rolls-handled'
const KEEP = 60

function load(): Set<string> {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
        return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
    } catch {
        return new Set()
    }
}

function save(ids: Set<string>) {
    try { localStorage.setItem(KEY, JSON.stringify([...ids].slice(-KEEP))) } catch { /* cota cheia */ }
}

/**
 * Aplica ao encontro a iniciativa que o jogador rolou pela ficha. Cada rolagem
 * vale uma vez (o ajuste manual do GM depois não é desfeito), lembrada no
 * `localStorage` para sobreviver a recarregar a página.
 */
export function useInitiativeRolls(combatants: Combatant[], apply: (u: InitiativeUpdate) => void) {
    const { rolls, ready } = useTableRolls()
    const handled = useRef<Set<string> | null>(null)
    const applyRef = useRef(apply)
    useEffect(() => { applyRef.current = apply })

    useEffect(() => {
        if (!ready) return
        if (!handled.current) handled.current = load()
        const { updates, settled } = pendingInitiativeUpdates(rolls, combatants, handled.current, Date.now())
        if (settled.length === 0) return
        for (const id of settled) handled.current.add(id)
        save(handled.current)
        for (const u of updates) applyRef.current(u)
    }, [rolls, ready, combatants])
}
