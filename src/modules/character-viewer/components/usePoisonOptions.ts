import { useEffect, useMemo, useState } from 'react'
import type { BuildInfo } from '../../character-sheet/types'
import { fetchItemTraits, type ItemTraits } from '../../../services/itemTraits'
import { consumedKeyFor } from '../charId'
import { SIMPLE_POISON, isApplicablePoison, isSimplePoison, simpleDoses, simplePoisonDice } from '../rogue'
import { useConsumables } from './useConsumables'
import type { RogueApi } from './useRogue'

export interface PoisonOption {
    name: string
    label: string
    left: number
    of: number
}

/**
 * Os venenos que o Poison Weapon pode pôr na arma: o SIMPLE do talento primeiro
 * (o padrão, N doses por dia) e depois os de contato/injeção do inventário.
 * Compartilhado pela faixa do Ladino e pelo diálogo do Golpe — os dois aplicam,
 * então a lista e o gasto têm UMA fonte.
 */
export function usePoisonOptions(build: BuildInfo, rogue: RogueApi, enabled = true) {
    const consumables = useConsumables(consumedKeyFor(build))
    const [traits, setTraits] = useState<Record<string, ItemTraits | null>>({})
    const [choice, setChoice] = useState('')

    const names = useMemo(() => (build.equipment ?? []).map(([name]) => name), [build.equipment])
    useEffect(() => {
        if (!enabled || names.length === 0) return
        let cancelled = false
        fetchItemTraits(names).then((t) => { if (!cancelled) setTraits(t) })
        return () => { cancelled = true }
    }, [enabled, names])

    const inventory = (build.equipment ?? [])
        .filter(([name]) => isApplicablePoison(traits[name]))
        .map(([name, qty]) => ({ name, qty, left: consumables.remaining(name, qty) }))
        .filter((o) => o.left > 0)

    const dose = simpleDoses(build)
    const simpleLeft = Math.max(0, dose - rogue.stored.simpleUsed)
    const dice = simplePoisonDice(build)
    const options: PoisonOption[] = [
        { name: SIMPLE_POISON, label: `Veneno simples · ${dice.count}d${dice.faces} de veneno`, left: simpleLeft, of: dose },
        ...inventory.map((o) => ({ name: o.name, label: o.name, left: o.left, of: o.qty })),
    ]

    // Padrão: o simples enquanto há dose; sem dose, o primeiro do inventário.
    const fallback = options.find((o) => o.left > 0) ?? null
    const selected = options.find((o) => o.name === choice && o.left > 0) ?? fallback

    /** Põe o veneno escolhido na arma e gasta a dose/unidade. O custo em AÇÃO é de quem chama. */
    const applyChosen = (): string | null => {
        if (!selected) return null
        if (isSimplePoison(selected.name)) {
            rogue.applySimple()
            return selected.name
        }
        const item = inventory.find((o) => o.name === selected.name)
        if (!item) return null
        consumables.consume(item.name, item.qty)
        rogue.setPoison(item.name)
        return item.name
    }

    return { options, selected, setChoice, dose, simpleLeft, dice, applyChosen }
}

export type PoisonOptionsApi = ReturnType<typeof usePoisonOptions>
