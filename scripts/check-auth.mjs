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
const slugs = [`teste-auth-a-${stamp}`, `teste-auth-u-${stamp}`, `teste-auth-d-${stamp}`]
const createdMaps = []
const journalId = `teste-journal-${stamp}`
const revealId = `teste-reveal-${stamp}`
const wikiIds = { a: `w-t${stamp}a`, g: `w-t${stamp}g` }
const uploaded = []
let failures = 0
let mesaRulesBefore // regras da mesa de teste antes do check (restauradas no fim)

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
    await db.from('wiki_pages').delete().eq('mesa', MESA).in('id', Object.values(wikiIds))
    await db.from('mesa_events').delete().eq('mesa', MESA).in('data->>id', Object.values(wikiIds))
    await db.from('journal_docs').delete().eq('mesa', MESA).eq('id', journalId)
    await db.from('journal_reveals').delete().eq('mesa', MESA).eq('id', revealId)
    await db.from('shares').delete().eq('mesa', MESA).eq('id', revealId)
    await db.from('mesa_events').delete().eq('mesa', MESA).eq('data->>id', revealId)
    if (uploaded.length) await db.storage.from('images').remove(uploaded)
    // Rolagens de teste entram no Histórico de Rolagens da mesa: saem todas.
    await db.from('rolls').delete().eq('mesa', MESA).like('id', `teste-auth-${stamp}%`)
    for (const id of createdMaps) await db.from('maps').delete().eq('mesa', MESA).eq('id', id)
    // As notificações que as fichas e os mapas de teste geraram (os triggers não sabem que é teste).
    await db.from('mesa_events').delete().eq('mesa', MESA).in('data->>slug', slugs)
    if (createdMaps.length) await db.from('mesa_events').delete().eq('mesa', MESA).in('data->>map', createdMaps)
    for (const slug of slugs) {
        await db.from('character_state').delete().eq('mesa', MESA).eq('slug', slug)
        await db.from('sheet_versions').delete().eq('mesa', MESA).eq('slug', slug)
        await db.from('sheets').delete().eq('mesa', MESA).eq('slug', slug)
        await db.from('sheet_drafts').delete().eq('mesa', MESA).eq('slug', slug)
        await db.from('sheet_description_sets').delete().eq('mesa', MESA).eq('slug', slug)
    }
    // Builds do Criador: o dono vira nulo quando a conta sai, então saem antes, pelo criador.
    const creators = Object.values(users).map((u) => u.id)
    if (creators.length) await db.from('character_builds').delete().eq('mesa', MESA).in('created_by', creators)
    if (mesaRulesBefore !== undefined) {
        if (mesaRulesBefore) await db.from('mesa_rules').upsert({ mesa: MESA, ...mesaRulesBefore })
        else await db.from('mesa_rules').delete().eq('mesa', MESA)
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

    console.log('Publicação preparada (rascunho)')
    const draftNames = { spell: [], feat: ['Toughness'], special: [], item: [] }
    const draft = (token, name) => call({ token, method: 'POST', body: { action: 'draft-create', sheet: sheetJson(name), names: draftNames, version: 'v13' } })
    const draftSlug = slugs[2]
    expect('A cria rascunho de ficha nova → 200', (await draft(users.a.token, `Teste Auth D ${stamp}`)).status, 200)
    const listedDrafts = (await call({ token: users.b.token, query: { sheets: '1' } })).body
    expect('a mesa vê o rascunho em preparo', listedDrafts.drafts?.some((d) => d.slug === draftSlug), true)
    expect('...mas a ficha ainda não está na mesa', listedDrafts.sheets?.some((s) => s.slug === draftSlug), false)
    expect('B cria rascunho da mesma ficha nova → 403', (await draft(users.b.token, `Teste Auth D ${stamp}`)).status, 403)
    expect('B conduz o rascunho de A → 403', (await call({ token: users.b.token, method: 'POST', body: { action: 'draft-step', char: draftSlug } })).status, 403)
    expect('B descarta o rascunho de A → 403', (await call({ token: users.b.token, method: 'POST', body: { action: 'draft-discard', char: draftSlug } })).status, 403)
    expect('B cria rascunho por cima da ficha de A → 403', (await draft(users.b.token, `Teste Auth A ${stamp}`)).status, 403)
    expect('subir a ficha igual à publicada → 409', (await draft(users.a.token, `Teste Auth A ${stamp}`)).status, 409)
    expect('A descarta o próprio rascunho → 200', (await call({ token: users.a.token, method: 'POST', body: { action: 'draft-discard', char: draftSlug } })).status, 200)
    expect('GM cria rascunho → 200', (await draft(users.gm.token, `Teste Auth D ${stamp}`)).status, 200)
    expect('GM descarta → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'draft-discard', char: draftSlug } })).status, 200)
    expect('descartado, sai da lista', (await call({ token: users.a.token, query: { sheets: '1' } })).body.drafts?.some((d) => d.slug === draftSlug), false)

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
    // Aparelho do app antigo (anônimo) que ficou em `mesa_members` não pode ser dono.
    await db.from('mesa_members').insert({ mesa: MESA, user_id: users.anon.id })
    forgetMember(MESA, users.anon.id)
    expect('GM atribui a um anônimo → 400', (await call({ token: users.gm.token, method: 'POST', body: { action: 'sheet-assign', char: slugs[1], user: users.anon.id } })).status, 400)
    const listed = (await call({ token: users.gm.token, query: { members: '1' } })).body.members ?? []
    expect('lista marca o anônimo', listed.find((m) => m.userId === users.anon.id)?.anonymous, true)
    expect('lista não marca a conta', listed.find((m) => m.userId === users.a.id)?.anonymous, false)
    await db.from('mesa_members').delete().eq('mesa', MESA).eq('user_id', users.anon.id)
    forgetMember(MESA, users.anon.id)
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

    console.log('Notificações')
    const eventsOf = async (token) => (await call({ token, query: { events: '1' } })).body
    const assigned = (list) => (list.events ?? []).find((e) => e.kind === 'sheet-assigned' && e.data?.slug === slugs[1])
    const forA = await eventsOf(users.a.token)
    expect('A vê a ficha atribuída a ele', !!assigned(forA), true)
    expect('B não vê a ficha atribuída a A', !!assigned(await eventsOf(users.b.token)), false)
    const published = (forA.events ?? []).find((e) => e.kind === 'sheet-published' && e.data?.slug === slugs[0])
    expect('publicação vira notificação da mesa', !!published, true)
    const top = Math.max(0, ...(forA.events ?? []).map((e) => e.id))
    const seen = (token, upTo) => call({ token, method: 'POST', body: { action: 'events-seen', upTo } })
    expect('marcar como lido → seen', (await seen(users.a.token, top)).body.seen, top)
    expect('lido não anda para trás', (await seen(users.a.token, 1)).body.seen, top)
    expect('lido é da conta: B segue sem ler', (await eventsOf(users.b.token)).seen < top, true)
    expect('quem não é membro não lê → 403', (await call({ token: users.out.token, query: { events: '1' } })).status, 403)

    console.log('Configurações da mesa')
    // A mesa de teste é real: manda os MESMOS valores de agora, então nada muda para quem está nela.
    const { data: mesaRow } = await db.from('mesas').select('name, next_session_at').eq('id', MESA).single()
    const settings = (token, extra) => call({ token, method: 'POST', body: { action: 'mesa-settings', ...extra } })
    expect('jogador não muda a mesa → 403', (await settings(users.a.token, { name: mesaRow.name })).status, 403)
    expect('nome curto demais → 400', (await settings(users.gm.token, { name: 'x' })).status, 400)
    expect('data inválida → 400', (await settings(users.gm.token, { nextSessionAt: 'amanhã' })).status, 400)
    const saved = await settings(users.gm.token, { name: mesaRow.name, nextSessionAt: mesaRow.next_session_at })
    expect('GM grava → 200', saved.status, 200)
    expect('volta o nome gravado', saved.body.name, mesaRow.name)
    const mine = (await call({ token: users.a.token, query: { me: '1' } })).body.mesas?.find((m) => m.id === MESA)
    expect('?me traz o nome da mesa', mine?.name, mesaRow.name)
    expect('?me conta as contas da mesa', typeof mine?.members === 'number' && mine.members >= 3, true)

    console.log('Diário de Campanha')
    const jdoc = { id: journalId, kind: 'session', title: 'Sessão de teste', sort: 1, data: { prep: 'segredo' } }
    expect('jogador não lista o diário', (await call({ token: users.a.token, query: { journal: 'list' } })).status, 403)
    expect('jogador não grava no diário', (await call({ token: users.a.token, method: 'POST', body: { action: 'journal-save', doc: jdoc, base: null } })).status, 403)
    const jsave = await call({ token: users.gm.token, method: 'POST', body: { action: 'journal-save', doc: jdoc, base: null } })
    expect('GM grava no diário → 200', jsave.status, 200)
    expect('jogador não lê o documento', (await call({ token: users.a.token, query: { journal: journalId } })).status, 403)
    expect('GM lê o documento', (await call({ token: users.gm.token, query: { journal: journalId } })).body.doc?.data?.prep, 'segredo')
    expect('escrita com versão velha → 409', (await call({ token: users.gm.token, method: 'POST', body: { action: 'journal-save', doc: jdoc, base: 1 } })).status, 409)
    const reveal = { id: revealId, title: 'Carta do barão', markdown: 'Querido amigo…' }
    expect('jogador não mostra à mesa', (await call({ token: users.a.token, method: 'POST', body: { action: 'journal-reveal', reveal, by: 'A', color: '#7e611d' } })).status, 403)
    expect('share-add de handout pelo cliente → 400', (await call({ token: users.a.token, method: 'POST', body: { action: 'share-add', share: { id: revealId, by: 'A', color: '#7e611d', type: 'handout', name: 'X', ref: revealId } } })).status, 400)
    expect('GM mostra à mesa → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'journal-reveal', reveal, by: 'GM', color: '#7e611d' } })).status, 200)
    expect('jogador lê o que foi mostrado', (await call({ token: users.a.token, query: { reveal: revealId } })).body.reveal?.markdown, 'Querido amigo…')
    expect('quem não é membro não lê', (await call({ token: users.out.token, query: { reveal: revealId } })).status, 403)
    const handoutEvent = await db.from('mesa_events').select('kind').eq('mesa', MESA).eq('data->>id', revealId).maybeSingle()
    expect('a notificação é handout-shared', handoutEvent.data?.kind, 'handout-shared')
    // Imagem do diário: a pasta `journal/` é só do GM.
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0))
    const upload = async (token, path) => {
        const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
        const { error } = await client.storage.from('images').upload(path, new Blob([png], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
        if (!error) uploaded.push(path)
        return !error
    }
    expect('jogador não envia imagem ao diário', await upload(users.a.token, `journal/teste-${stamp}-a.png`), false)
    expect('GM envia imagem ao diário', await upload(users.gm.token, `journal/teste-${stamp}-gm.png`), true)
    expect('jogador ainda envia token', await upload(users.a.token, `tokens/teste-${stamp}-a.png`), true)

    console.log('Wiki da Mesa')
    const wget = (token, query) => call({ token, query })
    const wsave = (token, page, base) => call({ token, method: 'POST', body: { action: 'wiki-save', page, base } })
    const wread = async (token, id) => (await wget(token, { wiki: id })).body.page
    const pageA = { id: wikiIds.a, kind: 'npc', title: `Barão Teste ${stamp}`, body: 'Dono da taverna.\n:::mestre\ninjetado pelo jogador\n:::' }
    expect('quem não é membro não lê a Wiki', (await wget(users.out.token, { wiki: 'list' })).status, 403)
    expect('jogador cria página → 200', (await wsave(users.a.token, pageA, null)).status, 200)
    expect(':::mestre do jogador vira texto comum', (await wread(users.gm.token, wikiIds.a))?.body.includes('\\:::mestre'), true)
    let cur = await wread(users.gm.token, wikiIds.a)
    expect('GM põe um segredo → 200', (await wsave(users.gm.token, { ...cur, body: `${cur.body}\n\n## Segredos\n\n:::mestre\nÉ um vampiro.\n:::` }, cur.updatedAt)).status, 200)
    expect('jogador NÃO recebe o segredo', (await wread(users.b.token, wikiIds.a))?.body.includes('vampiro'), false)
    expect('GM recebe o segredo', (await wread(users.gm.token, wikiIds.a))?.body.includes('vampiro'), true)
    expect('busca do jogador não acha o segredo', (await wget(users.b.token, { wiki: 'search', q: 'vampiro' })).body.results?.length, 0)
    expect('busca do GM acha', (await wget(users.gm.token, { wiki: 'search', q: 'vampiro' })).body.results?.length, 1)
    cur = await wread(users.b.token, wikiIds.a)
    expect('outro jogador edita a página pública → 200', (await wsave(users.b.token, { ...cur, body: `${cur.body}\n\nMais um parágrafo.` }, cur.updatedAt)).status, 200)
    expect('o segredo sobrevive à edição do jogador', (await wread(users.gm.token, wikiIds.a))?.body.includes('É um vampiro.'), true)
    expect('escrita com versão velha → 409', (await wsave(users.b.token, cur, cur.updatedAt)).status, 409)
    const hist = (await wget(users.b.token, { wikiHistory: wikiIds.a })).body.revisions ?? []
    expect('histórico com as versões de cada pessoa', hist.length >= 3, true)
    const revBodies = await Promise.all(hist.map(async (r) => (await wget(users.b.token, { wikiRev: wikiIds.a, rev: String(r.rev) })).body.revision?.body ?? ''))
    expect('o histórico do jogador não tem o segredo', revBodies.some((b) => b.includes('vampiro')), false)
    const view = (await wget(users.b.token, { wiki: wikiIds.a })).body
    expect('autoria com nome de quem criou', typeof view.authors?.[users.a.id] === 'string', true)
    const pageG = { id: wikiIds.g, kind: 'location', title: `Covil Secreto ${stamp}`, body: `Onde mora o [[${pageA.title}]].`, visibility: 'gm' }
    expect('GM cria página só dele → 200', (await wsave(users.gm.token, pageG, null)).status, 200)
    expect('a página do GM não aparece na lista do jogador', (await wget(users.a.token, { wiki: 'list' })).body.pages?.some((p) => p.id === wikiIds.g), false)
    expect('jogador não abre a página do GM → 404', (await wget(users.a.token, { wiki: wikiIds.g })).status, 404)
    expect('backlink da página do GM some para o jogador', (await wget(users.a.token, { wiki: wikiIds.a })).body.backlinks?.some((b) => b.id === wikiIds.g), false)
    expect('backlink aparece para o GM', (await wget(users.gm.token, { wiki: wikiIds.a })).body.backlinks?.some((b) => b.id === wikiIds.g), true)
    expect('jogador não edita a página do GM', (await wsave(users.a.token, { ...pageG }, Date.now())).status, 404)
    expect('jogador não trava → 403', (await call({ token: users.a.token, method: 'POST', body: { action: 'wiki-flags', id: wikiIds.a, locked: true } })).status, 403)
    expect('GM trava → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'wiki-flags', id: wikiIds.a, locked: true } })).status, 200)
    cur = await wread(users.a.token, wikiIds.a)
    expect('página travada: jogador não edita → 403', (await wsave(users.a.token, cur, cur.updatedAt)).status, 403)
    await call({ token: users.gm.token, method: 'POST', body: { action: 'wiki-flags', id: wikiIds.a, locked: false } })
    expect('quem não criou não apaga → 403', (await call({ token: users.b.token, method: 'POST', body: { action: 'wiki-delete', id: wikiIds.a } })).status, 403)
    expect('quem criou apaga → 200', (await call({ token: users.a.token, method: 'POST', body: { action: 'wiki-delete', id: wikiIds.a } })).status, 200)
    expect('apagada some da Wiki', (await wget(users.a.token, { wiki: wikiIds.a })).status, 404)
    expect('jogador não restaura da lixeira', (await call({ token: users.a.token, method: 'POST', body: { action: 'wiki-undelete', id: wikiIds.a } })).status, 403)
    expect('jogador não abre a lixeira', (await wget(users.a.token, { wiki: 'trash' })).status, 403)
    expect('GM restaura da lixeira → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'wiki-undelete', id: wikiIds.a } })).status, 200)
    expect('fora da lixeira não apaga de vez → 400', (await call({ token: users.gm.token, method: 'POST', body: { action: 'wiki-purge', id: wikiIds.a } })).status, 400)
    expect('GM revela a página → 200', (await call({ token: users.gm.token, method: 'POST', body: { action: 'wiki-flags', id: wikiIds.g, visibility: 'public' } })).status, 200)
    const revealed = await db.from('mesa_events').select('kind').eq('mesa', MESA).eq('data->>id', wikiIds.g)
    expect('notificação de página revelada', revealed.data?.some((e) => e.kind === 'wiki-revealed'), true)
    expect('revelada, o jogador a vê', (await wget(users.a.token, { wiki: wikiIds.g })).status, 200)
    expect('jogador envia imagem à Wiki', await upload(users.a.token, `wiki/teste-${stamp}-a.png`), true)
    expect('quem não é membro não envia à Wiki', await upload(users.out.token, `wiki/teste-${stamp}-out.png`), false)

    console.log('Criador de Personagem')
    {
        const post = (who, body) => call({ token: users[who].token, method: 'POST', body })
        const created = await post('a', { action: 'build-create', name: `Teste Criador ${stamp}` })
        expect('jogador cria build → 200', created.status, 200)
        const build = created.body.build
        expect('slug nasce do nome', build?.slug, `teste-criador-${stamp}`)
        const twin = await post('b', { action: 'build-create', name: `Teste Criador ${stamp}` })
        expect('mesmo nome ganha outro slug', twin.body.build?.slug, `teste-criador-${stamp}-2`)
        const state = { ...build.state, level: 2, name: `Teste Renomeado ${stamp}` }
        const saved = await post('a', { action: 'build-save', id: build.id, rev: 1, state, className: 'Fighter' })
        expect('dono salva → 200', saved.status, 200)
        expect('rev sobe', saved.body.build?.rev, 2)
        expect('renomear não muda o slug', saved.body.build?.slug, build.slug)
        expect('rev velho → 409', (await post('a', { action: 'build-save', id: build.id, rev: 1, state })).status, 409)
        expect('outro jogador não grava → 403', (await post('b', { action: 'build-save', id: build.id, rev: 2, state })).status, 403)
        const other = await call({ token: users.b.token, query: { build: build.id } })
        expect('outro jogador lê → 200', other.status, 200)
        expect('…somente leitura', other.body.canEdit, false)
        expect('dono lê o próprio com canEdit', (await call({ token: users.a.token, query: { build: build.id } })).body.canEdit, true)
        const list = await call({ token: users.b.token, query: { builds: '1' } })
        const mine = list.body.builds?.find((b) => b.id === build.id)
        expect('lista não leva o state', mine && 'state' in mine, false)
        expect('lista traz o nome do dono', typeof mine?.ownerName, 'string')
        expect('quem não é membro não lista → 403', (await call({ token: users.out.token, query: { builds: '1' } })).status, 403)
        expect('quem não é membro não cria → 403', (await call({ token: users.out.token, method: 'POST', body: { action: 'build-create', name: 'X' } })).status, 403)
        expect('GM grava build alheio → 200', (await post('gm', { action: 'build-save', id: build.id, rev: 2, state })).status, 200)
        expect('jogador não atribui dono → 403', (await post('a', { action: 'build-assign', id: build.id, user: users.b.id })).status, 403)
        expect('GM atribui dono → 200', (await post('gm', { action: 'build-assign', id: build.id, user: users.b.id })).status, 200)
        expect('novo dono grava → 200', (await post('b', { action: 'build-save', id: build.id, rev: 3, state })).status, 200)
        expect('antigo dono não grava mais → 403', (await post('a', { action: 'build-save', id: build.id, rev: 4, state })).status, 403)
        const big = { ...state, history: Array.from({ length: 100 }, () => ({ at: new Date().toISOString(), by: 'x', note: 'y'.repeat(200), kind: 'override' })),
            spellcasting: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, { spellbook: Array.from({ length: 300 }, (_, j) => `spell:spell-${i}${j}`) }])) }
        expect('build grande demais → 413', (await post('b', { action: 'build-save', id: build.id, rev: 4, state: big })).status, 413)
        expect('jogador não apaga build alheio → 403', (await post('a', { action: 'build-delete', id: twin.body.build.id })).status, 403)
        expect('B apaga o que agora é dele → 200', (await post('b', { action: 'build-delete', id: build.id })).status, 200)
        expect('na lixeira não salva → 409', (await post('b', { action: 'build-save', id: build.id, rev: 4, state })).status, 409)
        expect('colega não vê o da lixeira → 404', (await call({ token: users.a.token, query: { build: build.id } })).status, 404)
        expect('dono restaura → 200', (await post('b', { action: 'build-restore', id: build.id })).status, 200)

        const { data: rulesRow } = await db.from('mesa_rules').select('rules, updated_at, updated_by').eq('mesa', MESA).maybeSingle()
        mesaRulesBefore = rulesRow ?? null
        const rules = await call({ token: users.a.token, query: { mesaRules: '1' } })
        expect('membro lê regras da mesa → 200', rules.status, 200)
        expect('jogador não muda regras da mesa → 403', (await post('a', { action: 'mesa-rules-save', rules: rules.body.rules })).status, 403)
        const changed = { ...rules.body.rules, startingLevel: 3 }
        const savedRules = await post('gm', { action: 'mesa-rules-save', rules: changed })
        expect('GM muda regras da mesa → 200', savedRules.status, 200)
        expect('…e a regra volta sanitizada', savedRules.body.rules?.startingLevel, 3)
    }

    console.log('Base de regras (admin da plataforma)')
    expect('GM comum não lista os livros → 403', (await call({ token: users.gm.token, query: { rulesSources: '1' } })).status, 403)
    expect('jogador não verifica novidades → 403', (await call({ token: users.a.token, method: 'POST', body: { action: 'rules-check' } })).status, 403)
    expect('GM comum não importa → 403', (await call({ token: users.gm.token, method: 'POST', body: { action: 'rules-import', sources: ['source-220'] } })).status, 403)
    expect('GM comum não corrige mecânica → 403', (await call({ token: users.gm.token, method: 'POST', body: { action: 'rules-mechanics-save', aonId: 'feat-1', rules: [], note: 'Player Core pg. 1' } })).status, 403)
    expect('GM comum não publica versão → 403', (await call({ token: users.gm.token, method: 'POST', body: { action: 'rules-publish' } })).status, 403)
    expect('me de quem não é admin não traz platformAdmin', (await call({ token: users.gm.token, query: { me: '1' } })).body.platformAdmin, undefined)

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
    // O diário tem segredos: também NÃO afrouxa com a flag.
    expect('jogador não lê o diário (flag desligada)', (await call({ token: users.b.token, query: { journal: 'list' } })).status, 403)
    expect('sem sessão não lê o diário (flag desligada)', (await call({ query: { journal: 'list' } })).status, 403)
    // A Wiki também decide pelo papel na mesa, com a flag desligada.
    expect('sem sessão não lê a Wiki (flag desligada)', (await call({ query: { wiki: 'list' } })).status, 403)
    expect('jogador não muda regras da mesa (flag desligada)', (await call({ token: users.b.token, method: 'POST', body: { action: 'mesa-rules-save', rules: {} } })).status, 403)
    expect('sem sessão não muda regras da mesa (flag desligada)', (await call({ method: 'POST', body: { action: 'mesa-rules-save', rules: {} } })).status, 403)
    expect('GM comum não lista os livros (flag desligada)', (await call({ token: users.a.token, query: { rulesSources: '1' } })).status, 403)
    expect('sem sessão não importa (flag desligada)', (await call({ method: 'POST', body: { action: 'rules-import', sources: ['source-220'] } })).status, 403)
    expect('sem sessão não cria build (flag desligada)', (await call({ method: 'POST', body: { action: 'build-create', name: 'X' } })).status, 401)
    expect('quem não é membro não grava na Wiki (flag desligada)', (await call({ token: users.out.token, method: 'POST', body: { action: 'wiki-save', page: { id: `w-t${stamp}x`, kind: 'npc', title: 'X', body: '' }, base: null } })).status, 403)
} catch (error) {
    failures += 1
    console.error('Erro inesperado:', error)
} finally {
    await cleanup().catch((e) => console.error('Limpeza falhou:', e))
}

console.log(failures === 0 ? '\nTudo certo.' : `\n${failures} falha(s).`)
process.exit(failures === 0 ? 0 : 1)
