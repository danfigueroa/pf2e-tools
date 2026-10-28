// Confere a matriz de acesso do servidor (login, papéis, convites, dono de ficha) contra o
// banco REAL, rodando o `routeState` em processo — o mesmo despacho do Vercel e do dev server.
//
//   node --env-file=.env scripts/check-auth.mjs
//
// Cria usuários de teste pela Admin API, usa a mesa `arton-1515` com slugs `teste-auth-*` e
// APAGA tudo no fim (mesmo se uma checagem falhar). Sai com código diferente de zero na falha.

import { createClient } from '@supabase/supabase-js'

const { supabase, isSupabaseConfigured } = await import('../api/_lib/supabase.js')
const { routeState } = await import('../api/_lib/state-router.js')
const { forgetMember, forgetOwner } = await import('../api/_lib/access.js')

const url = process.env.SUPABASE_URL
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!isSupabaseConfigured() || !publishable) {
    console.error('Faltam SUPABASE_URL / SUPABASE_SECRET_KEY / VITE_SUPABASE_PUBLISHABLE_KEY: rode com --env-file=.env.')
    process.exit(2)
}

const MESA = 'arton-1515'
const db = supabase()
const stamp = Date.now().toString(36)
const password = `Tmp-${stamp}-${Math.random().toString(36).slice(2)}`
const users = {} // nome → { id, token }
const slugs = [`teste-auth-a-${stamp}`, `teste-auth-u-${stamp}`]
const createdMaps = []
let failures = 0

const pass = (name) => console.log(`  ok   ${name}`)
function expect(name, got, want) {
    if (got === want) return pass(name)
    failures += 1
    console.log(`  FAIL ${name}: esperava ${want}, veio ${got}`)
}

function call({ token, method = 'GET', query = {}, body = {} }) {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} }
    return routeState({ req, method, query: { mesa: MESA, ...query }, body })
}

async function makeUser(name, { anonymous = false } = {}) {
    const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } })
    if (anonymous) {
        const { data, error } = await client.auth.signInAnonymously()
        if (error) throw error
        users[name] = { id: data.user.id, token: data.session.access_token }
        return
    }
    const email = `check-auth-${name}-${stamp}@example.test`
    const created = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) throw created.error
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    users[name] = { id: created.data.user.id, token: data.session.access_token }
}

const sheetJson = (name) => ({ build: { name, class: 'Teste', level: 1 } })

async function cleanup() {
    // Rolagens de teste entram no Histórico de Rolagens da mesa: saem todas.
    await db.from('rolls').delete().eq('mesa', MESA).like('id', `teste-auth-${stamp}%`)
    for (const id of createdMaps) await db.from('maps').delete().eq('mesa', MESA).eq('id', id)
    for (const slug of slugs) {
        await db.from('character_state').delete().eq('mesa', MESA).eq('slug', slug)
        await db.from('sheet_versions').delete().eq('mesa', MESA).eq('slug', slug)
        await db.from('sheets').delete().eq('mesa', MESA).eq('slug', slug)
    }
    for (const u of Object.values(users)) {
        await db.from('mesa_invites').delete().eq('created_by', u.id)
        await db.auth.admin.deleteUser(u.id) // cascata: mesa_members
    }
}

