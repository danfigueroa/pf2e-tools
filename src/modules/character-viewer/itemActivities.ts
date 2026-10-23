/**
 * Ativações de itens que gastam só ação e uso diário, sem dado próprio (as curas ficam em
 * `healActivities.ts`). Casadas pelo NOME do item no inventário; o texto veio da AON.
 *
 * - **Arachnid Harness** (Treasure Vault Remastered pg. 14): 1 ação (concentrar), 1× por dia —
 *   por 1 minuto, Deslocamento de escalar igual à metade do terrestre, com as mãos livres.
 */
import type { ActivityInfo } from './activities'

const ITEM_ACTIVITIES: Readonly<Record<string, ActivityInfo>> = {
    'arachnid harness': {
        time: { kind: 'actions', n: 1 },
        mythicPoint: false,
        daily: true,
        includesStrike: false,
        trigger: undefined,
    },
}

export const itemActivityOf = (name: string): ActivityInfo | null => ITEM_ACTIVITIES[name.trim().toLowerCase()] ?? null
