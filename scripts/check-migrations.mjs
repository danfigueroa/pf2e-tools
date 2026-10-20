// Confere as migrations PENDENTES contra o banco de produção, dentro de uma
// transação que termina em ROLLBACK — nada é gravado.
//
// Existe porque o projeto não usa Docker (nada de `supabase start`/`db reset`
// local), o plano gratuito não tem branch de preview e a integração com o
// GitHub aplica `supabase/migrations/` sozinha no push da `main`: este é o
// último ponto em que um SQL quebrado ainda não chegou em produção.
//
//   node --env-file=.env scripts/check-migrations.mjs
//
// Precisa do `psql` (>= 17) e de SUPABASE_DB_URL no .env. Quase todo DDL do
// Postgres é transacional; o que não é (CREATE INDEX CONCURRENTLY, VACUUM) não
// pode ser conferido assim, e o psql avisa com erro.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'supabase/migrations'
const url = process.env.SUPABASE_DB_URL
if (!url) {
    console.error('Falta SUPABASE_DB_URL no .env (string de conexão do pooler, modo sessão).')
    process.exit(2)
}

// A conexão vai pelas variáveis do libpq, não pela linha de comando: assim a
// senha não aparece na lista de processos nem na mensagem de um erro.
const conn = new URL(url)
const env = {
    ...process.env,
    PGHOST: conn.hostname,
    PGPORT: conn.port || '5432',
    PGUSER: decodeURIComponent(conn.username),
    PGPASSWORD: decodeURIComponent(conn.password),
    PGDATABASE: conn.pathname.slice(1) || 'postgres',
    PGSSLMODE: conn.searchParams.get('sslmode') ?? 'require',
}

const psql = (args, input) =>
    execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], {
        input,
        env,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    })

const query = (sql) => psql(['-tA', '-c', sql]).trim()

// Antes da primeira migration aplicada a tabela de controle não existe — e o
// Postgres resolve a tabela antes de avaliar qualquer `where`, então são duas
// consultas.
const hasHistory = query(`select to_regclass('supabase_migrations.schema_migrations') is not null`) === 't'
const applied = new Set(
    hasHistory ? query('select version from supabase_migrations.schema_migrations').split(/\s+/).filter(Boolean) : [],
)

const pending = readdirSync(DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()
    .filter((f) => !applied.has(f.split('_')[0]))

if (pending.length === 0) {
    console.log('Nenhuma migration pendente.')
    process.exit(0)
}

// Todas numa transação só, na ordem: a segunda pode depender da primeira.
const script = [
    'begin;',
    ...pending.map((f) => `\\echo '→ ${f}'\n${readFileSync(join(DIR, f), 'utf8')}`),
    'rollback;',
].join('\n')

try {
    const out = psql(['-f', '-'], script)
    process.stdout.write(out)
    console.log(`OK: ${pending.length} migration(s) rodaram sem erro e foram desfeitas.`)
} catch (error) {
    process.stdout.write(error.stdout ?? '')
    console.error(error.stderr || 'psql falhou sem mensagem.')
    console.error('FALHOU: nada foi gravado. Corrija antes do commit.')
    process.exit(1)
}
