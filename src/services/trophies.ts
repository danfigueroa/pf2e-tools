// Troféus do Covil: o perfil (o meu ou o de um colega da mesa) e o ranking da mesa.
//
// Quem decide o que desbloqueia é o servidor (`api/_lib/trophies.js`), que manda o catálogo
// junto com o perfil: o cliente só desenha. O aviso de troféu novo chega pelo canal de eventos
// da mesa (`trophy-unlocked`, ver `services/notifications.ts`).

import { stateApi } from './mesa'

export type TrophyTier = 'bronze' | 'prata' | 'ouro' | 'platina'
export type TrophyRole = 'player' | 'gm'

export interface TrophyDef {
    id: string
    role: TrophyRole
    category: string
    tier: TrophyTier
    title: string
    description: string
    hidden: boolean
    goal: number
}

export interface Unlocked { id: string; at: number; mesa: string | null }

export interface TrophyProfile {
    catalog: TrophyDef[]
    unlocked: Unlocked[]
    progress: Record<string, number>
    points: Record<TrophyRole, number>
}

export interface RankingEntry {
    userId: string
    role: 'player' | 'gm'
    name: string
    username: string | null
    points: Record<TrophyRole, number>
    count: number
    platinum: number
    last: { id: string; at: number; title: string } | null
}

export const TIER_POINTS: Record<TrophyTier, number> = { bronze: 15, prata: 30, ouro: 90, platina: 300 }

/** O nível do perfil pelos pontos: cada nível pede um pouco mais que o anterior. */
export function levelOf(points: number): { level: number; into: number; next: number } {
    let level = 1
    let need = 60
    let left = points
    while (left >= need) {
        left -= need
        level += 1
        need = Math.round(need * 1.15)
    }
    return { level, into: left, next: need }
}

async function get<T>(query: string): Promise<T | null> {
    try {
        const res = await fetch(stateApi(query))
        if (!res.ok) return null
        return (await res.json()) as T
    } catch {
        return null
    }
}

/** `me` ou o id de um colega desta mesa. `null` = falhou (offline, fora da mesa). */
export async function fetchTrophyProfile(who: 'me' | string): Promise<TrophyProfile | null> {
    const body = await get<TrophyProfile>(`?trophies=${encodeURIComponent(who)}`)
    if (!body || !Array.isArray(body.catalog)) return null
    return {
        catalog: body.catalog,
        unlocked: Array.isArray(body.unlocked) ? body.unlocked : [],
        progress: body.progress ?? {},
        points: { player: Number(body.points?.player) || 0, gm: Number(body.points?.gm) || 0 },
    }
}

export async function fetchTrophyRanking(): Promise<RankingEntry[] | null> {
    const body = await get<{ ranking?: RankingEntry[] }>('?trophies=ranking')
    return Array.isArray(body?.ranking) ? body.ranking : null
}
