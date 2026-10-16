// Iniciativa que o jogador rolou pela Ficha Virtual ("Usar como iniciativa") e
// que chega pelo feed de rolagens da mesa.
//
// O encontro é do GM e mora no navegador dele; o feed é da mesa. Aqui só se
// DECIDE o que aplicar — quem aplica é a página, num handler local que escreve
// no reducer. Nada volta para a mesa, então não forma o laço "lê a mesa e
// escreve na mesa" que o módulo proíbe.

import type { TableRoll } from '../../dice/tableRoll'
import type { Combatant } from './types'

/** Rolagem de iniciativa mais velha que isso não é aplicada ao abrir/entrar. */
export const INITIATIVE_ROLL_MAX_AGE_MS = 10 * 60_000

export interface InitiativeUpdate {
    rollId: string
    combatantId: string
    name: string
    value: number
    skill: string
}

/**
 * As rolagens de iniciativa ainda não aplicadas, da mais velha para a mais nova
 * (a mais nova vence). PC que ainda não está no encontro fica de fora — e a
 * rolagem NÃO é dada como tratada enquanto for recente, para valer quando o
 * personagem entrar. Rolagem velha demais é descartada.
 */
export function pendingInitiativeUpdates(
    rolls: TableRoll[],
    combatants: Combatant[],
    handled: ReadonlySet<string>,
    now: number,
): { updates: InitiativeUpdate[]; settled: string[] } {
    const updates: InitiativeUpdate[] = []
    const settled: string[] = []
    const ordered = rolls.filter((r) => r.initiative && r.check && r.slug && !handled.has(r.id)).sort((a, b) => a.at - b.at)
    for (const r of ordered) {
        const pc = combatants.find((c) => c.kind === 'pc' && c.slug === r.slug)
        if (!pc) {
            if (now - r.at > INITIATIVE_ROLL_MAX_AGE_MS) settled.push(r.id)
            continue
        }
        if (now - r.at > INITIATIVE_ROLL_MAX_AGE_MS) { settled.push(r.id); continue }
        updates.push({ rollId: r.id, combatantId: pc.id, name: pc.name, value: r.check!.total, skill: r.title })
        settled.push(r.id)
    }
    return { updates, settled }
}
