// As transformações de texto da barra do editor de Markdown (`MarkdownEditor`), puras e sem React:
// cada uma recebe o texto e a seleção e devolve a troca a fazer — o trecho `[from, to)` vira `insert`,
// e a seleção nova `[selStart, selEnd)` já é no texto novo. O componente só aplica a troca.
// Testadas no `check-rolls`.

import { alignMark, type TextAlign } from './blocks'

export interface TextEdit {
    from: number
    to: number
    insert: string
    selStart: number
    selEnd: number
}

const lineStartOf = (v: string, pos: number) => v.lastIndexOf('\n', pos - 1) + 1
const lineEndOf = (v: string, pos: number) => {
    const nl = v.indexOf('\n', pos)
    return nl < 0 ? v.length : nl
}

/** O fim da seleção, sem a quebra de linha final (linhas inteiras selecionadas não pegam a de baixo). */
const trimEnd = (v: string, s: number, e: number) => (e > s && v[e - 1] === '\n' ? e - 1 : e)

/**
 * Marca em volta da seleção (`**`, `_`, `~~`). Se ela já está marcada — por dentro ou logo por fora —,
 * tira a marca em vez de dobrá-la. Sem seleção, entra o `fallback`, selecionado para ser trocado.
 */
export function toggleWrap(v: string, s: number, e: number, mark: string, fallback: string): TextEdit {
    const sel = v.slice(s, e)
    const n = mark.length
    if (sel.length >= 2 * n && sel.startsWith(mark) && sel.endsWith(mark)) {
        const inner = sel.slice(n, -n)
        return { from: s, to: e, insert: inner, selStart: s, selEnd: s + inner.length }
    }
    // Por fora só com seleção: um cursor entre `**a**|**b**` não junta os dois.
    if (sel && v.slice(s - n, s) === mark && v.slice(e, e + n) === mark) {
        return { from: s - n, to: e + n, insert: sel, selStart: s - n, selEnd: s - n + sel.length }
    }
    const inner = sel || fallback
    return { from: s, to: e, insert: mark + inner + mark, selStart: s + n, selEnd: s + n + inner.length }
}

/** As linhas tocadas pela seleção: `[início da primeira, fim da última)`. */
function linesOf(v: string, s: number, e: number) {
    const from = lineStartOf(v, s)
    const to = lineEndOf(v, trimEnd(v, s, e))
    return { from, to, lines: v.slice(from, to).split('\n') }
}

const HEADING_RE = /^#{1,6}[ \t]+/

/** Título da linha: `level` 2 (`##`), 3 (`###`) ou 0 (texto normal). Troca o nível, não empilha `#`. */
export function setHeading(v: string, s: number, e: number, level: 0 | 2 | 3): TextEdit {
    const { from, to, lines } = linesOf(v, s, e)
    const prefix = level ? `${'#'.repeat(level)} ` : ''
    const insert = lines.map((l) => (l.trim() ? prefix + l.replace(HEADING_RE, '') : l)).join('\n')
    return { from, to, insert, selStart: from, selEnd: from + insert.length }
}

export type LineKind = 'bullet' | 'number' | 'task' | 'quote'

const PREFIX_RE = /^([ \t]*)(>[ \t]?|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)/

function kindOf(prefix: string): LineKind {
    if (prefix.startsWith('>')) return 'quote'
    if (/^\d/.test(prefix)) return 'number'
    return prefix.includes('[') ? 'task' : 'bullet'
}

/**
 * Lista, numerada, tarefas ou citação nas linhas da seleção. Se todas já são desse tipo, o prefixo sai;
 * senão, o prefixo de outro tipo é trocado (não empilha `- 1. `). A numerada é contada de 1. Linhas em
 * branco ficam como estão, menos quando a seleção é só uma linha vazia (o cursor onde começa a lista).
 */
export function toggleLines(v: string, s: number, e: number, kind: LineKind): TextEdit {
    const { from, to, lines } = linesOf(v, s, e)
    const filled = lines.filter((l) => l.trim())
    const all = filled.length > 0 && filled.every((l) => {
        const m = l.match(PREFIX_RE)
        return m !== null && kindOf(m[2]) === kind
    })
    let n = 0
    const insert = lines.map((l) => {
        if (!l.trim() && filled.length) return l
        const m = l.match(PREFIX_RE)
        const indent = m ? m[1] : l.match(/^[ \t]*/)![0]
        const body = m ? l.slice(m[0].length) : l.slice(indent.length)
        if (all) return indent + body
        n++
        const prefix = kind === 'bullet' ? '- ' : kind === 'task' ? '- [ ] ' : kind === 'quote' ? '> ' : `${n}. `
        return indent + prefix + body
    }).join('\n')
    // Uma linha só: o cursor vai para o fim dela (é onde se continua a escrever).
    const single = lines.length === 1
    return { from, to, insert, selStart: single ? from + insert.length : from, selEnd: from + insert.length }
}

