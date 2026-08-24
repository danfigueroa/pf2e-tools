import type { Combatant, EncounterState, NpcCombatant, PcCombatant } from './types'

export const emptyEncounter = (): EncounterState => ({
    version: 1,
    round: 0,
    activeId: null,
    combatants: [],
})

// --- Ordem de turnos ---------------------------------------------------------

/**
 * Em empate entre um PC e um adversário, o adversário age primeiro (RAW).
 * Entre dois PCs a regra manda combinarem entre si — daí as setas ↑↓, que
 * sobrevivem porque `Array.prototype.sort` é estável.
 */
const kindRank = (c: Combatant) => (c.kind === 'npc' ? 0 : 1)

export const compareInitiative = (a: Combatant, b: Combatant) =>
    b.initiative - a.initiative || kindRank(a) - kindRank(b)

/**
 * A ordem NÃO é derivada no render: reordenar a cada render apagaria o
 * desempate manual. O array de `combatants` é a ordem autoritativa e só é
 * reordenado em eventos explícitos (entrar no encontro, mudar iniciativa,
 * botão "Reordenar").
 */
const sorted = (list: Combatant[]) => [...list].sort(compareInitiative)

/** Quem efetivamente joga: sem os adiados e sem os marcados como derrotados. */
export const activeOrder = (state: EncounterState): Combatant[] =>
    state.combatants.filter((c) => !c.delayed && !c.defeated)

export const activeIndex = (state: EncounterState): number =>
    activeOrder(state).findIndex((c) => c.id === state.activeId)

/** Quem age depois do turno atual, e se a rodada vira. */
export function peekNext(state: EncounterState): { next: Combatant | null; wraps: boolean } {
    const order = activeOrder(state)
    if (order.length === 0) return { next: null, wraps: false }
    const i = order.findIndex((c) => c.id === state.activeId)
    if (i === -1) return { next: order[0], wraps: false }
    const nextIndex = i + 1
    return { next: order[nextIndex % order.length], wraps: nextIndex >= order.length }
}

// --- Ações -------------------------------------------------------------------

export type EncounterAction =
    | { type: 'hydrate'; state: EncounterState }
    | { type: 'addCombatants'; combatants: Combatant[] }
    | { type: 'duplicate'; id: string }
    | { type: 'remove'; id: string }
    | { type: 'patch'; id: string; patch: Partial<PcCombatant> & Partial<NpcCombatant> }
    | { type: 'setInitiative'; id: string; value: number }
    | { type: 'sortByInitiative' }
    | { type: 'move'; id: string; dir: -1 | 1 }
    | { type: 'start' }
    /** `drop`: condições do PRÓXIMO combatente que devem sumir junto com o tique. */
    | { type: 'nextTurn'; drop: string[] }
    | { type: 'prevTurn' }
    | { type: 'delay'; id: string; drop: string[] }
    | { type: 'returnFromDelay'; id: string }
    | { type: 'setDefeated'; id: string; value: boolean }
    | { type: 'npcDamage'; entries: Array<{ id: string; amount: number }> }
    | { type: 'npcHeal'; entries: Array<{ id: string; amount: number }> }
    | { type: 'npcSetTemp'; id: string; amount: number }
    | { type: 'setNpcCondition'; id: string; conditionId: string; value: number }
    | { type: 'setDuration'; id: string; conditionId: string; rounds: number | null }
    | { type: 'endEncounter' }

const mapById = (
    list: Combatant[],
    id: string,
    fn: (c: Combatant) => Combatant,
): Combatant[] => list.map((c) => (c.id === id ? fn(c) : c))

const clampHp = (n: number, max: number) => Math.min(max, Math.max(0, Math.floor(n)))

/**
 * Dano em NPC: PV temporários absorvem primeiro, exatamente como
 * `useHpTracker.applyDamage` faz do lado dos personagens.
 */
