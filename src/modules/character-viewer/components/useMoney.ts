import { useCallback, useMemo } from 'react'
import { useSharedState } from './useSharedState'
import { effectivePurse, samePurse, sanitizeMoney, sheetPurse, type MoneyStored, type Purse } from '../money'

/** O dinheiro do personagem: o da ficha, ou o que o jogador acertou na mesa (campo `money`). */
export function useMoney(syncKey: string, money: Partial<Purse> | null | undefined) {
    const [stored, setStored] = useSharedState<MoneyStored | null>(syncKey, {
        empty: () => null,
        sanitize: sanitizeMoney,
    })
    const sheet = useMemo(() => sheetPurse(money), [money])
    const { purse, edited } = effectivePurse(sheet, stored)

    /** `null` (ou a bolsa igual à da ficha) volta ao dinheiro da ficha. */
    const setPurse = useCallback((next: Purse | null) => {
        setStored(() => (!next || samePurse(next, sheet) ? null : { purse: next, of: sheet }))
    }, [setStored, sheet])

    return { purse, sheet, edited, setPurse }
}

export type MoneyApi = ReturnType<typeof useMoney>
