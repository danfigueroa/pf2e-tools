// O Markdown do Diário de Campanha tem duas marcas próprias, resolvidas ANTES de
// o texto ir ao `react-markdown`:
//
//   :::jogadores Título            um trecho para os jogadores (texto lido em voz
//   …                              alta, carta, descrição): na prévia ganha o botão
//   :::                            de compartilhar; o resto da página segue secreto
//
//   [[Nome]]                       link para a ficha do catálogo com esse nome
//   [[Nome|rótulo]]                o mesmo link, mostrando "rótulo"
//   [[wiki:Nome]]                  no Diário, força a página da Wiki com esse nome
//
// E a Wiki da Mesa tem a sua (a página só chega com ela ao GM — o servidor a corta para o jogador):
//
//   :::mestre Título               um segredo do GM dentro de uma página da Wiki (`:::gm` em inglês)
//   …
//   :::
//
// E o alinhamento do texto, em linha própria, vale dali até a próxima marca (ou o fim da página):
//
//   ::centro   ::direita   ::esquerda   ::justificar     (em inglês: ::center ::right ::left ::justify)
//
// Duas vírgulas-pontos, não três: não conflita com `:::` (blocos), nem o servidor as vê como segredo.
//
// Puro, sem React: o diário também o usa para achar os nomes citados.

export interface MdSegment {
    kind: 'text' | 'players' | 'gm'
    text: string
    /** Só `players`/`gm`: o que vem depois de `:::jogadores`/`:::mestre` (pode ser vazio). */
    title?: string
}

