// A página da Wiki criada a partir de uma ficha do catálogo do Diário ("Criar na Wiki a partir desta").
// Puro, no `check-rolls`. Nada se perde: o que não vai para os jogadores vira trecho `:::mestre`, que a
// Wiki guarda para o GM e o servidor corta de tudo que o jogador recebe.

import { splitSegments } from '../../components/markdown/blocks'

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

/** O mínimo que a página precisa da ficha: o tipo `WikiPage` sem depender do serviço (o teste roda no Node). */
interface PageLike { body: string; image: string | null; tags: string[] }

/**
 * A página da Wiki atualizada pela ficha: o texto é o da ficha (`wikiBodyFrom`); a imagem, a da ficha
 * quando ela tem uma, senão a que a página já tinha; as etiquetas se somam. Título, apelidos, infobox e
 * página-mãe ficam como estão na Wiki — podem ter sido ajustados lá para os jogadores.
 */
export function updatedPage<P extends PageLike>(page: P, md: string, cover: string | null, tags: string[], share: WikiShare, open?: string): P {
    const body = wikiBodyFrom(md, share, open)
    return {
        ...page,
        body,
        image: wikiCover(cover, body) ?? page.image,
        tags: [...new Set([...page.tags, ...tags])],
    }
}