/**
 * Um bloco `:::` em volta do trecho selecionado. As marcas precisam de linha própria, então a linha é
 * partida em volta da seleção: o que vem antes e depois fica onde estava, e só o trecho entra no bloco.
 * Para o jogador, o antes e o depois voltam a ser a mesma frase (linhas seguidas, sem linha em branco,
 * são um parágrafo só no Markdown). Sem seleção, entra o `fallback`. Com `title`, ele vai depois da
 * marca e é ele que fica selecionado (para ser trocado); senão, o texto de dentro.
 *
 * Quem chama confere antes o `blockInRange`: bloco dentro de bloco quebra o parse.
 */
export function wrapBlock(v: string, s: number, e0: number, open: string, fallback: string, title = ''): TextEdit {
    const e = trimEnd(v, s, e0)
    const lineStart = lineStartOf(v, s)
    const lineEnd = lineEndOf(v, e)
    const inner = v.slice(s, e).trim() || fallback
    const before = v.slice(lineStart, s).trimEnd()
    const after = v.slice(e, lineEnd).trimStart()
    const pre = before ? `${before}\n` : ''
    const head = `${pre}${open}${title ? ` ${title}` : ''}\n`
    const insert = `${head}${inner}\n:::${after ? `\n${after}` : ''}`
    const titleAt = lineStart + pre.length + open.length + 1
    return title
        ? { from: lineStart, to: lineEnd, insert, selStart: titleAt, selEnd: titleAt + title.length }
        : { from: lineStart, to: lineEnd, insert, selStart: lineStart + head.length, selEnd: lineStart + head.length + inner.length }
}

/** As palavras da marca de alinhamento, em português e inglês (as duas valem sempre). */
export const ALIGN_WORD: Record<'pt' | 'en', Record<TextAlign, string>> = {
    pt: { left: 'esquerda', right: 'direita', center: 'centro', justify: 'justificar' },
    en: { left: 'left', right: 'right', center: 'center', justify: 'justify' },
}

/**
 * Alinha as linhas da seleção: uma marca `::centro` antes e a do alinhamento padrão (`rest`) depois — a
 * menos que já haja uma marca ali, que é trocada/mantida —, para o alinhamento não vazar para o resto.
 */
export function alignLines(v: string, s: number, e0: number, mode: TextAlign, rest: TextAlign, words = ALIGN_WORD.pt): TextEdit {
    const e = trimEnd(v, s, e0)
    const lineStart = lineStartOf(v, s)
    const lineEnd = lineEndOf(v, e)
    const prevStart = lineStart > 0 ? lineStartOf(v, lineStart - 1) : 0
    const hasPrev = lineStart > 0 && alignMark(v.slice(prevStart, lineStart - 1)) !== null
    const nextEnd = lineEnd < v.length ? lineEndOf(v, lineEnd + 1) : lineEnd
    const hasNext = lineEnd < v.length && alignMark(v.slice(lineEnd + 1, nextEnd)) !== null
    const from = hasPrev ? prevStart : lineStart
    const body = v.slice(lineStart, lineEnd)
    const head = `::${words[mode]}\n`
    const insert = `${head}${body}${hasNext ? '' : `\n::${words[rest]}`}`
    return { from, to: lineEnd, insert, selStart: from + head.length, selEnd: from + head.length + body.length }
}

/**
 * Um bloco inteiro (tabela, divisória, modelo, imagem) no cursor, com linha em branco antes e depois —
 * sem ela, `---` logo abaixo de um texto vira título e a linha seguinte a uma tabela vira linha dela.
 * `select` é o trecho do `snippet` que fica selecionado (`[início, fim)`); sem ele, o cursor vai para o fim.
 */
export function insertBlock(v: string, s: number, e: number, snippet: string, select?: [number, number]): TextEdit {
    const before = v.slice(0, s)
    const after = v.slice(e)
    const padBefore = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
    const padAfter = !after ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const insert = padBefore + snippet + padAfter
    const at = s + padBefore.length
    const [a, b] = select ?? [snippet.length, snippet.length]
    return { from: s, to: e, insert, selStart: at + a, selEnd: at + b }
}

/** O esqueleto de uma tabela de duas colunas, com o primeiro cabeçalho selecionado. */
export function tableSnippet(col: string, cell = ''): { snippet: string; select: [number, number] } {
    const snippet = `| ${col} | ${col} |\n| --- | --- |\n| ${cell} | ${cell} |`
    return { snippet, select: [2, 2 + col.length] }
}

/**
 * Citação com assinatura (`> — Nome` em parágrafo próprio; a Wiki a desenha como assinatura). Com seleção,
 * as linhas dela viram a citação; sem, o `fallback`. A assinatura fica selecionada.
 */
export function quoteWithSignature(v: string, s: number, e0: number, fallback: string, who: string): TextEdit {
    const e = trimEnd(v, s, e0)
    const sel = v.slice(s, e).trim()
    const body = (sel || fallback).split('\n').map((l) => `> ${l.replace(/^>[ \t]?/, '')}`.trimEnd()).join('\n')
    const snippet = `${body}\n>\n> — ${who}`
    const at = snippet.length - who.length
    return insertBlock(v, s, e, snippet, [at, snippet.length])
}
