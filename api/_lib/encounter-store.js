// Encontros da Iniciativa, um por mapa (mais o "Sem mapa"), para o GM abrir o
// mesmo encontro em qualquer aparelho.
//
// No Postgres (migration `encontros`): uma linha por (mesa, mapa) com o
// documento inteiro — o mesmo `EncounterState` que o aparelho guarda no
// `localStorage`. A última escrita vence. Cada escrita é transmitida (só o
// aviso, sem o documento) no canal `mesa:<mesa>:encounters`.
//
// Quem valida o CONTEÚDO é o cliente, ao ler (`sanitizeEncounter` em
// encounterStorage.ts, o mesmo do `localStorage`); aqui só a forma e o tamanho,
// porque o endpoint é público.
//
// Sem banco, cai num Map de processo por mesa, como os outros stores.

import { supabase } from './supabase.js'
import { isValidMapId } from './map-store.js'

export const MAX_ENCOUNTER_BYTES = 256 * 1024
const MAX_COMBATANTS = 80

/** `map` do pedido → a chave da linha: o id do mapa, ou '' para o "Sem mapa". */
export function encounterKey(map) {
    if (map === null || map === undefined || map === '' || map === 'none') return ''
    return isValidMapId(map) ? map : null
}

/** Um `EncounterState` reconhecível e dentro do teto, ou `null`. */
export function isValidEncounter(state) {
    if (!state || typeof state !== 'object' || state.version !== 1) return false
    if (!Array.isArray(state.combatants) || state.combatants.length > MAX_COMBATANTS) return false
    return JSON.stringify(state).length <= MAX_ENCOUNTER_BYTES
}

const memory = new Map()

const dbStore = (db) => {
    const check = ({ data, error }) => {
        if (error) throw error
        return data
    }
    return {
        read: async (mesa, key) => {
            const row = check(await db.from('encounters').select('state, updated_at')
                .eq('mesa', mesa).eq('map_key', key).maybeSingle())
            return row ? { state: row.state, updatedAt: Number(row.updated_at) } : null
        },
        mapExists: async (mesa, id) => !!check(await db.from('maps').select('id').eq('mesa', mesa).eq('id', id).maybeSingle()),
        write: async (mesa, key, state, updatedAt, by) => {
            check(await db.from('encounters').upsert({ mesa, map_key: key, state, updated_at: updatedAt, updated_by: by }))
        },
    }
}

const memoryStore = {
    read: async (mesa, key) => memory.get(`${mesa}|${key}`) ?? null,
    mapExists: async () => true,
    write: async (mesa, key, state, updatedAt) => { memory.set(`${mesa}|${key}`, { state, updatedAt }) },
}

const store = () => {
    const db = supabase()
    return db ? dbStore(db) : memoryStore
}

/** `{ state, updatedAt }` do encontro, ou `null` quando ninguém o subiu ainda. */
export const readEncounter = (mesa, key) => store().read(mesa, key)

/**
 * Grava o encontro e devolve o `updatedAt` (ms, do servidor), ou `null` se o
 * mapa não existe mais — o encontro de um mapa apagado não volta a nascer.
 */
export async function writeEncounter(mesa, key, state, by = null) {
    const db = store()
    if (key && !(await db.mapExists(mesa, key))) return null
    const updatedAt = Date.now()
    await db.write(mesa, key, state, updatedAt, by)
    return updatedAt
}
