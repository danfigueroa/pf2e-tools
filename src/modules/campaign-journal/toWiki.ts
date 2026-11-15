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
