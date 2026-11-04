// Rotas da Wiki da Mesa, compartilhadas por `api/state.js` (Vercel) e `server/index.mjs` (dev). Moram
// no endpoint `state` pelo limite de 12 funções serverless do plano Hobby (ver CLAUDE.md).
//
//   GET  ?wiki=list                   → { pages, authors, gm }        resumo das páginas que a pessoa vê
//   GET  ?wiki=trash                  → { pages, authors }            a lixeira (GM)
//   GET  ?wiki=recent                 → { changes, authors }          as últimas versões gravadas
//   GET  ?wiki=search&q=…             → { results }                   título, apelido, etiqueta e texto
//   GET  ?wiki=<id>                   → { page, backlinks, authors, canEdit, canDelete }
//   GET  ?wikiHistory=<id>            → { revisions, authors }
//   GET  ?wikiRev=<id>&rev=N          → { revision }
//   POST { action: 'wiki-save', page, base }       → { updatedAt, rev } | 409 { page }
//   POST { action: 'wiki-restore', id, rev, base } → { updatedAt, rev } | 409 { page }
//   POST { action: 'wiki-delete', id }             → { ok }   para a lixeira (quem criou e o GM)
//   POST { action: 'wiki-undelete', id }           → { ok }   (GM)
//   POST { action: 'wiki-purge', id }              → { ok }   apaga de vez, só da lixeira (GM)
//   POST { action: 'wiki-flags', id, locked?, visibility? } → { ok }  (GM)
//   POST { action: 'wiki-show', id, reveal, by, color, image? }  → { share }  "Mostrar à mesa" (GM)
//
// Quem pode o quê (decidido AQUI, o cliente só esconde botões), valendo também com `AUTH_REQUIRED`
// desligado, pelo papel na mesa — como o Diário de Campanha:
//   - qualquer membro lê as páginas públicas, cria páginas (sempre públicas) e edita as públicas
//     que não estão travadas;
//   - página travada ou só do GM: só o GM edita (e só ele a vê, no segundo caso);
//   - apagar: quem criou e o GM; lixeira, travar, revelar e "Mostrar à mesa": só o GM.
//
// O jogador NUNCA recebe os trechos `:::mestre`: lê o `body_public`, busca nele, vê os backlinks que
// ele cita e o histórico só nele. Ao salvar, os segredos voltam para o lugar (`mergeSecrets`).
//
// Vem ANTES da ficha publicada nos dois servidores: a rota da ficha aceita qualquer POST com
// `action` e engoliria esta.

import { isSupabaseConfigured } from './supabase.js'
import { forbidden, memberRole } from './access.js'
import { imagePath } from './images.js'
import { addShare, sanitizeShare } from './roll-store.js'
import { addReveal, cleanReveal, MAX_REVEAL_BYTES } from './journal-store.js'
import { lastFeatAt, recordFeat, safely, touchFeat } from './trophy-store.js'
import { escapeSecrets, fold, hasSecrets, linkNames, mergeSecrets, stripSecrets } from './wiki-secrets.js'
import {
    PAGE_ID_RE, authorNames, cleanPage, fieldTexts, listPages, pageBacklinks, pageHistory, pageRevision, purgePage,
    readPage, recentChanges, savePage, searchPages, setPageFlags, trashPage, untrashPage,
} from './wiki-store.js'

const ok = (body) => ({ status: 200, body: { ...body, storeReady: isSupabaseConfigured() } })
const fail = (status, error) => ({ status, body: { error } })
const notFound = () => fail(404, 'Página não encontrada')

const ACTIONS = new Set([
    'wiki-save', 'wiki-restore', 'wiki-delete', 'wiki-undelete', 'wiki-purge', 'wiki-flags', 'wiki-show',
])

/** Janela em que editar a página de outra pessoa conta uma vez só para o troféu. */
const EDIT_FEAT_WINDOW_MS = 30 * 60 * 1000

/** Páginas que esta instância já sabe lidas por quem (poupa a consulta ao banco a cada abertura). */
const READ_SEEN = new Set()

/** Registra a primeira leitura de uma página de outra pessoa (`wiki-read`, uma por conta e página). */
async function noteRead(mesa, userId, page) {
    const key = `${mesa}:${userId}:${page.id}`
    if (READ_SEEN.has(key)) return
    if (READ_SEEN.size > 5000) READ_SEEN.clear()
    READ_SEEN.add(key)
    if (await lastFeatAt(userId, 'wiki-read', page.id, mesa)) return
    await recordFeat(mesa, userId, 'wiki-read', { slug: page.id, kind: page.kind })
}

