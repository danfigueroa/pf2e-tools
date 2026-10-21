// Persistência do encontro neste aparelho. O `localStorage` pinta a página na
// hora e segura o encontro sem rede; a cópia da NUVEM (`useEncounterCloud`) é a
// que leva o encontro a outro aparelho do GM. PV e condições dos personagens não
// moram aqui: são da mesa e chegam pelo `useEncounterParty`.
//
// Um encontro POR MAPA de combate: o GM prepara o do Mapa X e o do Mapa Y antes
// da sessão, e trocar de mapa na Iniciativa troca o encontro. A chave antiga
// (sem mapa) continua sendo o encontro "Sem mapa" — nada do que já estava
// guardado se perde.
//
// As três chaves são da mesa (`mesaKey`): o encontro "Sem mapa" e o mapa aberto
// de uma mesa não aparecem na outra, mesmo com o GM no mesmo navegador.

import { CONDITIONS_BY_ID } from '../character-viewer/conditions'
import { sanitizeAfflictions } from './afflictions'
import { sanitizePersistent } from './persistentDamage'
import { emptyEncounter } from './encounterReducer'
import type { ScaleOverrides } from '../monster-scaler/types'
import type { Combatant, EncounterState, NpcCombatant, NpcShield, PcCombatant } from './types'
import type { ShieldItem } from '../character-viewer/shield'
import { sanitizeFit } from '../battle-map/tokenFit'
import { mesaKey } from '../../services/mesa'

const STORAGE_KEY = mesaKey('pf2e:initiative:v1')
const MAP_KEY_PREFIX = mesaKey('pf2e:initiative:v1:map:')
const CURRENT_MAP_KEY = mesaKey('pf2e:initiative:map')
const SYNC_KEY_PREFIX = mesaKey('pf2e:initiative:sync:')

const keyFor = (mapId: string | null) => (mapId ? MAP_KEY_PREFIX + mapId : STORAGE_KEY)

/** O mapa cujo encontro está aberto na Iniciativa (`null` = "Sem mapa"). */
export function currentMapId(): string | null {
    try { return localStorage.getItem(CURRENT_MAP_KEY) || null } catch { return null }
}

export function setCurrentMapId(mapId: string | null): void {
    try {
        if (mapId) localStorage.setItem(CURRENT_MAP_KEY, mapId)
        else localStorage.removeItem(CURRENT_MAP_KEY)
    } catch {
        // sem storage: a troca vale só nesta aba
    }
}

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

/**
 * Ajustes de degrau do escalar monstro: só chave e valor em texto entram.
 * `scaleMonster` valida a coluna contra a tabela, então um degrau inventado
 * aqui não vira número errado — cai fora lá.
 */
function scaleOverrides(value: unknown): ScaleOverrides | undefined {
    if (!value || typeof value !== 'object') return undefined
    const out: Record<string, string> = {}
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (typeof raw === 'string') out[key] = raw
    }
    return Object.keys(out).length > 0 ? (out as ScaleOverrides) : undefined
}

function npcShield(value: unknown): NpcShield | undefined {
    if (!value || typeof value !== 'object') return undefined
    const v = value as Record<string, unknown>
    const maxHp = num(v.maxHp, 0)
    if (maxHp <= 0) return undefined
    return {
        name: typeof v.name === 'string' ? v.name : 'Escudo',
        bonus: Math.max(0, num(v.bonus, 2)),
        hardness: Math.max(0, num(v.hardness)),
        maxHp,
        bt: Math.max(0, Math.min(maxHp, num(v.bt, Math.floor(maxHp / 2)))),
        canBlock: v.canBlock !== false,
        hp: Math.max(0, Math.min(maxHp, num(v.hp, maxHp))),
        raised: v.raised === true,
    }
}