// `:::players` é o mesmo bloco, para quem usa a plataforma em inglês (os dois valem sempre).
const OPEN_RE = /^:::[ \t]*(?:jogadores|players)\b[ \t]*(.*)$/i
// O segredo do GM na Wiki: o mesmo `OPEN_RE` de `api/_lib/wiki-secrets.js`.
const GM_OPEN_RE = /^:::[ \t]*(?:mestre|gm)\b[ \t]*(.*)$/i
const CLOSE_RE = /^:::[ \t]*$/
const FENCE_RE = /^(```|~~~)/

/**
 * Separa o texto nos trechos para os jogadores, nos segredos do GM e no resto. Bloco sem `:::` de
 * fechamento vai até o fim.
 */
export function splitSegments(source: string): MdSegment[] {
    const out: MdSegment[] = []
    let text: string[] = []
    let block: string[] | null = null
    let blockKind: 'players' | 'gm' = 'players'
    let title = ''
    let fenced = false
    const flushText = () => {
        if (text.join('').trim()) out.push({ kind: 'text', text: text.join('\n') })
        text = []
    }
    for (const line of source.split('\n')) {
        // Dentro de um bloco de código, `:::` é só texto.
        if (FENCE_RE.test(line.trim())) fenced = !fenced
        if (block) {
            if (!fenced && CLOSE_RE.test(line.trim())) {
                out.push({ kind: blockKind, title, text: block.join('\n') })
                block = null
            } else block.push(line)
            continue
        }
        const players = fenced ? null : line.trim().match(OPEN_RE)
        const gm = fenced || players ? null : line.trim().match(GM_OPEN_RE)
        const open = players ?? gm
        if (open) {
            flushText()
            block = []
            blockKind = players ? 'players' : 'gm'
            title = open[1].trim()
        } else text.push(line)
    }
    if (block) out.push({ kind: blockKind, title, text: block.join('\n') })
    flushText()
    return out
}

export const WIKI_RE = /\[\[([^[\]\n]{1,120})\]\]/g
export const WIKI_HREF = '#journal:'

/** O nome para onde um `[[…]]` aponta, como foi escrito (com o `wiki:`, se houver). */
export const linkTarget = (inner: string) => inner.split('|')[0].trim()

/** O nome sem o `wiki:` — o mesmo `linkTarget` de `api/_lib/wiki-secrets.js`. */
export const linkName = (target: string) => target.replace(/^wiki:/i, '').trim()

/** O que aparece no texto: o rótulo de `[[Nome|rótulo]]`, senão o nome sem o `wiki:`. */
export function linkLabel(inner: string): string {
    const bar = inner.indexOf('|')
    const label = bar >= 0 ? inner.slice(bar + 1).trim() : ''
    return label || linkName(linkTarget(inner))
}

/** `[[Nome]]` → `[Nome](#journal:Nome)`, que o componente desenha como link do catálogo. */
export const withWikiLinks = (text: string) =>
    text.replace(WIKI_RE, (_, inner: string) => `[${linkLabel(inner)}](${WIKI_HREF}${encodeURIComponent(linkTarget(inner))})`)

/** Os nomes citados com `[[…]]`, sem repetição (com o `wiki:`, se houver). */
export function wikiNames(text: string): string[] {
    const names = new Set<string>()
    for (const m of text.matchAll(WIKI_RE)) names.add(linkTarget(m[1]))
    return [...names]
}

/** O texto do trecho para os jogadores sem as marcas do diário (`[[Nome]]` vira só o nome). */
export const forPlayers = (text: string) => text.replace(WIKI_RE, (_, inner: string) => linkLabel(inner)).trim()

/** Só os trechos `:::jogadores` (o que pode sair do Diário), separados por linha em branco. */
export const playersText = (source: string) =>
    splitSegments(source).filter((s) => s.kind === 'players').map((s) => forPlayers(s.text)).join('\n\n').trim()

/** Minúsculas, sem acento, espaços juntados: a dobra de `fold` em `api/_lib/wiki-secrets.js`. */
export const foldName = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

export type TextAlign = 'left' | 'right' | 'center' | 'justify'

const ALIGN_WORDS: Record<string, TextAlign> = {
    esquerda: 'left', left: 'left', direita: 'right', right: 'right',
    centro: 'center', centralizar: 'center', center: 'center', justificar: 'justify', justificado: 'justify', justify: 'justify',
}
const ALIGN_RE = /^::[ \t]*([a-z]+)[ \t]*$/i

/** A marca de alinhamento da linha, ou `null` (linha comum). */
export const alignMark = (line: string): TextAlign | null => {
    const m = line.trim().match(ALIGN_RE)
    return m ? ALIGN_WORDS[m[1].toLowerCase()] ?? null : null
}

/**
 * Parte o texto nos trechos de cada alinhamento. `start` é o alinhamento em vigor ao começar (uma marca
 * vale também depois de um bloco `:::`). Dentro de bloco de código, `::centro` é só texto.
 */
export function splitAlign(text: string, start: TextAlign | null): { align: TextAlign | null; text: string }[] {
    const out: { align: TextAlign | null; text: string }[] = []
    let align = start
    let lines: string[] = []
    let fenced = false
    const flush = () => {
        if (lines.join('').trim()) out.push({ align, text: lines.join('\n') })
        lines = []
    }
    for (const line of text.split('\n')) {
        if (FENCE_RE.test(line.trim())) fenced = !fenced
        const mark = fenced ? null : alignMark(line)
        if (mark) { flush(); align = mark } else lines.push(line)
    }
    flush()
    return out
}

/** O alinhamento em vigor depois deste texto. */
export function alignAtEnd(text: string, start: TextAlign | null): TextAlign | null {
    let align = start
    let fenced = false
    for (const line of text.split('\n')) {
        if (FENCE_RE.test(line.trim())) fenced = !fenced
        const mark = fenced ? null : alignMark(line)
        if (mark) align = mark
    }
    return align
}

/** Âncora de um título (`## Aparência e personalidade` → `aparencia-e-personalidade`). */
export const headingSlug = (text: string) => foldName(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Os títulos `##`/`###` do texto (menos os dos blocos `:::` e dos blocos de código), para o sumário. */
export function headingsOf(source: string): { level: 2 | 3; text: string; id: string }[] {
    const out: { level: 2 | 3; text: string; id: string }[] = []
    for (const seg of splitSegments(source)) {
        if (seg.kind !== 'text') continue
        let fenced = false
        for (const line of seg.text.split('\n')) {
            if (FENCE_RE.test(line.trim())) fenced = !fenced
            const m = fenced ? null : line.match(/^(#{2,3})[ \t]+(.+?)[ \t#]*$/)
            if (!m) continue
            const text = m[2].replace(WIKI_RE, (_, inner: string) => linkLabel(inner)).replace(/[*_`~]/g, '').trim()
            if (text) out.push({ level: m[1].length as 2 | 3, text, id: headingSlug(text) })
        }
    }
    return out
}
