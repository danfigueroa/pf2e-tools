// Consultas à AON por nome (gear, items, shields), guardadas no Postgres: a primeira vez vai à AON,
// as seguintes leem do banco (tabela `aon_lookups`, global). Sem Supabase, só a AON — como antes.
// Só grava o que a AON achou: nome que ela não tem (item caseiro) é tentado de novo, é uma busca só.

import { supabase } from './supabase.js'

const CHUNK = 80

async function readLookups(db, kind, names) {
  const found = {}
  for (let i = 0; i < names.length; i += CHUNK) {
    const { data, error } = await db.from('aon_lookups').select('name, payload').eq('kind', kind).in('name', names.slice(i, i + CHUNK))
    if (error) throw error
    for (const row of data) found[row.name] = row.payload
  }
  return found
}

/**
 * @param {string} kind formato versionado, ex. 'gear:v1'
 * @param {string[]} names nomes de entrada
 * @param {(names: string[]) => Promise<Record<string, object>>} resolve a consulta de verdade
 */
export async function cachedLookup(kind, names, resolve) {
  const wanted = [...new Set(names.map((n) => String(n || '').trim()).filter(Boolean))]
  const db = supabase()
  if (!db || wanted.length === 0) return resolve(wanted)

  let out = {}
  try {
    out = await readLookups(db, kind, wanted)
  } catch (error) {
    // Banco fora do ar é só um miss: a AON responde como sempre.
    console.error('[lookup-cache] Falha ao ler:', error)
  }
  const missing = wanted.filter((n) => !(n in out))
  if (missing.length === 0) return out

  const fresh = await resolve(missing)
  Object.assign(out, fresh)
  const rows = Object.entries(fresh).map(([name, payload]) => ({ kind, name, payload }))
  if (rows.length > 0) {
    const { error } = await db.from('aon_lookups').upsert(rows, { onConflict: 'kind,name' })
    if (error) console.error('[lookup-cache] Falha ao gravar:', error)
  }
  return out
}
