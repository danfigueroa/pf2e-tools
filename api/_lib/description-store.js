// Descrições prontas no banco (tabela global `descriptions`, a mesma das fichas publicadas): os endpoints de descrição
// (`/api/feats`, `/api/searches`, `/api/spells`) leem daqui antes de ir à AON e ao tradutor, e guardam o que resolverem.
// O catálogo inteiro é carregado de uma vez por `scripts/warm-catalog-descriptions.mjs`.
// A versão é a `CACHE_VERSION` do cliente (vem no corpo): mudou o payload, muda a versão e nada velho é servido.
import { isSupabaseConfigured, supabase } from './supabase.js'

const VERSION_RE = /^v\d{1,4}$/
const CHUNK = 200

/** `{ nome: payload }` do que já está no banco para estes nomes. */
export async function readStoredDescriptions(version, lang, kind, names) {
  if (!isSupabaseConfigured() || !VERSION_RE.test(String(version)) || names.length === 0) return {}
  const db = supabase()
  const out = {}
  for (let i = 0; i < names.length; i += CHUNK) {
    const { data, error } = await db.from('descriptions').select('name, payload')
      .eq('version', version).eq('lang', lang).eq('kind', kind).in('name', names.slice(i, i + CHUNK))
    if (error) throw error
    for (const row of data ?? []) out[row.name] = row.payload
  }
  return out
}

/** Grava só o que veio inteiro: com descrição e sem `translationPending` (nada de cachear inglês de tradução que falhou). */
export async function writeStoredDescriptions(version, lang, kind, bag) {
  if (!isSupabaseConfigured() || !VERSION_RE.test(String(version))) return 0
  const at = new Date().toISOString()
  const rows = Object.entries(bag)
    .filter(([, p]) => p && typeof p.description === 'string' && p.description.trim() && !p.translationPending)
    .map(([name, payload]) => ({ version, lang, kind, name, payload, updated_at: at }))
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase().from('descriptions').upsert(rows.slice(i, i + CHUNK))
    if (error) throw error
  }
  return rows.length
}

/** Teto do pré-carregamento em lote (`storedOnly`): uma lista do seletor de uma vez, só leitura do banco. */
export const STORED_ONLY_MAX = 400

/**
 * O banco primeiro; o que faltar, `resolve(missing)` (AON + tradução) e grava. `resolve` devolve `{ nome: payload }`
 * chaveado pelo nome de entrada. Sem versão válida, só resolve (cliente antigo). `storedOnly`: só o que já está no
 * banco, sem AON nem tradutor (o seletor pré-carrega a lista inteira assim e o clique fica instantâneo).
 */
export async function withStoredDescriptions({ kind, names, version, lang, storedOnly = false }, resolve) {
  const found = await readStoredDescriptions(version, lang, kind, storedOnly ? names.slice(0, STORED_ONLY_MAX) : names).catch((e) => {
    console.error('[descriptions] leitura falhou:', e?.message ?? e)
    return {}
  })
  if (storedOnly) return found
  const missing = names.filter((n) => !found[n])
  const resolved = missing.length ? await resolve(missing) : {}
  if (missing.length) {
    await writeStoredDescriptions(version, lang, kind, resolved).catch((e) => console.error('[descriptions] gravação falhou:', e?.message ?? e))
  }
  return { ...resolved, ...found }
}