/** Falso quando a requisição não é da Wiki — aí segue para as outras rotas do `state`. */
export function isWikiRequest(method, query, body) {
    if (method === 'GET') return query.wiki !== undefined || query.wikiHistory !== undefined || query.wikiRev !== undefined
    if (method === 'POST') return ACTIONS.has(body?.action)
    return false
}

/** 'gm' | 'player' | null (não é da mesa). Sem Supabase (modo local) não há como saber: vale tudo. */
async function wikiRole(mesa, access) {
    if (!isSupabaseConfigured()) return 'gm'
    if (!access?.userId) return null
    return access.role ?? (await memberRole(mesa, access.userId))
}

/** Página que esta pessoa vê. */
const visible = (page, gm) => !!page && page.deletedAt === null && (gm || page.visibility === 'public')

/** Pode editar: o GM sempre; o jogador, página pública e não travada. */
const canEdit = (page, gm) => gm || (page.visibility === 'public' && !page.locked)

/** Pode mandar para a lixeira: o GM, ou quem criou a página (se ela não estiver travada). */
const canDelete = (page, gm, userId) => gm || (!page.locked && !!userId && page.createdBy === userId)

/** A página como esta pessoa a vê: o jogador recebe o texto sem os trechos do mestre. */
function viewOf(page, gm) {
    const { body, bodyPublic, linksAll, linksPublic, ...rest } = page
    return gm ? { ...rest, body, hasSecrets: hasSecrets(body) } : { ...rest, body: bodyPublic, hasSecrets: false }
}

/** URL de imagem que pode ir para a página: do nosso Storage, ou `idb:` sem Supabase. */
const validImage = (url) =>
    url === null || (typeof url === 'string' && (imagePath(url) !== null || (!isSupabaseConfigured() && /^idb:[a-z0-9-]{1,64}$/.test(url))))

/** O pai existe, está na lixeira não, e subir por ele nunca volta à própria página (ciclo). */
async function validParent(mesa, id, parent) {
    if (!parent) return true
    const pages = await listPages(mesa, { gm: true })
    const byId = new Map(pages.map((p) => [p.id, p]))
    let at = parent
    for (let i = 0; at && i < 40; i++) {
        if (at === id) return false
        const p = byId.get(at)
        if (!p) return i > 0
        at = p.parent
    }
    return true
}

const authorsOf = (mesa, items) => authorNames(mesa, items.flatMap((x) => [x.createdBy, x.updatedBy, x.by]))

/** O que vai para o banco: o texto resolvido, o texto público e os links dos dois. */
function prepared(input, body, extra = {}) {
    const bodyPublic = stripSecrets(body)
    const fields = fieldTexts(input.fields)
    return {
        ...input,
        body,
        body_public: bodyPublic,
        links_all: linkNames(body, ...fields),
        links_public: linkNames(bodyPublic, ...fields),
        ...extra,
    }
}

const parseBase = (v) => (v === null || v === undefined ? null : Number(v))

