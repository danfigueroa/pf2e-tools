import type { ConditionModifiers } from '../character-viewer/conditions'
import type { ConditionState } from '../character-viewer/components/useConditions'
import type { AfflictionState, SaveDegree } from './afflictions'
import type { PersistentDamage } from './persistentDamage'
import type { DamageBreakdown } from './damage'

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
    /** Venenos e doenças. As do personagem vivem na mesa, não aqui. */
    afflictions?: AfflictionState[]
    /** Dano persistente. Mesma divisão das aflições: o do personagem é da mesa. */
    persistent?: PersistentDamage[]
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
    afflictions: AfflictionState[]
    persistent: PersistentDamage[]
    mods: ConditionModifiers
    defense: TargetDefense
    applyDamage: (amount: number) => void
    /**
     * Dano com tipo: passa por imunidade, fraqueza e resistência antes de bater
     * no PV, e devolve o memorial. É por aqui que entram o dano de estágio de
     * aflição e o dano persistente — um veneno não fere quem é imune a veneno.
     */
    applyTypedDamage: (amount: number, type: string) => DamageBreakdown
    /** Restaura PV e PV temporário exatos — é o que o "Desfazer" usa. */
    setVitals: (current: number, temp: number) => void
    applyHealing: (amount: number) => void
    setTemp: (amount: number) => void
    setCondition: (id: string, value: number) => void
    toggleCondition: (id: string) => void
    addAffliction: (affliction: AfflictionState) => void
    removeAffliction: (afflictionId: string) => void
    saveAffliction: (afflictionId: string, degree: SaveDegree) => void
    advanceAffliction: (afflictionId: string, by: number) => void
    /** Lista inteira de uma vez: os componentes calculam a nova com os
     *  helpers puros de `persistentDamage.ts`. */
    setPersistent: (list: PersistentDamage[]) => void
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