function damageNpc(npc: NpcCombatant, amount: number): NpcCombatant {
    const dmg = Math.max(0, Math.floor(amount))
    if (!dmg) return npc
    const absorbed = Math.min(npc.temp, dmg)
    return {
        ...npc,
        temp: npc.temp - absorbed,
        current: Math.max(0, npc.current - (dmg - absorbed)),
    }
}

/** Avanço de turno compartilhado por `nextTurn` e por `delay` do combatente ativo. */
function advance(state: EncounterState, drop: string[]): EncounterState {
    const { next, wraps } = peekNext(state)
    if (!next) return { ...state, activeId: null }

    const combatants = mapById(state.combatants, next.id, (c) => ({
        ...c,
        durations: tickDurations(c.durations, drop),
    }))

    return {
        ...state,
        combatants,
        activeId: next.id,
        round: state.round + (wraps ? 1 : 0),
    }
}

/** Decrementa as rodadas restantes e descarta o que expirou ou saiu de cena. */
function tickDurations(durations: Record<string, number>, drop: string[]): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [id, rounds] of Object.entries(durations)) {
        if (drop.includes(id)) continue
        const left = rounds - 1
        if (left > 0) out[id] = left
    }
    return out
}

export function encounterReducer(state: EncounterState, action: EncounterAction): EncounterState {
    switch (action.type) {
        case 'hydrate':
            return action.state

        case 'addCombatants':
            return { ...state, combatants: sorted([...state.combatants, ...action.combatants]) }

        case 'duplicate': {
            const source = state.combatants.find((c) => c.id === action.id)
            if (!source || source.kind !== 'npc') return state
            const copy: NpcCombatant = {
                ...source,
                id: crypto.randomUUID(),
                name: nextCopyName(state.combatants, source.name),
                current: source.maxHp,
                temp: 0,
                conditions: {},
                durations: {},
                defeated: false,
                delayed: false,
            }
            return { ...state, combatants: sorted([...state.combatants, copy]) }
        }

        case 'remove': {
            // Se o removido estava agindo, o turno passa antes de ele sumir —
            // senão o encontro fica sem combatente ativo no meio da rodada.
            const base = state.activeId === action.id ? advance(state, []) : state
            const combatants = base.combatants.filter((c) => c.id !== action.id)
            return {
                ...base,
                combatants,
                activeId: combatants.some((c) => c.id === base.activeId) ? base.activeId : null,
            }
        }

        case 'patch':
            return {
                ...state,
                combatants: mapById(state.combatants, action.id, (c) => ({ ...c, ...action.patch } as Combatant)),
            }

        case 'setInitiative':
            return {
                ...state,
                combatants: sorted(
                    mapById(state.combatants, action.id, (c) => ({ ...c, initiative: action.value })),
                ),
            }

        case 'sortByInitiative':
            return { ...state, combatants: sorted(state.combatants) }

        case 'move': {
            const list = [...state.combatants]
            const i = list.findIndex((c) => c.id === action.id)
            const j = i + action.dir
            if (i === -1 || j < 0 || j >= list.length) return state
            ;[list[i], list[j]] = [list[j], list[i]]
            return { ...state, combatants: list }
        }

        case 'start': {
            const order = activeOrder(state)
            if (order.length === 0) return state
            return { ...state, round: 1, activeId: order[0].id }
        }

        case 'nextTurn':
            return state.activeId === null ? state : advance(state, action.drop)

        case 'prevTurn': {
            // Correção de clique: volta sem mexer em duração nenhuma, porque
            // "desandar" um tique reviveria condições já expiradas.
            const order = activeOrder(state)
            if (order.length === 0) return state
            const i = order.findIndex((c) => c.id === state.activeId)
            if (i === -1) return state
            const prevIndex = i - 1
            const wraps = prevIndex < 0
            return {
                ...state,
                activeId: order[(prevIndex + order.length) % order.length].id,
                round: Math.max(1, state.round - (wraps ? 1 : 0)),
            }
        }

        case 'delay': {
            const marked: EncounterState = {
                ...state,
                combatants: mapById(state.combatants, action.id, (c) => ({ ...c, delayed: true })),
            }
            return state.activeId === action.id ? advance(marked, action.drop) : marked
        }

        case 'returnFromDelay': {
            // RAW: ao voltar de Adiar, a iniciativa passa a ser PERMANENTEMENTE
            // a nova posição — senão o próximo "Reordenar" teleporta de volta.
            const returning = state.combatants.find((c) => c.id === action.id)
            if (!returning) return state
            const interrupted = state.combatants.find((c) => c.id === state.activeId)
            const initiative = interrupted ? interrupted.initiative : returning.initiative

            const rest = state.combatants.filter((c) => c.id !== action.id)
            const at = interrupted ? rest.findIndex((c) => c.id === interrupted.id) : 0
            const list = [...rest]
            list.splice(at < 0 ? 0 : at, 0, { ...returning, delayed: false, initiative })

            return { ...state, combatants: list, activeId: action.id, round: Math.max(1, state.round) }
        }

        case 'setDefeated': {
            const marked: EncounterState = {
                ...state,
                combatants: mapById(state.combatants, action.id, (c) => ({ ...c, defeated: action.value })),
            }
            // Marcar o combatente ativo como derrotado o tira da ordem; passar a
            // vez evita ficar com um `activeId` fora de `activeOrder`.
            return action.value && state.activeId === action.id ? advance(marked, []) : marked
        }

        case 'npcDamage': {
            const byId = new Map(action.entries.map((e) => [e.id, e.amount]))
            return {
                ...state,
                combatants: state.combatants.map((c) =>
                    c.kind === 'npc' && byId.has(c.id) ? damageNpc(c, byId.get(c.id)!) : c,
                ),
            }
        }

        case 'npcHeal': {
            const byId = new Map(action.entries.map((e) => [e.id, e.amount]))
            return {
                ...state,
                combatants: state.combatants.map((c) =>
                    c.kind === 'npc' && byId.has(c.id)
                        ? { ...c, current: clampHp(c.current + byId.get(c.id)!, c.maxHp) }
                        : c,
                ),
            }
        }

        case 'npcSetTemp':
            return {
                ...state,
                combatants: mapById(state.combatants, action.id, (c) =>
                    c.kind === 'npc' ? { ...c, temp: Math.max(0, Math.floor(action.amount)) } : c,
                ),
            }

        case 'setNpcCondition':
            return {
                ...state,
                combatants: mapById(state.combatants, action.id, (c) => {
                    if (c.kind !== 'npc') return c
                    const conditions = { ...c.conditions }
                    const durations = { ...c.durations }
                    if (action.value <= 0) {
                        delete conditions[action.conditionId]
                        delete durations[action.conditionId]
                    } else {
                        conditions[action.conditionId] = action.value
                    }
                    return { ...c, conditions, durations }
                }),
            }

        case 'setDuration':
            return {
                ...state,
                combatants: mapById(state.combatants, action.id, (c) => {
                    const durations = { ...c.durations }
                    if (action.rounds === null || action.rounds <= 0) delete durations[action.conditionId]
                    else durations[action.conditionId] = Math.floor(action.rounds)
                    return { ...c, durations }
                }),
            }

        case 'endEncounter':
            return emptyEncounter()

        default:
            return state
    }
}

/** "Goblin Warrior" → "Goblin Warrior 2" → "Goblin Warrior 3"… */
function nextCopyName(list: Combatant[], name: string): string {
    const base = name.replace(/\s+\d+$/, '')
    const used = new Set(list.map((c) => c.name))
    for (let i = 2; i < 100; i++) {
        const candidate = `${base} ${i}`
        if (!used.has(candidate)) return candidate
    }
    return `${base} ${list.length + 1}`
}