try {
    await makeUser('gm')
    await makeUser('a')
    await makeUser('b')
    await makeUser('out') // logado, sem convite
    await makeUser('anon', { anonymous: true })

    // O GM inicial entra por fora (é o que o script de bootstrap faz); os outros, por convite.
    await db.from('mesa_members').insert({ mesa: MESA, user_id: users.gm.id, role: 'gm' })
    forgetMember(MESA, users.gm.id)

    process.env.AUTH_REQUIRED = '1'

    console.log('Portão')
    expect('sem token → 401', (await call({ query: { char: slugs[0] } })).status, 401)
    expect('anônimo → 401', (await call({ token: users.anon.token, query: { char: slugs[0] } })).status, 401)
    expect('logado sem convite → 403', (await call({ token: users.out.token, query: { char: slugs[0] } })).status, 403)
    expect('GM lê → 200', (await call({ token: users.gm.token, query: { char: slugs[0] } })).status, 200)

    console.log('Convites')
    const inv = await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-create', maxUses: 1 } })
    expect('GM cria convite → 200', inv.status, 200)
    const code = inv.body.invite?.code
    expect('jogador não cria convite', (await call({ token: users.out.token, method: 'POST', body: { action: 'invite-create' } })).status, 403)
    expect('A resgata → 200', (await call({ token: users.a.token, method: 'POST', body: { action: 'invite-accept', code } })).status, 200)
    expect('B no mesmo convite (uso único) → 404', (await call({ token: users.b.token, method: 'POST', body: { action: 'invite-accept', code } })).status, 404)
    expect('A de novo não consome nem falha', (await call({ token: users.a.token, method: 'POST', body: { action: 'invite-accept', code } })).status, 200)

    const inv2 = await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-create', maxUses: 5 } })
    await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-revoke', code: inv2.body.invite.code } })
    expect('convite revogado → 404', (await call({ token: users.b.token, method: 'POST', body: { action: 'invite-accept', code: inv2.body.invite.code } })).status, 404)

    const inv3 = await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-create', maxUses: 5 } })
    await db.from('mesa_invites').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('code', inv3.body.invite.code)
    expect('convite vencido → 404', (await call({ token: users.b.token, method: 'POST', body: { action: 'invite-accept', code: inv3.body.invite.code } })).status, 404)

    const inv4 = await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-create', maxUses: 5 } })
    expect('B resgata outro → 200', (await call({ token: users.b.token, method: 'POST', body: { action: 'invite-accept', code: inv4.body.invite.code } })).status, 200)
    const me = await call({ token: users.a.token, query: { me: '1' } })
    expect('me lista a mesa com papel player', me.body.mesas?.find((m) => m.id === MESA)?.role, 'player')

    console.log('Conta por convite (usuário + senha, sem e-mail)')
    const pub2 = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } })
    const login = async (username, pass) => !(await pub2.auth.signInWithPassword({ email: `${username}@covil.local`, password: pass })).error
    const findUser = async (username) =>
        (await db.auth.admin.listUsers({ page: 1, perPage: 200 })).data.users.filter((u) => u.email === `${username}@covil.local`)
    const uname = `teste-${stamp}`.slice(0, 30)
    const reg = (code, username, pass = 'senha-123') =>
        call({ method: 'POST', body: { action: 'register', code, username, password: pass, name: 'Teste Cadastro' } })

    const regInv = await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-create', maxUses: 2 } })
    const regCode = regInv.body.invite.code
    expect('usuário inválido → 400', (await reg(regCode, 'A B')).status, 400)
    expect('senha curta → 400', (await reg(regCode, uname, '123')).status, 400)
    expect('cria conta SEM sessão → 200', (await reg(regCode, uname)).status, 200)
    const [created] = await findUser(uname)
    if (created) users.reg = { id: created.id }
    expect('entra com usuário e senha', await login(uname, 'senha-123'), true)
    expect('virou membro com o nome escolhido',
        (await db.from('mesa_members').select('display_name').eq('mesa', MESA).eq('user_id', created?.id).maybeSingle()).data?.display_name,
        'Teste Cadastro')
    expect('mesmo usuário de novo → 409', (await reg(regCode, uname)).status, 409)

    const spent = await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-create', maxUses: 1 } })
    await db.from('mesa_invites').update({ uses: 1 }).eq('code', spent.body.invite.code)
    expect('convite esgotado → 404', (await reg(spent.body.invite.code, `${uname}x`.slice(0, 30))).status, 404)
    expect('convite esgotado não deixa conta órfã', (await findUser(`${uname}x`.slice(0, 30))).length, 0)

    expect('jogador não gera senha nova', (await call({ token: users.a.token, method: 'POST', body: { action: 'member-reset-password', user: created?.id } })).status, 403)
    const reset = await call({ token: users.gm.token, method: 'POST', body: { action: 'member-reset-password', user: created?.id } })
    expect('GM gera senha nova → 200', reset.status, 200)
    expect('a senha antiga deixa de valer', await login(uname, 'senha-123'), false)
    expect('a provisória entra', await login(uname, reset.body.password), true)

    console.log('Fichas')
    const pub = (token, name) => call({ token, method: 'POST', body: { action: 'publish', sheet: sheetJson(name) } })
    expect('A publica ficha nova → 200', (await pub(users.a.token, `Teste Auth A ${stamp}`)).status, 200)
    forgetOwner(MESA, slugs[0])
    expect('A virou dono', (await db.from('sheets').select('owner_id').eq('mesa', MESA).eq('slug', slugs[0]).single()).data?.owner_id, users.a.id)
    expect('B publica por cima → 403', (await pub(users.b.token, `Teste Auth A ${stamp}`)).status, 403)
    expect('B pede o guia → 403', (await call({ token: users.b.token, method: 'POST', body: { action: 'guide', char: slugs[0] } })).status, 403)
    expect('B restaura → 403', (await call({ token: users.b.token, method: 'POST', body: { action: 'restore', char: slugs[0] } })).status, 403)
    expect('GM publica por cima → 200', (await pub(users.gm.token, `Teste Auth A ${stamp}`)).status, 200)
    expect('dono segue sendo A', (await db.from('sheets').select('owner_id').eq('mesa', MESA).eq('slug', slugs[0]).single()).data?.owner_id, users.a.id)
    expect('B lê a ficha → 200', (await call({ token: users.b.token, query: { sheet: slugs[0] } })).status, 200)

    console.log('Estado do personagem')
    const hp = (token, slug) => call({ token, method: 'POST', body: { char: slug, field: 'hp', data: { current: 3 } } })
    expect('A escreve na própria → 200', (await hp(users.a.token, slugs[0])).status, 200)
    expect('B escreve na de A → 403', (await hp(users.b.token, slugs[0])).status, 403)
    expect('GM escreve → 200', (await hp(users.gm.token, slugs[0])).status, 200)
    expect('B lê o estado de A → 200', (await call({ token: users.b.token, query: { char: slugs[0] } })).status, 200)

    await pub(users.gm.token, `Teste Auth U ${stamp}`)
    await db.from('sheets').update({ owner_id: null }).eq('mesa', MESA).eq('slug', slugs[1])
    forgetOwner(MESA, slugs[1])
    expect('ficha sem dono: A escreve → 403', (await hp(users.a.token, slugs[1])).status, 403)
    expect('jogador não atribui', (await call({ token: users.a.token, method: 'POST', body: { action: 'sheet-assign', char: slugs[1], user: users.a.id } })).status, 403)
    expect('GM atribui a A → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'sheet-assign', char: slugs[1], user: users.a.id } })).status, 200)
    expect('depois de atribuída, A escreve → 200', (await hp(users.a.token, slugs[1])).status, 200)

    console.log('Mapa')
    const made = await call({ token: users.gm.token, method: 'POST', body: { action: 'map-create', name: 'Teste auth' } })
    expect('GM cria mapa → 200', made.status, 200)
    const mapId = made.body.map?.id ?? made.body.map?.meta?.id
    if (mapId) createdMaps.push(mapId)
    expect('jogador não cria mapa', (await call({ token: users.a.token, method: 'POST', body: { action: 'map-create', name: 'x' } })).status, 403)
    if (mapId) {
        const write = (token, field) => call({ token, method: 'POST', body: { action: 'map-write', id: mapId, fields: { [field]: { x: 1, y: 1 } } } })
        expect('jogador move token que não é dele (pos:) → 403', (await write(users.a.token, 'pos:abc')).status, 403)
        expect('jogador grava meta → 403', (await write(users.a.token, 'meta')).status, 403)
        expect('jogador grava PV de monstro → 403', (await write(users.a.token, 'hp:abc')).status, 403)
        expect('mapa privado: jogador → 403', (await call({ token: users.a.token, query: { map: mapId } })).status, 403)
        expect('mapa privado: jogador com gm=1 falso → 403', (await call({ token: users.a.token, query: { map: mapId, gm: '1' } })).status, 403)
        expect('mapa privado: GM → 200', (await call({ token: users.gm.token, query: { map: mapId } })).status, 200)
        expect('jogador não revela', (await call({ token: users.a.token, method: 'POST', body: { action: 'map-visibility', id: mapId, private: false } })).status, 403)
        expect('jogador não apaga', (await call({ token: users.a.token, method: 'POST', body: { action: 'map-delete', id: mapId } })).status, 403)
    }

    console.log('Rolagem por personagem')
    let rollN = 0
    const roll = (token, slug) => call({
        token, method: 'POST',
        body: { action: 'roll-add', roll: {
            id: `teste-auth-${stamp}-${(rollN += 1)}`, color: '#336699', by: 'Teste', title: 'Teste',
            ...(slug ? { slug } : {}), check: { d20: 10, mod: 5, total: 15, parts: [] },
        } },
    })
    expect('dono rola pela própria ficha → 200', (await roll(users.a.token, slugs[0])).status, 200)
    expect('B rola pela ficha de A → 403', (await roll(users.b.token, slugs[0])).status, 403)
    expect('GM rola por qualquer ficha → 200', (await roll(users.gm.token, slugs[0])).status, 200)
    expect('rolagem livre (sem personagem) → 200', (await roll(users.b.token, null)).status, 200)

    console.log('Tokens: cada um move o seu')
    const board = await call({ token: users.gm.token, method: 'POST', body: { action: 'map-create', name: 'Teste tokens' } })
    const boardId = board.body.map?.id
    if (boardId) {
        createdMaps.push(boardId)
        const sync = await call({ token: users.gm.token, method: 'POST', body: { action: 'map-sync', id: boardId, turn: null, hp: {}, tokens: [
            { id: 'tok-a', kind: 'pc', name: 'A', slug: slugs[0], size: 1 },
            { id: 'tok-u', kind: 'pc', name: 'U', slug: slugs[1], size: 1 },
            { id: 'tok-arm', kind: 'npc', name: 'Armadura', companionOf: slugs[0], size: 1 },
            { id: 'tok-mon', kind: 'npc', name: 'Goblin', size: 1 },
        ] } })
        expect('GM põe os tokens no mapa → 200', sync.status, 200)
        const move = (token, tid) => call({ token, method: 'POST', body: { action: 'map-write', id: boardId, fields: { [`pos:${tid}`]: { x: 5, y: 5 } } } })
        expect('A move o próprio token → 200', (await move(users.a.token, 'tok-a')).status, 200)
        expect('A move o companheiro dele → 200', (await move(users.a.token, 'tok-arm')).status, 200)
        expect('B move o token de A → 403', (await move(users.b.token, 'tok-a')).status, 403)
        expect('B move o companheiro de A → 403', (await move(users.b.token, 'tok-arm')).status, 403)
        expect('jogador move monstro → 403', (await move(users.a.token, 'tok-mon')).status, 403)
        expect('GM move qualquer token → 200', (await move(users.gm.token, 'tok-mon')).status, 200)
    }

    console.log('Iniciativa e papéis')
    expect('jogador não grava encontro', (await call({ token: users.a.token, method: 'POST', body: { action: 'encounter-save', map: null, state: {} } })).status, 403)
    // A mesa de teste é real e pode ter outros GMs (o dono do projeto): aí a trava não se aplica.
    const { count: gms } = await db.from('mesa_members').select('user_id', { count: 'exact', head: true }).eq('mesa', MESA).eq('role', 'gm')
    if (gms === 1) {
        expect('último GM não se rebaixa → 409', (await call({ token: users.gm.token, method: 'POST', body: { action: 'member-set-role', user: users.gm.id, role: 'player' } })).status, 409)
    } else {
        console.log(`  --   último GM não se rebaixa: pulado (a mesa tem ${gms} GMs de verdade)`)
    }
    expect('GM promove A → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'member-set-role', user: users.a.id, role: 'gm' } })).status, 200)
    expect('agora o GM pode se rebaixar → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'member-set-role', user: users.gm.id, role: 'player' } })).status, 200)
    expect('ex-GM perde o poder (cache invalidado) → 403', (await call({ token: users.gm.token, method: 'POST', body: { action: 'invite-create' } })).status, 403)

    console.log('Cobrança desligada (comportamento de antes)')
    process.env.AUTH_REQUIRED = '0'
    expect('sem token passa → 200', (await call({ query: { char: slugs[0] } })).status, 200)
    expect('escrita sem dono passa → 200', (await hp(users.out.token, slugs[0])).status, 200)
    // A gestão de conta NÃO afrouxa com a flag: senão qualquer um se promoveria antes do cutover.
    expect('jogador não se promove a GM', (await call({ token: users.b.token, method: 'POST', body: { action: 'member-set-role', user: users.b.id, role: 'gm' } })).status, 403)
    expect('jogador não troca a senha de outro', (await call({ token: users.b.token, method: 'POST', body: { action: 'member-reset-password', user: users.a.id } })).status, 403)
    expect('quem não é membro não lista membros', (await call({ token: users.out.token, query: { members: '1' } })).status, 403)
} catch (error) {
    failures += 1
    console.error('Erro inesperado:', error)
} finally {
    await cleanup().catch((e) => console.error('Limpeza falhou:', e))
}

console.log(failures === 0 ? '\nTudo certo.' : `\n${failures} falha(s).`)
process.exit(failures === 0 ? 0 : 1)
