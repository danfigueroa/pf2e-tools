// Confere o resumo do histórico da mesa que o BANCO monta (`diary_summary`, SQL)
// contra o que o CLIENTE calcula (`summarize` em `session-diary/stats.ts`) a
// partir das mesmas rolagens, em todo dia de jogo de toda mesa. As duas contas
// são escritas à mão em duas línguas; este é o teste de que dizem o mesmo.
//
//   node --env-file=.env scripts/check-diary.mjs
//
// Só lê. Sai com código diferente de zero na primeira divergência de cada dia.

import { register } from 'node:module'

register('./ts-loader.mjs', import.meta.url)

const { isSupabaseConfigured } = await import('../api/_lib/supabase.js')
const { MESA_IDS } = await import('../api/_lib/mesas.js')
const { readDiaryDays, readDiaryRolls, readDiarySummary } = await import('../api/_lib/roll-store.js')
const { sanitizeTableRoll } = await import('../src/dice/tableRoll.ts')
const { summarize } = await import('../src/modules/session-diary/stats.ts')

if (!isSupabaseConfigured()) {
    console.error('Sem credenciais do Supabase: rode com --env-file=.env.')
    process.exit(2)
}

let days = 0
let rows = 0
let failures = 0
for (const mesa of MESA_IDS) {
    const t0 = Date.now()
    const summary = await readDiarySummary(mesa)
    const ms = Date.now() - t0
    for (const { day } of await readDiaryDays(mesa)) {
        days++
        const fromDb = summary.filter((s) => s.day === day)
        // O cliente revalida o que vem do banco (`fetchDiaryRolls`): confere com a mesma porta.
        const rolls = (await readDiaryRolls(mesa, day)).map(sanitizeTableRoll).filter(Boolean)
        const fromClient = summarize(rolls)
        rows += fromDb.length
        const a = JSON.stringify(fromDb)
        const b = JSON.stringify(fromClient)
        if (a !== b) {
            failures++
            console.error(`✗ ${mesa} ${day}: o banco e o cliente divergem`)
            console.error('  banco:  ', a.slice(0, 600))
            console.error('  cliente:', b.slice(0, 600))
        }
    }
    console.log(`${mesa}: resumo em ${ms} ms, ${summary.length} linhas`)
}
console.log(`${days} dia(s), ${rows} linha(s) de resumo, ${failures} divergência(s).`)
process.exit(failures ? 1 : 0)
