// Copia do Upstash Redis para o Supabase o que já migrou de domínio, para o
// trabalho feito antes da troca (traduções pagas ao LLM, pacotes montados) não
// se perder. Só LÊ do Redis — nada lá é apagado; ele sai inteiro no fim da
// migração. Pode rodar de novo à vontade: tudo é upsert.
//
//   node --env-file=.env scripts/migrate-redis.mjs --domain translations [--dry-run]
//   node --env-file=.env scripts/migrate-redis.mjs --domain descriptions [--dry-run]
//   node --env-file=.env scripts/migrate-redis.mjs --domain state [--dry-run]
//   node --env-file=.env scripts/migrate-redis.mjs --domain rolls [--dry-run]
//
// Precisa das credenciais do Redis de PRODUÇÃO no .env — KV_REST_API_URL e, de
// preferência, KV_REST_API_READ_ONLY_TOKEN (o script só lê; o KV_REST_API_TOKEN
// também serve). Na Vercel elas são sensíveis e não saem pelo `env pull`: copie
// da aba .env.local da store no painel. E as do Supabase.
//
// Mapeamento das chaves (a mesa legada não tem prefixo — ver api/_lib/mesas.js):
//   pf2e:tr:<sha1>                       → translations (global)
//   pf2e:sheet:desc:v1:<slug>            → descriptions + description_misses (globais)
//   pf2e:m:<mesa>:sheet:desc:v1:<slug>     + sheet_description_sets (da mesa)
//   pf2e:table:v1:<slug>                 → character_state, uma linha por campo do hash
//   pf2e:m:<mesa>:table:v1:<slug>          (só entra o que for MAIS NOVO que o banco:
//                                           pode rodar antes e depois do deploy)
//   pf2e:rolls:v1                        → rolls (a lista das últimas 30; as que já
//   pf2e:m:<mesa>:rolls:v1                 estão no banco ficam como estão)

import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const domain = args.includes('--domain') ? args[args.indexOf('--domain') + 1] : null
const dryRun = args.includes('--dry-run')
const DOMAINS = ['translations', 'descriptions', 'state', 'rolls']
if (!DOMAINS.includes(domain)) {
    console.error(`Uso: --domain ${DOMAINS.join('|')} [--dry-run]`)
    process.exit(2)
}

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.KV_REST_API_READ_ONLY_TOKEN
    || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
if (!redisUrl || !redisToken) {
    console.error('Faltam as credenciais do Redis (KV_REST_API_URL e KV_REST_API_READ_ONLY_TOKEN) no .env.')
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

const FIELD_RE = /^(hp|slots|conditions|afflictions|persistent|mythic|consumed|shield|token|size|rage|psyche|energy|magus|ranger|rogue|actions|uses|companions|pet:[a-z0-9:#-]{1,80})$/

function characterFromKey(key) {
    const scoped = key.match(/^pf2e:m:([a-z0-9-]+):table:v1:([a-z0-9-]+)$/)
    if (scoped) return { mesa: scoped[1], slug: scoped[2] }
    const legacy = key.match(/^pf2e:table:v1:([a-z0-9-]+)$/)
    return legacy ? { mesa: LEGACY_MESA, slug: legacy[1] } : null
}

async function migrateState() {
    const keys = [...await scan('pf2e:table:v1:*'), ...await scan('pf2e:m:*:table:v1:*')]
    const rows = []
    for (const key of keys) {
        const who = characterFromKey(key)
        if (!who) continue
        const hash = (await redis.hgetall(key)) ?? {}
        for (const [field, raw] of Object.entries(hash)) {
            // Cada campo é `{ v, data, updatedAt }`, às vezes já desserializado pelo SDK.
            let entry = raw
            if (typeof raw === 'string') { try { entry = JSON.parse(raw) } catch { entry = null } }
            if (!FIELD_RE.test(field) || !entry || entry.data == null) continue
            if (JSON.stringify(entry.data).length > 8 * 1024) continue
            rows.push({ ...who, field, data: entry.data, updated_at: Number(entry.updatedAt) || 0 })
        }
    }
    // O mais novo vence: uma escrita que já chegou ao banco pelo código novo não é desfeita.
    const { data: existing, error } = await db.from('character_state').select('mesa, slug, field, updated_at')
    if (error) throw new Error(`character_state: ${error.message}`)
    const inDb = new Map(existing.map((r) => [`${r.mesa}|${r.slug}|${r.field}`, Number(r.updated_at)]))
    const newer = rows.filter((r) => r.updated_at > (inDb.get(`${r.mesa}|${r.slug}|${r.field}`) ?? -1))
    const bySlug = {}
    for (const r of rows) bySlug[`${r.mesa}/${r.slug}`] = (bySlug[`${r.mesa}/${r.slug}`] ?? 0) + 1
    for (const [who, n] of Object.entries(bySlug)) console.log(`${who}: ${n} campo(s)`)
    console.log(`Personagens: ${keys.length}; campos: ${rows.length}; mais novos que o banco: ${newer.length}`)
    const { data: mesas } = await db.from('mesas').select('id')
    const valid = new Set((mesas ?? []).map((m) => m.id))
    if (!dryRun) await upsert('character_state', newer.filter((r) => valid.has(r.mesa)))
}

async function migrateRolls() {
    const keys = [...await scan('pf2e:rolls:v1'), ...await scan('pf2e:m:*:rolls:v1')]
    const rows = []
    for (const key of keys) {
        const mesa = key.match(/^pf2e:m:([a-z0-9-]+):rolls:v1$/)?.[1] ?? LEGACY_MESA
        const list = (await redis.lrange(key, 0, -1)) ?? []
        for (const raw of list) {
            let roll = raw
            if (typeof raw === 'string') { try { roll = JSON.parse(raw) } catch { roll = null } }
            // Já validadas na entrada (`sanitizeRoll`); aqui só o mínimo da tabela.
            if (!roll || !/^[a-z0-9-]{1,64}$/.test(roll.id ?? '') || typeof roll.at !== 'number') continue
            rows.push({ id: roll.id, mesa, at: roll.at, slug: roll.slug ?? null, roll })
        }
        console.log(`${mesa}: ${list.length} rolagem(ns)`)
    }
    // Na ordem em que foram feitas: o `seq` da sequência segue a ordem de inserção.
    rows.sort((a, b) => a.at - b.at)
    console.log(`Rolagens: ${rows.length}`)
    if (!dryRun) await upsert('rolls', rows, { onConflict: 'id', ignoreDuplicates: true })
}

await ({ translations: migrateTranslations, descriptions: migrateDescriptions, state: migrateState, rolls: migrateRolls })[domain]()
console.log(dryRun ? 'Dry-run: nada foi gravado.' : 'Feito.')
