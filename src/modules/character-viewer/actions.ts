/**
 * As ações do turno: 3 por turno, a reação (1 por rodada) e o que mexe nelas.
 *
 * - **Lento X** tira X ações no início do turno; **Atordoado X** também. Os dois
 *   NÃO somam — o atordoado consome primeiro e o lento só tira o que sobra —,
 *   então o que se perde é o MAIOR dos dois.
 * - **Acelerado** (Haste) dá 1 ação a mais, que só pode ser usada para fazer um
 *   Golpe ou Andar (Stride). É uma ação de 1 só: uma atividade de 2 ações não
 *   a usa. Ao gastar um Golpe ou um Andar, ela vai primeiro — assim as ações
 *   gerais sobram para o resto.
 *
 * O app só CONTA: gastar mais do que tem é permitido (uma ação livre mal
 * classificada não pode travar a ficha), mas avisa. O estado é da MESA (campo
 * `actions`) e a Iniciativa o zera quando o turno do personagem começa.
 */
import type { ConditionModifiers } from './conditions'

export const BASE_ACTIONS = 3

/** O que fica gravado na mesa. */
export interface ActionsStored {
    /** Ações gerais já gastas neste turno. */
    used: number
    /** A ação extra do Acelerado já foi gasta. */
    quickUsed: boolean
    /** A reação da rodada já foi usada. */
    reacted: boolean
    /** Carimbo do último "novo turno" (ms): a Iniciativa e o botão o atualizam. */
    turn: number
}

export const NO_ACTIONS: ActionsStored = { used: 0, quickUsed: false, reacted: false, turn: 0 }

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

export function sanitizeActions(raw: unknown): ActionsStored {
    if (!raw || typeof raw !== 'object') return NO_ACTIONS
    const r = raw as Partial<ActionsStored>
    return {
        used: finite(r.used) ? Math.min(9, Math.max(0, Math.floor(r.used))) : 0,
        quickUsed: !!r.quickUsed,
        reacted: !!r.reacted,
        turn: finite(r.turn) && r.turn > 0 ? r.turn : 0,
    }
}

export const isActionsEmpty = (s: ActionsStored) => s.used === 0 && !s.quickUsed && !s.reacted && s.turn === 0

/** Um turno novo: tudo volta, e o carimbo marca quando. */
export const newTurn = (now = Date.now()): ActionsStored => ({ used: 0, quickUsed: false, reacted: false, turn: now })

export interface ActionBudget {
    /** Ações gerais do turno depois de Lento/Atordoado. */
    base: number
    /** Quantas se perdem por Lento/Atordoado (0 se nenhum). */
    lost: number
    slowed: number
    stunned: number
    /** Tem a ação extra do Acelerado. */
    quick: boolean
}

export function actionBudget(mods: ConditionModifiers): ActionBudget {
    const value = (id: string) => mods.active.find((c) => c.id === id)?.value ?? 0
    const slowed = value('slowed')
    const stunned = value('stunned')
    const lost = Math.max(slowed, stunned)
    return {
        base: Math.max(0, BASE_ACTIONS - lost),
        lost,
        slowed,
        stunned,
        quick: mods.active.some((c) => c.id === 'quickened'),
    }
}

export interface ActionsLeft {
    base: number
    quick: number
    total: number
}

export function actionsLeft(stored: ActionsStored, budget: ActionBudget): ActionsLeft {
    const base = Math.max(0, budget.base - stored.used)
    const quick = budget.quick && !stored.quickUsed ? 1 : 0
    return { base, quick, total: base + quick }
}

/** `move-attack` = Golpe ou Andar, o único uso da ação extra do Acelerado. */
export type ActionKind = 'any' | 'move-attack'

const usesQuick = (stored: ActionsStored, budget: ActionBudget, cost: number, kind: ActionKind) =>
    kind === 'move-attack' && cost === 1 && budget.quick && !stored.quickUsed

/** Quantas ações FALTAM para pagar este custo (0 = cabe). */
export function shortfall(stored: ActionsStored, budget: ActionBudget, cost: number, kind: ActionKind): number {
    if (cost <= 0) return 0
    if (usesQuick(stored, budget, cost, kind)) return 0
    return Math.max(0, cost - actionsLeft(stored, budget).base)
}

export function applySpend(stored: ActionsStored, budget: ActionBudget, cost: number, kind: ActionKind): ActionsStored {
    if (cost <= 0) return stored
    if (usesQuick(stored, budget, cost, kind)) return { ...stored, quickUsed: true }
    return { ...stored, used: Math.min(9, stored.used + cost) }
}

/**
 * Quantas ações a magia custa, lendo o campo `actions` da AON ("1", "2", "3",
 * "Two Actions"…). Reação, ação livre e o que não se lê (ex.: "1 to 3") não
 * gastam nada: `null` = não sei, e o app não descobre sozinho.
 */
export function actionCost(actions: string | number | undefined | null): number | null {
    if (actions == null) return null
    const s = String(actions).toLowerCase().replace(/\s+/g, '')
    if (s === '1' || s === 'oneaction' || s === 'singleaction' || s === 'one') return 1
    if (s === '2' || s === 'twoactions' || s === 'two') return 2
    if (s === '3' || s === 'threeactions' || s === 'three') return 3
    return null
}
