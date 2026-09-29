import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cachedShield, fetchShield } from '../../../services/shields'
import {
    canBlockNow,
    isBroken,
    isDestroyed,
    raisedBonus,
    sanitizeShield,
    shieldBlock,
    shieldStats,
    type AonShield,
    type BlockResult,
    type ShieldItem,
    type ShieldStats,
    type ShieldStored,
} from '../shield'
import { useSharedState } from './useSharedState'
import type { BuildInfo } from '../../character-sheet/types'
import { shieldItemOf } from '../shield'
import { shieldKeyFor } from '../charId'

/** Os números do escudo: o item da ficha + o que a AON tem dele. */
export function useShieldStats(item: ShieldItem | null): { stats: ShieldStats | null; loading: boolean } {
    const name = item?.name ?? ''
    const [aon, setAon] = useState<{ name: string; value: AonShield | null } | null>(() =>
        name ? (cachedShield(name) === undefined ? null : { name, value: cachedShield(name) ?? null }) : null)

    useEffect(() => {
        if (!name) return
        let cancelled = false
        fetchShield(name).then((value) => { if (!cancelled) setAon({ name, value }) })
        return () => { cancelled = true }
    }, [name])

    const current = aon?.name === name ? aon.value : null
    const stats = useMemo(() => (item ? shieldStats(item, current) : null), [item, current])
    return { stats, loading: !!name && aon?.name !== name }
}

/** Estado do escudo resolvido contra os números: o que as telas leem. */
export interface ShieldView {
    stats: ShieldStats
    hp: number
    raised: boolean
    broken: boolean
    destroyed: boolean
    /** O que o escudo soma na CA agora. */
    acBonus: number
    /** Tem o talento, está erguido e inteiro. */
    canBlock: boolean
}

export function shieldView(stats: ShieldStats, stored: ShieldStored | null): ShieldView {
    const hp = Math.min(stats.maxHp, Math.max(0, stored?.hp ?? stats.maxHp))
    const raised = !!stored?.raised
    return {
        stats,
        hp,
        raised,
        broken: isBroken(hp, stats),
        destroyed: isDestroyed(hp),
        acBonus: raisedBonus(stats, hp, raised),
        canBlock: canBlockNow(stats, hp, raised),
    }
}

/**
 * PV e "erguido" do escudo, compartilhados com a mesa (`<slug>/shield`) — o GM
 * vê na Iniciativa o escudo que o jogador ergueu na ficha, e vice-versa.
 *
 * Como o PV, `hp: null` é "ninguém mexeu": resolve para o máximo no render, e
 * uma runa nova (máximo maior) não precisa de migração.
 */
export function useShield(syncKey: string, stats: ShieldStats | null) {
    const [stored, setStored] = useSharedState<ShieldStored | null>(syncKey, {
        empty: () => null,
        sanitize: sanitizeShield,
        isEmpty: (v) => v === null,
    })

    const view = useMemo(() => (stats ? shieldView(stats, stored) : null), [stats, stored])
    const viewRef = useRef(view)
    viewRef.current = view

    const setRaised = useCallback((raised: boolean) => {
        const v = viewRef.current
        if (!v || (raised && v.broken)) return
        setStored(() => ({ hp: v.hp, raised }))
    }, [setStored])

    /**
     * Bloqueio: devolve o resultado para quem chamou aplicar o resto no PV.
     * `destructive` só vale com o talento Destructive Block.
     */
    const block = useCallback((damage: number, destructive = false): BlockResult | null => {
        const v = viewRef.current
        if (!v || !v.canBlock) return null
        const result = shieldBlock(damage, v.stats, v.hp, destructive)
        // Quebrou: deixa de estar erguido — escudo quebrado não cumpre a função.
        setStored(() => ({ hp: result.hpAfter, raised: !isBroken(result.hpAfter, v.stats) }))
        return result
    }, [setStored])

    /** Conserto: devolve quanto de fato entrou (teto no máximo). */
    const repair = useCallback((amount: number): number => {
        const v = viewRef.current
        if (!v) return 0
        const hp = Math.min(v.stats.maxHp, v.hp + Math.max(0, Math.floor(amount)))
        setStored(() => ({ hp, raised: v.raised }))
        return hp - v.hp
    }, [setStored])

    /** Volta a um estado exato — o "Desfazer". */
    const restore = useCallback((prev: ShieldStored) => {
        setStored(() => sanitizeShield(prev))
    }, [setStored])

    return { view, setRaised, block, repair, restore }
}

/** O escudo vestido do personagem, com números da AON e estado da mesa. */
export function useCharacterShield(build: BuildInfo) {
    const item = useMemo(() => shieldItemOf(build), [build])
    const { stats, loading } = useShieldStats(item)
    return { item, loading, ...useShield(shieldKeyFor(build), stats) }
}

export type CharacterShield = ReturnType<typeof useCharacterShield>