export async function handleWikiRequest(mesa, method, query, body, ctx = {}) {
    const role = await wikiRole(mesa, ctx.access)
    if (!role) return forbidden('Você não faz parte desta mesa')
    const gm = role === 'gm'
    const userId = ctx.userId ?? null

    if (method === 'GET') {
        if (query.wikiHistory !== undefined) {
            const id = String(query.wikiHistory)
            if (!PAGE_ID_RE.test(id)) return fail(400, 'Página inválida')
            if (!visible(await readPage(mesa, id), gm)) return notFound()
            const revisions = await pageHistory(mesa, id)
            return ok({ revisions, authors: await authorsOf(mesa, revisions) })
        }
        if (query.wikiRev !== undefined) {
            const id = String(query.wikiRev)
            const rev = Number(query.rev)
            if (!PAGE_ID_RE.test(id) || !Number.isInteger(rev)) return fail(400, 'Versão inválida')
            if (!visible(await readPage(mesa, id), gm)) return notFound()
            const r = await pageRevision(mesa, id, rev)
            if (!r) return fail(404, 'Versão não encontrada')
            const { body: full, bodyPublic, ...rest } = r
            return ok({ revision: { ...rest, body: gm ? full : bodyPublic } })
        }

        const what = String(query.wiki)
        if (what === 'list') {
            const pages = await listPages(mesa, { gm })
            return ok({ pages, authors: await authorsOf(mesa, pages), gm })
        }
        if (what === 'trash') {
            if (!gm) return forbidden('Só o GM abre a lixeira da Wiki')
            const pages = await listPages(mesa, { gm: true, trash: true })
            return ok({ pages, authors: await authorsOf(mesa, pages) })
        }
        if (what === 'recent') {
            const pages = new Map((await listPages(mesa, { gm })).map((p) => [p.id, p]))
            const changes = (await recentChanges(mesa, 80))
                .filter((c) => pages.has(c.page))
                .slice(0, 40)
                .map((c) => ({ ...c, title: pages.get(c.page).title, kind: pages.get(c.page).kind }))
            return ok({ changes, authors: await authorsOf(mesa, changes) })
        }
        if (what === 'search') {
            const q = String(query.q ?? '').slice(0, 80)
            if (fold(q).length < 2) return ok({ results: [] })
            return ok({ results: await searchPages(mesa, q, gm) })
        }
        if (!PAGE_ID_RE.test(what)) return fail(400, 'Página inválida')
        const page = await readPage(mesa, what)
        if (!visible(page, gm)) return notFound()
        // Ler a página de outra pessoa conta uma vez por página (troféu); a conta é de quem abriu.
        if (userId && page.deletedAt === null && page.createdBy !== userId) {
            await safely('leitura na wiki', () => noteRead(mesa, userId, page))
        }
        const names = [fold(page.title), ...page.aliases.map(fold)].filter(Boolean)
        const backlinks = await pageBacklinks(mesa, names, { gm, except: page.id })
        return ok({
            page: viewOf(page, gm),
            backlinks,
            authors: await authorsOf(mesa, [page]),
            canEdit: canEdit(page, gm),
            canDelete: canDelete(page, gm, userId),
        })
    }

    const id = typeof body.id === 'string' ? body.id : body.page?.id
    if (body.action !== 'wiki-save' && (typeof id !== 'string' || !PAGE_ID_RE.test(id))) return fail(400, 'Página inválida')

    if (body.action === 'wiki-save') {
        const input = cleanPage(body.page)
        if (!input) return fail(400, 'Página inválida')
        if (!validImage(input.image)) return fail(400, 'Imagem inválida')
        const base = parseBase(body.base)
        if (base !== null && !Number.isFinite(base)) return fail(400, 'Versão inválida')
        if (!(await validParent(mesa, input.id, input.parent))) return fail(400, 'Página-mãe inválida')

        let current = null
        let text
        let extra = {}
        if (base === null) {
            // Página nova: o jogador cria sempre pública; o GM pode criá-la só para ele.
            text = gm ? input.body : escapeSecrets(input.body)
            extra = { visibility: gm && body.page?.visibility === 'gm' ? 'gm' : 'public' }
        } else {
            current = await readPage(mesa, input.id)
            if (!visible(current, gm)) return notFound()
            if (!canEdit(current, gm)) return forbidden('Esta página está travada pelo GM')
            text = gm ? input.body : mergeSecrets(current.body, input.body)
        }

        const out = await savePage(mesa, prepared(input, text, extra), base, userId)
        if (out.conflict) {
            const fresh = await readPage(mesa, input.id)
            if (base === null && fresh) return fail(409, 'Já existe uma página com esse id')
            return {
                status: 409,
                body: { error: 'Editada por outra pessoa', code: 'conflict', page: visible(fresh, gm) ? viewOf(fresh, gm) : null },
            }
        }
        if (base === null) {
            await safely('página da wiki', () => recordFeat(mesa, userId, 'wiki-created', {
                slug: input.id, kind: input.kind, parent: Boolean(input.parent), links: linkNames(text, ...fieldTexts(input.fields)).length,
            }))
        } else if (userId && current.createdBy && current.createdBy !== userId) {
            await safely('edição na wiki', () => touchFeat(mesa, userId, 'wiki-edited', { slug: input.id, kind: input.kind }, EDIT_FEAT_WINDOW_MS))
        }
        // O GM escrevendo segredo: uma página por janela, como a edição.
        if (gm && userId && hasSecrets(text)) {
            await safely('segredo na wiki', () => touchFeat(mesa, userId, 'gm-wiki-secret', { slug: input.id }, EDIT_FEAT_WINDOW_MS))
        }
        return ok(out)
    }

    const page = await readPage(mesa, id)

    if (body.action === 'wiki-restore') {
        if (!visible(page, gm)) return notFound()
        if (!canEdit(page, gm)) return forbidden('Esta página está travada pelo GM')
        const rev = Number(body.rev)
        const base = parseBase(body.base)
        if (!Number.isInteger(rev) || base === null || !Number.isFinite(base)) return fail(400, 'Versão inválida')
        const r = await pageRevision(mesa, id, rev)
        if (!r) return fail(404, 'Versão não encontrada')
        const input = cleanPage({ ...r.meta, id, body: gm ? r.body : r.bodyPublic })
        if (!input) return fail(400, 'Versão inválida')
        // Pai que foi apagado ou que viraria um ciclo: a página volta sem pai.
        if (!(await validParent(mesa, id, input.parent))) input.parent = null
        // O jogador restaura só o que via; os segredos de AGORA ficam.
        const text = gm ? input.body : mergeSecrets(page.body, input.body)
        const out = await savePage(mesa, prepared(input, text), base, userId, { coalesce: false })
        if (out.conflict) {
            const fresh = await readPage(mesa, id)
            return { status: 409, body: { error: 'Editada por outra pessoa', code: 'conflict', page: visible(fresh, gm) ? viewOf(fresh, gm) : null } }
        }
        return ok(out)
    }

    if (body.action === 'wiki-delete') {
        if (!visible(page, gm)) return notFound()
        if (!canDelete(page, gm, userId)) return forbidden('Só quem criou a página e o GM a apagam')
        await trashPage(mesa, id)
        return ok({ ok: true })
    }

    // Daqui para baixo, só o GM.
    if (!gm) return forbidden('Só o GM pode fazer isso')
    if (!page) return notFound()

    if (body.action === 'wiki-undelete') {
        await untrashPage(mesa, id)
        return ok({ ok: true })
    }
    if (body.action === 'wiki-purge') {
        if (page.deletedAt === null) return fail(400, 'Mande a página para a lixeira antes')
        await purgePage(mesa, id)
        return ok({ ok: true })
    }
    if (body.action === 'wiki-flags') {
        const flags = {}
        if (typeof body.locked === 'boolean') flags.locked = body.locked
        if (body.visibility === 'public' || body.visibility === 'gm') flags.visibility = body.visibility
        if (!Object.keys(flags).length) return fail(400, 'Nada para mudar')
        await setPageFlags(mesa, id, flags)
        if (flags.visibility === 'public' && page.visibility === 'gm' && page.deletedAt === null) {
            await safely('página revelada', () => recordFeat(mesa, userId, 'gm-wiki-reveal', { slug: id }))
        }
        return ok({ ok: true })
    }

    // wiki-show: a parte PÚBLICA da página no cartão de todos (o mesmo handout do Diário).
    if (page.deletedAt !== null) return notFound()
    let markdown = page.bodyPublic
    while (new TextEncoder().encode(markdown).length > MAX_REVEAL_BYTES - 8) markdown = markdown.slice(0, Math.floor(markdown.length * 0.9))
    if (markdown !== page.bodyPublic) markdown = `${markdown.trimEnd()}\n\n…`
    // Só a imagem (a capa ou uma do texto público) com o nome da página: o handout de um NPC, item ou
    // local. Só vale a imagem que a página de fato tem; o jogador nunca recebe a de um trecho do mestre.
    const only = typeof body.image === 'string' && body.image ? body.image : null
    if (only && only !== page.image && !page.bodyPublic.includes(`](${only}`)) return fail(400, 'Imagem inválida')
    if (only && !validImage(only)) return fail(400, 'Imagem inválida')
    const reveal = cleanReveal({
        id: body.reveal,
        title: page.title.slice(0, 120),
        markdown: only ? '' : markdown || page.summary,
        image: only ?? (page.image && validImage(page.image) ? page.image : null),
        source: page.id,
    })
    if (!reveal) return fail(400, 'Nada para mostrar')
    const share = sanitizeShare({ id: reveal.id, by: body.by, color: body.color, type: 'handout', name: reveal.title, ref: reveal.id })
    if (!share) return fail(400, 'Compartilhamento inválido')
    await addReveal(mesa, reveal, userId)
    const rev = await addShare(mesa, share, userId)
    return ok({ rev, share })
}
