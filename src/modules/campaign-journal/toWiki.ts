// A página da Wiki criada a partir de uma ficha do catálogo do Diário ("Criar na Wiki a partir desta").
// Puro, no `check-rolls`. Nada se perde: o que não vai para os jogadores vira trecho `:::mestre`, que a
// Wiki guarda para o GM e o servidor corta de tudo que o jogador recebe.

import { foldName, splitSegments } from '../../components/markdown/blocks'
import type { CatalogDoc, JournalSummary } from './doc'

/**
 * `all`: todo o texto fica visível aos jogadores, menos os trechos "Só o mestre".
 * `players`: só as caixas `:::jogadores` ficam visíveis; o resto vai como "Só o mestre".
 */
export type WikiShare = 'all' | 'players'

/**
 * O corpo da página. A caixa `:::jogadores` vira texto comum (o título dela, em negrito, por cima);
 * `open` é a marca do trecho do mestre (`:::mestre`, ou `:::gm` em inglês — as duas valem).
 */
export function wikiBodyFrom(md: string, share: WikiShare, open = ':::mestre'): string { // i18n-ok
    const parts: string[] = []
    const secret = (title: string, text: string) => `${open}${title ? ` ${title}` : ''}\n${text}\n:::`
    for (const seg of splitSegments(md)) {
        const text = seg.text.trim()
        if (!text) continue
        if (seg.kind === 'players') parts.push(seg.title ? `**${seg.title}**\n\n${text}` : text)
        else if (seg.kind === 'gm') parts.push(secret(seg.title ?? '', text))
        else parts.push(share === 'all' ? text : secret('', text))
    }
    return parts.join('\n\n')
}

/** O que os jogadores leem da página (sem os trechos do mestre): a prévia e de onde sai a capa. */
export const publicPart = (body: string) =>
    splitSegments(body).filter((s) => s.kind !== 'gm').map((s) => s.text.trim()).filter(Boolean).join('\n\n')

/** Quantos trechos do mestre o corpo tem. */
export const secretCount = (body: string) => splitSegments(body).filter((s) => s.kind === 'gm').length

/** A primeira imagem do texto (`![…](url)`), ou `null`. */
export function firstImage(text: string): string | null {
    const m = text.match(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/)
    return m ? m[1] : null
}

/**
 * A capa da página: a da ficha; sem ela, a primeira imagem da parte que os jogadores leem (nunca uma
 * de trecho do mestre: a capa vai para todos, e o "Mostrar à mesa" da Wiki a usa).
 */
export const wikiCover = (cover: string | null, body: string) => cover ?? firstImage(publicPart(body))

export interface DiffLine { kind: 'same' | 'add' | 'del'; text: string }

/** Acima disto (linhas × linhas), a diferença vira "tudo saiu, tudo entrou": a tabela não cabe. */
const DIFF_MAX_CELLS = 4_000_000

/**
 * A diferença por linha entre o texto de antes e o de depois (a maior subsequência comum). É só para o
 * GM ver o que a atualização apaga da Wiki antes de confirmar.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
    const a = before ? before.split('\n') : []
    const b = after ? after.split('\n') : []
    const n = a.length
    const m = b.length
    if ((n + 1) * (m + 1) > DIFF_MAX_CELLS) {
        return [...a.map((text) => ({ kind: 'del' as const, text })), ...b.map((text) => ({ kind: 'add' as const, text }))]
    }
    // lcs[i][j] = maior subsequência comum de a[i..] e b[j..], numa tabela só.
    const w = m + 1
    const lcs = new Uint32Array((n + 1) * w)
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1])
        }
    }
    const out: DiffLine[] = []
    let i = 0
    let j = 0
    while (i < n && j < m) {
        if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++ }
        else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) out.push({ kind: 'del', text: a[i++] })
        else out.push({ kind: 'add', text: b[j++] })
    }
    while (i < n) out.push({ kind: 'del', text: a[i++] })
    while (j < m) out.push({ kind: 'add', text: b[j++] })
    return out
}

/** A ficha do catálogo, no que ela leva à Wiki. `parentWiki`: a página ligada à ficha-mãe, se houver. */
export interface EntryLike {
    kind: string
    title: string
    image: string | null
    md: string
    tags: string[]
    aliases: string[]
    summary: string
    fields: Record<string, string>
    aon: unknown
    parentWiki: string | null
}

