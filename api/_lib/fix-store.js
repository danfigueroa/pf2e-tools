// Correções de tradução feitas pela mesa (migration `correcoes_de_traducao`):
// uma camada por cima da descrição traduzida, por (tipo, nome), que o cliente
// aplica na leitura (`src/services/translationFixes.ts`). Global, como as
// traduções. Cada gravação guarda a versão anterior em `previous`, que é o
// "Desfazer"; `fields` vazio é "voltar à tradução automática".
//
// Sem banco, cai num Map de processo, como os outros stores.

import { supabase } from './supabase.js'

export const FIX_KINDS = ['feat', 'special', 'item', 'spell']

/**
 * Os textos que a mesa pode corrigir, por tipo. Só prosa: número, traço e o
 * `defense` da magia (que a rolagem lê, nas duas línguas) ficam de fora.
 */
const FIELDS = {
    feat: ['description', 'prerequisites', 'trigger', 'requirements', 'frequency', 'cost', 'access'],
    special: ['description', 'prerequisites', 'trigger', 'requirements', 'frequency', 'cost', 'access'],
    item: ['description', 'prerequisites', 'trigger', 'requirements', 'frequency', 'cost', 'access'],
    spell: ['description'],
}

const MAX_FIELD_CHARS = 8000
const MAX_FIELDS_BYTES = 16384

export const isValidFixKey = (kind, name) =>
    FIX_KINDS.includes(kind) && typeof name === 'string' && name.trim().length > 0 && name.length <= 200

/**
 * Os campos corrigidos, limpos: só os do tipo, só texto, sem os vazios. `null`
 * quando algo não confere — o endpoint é público.
 */
export function sanitizeFixFields(kind, raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const out = {}
    for (const [field, value] of Object.entries(raw)) {
        if (!FIELDS[kind].includes(field)) return null
        if (typeof value !== 'string' || value.length > MAX_FIELD_CHARS) return null
        const text = value.replace(/\r\n/g, '\n').trim()
        if (text) out[field] = text
    }
    return JSON.stringify(out).length <= MAX_FIELDS_BYTES ? out : null
}

const fromRow = (row) => ({
    kind: row.kind,
    name: row.name,
    fields: row.fields ?? {},
    previous: row.previous ?? null,
    updatedAt: Number(row.updated_at),
})

const memory = new Map()

const dbStore = (db) => {
    const check = ({ data, error }) => {
        if (error) throw error
        return data
    }
    return {
        list: async () => check(await db.from('description_fixes').select('kind, name, fields, previous, updated_at')).map(fromRow),
        current: async (kind, name) => check(await db.from('description_fixes').select('fields')
            .eq('kind', kind).eq('name', name).maybeSingle())?.fields ?? null,
        write: async (row) => fromRow(check(await db.from('description_fixes').upsert(row)
            .select('kind, name, fields, previous, updated_at').single())),
    }
}

const memoryStore = {
    list: async () => [...memory.values()].map(fromRow),
    current: async (kind, name) => memory.get(`${kind}|${name}`)?.fields ?? null,
    write: async (row) => {
        memory.set(`${row.kind}|${row.name}`, row)
        return fromRow(row)
    },
}

const store = () => {
    const db = supabase()
    return db ? dbStore(db) : memoryStore
}

/** Todas as correções — são poucas, e o cliente guarda a lista inteira. */
export const listFixes = () => store().list()

/** Grava a correção (campos já limpos) e devolve a linha, com a anterior em `previous`. */
export async function saveFix(kind, name, fields, by = null) {
    const db = store()
    const previous = await db.current(kind, name)
    return db.write({ kind, name, fields, previous, updated_at: Date.now(), updated_by: by })
}
