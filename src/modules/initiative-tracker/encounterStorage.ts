// Persistência do encontro. Fica SÓ neste aparelho, de propósito: o encontro é
// do GM, enquanto PV e condições dos personagens são da mesa (Redis) e chegam
// pelo `useEncounterParty`.

import { CONDITIONS_BY_ID } from '../character-viewer/conditions'
import { sanitizeAfflictions } from './afflictions'
import { sanitizePersistent } from './persistentDamage'
import { emptyEncounter } from './encounterReducer'
import type { Combatant, EncounterState, NpcCombatant, PcCombatant } from './types'

const STORAGE_KEY = 'pf2e:initiative:v1'

const num = (value: unknown, fallback = 0): number => {
    const n = typeof value === 'string' ? parseInt(value, 10) : value
    return typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback
}

const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** `{ tipo: valor }` com valores numéricos e chaves em minúsculas. */
function numberMap(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const n = num(raw, NaN)
        if (Number.isFinite(n)) out[key.toLowerCase()] = n
    }
    return out
}

/** Só ids que ainda existem no catálogo, com valor mínimo 1. */
function conditionMap(value: unknown): Record<string, number> {
    const out: Record<string, number> = {}
    for (const [id, raw] of Object.entries(numberMap(value))) {
        if (!CONDITIONS_BY_ID[id]) continue
        out[id] = Math.max(1, raw)
    }
    return out
}

function sanitizeCombatant(raw: unknown): Combatant | null {
    if (!raw || typeof raw !== 'object') return null
    const c = raw as Record<string, unknown>
    if (typeof c.id !== 'string' || typeof c.name !== 'string') return null

    const base = {
        id: c.id,
        name: c.name,
        initiative: num(c.initiative),
        level: num(c.level),
        ac: num(c.ac),
        perception: c.perception === undefined ? undefined : num(c.perception),
        delayed: c.delayed === true,
        defeated: c.defeated === true,
        durations: numberMap(c.durations),
        resistances: numberMap(c.resistances),
        weaknesses: numberMap(c.weaknesses),
        immunities: strings(c.immunities).map((i) => i.toLowerCase()),
        defenseNotes: strings(c.defenseNotes),
    }

    if (c.kind === 'npc') {
        const maxHp = Math.max(1, num(c.maxHp, 1))
        const npc: NpcCombatant = {
            ...base,
            kind: 'npc',
            maxHp,
            current: Math.min(maxHp, Math.max(0, num(c.current, maxHp))),
            temp: Math.max(0, num(c.temp)),
            conditions: conditionMap(c.conditions),
            afflictions: sanitizeAfflictions(c.afflictions),
            persistent: sanitizePersistent(c.persistent),
            traits: strings(c.traits),
            aonUrl: typeof c.aonUrl === 'string' ? c.aonUrl : undefined,
        }
        return npc
    }

    if (typeof c.slug !== 'string' || !c.slug) return null
    const pc: PcCombatant = {
        ...base,
        kind: 'pc',
        slug: c.slug,
        baseMaxHp: Math.max(1, num(c.baseMaxHp, 1)),
        klass: typeof c.klass === 'string' ? c.klass : undefined,
        presetFile: typeof c.presetFile === 'string' ? c.presetFile : undefined,
    }
    return pc
}

export function loadEncounter(): EncounterState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return emptyEncounter()
        const parsed = JSON.parse(raw) as Record<string, unknown>
        if (parsed?.version !== 1) return emptyEncounter()

        const combatants = (Array.isArray(parsed.combatants) ? parsed.combatants : [])
            .map(sanitizeCombatant)
            .filter((c): c is Combatant => c !== null)

        const activeId = typeof parsed.activeId === 'string' ? parsed.activeId : null

        return {
            version: 1,
            round: Math.max(0, num(parsed.round)),
            // Um `activeId` que não existe mais deixaria o encontro sem turno ativo
            // e sem forma de avançar.
            activeId: combatants.some((c) => c.id === activeId) ? activeId : null,
            combatants,
        }
    } catch {
        return emptyEncounter()
    }
}

export function saveEncounter(state: EncounterState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        // quota estourada — o encontro continua vivo em memória
    }
}

/**
 * Acrescenta combatentes ao encontro guardado, sem passar pela página.
 *
 * É como o módulo de escalar monstro entrega um monstro pronto: grava aqui e
 * navega para /iniciativa, que monta o estado inicial com `loadEncounter()`.
 *
 * Seguro porque a página de Iniciativa só escreve enquanto está montada — o
 * efeito de gravação limpa o próprio timer ao desmontar, então nada dela
 * sobrescreve o que foi acrescentado depois que o usuário saiu.
 */
export function appendCombatants(combatants: Combatant[]): void {
    if (combatants.length === 0) return
    const current = loadEncounter()
    saveEncounter({ ...current, combatants: [...current.combatants, ...combatants] })
}