/** A ficha aberta como `EntryLike`; a página-mãe é a da ficha-mãe na lista, se ela estiver ligada à Wiki. */
export function entryOf(doc: CatalogDoc, docs: readonly JournalSummary[]): EntryLike & { kind: CatalogDoc['kind']; aon: CatalogDoc['data']['aon'] } {
    const d = doc.data
    return {
        kind: doc.kind, title: doc.title, image: d.image, md: d.md, tags: d.tags, aliases: d.aliases, summary: d.summary,
        fields: d.fields, aon: d.aon, parentWiki: d.parent ? docs.find((x) => x.id === d.parent)?.wiki ?? null : null,
    }
}

export interface ShareOptions {
    share: WikiShare
    /** A marca do trecho do mestre (`:::mestre`, ou `:::gm` em inglês). */
    open?: string
    /**
     * A ficha rápida, o resumo e a ficha da AON vão? A Wiki não tem segredo por campo: o que vai, os
     * jogadores leem (o texto, não — o que não é deles vira `:::mestre`).
     */
    facts: boolean
    /** Os apelidos vão? Mesmo motivo: um apelido pode ser o segredo ("o Rei disfarçado"). */
    aliases: boolean
}

/** O mínimo que a página precisa: o tipo `WikiPage` sem depender do serviço (o teste roda no Node). */
interface PageLike {
    kind: string
    title: string
    aliases: string[]
    summary: string
    fields: Record<string, string>
    aon: unknown
    parent: string | null
    body: string
    image: string | null
    tags: string[]
}

const MAX_ALIASES = 10
const uniqueNames = (names: string[], title: string) => {
    const seen = new Set([foldName(title)])
    return names.filter((n) => {
        const k = foldName(n)
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
    }).slice(0, MAX_ALIASES)
}

/** A página nova a partir da ficha: tudo o que a ficha tem, menos o que o GM escolheu não levar. */
export function pageFrom<E extends EntryLike>(entry: E, opts: ShareOptions) {
    const body = wikiBodyFrom(entry.md, opts.share, opts.open)
    return {
        kind: entry.kind as E['kind'],
        title: entry.title,
        aliases: opts.aliases ? uniqueNames(entry.aliases, entry.title) : [],
        summary: opts.facts ? entry.summary : '',
        fields: opts.facts ? { ...entry.fields } : {},
        aon: (opts.facts ? entry.aon ?? null : null) as E['aon'] | null,
        parent: entry.parentWiki,
        tags: [...entry.tags],
        image: wikiCover(entry.image, body),
        body,
    }
}

/**
 * A página da Wiki atualizada pela ficha: vai tudo o que `pageFrom` levaria (o que o GM não leva fica
 * como está na Wiki). Imagem: a da ficha quando ela tem uma, senão a de lá; etiquetas se somam; a
 * página-mãe só muda quando a ficha-mãe está ligada. Título trocado: o antigo vira apelido, para os
 * `[[ ]]` que já o citam continuarem achando a página.
 */
export function updatedPage<P extends PageLike>(page: P, entry: EntryLike, opts: ShareOptions): P {
    const from = pageFrom(entry, opts)
    const renamed = foldName(page.title) !== foldName(from.title)
    const aliases = [...(opts.aliases ? from.aliases : page.aliases), ...(renamed ? [page.title] : [])]
    return {
        ...page,
        kind: from.kind,
        title: from.title,
        aliases: uniqueNames(aliases, from.title),
        summary: opts.facts ? from.summary : page.summary,
        fields: opts.facts ? from.fields : page.fields,
        aon: opts.facts ? from.aon : page.aon,
        parent: from.parent ?? page.parent,
        body: from.body,
        image: from.image ?? page.image,
        tags: [...new Set([...page.tags, ...from.tags])],
    }
}

/** O que muda fora do texto, campo a campo (`key`: `kind`, `title`, `summary`, `aliases`, `aon`, `parent`, `image`, `tags` ou `field:<chave>`). */
export interface MetaChange { key: string; before: string; after: string }

const aonName = (v: unknown) => (v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string' ? (v as { name: string }).name : '')

export function metaChanges(before: PageLike, after: PageLike): MetaChange[] {
    const out: MetaChange[] = []
    const push = (key: string, a: string, b: string) => { if (a !== b) out.push({ key, before: a, after: b }) }
    push('kind', before.kind, after.kind)
    push('title', before.title, after.title)
    push('summary', before.summary, after.summary)
    push('aliases', before.aliases.join(', '), after.aliases.join(', '))
    for (const key of [...new Set([...Object.keys(before.fields), ...Object.keys(after.fields)])]) {
        push(`field:${key}`, before.fields[key] ?? '', after.fields[key] ?? '')
    }
    push('aon', aonName(before.aon), aonName(after.aon))
    push('parent', before.parent ?? '', after.parent ?? '')
    push('image', before.image ?? '', after.image ?? '')
    push('tags', before.tags.join(', '), after.tags.join(', '))
    return out
}