function shieldItem(value: unknown): ShieldItem | undefined {
    if (!value || typeof value !== 'object') return undefined
    const v = value as Record<string, unknown>
    if (typeof v.name !== 'string' || !v.name) return undefined
    const bonus = v.bonus == null ? null : num(v.bonus, NaN)
    return {
        name: v.name,
        runes: strings(v.runes),
        bonus: bonus === null || Number.isFinite(bonus) ? bonus : null,
        canBlock: v.canBlock === true,
        destructive: v.destructive === true,
    }
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
        size: typeof c.size === 'string' ? c.size : undefined,
        speed: typeof c.speed === 'number' && c.speed > 0 ? Math.floor(c.speed) : undefined,
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
            aonName: typeof c.aonName === 'string' ? c.aonName : undefined,
            scaleOverrides: scaleOverrides(c.scaleOverrides),
            shield: npcShield(c.shield),
            tokenImage: typeof c.tokenImage === 'string' ? c.tokenImage : undefined,
            companionOf: typeof c.companionOf === 'string' ? c.companionOf : undefined,
            companionId: typeof c.companionId === 'string' ? c.companionId : undefined,
            tokenFit: c.tokenFit && typeof c.tokenFit === 'object' ? (({ x, y, z }) => ({ x, y, z }))(sanitizeFit(c.tokenFit)) : undefined,
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
        shieldItem: shieldItem(c.shieldItem),
    }
    return pc
}

/**
 * Um encontro lido de fora — do `localStorage` ou da nuvem — no formato que o
 * reducer espera. Vale para os dois caminhos: o banco só confere forma e
 * tamanho, então combatente estranho cai aqui, como sempre caiu.
 */
export function sanitizeEncounter(raw: unknown): EncounterState {
    const parsed = raw as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return emptyEncounter()

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
}

export function loadEncounter(mapId: string | null = currentMapId()): EncounterState {
    try {
        const raw = localStorage.getItem(keyFor(mapId))
        return raw ? sanitizeEncounter(JSON.parse(raw)) : emptyEncounter()
    } catch {
        return emptyEncounter()
    }
}

/**
 * O que este aparelho sabe da cópia na nuvem de um encontro: o `updatedAt` (do
 * servidor) da última versão que ele subiu ou baixou, e se mexeu desde então.
 * Sem relógio de aparelho na conta: quem decide é "a nuvem mudou desde a última
 * vez que eu a vi?" e "eu mudei?". Encontro guardado antes da nuvem não tem
 * registro e conta como mexido — ainda não subiu.
 */
export interface EncounterSync {
    cloudAt: number
    dirty: boolean
}

export function loadEncounterSync(mapId: string | null): EncounterSync {
    try {
        const raw = JSON.parse(localStorage.getItem(SYNC_KEY_PREFIX + (mapId ?? 'none')) ?? 'null') as Partial<EncounterSync> | null
        if (raw && typeof raw.cloudAt === 'number') return { cloudAt: raw.cloudAt, dirty: raw.dirty === true }
    } catch {
        // sem storage: tudo conta como ainda não sincronizado
    }
    return { cloudAt: 0, dirty: true }
}

export function saveEncounterSync(mapId: string | null, sync: EncounterSync): void {
    try {
        localStorage.setItem(SYNC_KEY_PREFIX + (mapId ?? 'none'), JSON.stringify(sync))
    } catch {
        // sem storage
    }
}

export function saveEncounter(state: EncounterState, mapId: string | null = currentMapId()): void {
    try {
        localStorage.setItem(keyFor(mapId), JSON.stringify(state))
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
 *
 * Entra no encontro do mapa que está aberto na Iniciativa, que é o que a página
 * vai mostrar ao chegar.
 */
export function appendCombatants(combatants: Combatant[]): void {
    if (combatants.length === 0) return
    const mapId = currentMapId()
    const current = loadEncounter(mapId)
    saveEncounter({ ...current, combatants: [...current.combatants, ...combatants] }, mapId)
    // A Iniciativa sobe o encontro ao abrir: o monstro novo não pode perder para a nuvem.
    saveEncounterSync(mapId, { ...loadEncounterSync(mapId), dirty: true })
}
