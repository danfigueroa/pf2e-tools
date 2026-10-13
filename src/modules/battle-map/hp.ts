/** PV de um token, já resolvido (personagem: da mesa; monstro: do mapa). */
export interface TokenHp { current: number; max: number; temp: number }

/** Dano come o temporário primeiro (Player Core). */
export function damageHp(hp: TokenHp, amount: number): TokenHp {
    const absorbed = Math.min(hp.temp, amount)
    return { ...hp, temp: hp.temp - absorbed, current: Math.max(0, hp.current - (amount - absorbed)) }
}

/** Cura não passa do máximo e não mexe no temporário. */
export function healHp(hp: TokenHp, amount: number): TokenHp {
    return { ...hp, current: Math.min(hp.max, hp.current + amount) }
}
