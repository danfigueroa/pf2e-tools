import type { ConditionModifiers } from '../character-viewer/conditions'
import type { ConditionState } from '../character-viewer/components/useConditions'

export type CombatantKind = 'pc' | 'npc'

interface CombatantBase {
    id: string
    kind: CombatantKind
    name: string
    initiative: number
    /** Necessário para `computeConditionModifiers` (só Drenado usa nível). */
    level: number
    ac: number
    /** Bônus de percepção, só como sugestão de iniciativa para o GM. */
    perception?: number
    delayed: boolean
    defeated: boolean
    /** Rodadas restantes por condição. Ausente = sem prazo. */
    durations: Record<string, number>
    /** Tipo de dano canônico em inglês → valor. Aceita 'all', 'physical', 'energy'. */
    resistances: Record<string, number>
    weaknesses: Record<string, number>
    immunities: string[]
    /** Defesas com ressalva que nunca viram número — exibidas como aviso. */
    defenseNotes?: string[]
}

export interface PcCombatant extends CombatantBase {
    kind: 'pc'
    /** `charSlugFromName(name)` — a chave do estado compartilhado da mesa. */
    slug: string
    /** PV máximo da ficha, SEM o corte de Drenado (que é aplicado no render). */
    baseMaxHp: number
    klass?: string
    /** Preset de onde veio, para o botão "Reimportar" depois de um level-up. */
    presetFile?: string
}

export interface NpcCombatant extends CombatantBase {
    kind: 'npc'
    maxHp: number
    current: number
    temp: number
    conditions: ConditionState
    traits?: string[]
    aonUrl?: string
}

export type Combatant = PcCombatant | NpcCombatant

export interface EncounterState {
    version: 1
    /** 0 = combate ainda não iniciado. */
    round: number
    /** Id, nunca índice: sobrevive a inserção, remoção e reordenação. */
    activeId: string | null
    /** Já ordenado — a ordem do array é a ordem de turnos (ver encounterReducer). */
    combatants: Combatant[]
}

/**
 * O que o cartão de combatente consome. PC e NPC entram aqui iguais, apesar de
 * o estado de um vir da mesa (Redis) e o do outro do encontro (localStorage).
 */
export interface CombatantView {
    combatant: Combatant
    isActive: boolean
    current: number
    temp: number
    /** Já com o corte de Drenado aplicado. */
    maxHp: number
    maxHpDelta: number
    conditions: ConditionState
    mods: ConditionModifiers
    defense: TargetDefense
    applyDamage: (amount: number) => void
    applyHealing: (amount: number) => void
    setTemp: (amount: number) => void
    setCondition: (id: string, value: number) => void
    toggleCondition: (id: string) => void
    adjustCondition: (id: string, delta: number) => void
    clearConditions: () => void
    setDuration: (id: string, rounds: number | null) => void
}

/** Tudo que o cálculo de dano precisa saber sobre um alvo. */
export interface TargetDefense {
    resistances: Record<string, number>
    weaknesses: Record<string, number>
    immunities: string[]
    current: number
    temp: number
}
