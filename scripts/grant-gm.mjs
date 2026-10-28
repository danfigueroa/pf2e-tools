// Bootstrap do primeiro GM de uma mesa — o ovo e a galinha do login: só GM cria convite,
// e no começo não há GM. Duas formas:
//
//   node --env-file=.env scripts/grant-gm.mjs <mesa>                  → gera um CONVITE de GM (7 dias, 1 uso)
//   node --env-file=.env scripts/grant-gm.mjs <mesa> --user <usuário> → torna GM quem JÁ tem conta (em qualquer mesa)
//
// Quem abre o link do convite cria ali o usuário e a senha (ou entra, se já tem conta). Depois do
// primeiro GM, os outros convites saem pela própria tela de membros.

import { randomInt } from 'node:crypto'

const { supabase, isSupabaseConfigured } = await import('../api/_lib/supabase.js')
const { MESA_IDS } = await import('../api/_lib/mesas.js')

// Mesmo endereço do `og:image` do index.html — troque junto se o domínio mudar.
const SITE = 'https://pathfinder.danielfigueroa.dev'
const USER_DOMAIN = 'covil.local' // o "e-mail" fictício das contas (api/_lib/auth-handler.js)

const [mesa, flag, username] = process.argv.slice(2)
if (!MESA_IDS.includes(mesa)) {
    console.error(`Uso: grant-gm.mjs <mesa> [--user <usuário>]\nMesas: ${MESA_IDS.join(', ')}`)
    process.exit(2)
}
if (!isSupabaseConfigured()) {
    console.error('Sem credenciais do Supabase: rode com --env-file=.env.')
    process.exit(2)
}
const db = supabase()

if (flag === '--user') {
    if (!username) {
        console.error('Falta o usuário.')
        process.exit(2)
    }
    const email = `${username.trim().toLowerCase()}@${USER_DOMAIN}`
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw error
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
        console.error(`Ninguém com o usuário ${username}. Gere um convite de GM (sem --user) e crie a conta por ele.`)
        process.exit(1)
    }
    const { error: upsertError } = await db
        .from('mesa_members')
        .upsert({ mesa, user_id: user.id, role: 'gm' }, { onConflict: 'mesa,user_id' })
    if (upsertError) throw upsertError
    console.log(`${username} agora é GM de ${mesa}.`)
} else {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // mesmo do servidor: sem 0/O/1/I/L
    let code = ''
    for (let i = 0; i < 12; i += 1) code += alphabet[randomInt(alphabet.length)]
    const { error } = await db.from('mesa_invites').insert({
        code,
        mesa,
        role: 'gm',
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        max_uses: 1,
    })
    if (error) throw error
    console.log(`Convite de GM para ${mesa} (vale 7 dias, 1 uso):\n  código: ${code}\n  link:   ${SITE}/convite/${code}`)
}
