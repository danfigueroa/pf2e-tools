// Copia do Upstash Redis para o Supabase o que já migrou de domínio, para o
// trabalho feito antes da troca (traduções pagas ao LLM, pacotes montados) não
// se perder. Só LÊ do Redis — nada lá é apagado; ele sai inteiro no fim da
// migração. Pode rodar de novo à vontade: tudo é upsert.
//
//   node --env-file=.env scripts/migrate-redis.mjs --domain translations [--dry-run]
//   node --env-file=.env scripts/migrate-redis.mjs --domain descriptions [--dry-run]
//
// Precisa das credenciais do Redis de PRODUÇÃO no .env (KV_REST_API_URL e
// KV_REST_API_TOKEN — na Vercel elas são sensíveis e não saem pelo `env pull`;
// copie da aba .env.local da store no painel da Upstash/Vercel) e das do Supabase.
//
// Mapeamento das chaves (a mesa legada não tem prefixo — ver api/_lib/mesas.js):
//   pf2e:tr:<sha1>                       → translations (global)
//   pf2e:sheet:desc:v1:<slug>            → descriptions + description_misses (globais)
//   pf2e:m:<mesa>:sheet:desc:v1:<slug>     + sheet_description_sets (da mesa)

import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const domain = args.includes('--domain') ? args[args.indexOf('--domain') + 1] : null
const dryRun = args.includes('--dry-run')
const DOMAINS = ['translations', 'descriptions']
if (!DOMAINS.includes(domain)) {
    console.error(`Uso: --domain ${DOMAINS.join('|')} [--dry-run]`)
    process.exit(2)
}

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
if (!redisUrl || !redisToken) {
    console.error('Faltam as credenciais do Redis (KV_REST_API_URL/KV_REST_API_TOKEN) no .env.')
    process.exit(2)
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.error('Faltam SUPABASE_URL/SUPABASE_SECRET_KEY no .env.')
    process.exit(2)
}

const redis = new Redis({ url: redisUrl, token: redisToken })
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
})

const LEGACY_MESA = 'casa-do-gordo'
const KINDS = ['spell', 'feat', 'special', 'item']
const WRITE_CHUNK = 500

async function scan(match) {
    const keys = []
    let cursor = '0'
    do {
        const [next, batch] = await redis.scan(cursor, { match, count: 1000 })
        cursor = String(next)
        keys.push(...batch)
    } while (cursor !== '0')
    return keys
}

async function upsert(table, rows, options) {
    for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
        const { error } = await db.from(table).upsert(rows.slice(i, i + WRITE_CHUNK), options)
        if (error) throw new Error(`${table}: ${error.message}`)
    }
}

async function migrateTranslations() {
    const keys = await scan('pf2e:tr:*')
    const rows = []
    for (let i = 0; i < keys.length; i += 100) {
        const chunk = keys.slice(i, i + 100)
        const values = await redis.mget(...chunk)
        values.forEach((v, n) => {
            const hash = chunk[n].slice('pf2e:tr:'.length)
            // Gravado como `{ t }` (ver aon.js). Sem o inglês: o Redis não o guardava.
            if (v && typeof v.t === 'string' && v.t.trim() && /^[0-9a-f]{40}$/.test(hash)) rows.push({ key: hash, pt: v.t })
        })
    }
    console.log(`Traduções no Redis: ${keys.length}; válidas: ${rows.length}`)
    // Não sobrescreve: o que já está no banco (inclusive com o inglês) vale mais.
    if (!dryRun) await upsert('translations', rows, { onConflict: 'key', ignoreDuplicates: true })
}

const usable = (entry) =>
    !!entry && typeof entry.description === 'string' && entry.description.trim().length > 0 && !entry.translationPending

function sheetFromKey(key) {
    const scoped = key.match(/^pf2e:m:([a-z0-9-]+):sheet:desc:v1:([a-z0-9-]+)$/)
    if (scoped) return { mesa: scoped[1], slug: scoped[2] }
    const legacy = key.match(/^pf2e:sheet:desc:v1:([a-z0-9-]+)$/)
    return legacy ? { mesa: LEGACY_MESA, slug: legacy[1] } : null
}

async function migrateDescriptions() {
    const keys = [...await scan('pf2e:sheet:desc:v1:*'), ...await scan('pf2e:m:*:sheet:desc:v1:*')]
    const descriptions = new Map()
    const misses = new Map()
    const sets = []
    for (const key of keys) {
        const sheet = sheetFromKey(key)
        const bundle = sheet ? await redis.get(key) : null
        if (!bundle?.entries || !/^v\d{1,4}$/.test(bundle.version ?? '')) {
            console.warn(`Ignorado: ${key}`)
            continue
        }
        const names = {}
        for (const kind of KINDS) {
            names[kind] = []
            for (const [name, payload] of Object.entries(bundle.entries[kind] ?? {})) {
                if (!usable(payload) || name.length > 120) continue
                names[kind].push(name)
                descriptions.set(`${bundle.version}|${kind}|${name}`, { version: bundle.version, kind, name, payload })
            }
            names[kind] = names[kind].slice(-300)
            for (const [name, at] of Object.entries(bundle.misses?.[kind] ?? {})) {
                if (typeof at === 'number' && name.length <= 120) {
                    misses.set(`${kind}|${name}`, { kind, name, missed_at: new Date(at).toISOString() })
                }
            }
        }
        sets.push({ ...sheet, version: bundle.version, names })
        console.log(`${sheet.mesa}/${sheet.slug} ${bundle.version}: ${KINDS.map((k) => `${k} ${names[k].length}`).join(', ')}`)
    }
    console.log(`Pacotes: ${sets.length}; descrições distintas: ${descriptions.size}; misses: ${misses.size}`)
    if (dryRun) return
    await upsert('descriptions', [...descriptions.values()])
    await upsert('description_misses', [...misses.values()])
    // A mesa precisa existir (chave estrangeira): mesa fora da lista é avisada e fica de fora.
    const { data: mesas } = await db.from('mesas').select('id')
    const valid = new Set((mesas ?? []).map((m) => m.id))
    for (const s of sets.filter((s) => !valid.has(s.mesa))) console.warn(`Mesa desconhecida, pacote ignorado: ${s.mesa}/${s.slug}`)
    await upsert('sheet_description_sets', sets.filter((s) => valid.has(s.mesa)))
}

await (domain === 'translations' ? migrateTranslations() : migrateDescriptions())
console.log(dryRun ? 'Dry-run: nada foi gravado.' : 'Feito.')
