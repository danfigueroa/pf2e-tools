import type { ConditionModifiers } from '../character-viewer/conditions'
import type { ConditionState } from '../character-viewer/components/useConditions'
import type { AfflictionState, SaveDegree } from './afflictions'
import type { PersistentDamage } from './persistentDamage'
import type { ScaleOverrides, SpellEdits } from '../monster-scaler/types'
import type { DamageBreakdown } from './damage'
import type { BlockResult, ShieldItem, ShieldStored } from '../character-viewer/shield'
import type { ShieldView } from '../character-viewer/components/useShield'

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
    /**
     * O escudo vestido, como a ficha descreve. Os números (Dureza, PV, BT) vêm
     * da AON na hora e o estado (PV, erguido) é da mesa, campo `shield` — o
     * mesmo da Ficha Virtual.
     */
    shieldItem?: ShieldItem
}

/**
 * O escudo de um monstro: números e estado juntos, no encontro. Vem do texto
 * da AON (`parseCreatureShield`) ou é definido à mão pelo GM.
 */
export interface NpcShield {
    name: string
    bonus: number
    hardness: number
    maxHp: number
    bt: number
    canBlock: boolean
    hp: number
    raised: boolean
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
    /**
     * Nome da criatura na AON — a chave para buscar a ficha completa.
     *
     * Guardado à parte porque o `name` do combatente DIVERGE dele: a cópia
     * numerada vira "Goblin Warrior 2" e o escalar monstro marca o nível em
     * "Bugbear Tormentor (N8)". Buscar pelo nome exibido não acharia nenhum
     * dos dois.
     */
    aonName?: string
    /**
     * Ajustes finos de degrau escolhidos no escalar monstro. Sem eles, reabrir
     * a ficha reescalaria pelos degraus da AON e mostraria números diferentes
     * dos que estão no próprio cartão — pior do que não mostrar ficha nenhuma.
     */
    scaleOverrides?: ScaleOverrides
    /** A lista de magias montada à mão no escalar monstro, com o nível dela. */
    spellEdits?: SpellEdits
    shield?: NpcShield
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
    /** O escudo resolvido (números + estado), ou `null` sem escudo conhecido. */
    shield: ShieldView | null
    /** Erguer/abaixar. Erguer um quebrado não faz nada. */
    setShieldRaised: (raised: boolean) => void
    /**
     * Bloqueio com Escudo: a Dureza segura, o resto vai para o PV (pelo mesmo
     * caminho do dano comum) e para o escudo. `null` se não pode bloquear.
     * `destructive` é o Destructive Block, que só vale com o talento.
     */
    blockDamage: (amount: number, destructive?: boolean) => BlockResult | null
    /** Estado exato do escudo — o "Desfazer". */
    restoreShield: (stored: ShieldStored) => void
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
